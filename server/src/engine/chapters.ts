import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  ChapterDefSchema,
  UnitSchema,
  type Activity,
  type ChapterDef,
  type ChapterView,
  type HubView,
  type StageCompleteResult,
  type StageDef,
  type StageView,
  type Unit,
} from "@yav/shared";
import type { DB } from "../db/db.js";
import { config } from "../config.js";
import { findUnit } from "../units.js";
import { evaluateArithmetic } from "./answers.js";
import { snapshot, type Snapshot } from "./learner.js";

/**
 * Chapters are planets; stages unlock in order. Only progress is stored, so the
 * locked/open/done picture is always worked out fresh from the rules here.
 */

export function loadBankChapters(bank: Unit[], file = path.join(config.contentBank, "..", "chapters.json")): ChapterDef[] {
  const chapters = z.array(ChapterDefSchema).parse(JSON.parse(readFileSync(file, "utf8")));
  for (const c of chapters) {
    for (const s of c.stages) {
      if (s.kind === "story" && !bank.some((u) => u.id === s.unitId)) throw new Error(`chapters.json: ${c.id}/${s.id} points at unknown unit ${s.unitId}`);
    }
  }
  return chapters;
}

/** Bank chapters first, then the chapters Claude wrote, in order. */
export function allChapters(db: DB, bankChapters: ChapterDef[]): ChapterDef[] {
  const generated = (db.prepare("SELECT body FROM chapter WHERE status = 'ready' ORDER BY position").all() as { body: string }[])
    .map((r) => ChapterDefSchema.parse(JSON.parse(r.body)));
  return [...bankChapters, ...generated];
}

/**
 * Difficulty tier for each stage: it climbs along the chapter, the challenge is always 5,
 * and each chapter starts one tier higher than the one before (capped at 3).
 */
export function stageTiers(chapterIndex: number, stages: StageDef[]): number[] {
  const base = Math.min(3, chapterIndex + 1);
  const n = stages.filter((s) => s.kind !== "challenge").length;
  let k = 0;
  return stages.map((s) => {
    if (s.tier) return s.tier;
    if (s.kind === "challenge") return 5;
    const t = base + Math.floor((k++ * (5 - base)) / Math.max(1, n));
    return Math.min(4, t);
  });
}

/** Where his place inside a stage is saved: per part, so resuming lands in the right stage. */
export function progressKey(stage: StageDef, chapterId: string): string {
  if (stage.kind === "story") return stage.part ? `${stage.unitId}#${stage.part}` : stage.unitId;
  return `${stage.kind}-${chapterId}`;
}

type Progress = Map<string, { status: "open" | "done"; stars: number }>;
const key = (c: string, s: string) => `${c}/${s}`;

function progress(db: DB): Progress {
  const rows = db.prepare("SELECT chapter_id, stage_id, status, stars FROM stage_progress").all() as { chapter_id: string; stage_id: string; status: "open" | "done"; stars: number }[];
  return new Map(rows.map((r) => [key(r.chapter_id, r.stage_id), { status: r.status, stars: r.stars }]));
}

function stageTitle(db: DB, bank: Unit[], c: ChapterDef, s: StageDef): string {
  if (s.kind === "review") return "Word Vault review";
  if (s.kind === "challenge") return `${c.title} challenge`;
  return findUnit(db, bank, s.unitId)?.title ?? "Story";
}

/** The hub picture: every chapter and stage, with locks worked out from progress. */
export function chapterViews(db: DB, bank: Unit[], chapters: ChapterDef[]): ChapterView[] {
  const p = progress(db);
  let prevChapterDone = true;
  return chapters.map((c, ci) => {
    const parentOpened = c.stages.some((s) => p.get(key(c.id, s.id))?.status === "open");
    const chapterOpen = ci === 0 || prevChapterDone || parentOpened || c.stages.some((s) => p.get(key(c.id, s.id))?.status === "done");
    let prevDone = true;
    const tiers = stageTiers(ci, c.stages);
    const stages: StageView[] = c.stages.map((s, si) => {
      const row = p.get(key(c.id, s.id));
      const status = row?.status === "done" ? "done" : chapterOpen && (si === 0 || prevDone || row?.status === "open") ? "open" : "locked";
      prevDone = status === "done";
      return { id: s.id, kind: s.kind, title: stageTitle(db, bank, c, s), status, stars: row?.stars ?? 0, part: s.kind === "story" ? s.part : undefined, tier: tiers[si]! };
    });
    const done = stages.every((s) => s.status === "done");
    prevChapterDone = done;
    return {
      id: c.id, number: ci + 1, title: c.title, emoji: c.emoji, color: c.color, planet: c.planet, ring: c.ring,
      status: done ? "done" : chapterOpen ? "open" : "locked",
      stars: stages.reduce((a, s) => a + s.stars, 0),
      maxStars: stages.length * 3,
      stages,
    };
  });
}

