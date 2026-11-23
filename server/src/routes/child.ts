import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { equip, unlockedParts, type Activity, type Unit } from "@yav/shared";
import type { DB } from "../db/db.js";
import { getSetting } from "../db/settings.js";
import { checkKeywords, checkMaths, checkShortAnswer, evaluateArithmetic, normalise } from "../engine/answers.js";
import { applyAttempt, type SkillState } from "../engine/mastery.js";
import { firstReview } from "../engine/spaced.js";
import { forChild } from "../content.js";
import { findActivity, findUnit, pickTodaysUnits } from "../units.js";

interface Opts { db: DB; bank: Unit[] }

export function walletBalance(db: DB) {
  const rows = db.prepare("SELECT currency, COALESCE(SUM(amount),0) AS total FROM wallet_entry GROUP BY currency").all() as { currency: string; total: number }[];
  const out = { minutes: 0, blocks: 0, gems: 0 };
  for (const r of rows) out[r.currency as keyof typeof out] = r.total;
  return out;
}

/** Gems ever earned. Spending never lowers this, so unlocks are never taken away. */
export function gemsEarned(db: DB): number {
  return (db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM wallet_entry WHERE currency='gems' AND amount > 0").get() as { n: number }).n;
}

function robotState(db: DB) {
  const robot = db.prepare("SELECT name, parts FROM robot WHERE id = 1").get() as { name: string | null; parts: string };
  const earned = gemsEarned(db);
  return { name: robot.name, parts: JSON.parse(robot.parts) as string[], unlocked: unlockedParts(earned), gemsEarned: earned };
}

function earn(db: DB, currency: "minutes" | "blocks" | "gems", amount: number, reason: string) {
  db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES (?, ?, ?)").run(currency, amount, reason);
}

/** What to show once he has it, or after two tries: never before. */
export function revealFor(a: Activity): { text?: string; correctIndex?: number } | null {
  switch (a.kind) {
    case "short-answer": return { text: a.model ?? a.accept[0] };
    case "multiple-choice":
    case "word-meaning": return { correctIndex: a.correctIndex, text: a.options[a.correctIndex] };
    case "maths": return { text: a.working ?? `${a.expression} = ${evaluateArithmetic(a.expression)}` };
    default: return null;
  }
}

export const childRoutes: FastifyPluginAsync<Opts> = async (app, { db, bank }) => {
  app.get("/child", async () => {
    const child = db.prepare("SELECT first_name FROM child WHERE id = 1").get() as { first_name: string } | undefined;
    return { firstName: child?.first_name ?? null, robot: robotState(db), wallet: walletBalance(db) };
  });

  app.post("/child", async (req) => {
    const body = z.object({ firstName: z.string().trim().min(1).max(30).optional(), robotName: z.string().trim().min(1).max(30).optional() }).parse(req.body);
    if (body.firstName) db.prepare("INSERT INTO child (id, first_name) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name").run(body.firstName);
    if (body.robotName) db.prepare("UPDATE robot SET name = ? WHERE id = 1").run(body.robotName);
    return { ok: true };
  });

  /** Robot workshop: wear any unlocked part. */
  app.post("/robot/equip", async (req, reply) => {
    const { partId } = z.object({ partId: z.string() }).parse(req.body);
    const state = robotState(db);
    if (!state.unlocked.includes(partId)) return reply.code(403).send({ error: "not unlocked yet" });
    db.prepare("UPDATE robot SET parts = ? WHERE id = 1").run(JSON.stringify(equip(state.parts, partId)));
    return { robot: robotState(db) };
  });

  /** The journal shelf: every unit, with whether he has finished it. */
  app.get("/units", async () => {
    const done = new Set((db.prepare("SELECT DISTINCT substr(reason, 6) AS id FROM wallet_entry WHERE reason LIKE 'unit:%'").all() as { id: string }[]).map((r) => r.id));
    return bank.map((u) => ({ id: u.id, title: u.title, theme: u.theme, color: u.color ?? null, pypTheme: u.inquiry?.pypTheme ?? null, done: done.has(u.id) }));
  });

  app.get("/unit/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const unit = findUnit(db, bank, id);
    return unit ? forChild(unit) : reply.code(404).send({ error: "unknown unit" });
  });

  app.get("/session/today", async () => ({ units: pickTodaysUnits(db, bank).map(forChild), wallet: walletBalance(db) }));

  app.post("/attempt", async (req, reply) => {
    const body = z.object({
      unitId: z.string(),
      activityId: z.string(),
      answer: z.union([z.string(), z.number()]),
      usedHint: z.boolean().default(false),
      /** 1 for the first try. After two tries the server shows the answer, so nobody gets stuck. */
      tryNumber: z.number().int().min(1).default(1),
      /** For gap fill: which blank the word was placed in. */
      blank: z.number().int().min(0).optional(),
      msTaken: z.number().int().nonnegative().optional(),
    }).parse(req.body);

    const unit = findUnit(db, bank, body.unitId);
    const activity = unit && findActivity(unit, body.activityId);
    if (!activity) return reply.code(404).send({ error: "unknown activity" });

    let correct: boolean;
    switch (activity.kind) {
      case "short-answer":
        correct = activity.match === "keyword"
          ? checkKeywords(String(body.answer), activity.accept, activity.groups)
          : checkShortAnswer(String(body.answer), activity.accept);
        break;
      case "multiple-choice":
      case "word-meaning":
        correct = Number(body.answer) === activity.correctIndex;
        break;
      case "maths": correct = checkMaths(String(body.answer), activity.expression, activity.tolerance); break;
      case "gap-fill": {
        const s = activity.sentences[body.blank ?? -1];
        if (!s) return reply.code(400).send({ error: "which blank?" });
        correct = normalise(String(body.answer)) === normalise(s.answer);
        break;
      }
      case "open": return reply.code(400).send({ error: "open questions are saved with /respond" });
      case "writing": return reply.code(400).send({ error: "writing is completed by upload" });
    }
    const row = db.prepare("SELECT mastery, difficulty, streak_correct, streak_missed, last_practised FROM skill WHERE id = ?").get(activity.skill) as
      { mastery: number; difficulty: number; streak_correct: number; streak_missed: number; last_practised: string | null };
    const before: SkillState = {
      mastery: row.mastery, difficulty: row.difficulty, streakCorrect: row.streak_correct, streakMissed: row.streak_missed,
      lastPractised: row.last_practised ? new Date(row.last_practised) : null,
    };
    const now = new Date();
    const after = applyAttempt(before, { correct, usedHint: body.usedHint }, now);
    db.prepare("UPDATE skill SET mastery=?, difficulty=?, streak_correct=?, streak_missed=?, last_practised=? WHERE id=?")
      .run(after.mastery, after.difficulty, after.streakCorrect, after.streakMissed, now.toISOString(), activity.skill);
    db.prepare("INSERT INTO attempt (activity_id, skill_id, answer, correct, used_hint, ms_taken) VALUES (?,?,?,?,?,?)")
      .run(activity.id, activity.skill, String(body.answer), correct ? 1 : 0, body.usedHint ? 1 : 0, body.msTaken ?? null);

    // Suspiciously fast answers earn nothing extra (anti random-tapping).
    const tooFast = body.msTaken !== undefined && body.msTaken < 1500;
    if (correct && !tooFast) earn(db, "blocks", body.usedHint ? 1 : 2, `correct:${activity.id}`);

    const reveal = correct || body.tryNumber >= 2 ? revealFor(activity) : null;
    const hint = "hint" in activity ? activity.hint : "Try the word in the sentence. Does it make sense?";
    return { correct, hint: correct ? null : hint, reveal, wallet: walletBalance(db) };
  });

  /**
   * Open answers, tune-in ideas, reflections and the self-check. Never marked;
   * saved so a grown-up can talk about them. Open questions get a model idea back.
   */
  app.post("/respond", async (req, reply) => {
    const body = z.object({
      unitId: z.string(),
      activityId: z.string().optional(),
      kind: z.enum(["open", "tune-in", "reflect", "self-check"]),
      text: z.string().max(2000),
      talkLater: z.boolean().default(false),
    }).parse(req.body);
    const unit = findUnit(db, bank, body.unitId);
    if (!unit) return reply.code(404).send({ error: "unknown unit" });
    const activity = body.activityId ? findActivity(unit, body.activityId) : undefined;
    db.prepare("INSERT INTO response (unit_id, activity_id, kind, text, talk_later) VALUES (?, ?, ?, ?, ?)")
      .run(unit.id, body.activityId ?? null, body.kind, body.text, body.talkLater ? 1 : 0);
    if (body.text.trim().length > 2) earn(db, "blocks", 1, `respond:${body.activityId ?? body.kind}`);
    return { model: activity?.kind === "open" ? activity.model : null, wallet: walletBalance(db) };
  });

  /** Word Hunter: tapping a word always earns a gem and never costs anything. */
  app.post("/word-tap", async (req) => {
    const body = z.object({ word: z.string().trim().min(1).max(40), meaning: z.string().max(200).optional(), mystery: z.boolean().default(false) }).parse(req.body);
    const word = body.word.toLowerCase();
    const review = firstReview(new Date());
    db.prepare(`INSERT INTO word (word, meaning, source, review_step, due_at) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(word) DO UPDATE SET times_tapped = times_tapped + 1`)
      .run(word, body.meaning ?? null, body.mystery ? "mystery" : "tapped", review.step, review.dueAt!.toISOString());
    earn(db, "gems", body.mystery ? 3 : 1, `word:${word}`);
    return { wallet: walletBalance(db) };
  });

  app.get("/words", async () => db.prepare("SELECT word, meaning, times_tapped, first_seen FROM word ORDER BY first_seen DESC").all());

  /** A completed unit earns play minutes, up to the daily cap. */
  app.post("/unit/:id/complete", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const perUnit = getSetting(db, "minutesPerUnit");
    const cap = getSetting(db, "dailyUnitCap");
    const today = (db.prepare("SELECT COUNT(*) AS n FROM wallet_entry WHERE currency='minutes' AND amount > 0 AND reason LIKE 'unit:%' AND date(created_at) = date('now')").get() as { n: number }).n;
    const alreadyDone = db.prepare("SELECT 1 FROM wallet_entry WHERE reason = ? AND date(created_at) = date('now')").get(`unit:${id}`);
    let minutesEarned = 0;
    if (!alreadyDone && today < cap) {
      earn(db, "minutes", perUnit, `unit:${id}`);
      minutesEarned = perUnit;
    }
    db.prepare("UPDATE unit SET status='completed', completed_at=datetime('now') WHERE id = ?").run(id);
    db.prepare("INSERT INTO journal_entry (kind, title, ref) VALUES ('milestone', ?, ?)").run(`Finished a unit`, id);
    return { minutesEarned, capReached: today + (minutesEarned ? 1 : 0) >= cap, wallet: walletBalance(db) };
  });

  /** "Use my time": logs it for the parent. Actual limits are enforced by Apple Screen Time. */
  app.post("/wallet/use-time", async (req, reply) => {
    const { minutes } = z.object({ minutes: z.number().int().positive() }).parse(req.body);
    if (walletBalance(db).minutes < minutes) return reply.code(400).send({ error: "not enough minutes" });
    earn(db, "minutes", -minutes, "used");
    return { wallet: walletBalance(db) };
  });

  app.get("/journal", async () => db.prepare("SELECT id, kind, title, ref, created_at FROM journal_entry ORDER BY created_at DESC LIMIT 200").all());
};
