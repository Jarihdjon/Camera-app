import type { DB } from "../db/db.js";
import { applyAttempt } from "./mastery.js";

/**
 * Record one try at a skill and update its mastery. Used by the game's gates and by Arcade
 * games that report a score, so both shape what he gets next in the same way.
 */
export function recordAttempt(db: DB, skill: string, activityId: string, answer: string, correct: boolean) {
  const row = db.prepare("SELECT mastery, difficulty, streak_correct, streak_missed, last_practised FROM skill WHERE id = ?").get(skill) as
    { mastery: number; difficulty: number; streak_correct: number; streak_missed: number; last_practised: string | null } | undefined;
  if (!row) return;
  const now = new Date();
  const after = applyAttempt(
    { mastery: row.mastery, difficulty: row.difficulty, streakCorrect: row.streak_correct, streakMissed: row.streak_missed, lastPractised: row.last_practised ? new Date(row.last_practised) : null },
    { correct, usedHint: false },
    now,
  );
  db.prepare("UPDATE skill SET mastery=?, difficulty=?, streak_correct=?, streak_missed=?, last_practised=? WHERE id=?")
    .run(after.mastery, after.difficulty, after.streakCorrect, after.streakMissed, now.toISOString(), skill);
  db.prepare("INSERT INTO attempt (activity_id, skill_id, answer, correct, used_hint) VALUES (?, ?, ?, ?, 0)").run(activityId, skill, answer, correct ? 1 : 0);
}