export function hubView(db: DB, bank: Unit[], chapters: ChapterDef[], nextChapterComing: boolean): HubView {
  const views = chapterViews(db, bank, chapters);
  const r = db.prepare("SELECT unit_id, chapter_id, stage_id, label FROM unit_progress WHERE chapter_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1").get() as
    { unit_id: string; chapter_id: string; stage_id: string; label: string | null } | undefined;
  const stage = r && views.find((c) => c.id === r.chapter_id)?.stages.find((s) => s.id === r.stage_id);
  const resume = r && stage && stage.status !== "locked" ? { chapterId: r.chapter_id, stageId: r.stage_id, title: stage.title, label: r.label ?? "" } : null;
  return { chapters: views, resume, nextChapterComing };
}

export function findStage(chapters: ChapterDef[], chapterId: string, stageId: string) {
  const chapter = chapters.find((c) => c.id === chapterId);
  const stage = chapter?.stages.find((s) => s.id === stageId);
  return chapter && stage ? { chapter, stage } : null;
}

export interface StageMetrics {
  /** Questions that needed a second try or a hint. */
  secondTries: number;
  wordsHunted: number;
  asked: number;
}

/** Three stars: finished; two or fewer second tries; curious (3 words hunted or a question asked). */
export function starsFor(kind: StageDef["kind"], m: StageMetrics): number {
  let stars = 1;
  if (m.secondTries <= 2) stars++;
  // Review and challenge stages have no story to hunt in: the third star is for a clean run.
  if (kind === "story" ? m.wordsHunted >= 3 || m.asked > 0 : m.secondTries === 0) stars++;
  return stars;
}

function earn(db: DB, currency: "minutes" | "blocks" | "gems", amount: number, reason: string) {
  db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES (?, ?, ?)").run(currency, amount, reason);
}

/** Play minutes for a finished story stage, once per unit per day, up to the daily cap. */
export function earnUnitMinutes(db: DB, unitId: string, perUnit: number, cap: number): number {
  const today = (db.prepare("SELECT COUNT(*) AS n FROM wallet_entry WHERE currency='minutes' AND amount > 0 AND reason LIKE 'unit:%' AND date(created_at) = date('now')").get() as { n: number }).n;
  const already = db.prepare("SELECT 1 FROM wallet_entry WHERE reason = ? AND date(created_at) = date('now')").get(`unit:${unitId}`);
  if (already || today >= cap) return 0;
  earn(db, "minutes", perUnit, `unit:${unitId}`);
  return perUnit;
}

export function completeStage(
  db: DB,
  bank: Unit[],
  chapters: ChapterDef[],
  chapterId: string,
  stageId: string,
  metrics: StageMetrics,
  minutes: { perUnit: number; cap: number },
): StageCompleteResult {
  const found = findStage(chapters, chapterId, stageId);
  if (!found) throw new Error("unknown stage");
  const before = chapterViews(db, bank, chapters);
  const stars = starsFor(found.stage.kind, metrics);
  const prev = (db.prepare("SELECT stars FROM stage_progress WHERE chapter_id = ? AND stage_id = ?").get(chapterId, stageId) as { stars: number } | undefined)?.stars ?? 0;
  db.prepare(`INSERT INTO stage_progress (chapter_id, stage_id, status, stars, plays, completed_at) VALUES (?, ?, 'done', ?, 1, datetime('now'))
              ON CONFLICT(chapter_id, stage_id) DO UPDATE SET status = 'done', stars = MAX(stars, excluded.stars), plays = plays + 1, completed_at = datetime('now')`)
    .run(chapterId, stageId, stars);
  const newStars = Math.max(0, stars - prev);
  // Stars are never taken away, and each new one is worth gems towards robot parts.
  if (newStars) earn(db, "gems", newStars * 2, `stars:${chapterId}/${stageId}`);

  let minutesEarned = 0;
  db.prepare("DELETE FROM unit_progress WHERE unit_id = ?").run(progressKey(found.stage, chapterId));
  // A whole unit is finished when its Create stage is (or when it is played as one stage).
  if (found.stage.kind === "story" && (!found.stage.part || found.stage.part === "create")) {
    minutesEarned = earnUnitMinutes(db, found.stage.unitId, minutes.perUnit, minutes.cap);
    db.prepare("UPDATE unit SET status='completed', completed_at=datetime('now') WHERE id = ? AND status IN ('ready','served','chapter')").run(found.stage.unitId);
    db.prepare("INSERT INTO journal_entry (kind, title, ref) VALUES ('milestone', ?, ?)").run(`Finished "${stageTitle(db, bank, found.chapter, found.stage)}"`, found.stage.unitId);
  }

  const after = chapterViews(db, bank, chapters);
  const unlockedStage = after.flatMap((c) => c.stages.map((s) => ({ c: c.id, s })))
    .find(({ c, s }) => s.status === "open" && before.find((b) => b.id === c)?.stages.find((x) => x.id === s.id)?.status === "locked");
  const unlockedChapter = after.find((c) => c.status !== "locked" && before.find((b) => b.id === c.id)?.status === "locked");
  if (unlockedChapter) db.prepare("INSERT INTO journal_entry (kind, title, ref) VALUES ('milestone', ?, ?)").run(`Unlocked ${unlockedChapter.title}`, unlockedChapter.id);
  return {
    stars,
    newStars,
    minutesEarned,
    unlockedStage: unlockedStage && unlockedStage.c === chapterId ? unlockedStage.s.id : null,
    unlockedChapter: unlockedChapter ? { id: unlockedChapter.id, title: unlockedChapter.title } : null,
  };
}

