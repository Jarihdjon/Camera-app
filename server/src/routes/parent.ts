import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { DB } from "../db/db.js";
import { getSetting, setSetting } from "../db/settings.js";
import { checkParentToken, hashPin, issueParentToken, verifyPin } from "../auth.js";
import { spendThisMonthAud } from "../ai/spend.js";
import { config } from "../config.js";

const COOKIE = "parent";

export const parentRoutes: FastifyPluginAsync<{ db: DB }> = async (app, { db }) => {
  app.post("/login", async (req, reply) => {
    const { pin } = z.object({ pin: z.string().min(4).max(12) }).parse(req.body);
    if (!verifyPin(pin, getSetting(db, "parentPinHash"))) return reply.code(401).send({ error: "wrong PIN" });
    return reply.setCookie(COOKIE, issueParentToken(), { httpOnly: true, sameSite: "strict", path: "/api/parent" }).send({ ok: true });
  });

  // Everything below needs the PIN.
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.endsWith("/login")) return;
    if (!checkParentToken(req.cookies[COOKIE])) return reply.code(401).send({ error: "PIN required" });
  });

  app.get("/review-queue", async () =>
    db.prepare("SELECT id, activity_id, created_at, review_status, parent_comment FROM upload ORDER BY review_status = 'pending' DESC, created_at DESC LIMIT 100").all());

  app.post("/uploads/:id/review", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ status: z.enum(["thumbs-up", "redo"]), comment: z.string().max(500).optional() }).parse(req.body);
    // A redo never removes rewards already earned.
    db.prepare("UPDATE upload SET review_status=?, parent_comment=?, reviewed_at=datetime('now') WHERE id=?").run(body.status, body.comment ?? null, id);
    return { ok: true };
  });

  app.get("/settings", async () => ({
    minutesPerUnit: getSetting(db, "minutesPerUnit"),
    dailyUnitCap: getSetting(db, "dailyUnitCap"),
    freeBuildMinutes: getSetting(db, "freeBuildMinutes"),
    monthlySpendCapAud: getSetting(db, "monthlySpendCapAud"),
    claudeModel: getSetting(db, "claudeModel"),
    pinnedSkills: getSetting(db, "pinnedSkills"),
    pinnedTopics: getSetting(db, "pinnedTopics"),
    // The key itself never leaves the PC; only whether one is set.
    claudeConfigured: Boolean(config.anthropicKey),
    spendThisMonthAud: Math.round(spendThisMonthAud(db) * 100) / 100,
  }));

  app.put("/settings", async (req) => {
    const body = z.object({
      minutesPerUnit: z.number().int().min(0).max(60),
      dailyUnitCap: z.number().int().min(0).max(6),
      freeBuildMinutes: z.number().int().min(0).max(30),
      monthlySpendCapAud: z.number().min(0).max(500),
      claudeModel: z.string().min(1),
      pinnedSkills: z.array(z.string()),
      pinnedTopics: z.array(z.string()),
    }).partial().parse(req.body);
    for (const [k, v] of Object.entries(body)) setSetting(db, k as never, v as never);
    return { ok: true };
  });

  app.post("/pin", async (req) => {
    const { pin } = z.object({ pin: z.string().regex(/^\d{4,12}$/) }).parse(req.body);
    setSetting(db, "parentPinHash", hashPin(pin));
    return { ok: true };
  });

  app.get("/generation-log", async () =>
    db.prepare("SELECT id, purpose, model, valid, error, cost_aud, created_at, prompt, output FROM generation_log ORDER BY id DESC LIMIT 100").all());

  app.get("/skills", async () => db.prepare("SELECT id, strand, mastery, difficulty, last_practised FROM skill ORDER BY strand, id").all());
};
