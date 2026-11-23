import { SKILLS, STRANDS, type Levels, type SkillId, type Strand } from "@yav/shared";
import type { DB } from "../db/db.js";
import { decay } from "./mastery.js";

/**
 * The learner snapshot: what the app knows about Yav right now, worked out from
 * everything saved. The engine uses it to build review stages, lean challenges towards
 * weak skills, add support or stretch, and tell Claude how to pitch new chapters.
 */
export interface SkillSnapshot {
  id: SkillId;
  strand: Strand;
  label: string;
  mastery: number; // 0..1, faded to today
  difficulty: number; // 1..5
  attempts: number;
}

export interface Snapshot {
  skills: SkillSnapshot[];
  strands: { strand: Strand; mastery: number; level: number }[];
  levels: Levels;
  weakest: Strand;
  strongest: Strand;
  wordsLearned: number;
  dueWords: { word: string; meaning: string | null }[];
  dueItems: { unitId: string; activityId: string }[];
  /** Words he asked about recently: the edge of his vocabulary. */
  recentWords: string[];
  /** Skills of questions he has missed lately, most missed first. */
  missedSkills: { skill: SkillId; misses: number }[];
  /** Interest themes, favourite first: finished stages, stars and "Yes!" self-checks. */
  themePrefs: { theme: string; score: number }[];
  stars: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * `finished` lists story stages he has completed, with their stars; `unitTheme` maps a unit to its theme.
 * Both come from the chapters engine, which knows which unit sits in which stage.
 */
export function snapshot(db: DB, unitTheme: (unitId: string) => string | undefined, finished: { unitId: string; stars: number }[] = [], now = new Date()): Snapshot {
  const rows = db.prepare("SELECT id, strand, mastery, difficulty, last_practised FROM skill").all() as
    { id: SkillId; strand: Strand; mastery: number; difficulty: number; last_practised: string | null }[];
  const counts = new Map((db.prepare("SELECT skill_id, COUNT(*) AS n FROM attempt GROUP BY skill_id").all() as { skill_id: string; n: number }[]).map((r) => [r.skill_id, r.n]));

  const skills: SkillSnapshot[] = rows.map((r) => {
    const faded = decay({ mastery: r.mastery, difficulty: r.difficulty, streakCorrect: 0, streakMissed: 0, lastPractised: r.last_practised ? new Date(r.last_practised) : null }, now);
    return { id: r.id, strand: r.strand, label: SKILLS[r.id]?.label ?? r.id, mastery: round(faded.mastery), difficulty: r.difficulty, attempts: counts.get(r.id) ?? 0 };
  });

  const strands = STRANDS.map((strand) => {
    const of = skills.filter((s) => s.strand === strand);
    const mastery = of.length ? of.reduce((a, s) => a + s.mastery, 0) / of.length : 0;
    const level = of.length ? Math.round(of.reduce((a, s) => a + s.difficulty, 0) / of.length) : 2;
    return { strand, mastery: round(mastery), level };
  });
  const sorted = [...strands].sort((a, b) => a.mastery - b.mastery);
  const levels = Object.fromEntries(strands.map((s) => [s.strand, s.level])) as Levels;

  const iso = now.toISOString();
  const dueWords = db.prepare("SELECT word, meaning FROM word WHERE due_at IS NOT NULL AND due_at <= ? ORDER BY due_at LIMIT 10").all(iso) as { word: string; meaning: string | null }[];
  const dueItems = (db.prepare("SELECT unit_id, activity_id FROM review_item WHERE due_at IS NOT NULL AND due_at <= ? ORDER BY due_at LIMIT 5").all(iso) as { unit_id: string; activity_id: string }[])
    .map((r) => ({ unitId: r.unit_id, activityId: r.activity_id }));
  const recentWords = (db.prepare("SELECT word FROM word ORDER BY first_seen DESC LIMIT 12").all() as { word: string }[]).map((r) => r.word);
  const wordsLearned = (db.prepare("SELECT COUNT(*) AS n FROM word").get() as { n: number }).n;

  const missedSkills = (db.prepare(
    "SELECT skill_id AS skill, COUNT(*) AS misses FROM attempt WHERE correct = 0 AND created_at >= datetime('now', '-21 days') GROUP BY skill_id ORDER BY misses DESC LIMIT 5",
  ).all() as { skill: SkillId; misses: number }[]);

  // Theme preference: stars from finished stages, plus "Yes!" answers in self-checks.
  const pref = new Map<string, number>();
  const add = (unitId: string, n: number) => {
    const t = unitTheme(unitId);
    if (t) pref.set(t, (pref.get(t) ?? 0) + n);
  };
  for (const f of finished) add(f.unitId, f.stars);
  for (const r of db.prepare("SELECT unit_id, text FROM response WHERE kind = 'self-check'").all() as { unit_id: string; text: string }[]) {
    add(r.unit_id, r.text.match(/Yes!/g)?.length ?? 0);
  }
  const themePrefs = [...pref].map(([theme, score]) => ({ theme, score })).sort((a, b) => b.score - a.score);
  const stars = (db.prepare("SELECT COALESCE(SUM(stars),0) AS n FROM stage_progress").get() as { n: number }).n;

  return { skills, strands, levels, weakest: sorted[0]!.strand, strongest: sorted[sorted.length - 1]!.strand, wordsLearned, dueWords, dueItems, recentWords, missedSkills, themePrefs, stars };
}

/** Plain-text summary for Claude: only learning data, never his name or anything personal. */
export function learnerSummary(s: Snapshot): string {
  const lvl = (n: number) => ["", "just starting", "building up", "on track", "confident", "very confident"][n] ?? "on track";
  const lines = [
    "What we know about this learner (Year 2, age 7):",
    ...s.strands.map((st) => `- ${st.strand}: ${lvl(st.level)} (level ${st.level} of 5, mastery ${Math.round(st.mastery * 100)}%)`),
    `- Weakest area: ${s.weakest}. Strongest: ${s.strongest}.`,
  ];
  const tt = s.skills.find((k) => k.id === "maths.times-tables");
  if (tt) lines.push(`- Times tables: secure to about the ${Math.min(12, 5 + tt.difficulty)}s; stretch him one table further.`);
  if (s.missedSkills.length) lines.push(`- Question types he has missed lately: ${s.missedSkills.map((m) => SKILLS[m.skill]?.label ?? m.skill).join(", ")}. Include a couple of these, with clear hints.`);
  if (s.recentWords.length) lines.push(`- Words he asked about recently (his vocabulary edge): ${s.recentWords.slice(0, 8).join(", ")}. Choose glossary words of a similar level.`);
  return lines.join("\n");
}
