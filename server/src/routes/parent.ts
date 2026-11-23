import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { DB } from "../db/db.js";
import { getSetting, setSetting } from "../db/settings.js";
import { checkParentToken, hashPin, issueParentToken, verifyPin } from "../auth.js";
import { spendThisMonthAud } from "../ai/spend.js";
import { config } from "../config.js";
import type { ChapterDef, Unit } from "@yav/shared";
import { allChapters, chapterViews, learnerNow } from "../engine/chapters.js";

const COOKIE = "parent";

interface ParentOpts { db: DB; bank: Unit[]; bankChapters: ChapterDef[]; isGenerating?: () => boolean }

export const parentRoutes: FastifyPluginAsync<ParentOpts> = async (app, { db, bank, bankChapters, isGenerating }) => {
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
    askEnabled: getSetting(db, "askEnabled"),
    askDailyLimit: getSetting(db, "askDailyLimit"),
    askModel: getSetting(db, "askModel"),
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
      askEnabled: z.boolean(),
      askDailyLimit: z.number().int().min(0).max(100),
      askModel: z.string().min(1),
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

  /** Everything he asked the robot. Flagged ones were handed to a grown-up. */
  app.get("/questions", async () =>
    db.prepare("SELECT id, unit_id, question, reply, kind, flagged, created_at FROM ask_log ORDER BY id DESC LIMIT 200").all());

  /** Open answers, reflections and self-checks, to talk about together. */
  app.get("/responses", async () =>
    db.prepare("SELECT id, unit_id, activity_id, kind, text, talk_later, created_at FROM response ORDER BY id DESC LIMIT 200").all());

  /** What the app has learned about him, and what is coming next. */
  app.get("/progress", async () => {
    const chapters = allChapters(db, bankChapters);
    const snap = learnerNow(db, bank, chapters);
    return {
      strands: snap.strands,
      skills: snap.skills,
      weakest: snap.weakest,
      strongest: snap.strongest,
      wordsLearned: snap.wordsLearned,
      dueWords: snap.dueWords.length,
      dueItems: snap.dueItems.length,
      stars: snap.stars,
      chapters: chapterViews(db, bank, chapters),
      generating: isGenerating?.() ?? false,
      lastGeneration: db.prepare("SELECT created_at, valid, error FROM generation_log WHERE purpose = 'unit' ORDER BY id DESC LIMIT 1").get() ?? null,
      generatedChapters: (db.prepare("SELECT id, body, status FROM chapter ORDER BY position").all() as { id: string; body: string; status: string }[])
        .map((r) => ({ id: r.id, title: (JSON.parse(r.body) as ChapterDef).title, status: r.status })),
    };
  });

  /** Let a stage through without finishing the one before (e.g. a school topic he needs now). */
  app.post("/unlock", async (req) => {
    const { chapterId, stageId } = z.object({ chapterId: z.string(), stageId: z.string() }).parse(req.body);
    db.prepare("INSERT INTO stage_progress (chapter_id, stage_id, status) VALUES (?, ?, 'open') ON CONFLICT DO NOTHING").run(chapterId, stageId);
    return { ok: true };
  });

  /** Take a chapter Claude wrote out of his journey. */
  app.post("/chapters/:id/retire", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    db.prepare("UPDATE chapter SET status = 'retired' WHERE id = ?").run(id);
    return { ok: true };
  });

  app.get("/skills", async () => db.prepare("SELECT id, strand, mastery, difficulty, last_practised FROM skill ORDER BY strand, id").all());
};