/** A stage's writing override, applied on top of the unit's own writing task. */
export function applyWriting(unit: Unit, stage: StageDef): Unit {
  if (stage.kind !== "story" || !stage.writing || !unit.writing) return unit;
  return { ...unit, writing: { ...unit.writing, ...stage.writing, skill: stage.writing.format === "story-mountain" ? "writing.story-mountain" : "writing.three-sentences", mode: "print" } };
}

/** Finished story stages and their stars, for the learner snapshot's theme preferences. */
export function finishedStories(db: DB, chapters: ChapterDef[]): { unitId: string; stars: number }[] {
  const p = progress(db);
  return chapters.flatMap((c) => c.stages.flatMap((s) => {
    const row = p.get(key(c.id, s.id));
    return s.kind === "story" && row?.status === "done" && (!s.part || s.part === "create") ? [{ unitId: s.unitId, stars: row.stars }] : [];
  }));
}

export function learnerNow(db: DB, bank: Unit[], chapters: ChapterDef[], now = new Date()): Snapshot {
  return snapshot(db, (id) => findUnit(db, bank, id)?.theme, finishedStories(db, chapters), now);
}

// ---------- building review and challenge stages ----------

function hashOf(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function storyUnits(db: DB, bank: Unit[], c: ChapterDef): Unit[] {
  return c.stages.flatMap((s) => (s.kind === "story" ? [findUnit(db, bank, s.unitId)].filter((u): u is Unit => Boolean(u)) : []));
}

/** Every glossary meaning the app knows, for wrong options in word reviews. */
function meaningPool(bank: Unit[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const u of bank) {
    for (const g of u.passage?.glossary ?? []) m.set(g.word.toLowerCase(), g.meaning);
    for (const v of u.vocab) m.set(v.word.toLowerCase(), v.options[v.correctIndex]!);
  }
  return m;
}

function wordItem(word: string, meaning: string, pool: Map<string, string>): Activity {
  const others = [...pool].filter(([w, m]) => w !== word && m !== meaning).map(([, m]) => m);
  const h = hashOf(word);
  const wrong = [others[h % others.length]!, others[(h * 7 + 3) % others.length]!].filter((x, i, a) => x && a.indexOf(x) === i);
  const options = [meaning, ...wrong];
  // Put the right answer in a stable but varied position.
  const at = h % options.length;
  [options[0], options[at]] = [options[at]!, options[0]!];
  return { id: `rv-w-${word}`, kind: "word-meaning", skill: "reading.word-meaning", difficulty: 2, word, options, correctIndex: at, hint: `Think about the story where you met "${word}".` };
}

/** A question copied out of its story, reworded so it makes sense on its own. */
function standalone(a: Activity, from: Unit, id: string): Activity | null {
  const intro = `From "${from.title}": `;
  switch (a.kind) {
    case "short-answer":
    case "multiple-choice":
      return { ...a, id, prompt: intro + a.prompt, para: undefined, hint: `Think back to the story "${from.title}".` };
    case "word-meaning":
    case "maths":
      return { ...a, id };
    default:
      return null;
  }
}

function saveBuilt(db: DB, unit: Unit): Unit {
  const checked = UnitSchema.parse(unit);
  db.prepare(`INSERT INTO unit (id, source, theme, body, status) VALUES (?, 'built', ?, ?, 'built')
              ON CONFLICT(id) DO UPDATE SET body = excluded.body`).run(checked.id, checked.theme, JSON.stringify(checked));
  return checked;
}

/**
 * Word Vault review: words due on his schedule, questions he missed that are due again,
 * then words from this chapter's stories to make at least four items.
 */
export function buildReviewUnit(db: DB, bank: Unit[], c: ChapterDef, snap: Snapshot): Unit {
  const pool = meaningPool(bank);
  const items: Activity[] = [];
  for (const w of snap.dueWords) {
    const meaning = w.meaning ?? pool.get(w.word);
    if (meaning && items.length < 5) items.push(wordItem(w.word, meaning, pool));
  }
  for (const d of snap.dueItems) {
    const u = findUnit(db, bank, d.unitId);
    const a = u && [...u.vocab, ...u.questions, ...u.corner].find((x) => x.id === d.activityId);
    const copy = u && a && standalone(a, u, `rv-i-${d.unitId}~${d.activityId}`);
    if (copy && items.length < 7) items.push(copy);
  }
  for (const u of storyUnits(db, bank, c)) {
    for (const g of u.passage?.glossary ?? []) {
      if (items.length >= 4) break;
      if (!items.some((i) => i.kind === "word-meaning" && i.word === g.word.toLowerCase())) items.push(wordItem(g.word.toLowerCase(), g.meaning, pool));
    }
  }
  const first = storyUnits(db, bank, c)[0];
  return saveBuilt(db, {
    id: `review-${c.id}`, title: "Word Vault review", theme: first?.theme ?? "space", source: "built", color: c.color,
    vocab: [], questions: items.slice(0, 8), corner: [],
  });
}

/**
 * Chapter challenge: a mixed set from the chapter's own stories, leaning towards the
 * skills he finds hardest. Always one gap fill and at least one maths item.
 */
export function buildChallengeUnit(db: DB, bank: Unit[], c: ChapterDef, snap: Snapshot): Unit {
  const mastery = new Map(snap.skills.map((s) => [s.id, s.mastery]));
  const units = storyUnits(db, bank, c);
  const candidates = units.flatMap((u, ui) =>
    [...u.vocab, ...u.questions, ...u.corner].map((a) => ({ a, u, id: `c${ui}-${a.id}` })),
  ).filter(({ a }) => a.kind !== "open" && a.kind !== "writing" && a.kind !== "gap-fill");
  candidates.sort((x, y) => (mastery.get(x.a.skill) ?? 0.5) - (mastery.get(y.a.skill) ?? 0.5) || hashOf(x.id) - hashOf(y.id));

  const picked: Activity[] = [];
  let words = 0;
  const maths = candidates.find(({ a }) => a.kind === "maths");
  if (maths) picked.push(standalone(maths.a, maths.u, maths.id)!);
  for (const { a, u, id } of candidates) {
    if (picked.length >= 6) break;
    if (picked.some((p) => p.id === id)) continue;
    if (a.kind === "word-meaning" && ++words > 2) continue;
    const copy = standalone(a, u, id);
    if (copy) picked.push(copy);
  }
  const gaps = units.find((u) => u.gapFill)?.gapFill;
  return saveBuilt(db, {
    id: `challenge-${c.id}`, title: `${c.title} challenge`, theme: units[0]?.theme ?? "space", source: "built", color: c.color,
    vocab: [], questions: picked, gapFill: gaps ? { ...gaps, id: "c-gaps" } : undefined, corner: [],
  });
}

/**
 * Stretch: on harder stages (tier 4, or tier 3 when his maths level is 4 or 5), a bank story
 * gets one bonus times-table item, pitched one table past what he is secure on.
 */
export function withStretch(db: DB, unit: Unit, snap: Snapshot, robotName: string, tier = 3): Unit {
  // Tier 4 stages always get a stretch; a strong maths level brings it forward to tier 3.
  const wanted = tier >= 4 || (snap.levels.maths >= 4 && tier >= 3);
  if (unit.source !== "bank" || !wanted || unit.corner.length >= 4) return unit;
  if (unit.corner.some((a) => a.id === "stretch-maths")) return unit;
  const tt = snap.skills.find((s) => s.id === "maths.times-tables")?.difficulty ?? 3;
  const t = Math.min(12, 5 + tt + 1);
  const n = 3 + (hashOf(unit.id) % 4);
  const expression = `${n} * ${t}`;
  const bonus: Activity = {
    id: "stretch-maths", kind: "maths", skill: "maths.times-tables", difficulty: 4,
    prompt: `Bonus challenge! ${robotName} builds ${n} towers with ${t} blocks in each. How many blocks is that?`,
    expression, tolerance: 0, unit: "blocks", working: `${n} × ${t} = ${evaluateArithmetic(expression)}`, hint: `Count in ${t}s, ${n} times.`,
  };
  const variant = UnitSchema.parse({ ...unit, corner: [...unit.corner, bonus] });
  db.prepare(`INSERT INTO unit (id, source, theme, body, status) VALUES (?, 'bank', ?, ?, 'variant')
              ON CONFLICT(id) DO UPDATE SET body = excluded.body`).run(variant.id, variant.theme, JSON.stringify(variant));
  return variant;
}
