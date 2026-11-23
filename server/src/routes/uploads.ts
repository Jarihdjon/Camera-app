import type { FastifyPluginAsync } from "fastify";
import { createWriteStream, createReadStream, mkdirSync, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import type { DB } from "../db/db.js";
import { paths } from "../config.js";

const EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/heic": ".heic", "image/webp": ".webp" };

/** Photos of handwriting stay on the PC. No AI ever sees them. */
export const uploadRoutes: FastifyPluginAsync<{ db: DB }> = async (app, { db }) => {
  app.post("/uploads", async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "no file" });
    const ext = EXT[file.mimetype];
    if (!ext) return reply.code(415).send({ error: "photos only" });
    const activityId = typeof file.fields.activityId === "object" && "value" in file.fields.activityId ? String(file.fields.activityId.value) : null;

    const id = randomUUID();
    const dir = paths.uploads();
    mkdirSync(dir, { recursive: true });
    const fileName = `${new Date().toISOString().slice(0, 10)}_${id}${ext}`;
    await pipeline(file.file, createWriteStream(path.join(dir, fileName)));
    if (file.file.truncated) return reply.code(413).send({ error: "photo too big" });

    db.prepare("INSERT INTO upload (id, activity_id, file_name) VALUES (?, ?, ?)").run(id, activityId, fileName);
    db.prepare("INSERT INTO journal_entry (kind, title, ref) VALUES ('writing', 'A page of writing', ?)").run(id);
    db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES ('gems', 3, ?)").run(`upload:${id}`);
    return { id, unlocked: true };
  });

  app.get("/uploads/:id/file", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const row = db.prepare("SELECT file_name FROM upload WHERE id = ?").get(id) as { file_name: string } | undefined;
    const full = row && path.join(paths.uploads(), path.basename(row.file_name));
    if (!full || !existsSync(full)) return reply.code(404).send({ error: "not found" });
    return reply.type(Object.entries(EXT).find(([, e]) => full.endsWith(e))?.[0] ?? "application/octet-stream").send(createReadStream(full));
  });
};
