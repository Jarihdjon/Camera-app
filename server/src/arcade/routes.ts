import type { FastifyPluginAsync } from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { z } from "zod";
import { SKILLS } from "@yav/shared";
import type { DB } from "../db/db.js";
import { getSetting, setSetting } from "../db/settings.js";
import { checkParentToken } from "../auth.js";
import { addEmbedGame, addH5pGame, CATEGORIES, finishPlay, listGames, logMessage, removeGame, seedSample, startPlay } from "./arcade.js";
import { config } from "../config.js";

interface Opts { db: DB; h5pRoot: string }

/** Where the H5P player's own files are (the h5p-standalone package). */
function h5pPlayerDir(): string | null {
  try {
    const pkg = createRequire(import.meta.url).resolve("h5p-standalone/package.json");
    return path.join(path.dirname(pkg), "dist");
  } catch {
    return null;
  }
}

/**
 * For the iPad:
 *   GET  /api/arcade                      the shelf
 *   POST /api/arcade/:id/start            → { playId }
 *   POST /api/arcade/play/:playId/finish  { score?, max? } → reward
 *   POST /api/arcade/:id/message          what an embedded game said (logged for the parent)
 *   GET  /api/h5p-content/<id>/…          unpacked H5P games
 *   GET  /api/h5p-player/…                the H5P player
 */
export const arcadeRoutes: FastifyPluginAsync<Opts> = async (app, { db, h5pRoot }) => {
  mkdirSync(h5pRoot, { recursive: true });
  seedSample(db, h5pRoot, path.join(config.contentBank, "..", "arcade", "number-sums"));
  await app.register(fastifyStatic, { root: h5pRoot, prefix: "/h5p-content/", decorateReply: false });
  const player = h5pPlayerDir();
  if (player && existsSync(player)) await app.register(fastifyStatic, { root: player, prefix: "/h5p-player/", decorateReply: false });

  app.get("/arcade", async () =>
    listGames(db).map((g) => ({ id: g.id, kind: g.kind, title: g.title, category: g.category, url: g.url, folder: g.folder, plays: g.plays, best: g.best, rewardedToday: Boolean(g.rewardedToday) })));

  app.post("/arcade/:id/start", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return startPlay(db, id) ?? reply.code(404).send({ error: "no such game" });
  });

  app.post("/arcade/play/:playId/finish", async (req, reply) => {
    const { playId } = z.object({ playId: z.string() }).parse(req.params);
    const body = z.object({ score: z.number().min(0).optional(), max: z.number().positive().optional() }).parse(req.body ?? {});
    const r = finishPlay(db, playId, body, { perUnit: getSetting(db, "minutesPerUnit"), cap: getSetting(db, "dailyUnitCap") });
    if (!r) return reply.code(409).send({ error: "already finished" });
    const gems = (db.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM wallet_entry WHERE currency = 'gems'").get() as { n: number }).n;
    return { ...r, wallet: { gems } };
  });

  app.post("/arcade/:id/message", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ origin: z.string().max(200), data: z.string().max(4000) }).parse(req.body);
    logMessage(db, id, body.origin, body.data);
    return { ok: true };
  });
};

const SkillId = z.enum(Object.keys(SKILLS) as [string, ...string[]]);

/** For the parent (needs the PIN): add, change and remove games, and the trusted sites list. */
export const arcadeParentRoutes: FastifyPluginAsync<Opts> = async (app, { db, h5pRoot }) => {
  app.addHook("onRequest", async (req, reply) => {
    if (!checkParentToken(req.cookies.parent)) return reply.code(401).send({ error: "PIN required" });
  });

  app.get("/", async () => ({
    games: listGames(db, true),
    hosts: getSetting(db, "arcadeHosts"),
    messages: db.prepare("SELECT m.game_id, g.title, m.origin, m.data, m.created_at FROM arcade_message m JOIN arcade_game g ON g.id = m.game_id ORDER BY m.id DESC LIMIT 50").all(),
    skills: Object.keys(SKILLS),
  }));

  app.post("/", async (req, reply) => {
    const body = z.object({ link: z.string().min(1).max(5000), title: z.string().trim().min(1).max(60), category: z.enum(CATEGORIES), skill: SkillId.nullable().optional() }).parse(req.body);
    const r = addEmbedGame(db, body.link, body.title, body.category, body.skill ?? null);
    return "error" in r ? reply.code(400).send(r) : r;
  });

  app.post("/h5p", async (req, reply) => {
    const file = await req.file({ limits: { fileSize: 80 * 1024 * 1024 } });
    if (!file) return reply.code(400).send({ error: "no file" });
    const buf = await file.toBuffer();
    if (file.file.truncated) return reply.code(413).send({ error: "That H5P file is too big (80 MB max)." });
    const field = (k: string) => {
      const f = file.fields[k];
      return f && typeof f === "object" && "value" in f ? String(f.value) : "";
    };
    const category = z.enum(CATEGORIES).safeParse(field("category"));
    const skill = field("skill") ? SkillId.safeParse(field("skill")) : null;
    if (!category.success || (skill && !skill.success)) return reply.code(400).send({ error: "Pick a category (and a valid skill)." });
    const r = addH5pGame(db, buf, h5pRoot, field("title").trim().slice(0, 60) || null, category.data, skill?.success ? skill.data : null);
    return "error" in r ? reply.code(400).send(r) : r;
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({
      title: z.string().trim().min(1).max(60).optional(),
      category: z.enum(CATEGORIES).optional(),
      skill: SkillId.nullable().optional(),
      hidden: z.boolean().optional(),
      sort: z.number().int().optional(),
    }).parse(req.body);
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    for (const [k, v] of Object.entries(body)) {
      sets.push(`${k} = ?`);
      vals.push(typeof v === "boolean" ? Number(v) : (v as string | number | null));
    }
    if (!sets.length) return { ok: true };
    const res = db.prepare(`UPDATE arcade_game SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
    return res.changes ? { ok: true } : reply.code(404).send({ error: "no such game" });
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return removeGame(db, id, h5pRoot) ? { ok: true } : reply.code(404).send({ error: "no such game" });
  });

  app.put("/hosts", async (req) => {
    const { hosts } = z.object({ hosts: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)).max(50) }).parse(req.body);
    setSetting(db, "arcadeHosts", [...new Set(hosts)]);
    return { hosts: getSetting(db, "arcadeHosts") };
  });
};
