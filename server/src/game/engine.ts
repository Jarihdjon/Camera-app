import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PackSchema, RealmDefSchema, type Pack, type RealmDef, type SkillId } from "@yav/shared";
import { GATES, GATE_INFO, buildLayout, type Band, type GameState, type GateQuestion, type GateResult, type GateType, type PackView, type Perk } from "@yav/shared/game";
import type { DB } from "../db/db.js";
import { getSetting } from "../db/settings.js";
import { config } from "../config.js";
import { applyAttempt } from "../engine/mastery.js";
import { snapshot } from "../engine/learner.js";
import { earnUnitMinutes } from "../engine/chapters.js";
import { fromPack, numberQuestion, puzzleQuestion, sentenceQuestion, spellingQuestion, type Generated } from "./generators.js";

// ---------- content ----------

export interface GameContent {
  realms: RealmDef[];
  packs: Map<string, Pack>;
}

export function loadGameContent(dir = path.join(config.contentBank, "..")): GameContent {
  const realms = z.array(RealmDefSchema).parse(JSON.parse(readFileSync(path.join(dir, "realms.json"), "utf8")));
  const packs = new Map<string, Pack>();
  for (const f of readdirSync(path.join(dir, "packs")).filter((f) => f.endsWith(".json"))) {
    const parsed = PackSchema.safeParse(JSON.parse(readFileSync(path.join(dir, "packs", f), "utf8")));
    if (!parsed.success) throw new Error(`content/packs/${f} is invalid:\n${parsed.error.message}`);
    packs.set(parsed.data.id, parsed.data);
  }
  for (const r of realms) for (const l of r.levels) if (l.pack && !packs.has(l.pack)) throw new Error(`realms.json: ${r.id}/${l.id} points at unknown pack ${l.pack}`);
  return { realms, packs };
}

export function findLevel(content: GameContent, levelId: string) {
  for (const realm of content.realms) {
    const level = realm.levels.find((l) => l.id === levelId);
    if (level) return { realm, level, pack: level.pack ? content.packs.get(level.pack) : undefined };
  }
  return null;
}

export function packView(p: Pack): PackView {
  return { id: p.id, title: p.title, emoji: p.emoji, palette: p.palette, passage: p.passage, glossary: p.glossary, eggs: p.eggs };
}

const layoutFor = (p: Pack) => buildLayout(p.id, p.eggs);

// ---------- perks and state ----------

function perkCount(db: DB, perk: Perk): number {
  return (db.prepare("SELECT count FROM game_perk WHERE perk = ?").get(perk) as { count: number } | undefined)?.count ?? 0;
}
function addPerk(db: DB, perk: Perk, n: number) {
  db.prepare("INSERT INTO game_perk (perk, count) VALUES (?, ?) ON CONFLICT(perk) DO UPDATE SET count = MAX(0, count + excluded.count)").run(perk, n);
}

export function gameState(db: DB, content: GameContent): GameState {
  const gems = (db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM wallet_entry WHERE currency = 'gems'").get() as { n: number }).n;
  return {
    gems,
    perks: { shield: perkCount(db, "shield"), jet: perkCount(db, "jet") > 0, hint: perkCount(db, "hint"), magnet: perkCount(db, "magnet") > 0 },
    realms: content.realms.map((r) => ({
      id: r.id, name: r.name, emoji: r.emoji, color: r.color, sky: r.sky,
      levels: r.levels.map((l) => {
        const pack = l.pack ? content.packs.get(l.pack) : undefined;
        const layout = pack && layoutFor(pack);
        const got = (db.prepare("SELECT COUNT(*) AS n FROM game_gem WHERE level_id = ?").get(l.id) as { n: number }).n;
        const eggs = (db.prepare("SELECT COUNT(*) AS n FROM game_egg WHERE level_id = ?").get(l.id) as { n: number }).n;
        const done = db.prepare("SELECT 1 FROM game_level_done WHERE level_id = ?").get(l.id);
        const run = db.prepare("SELECT checkpoint FROM game_run WHERE level_id = ? AND completed = 0 ORDER BY updated_at DESC LIMIT 1").get(l.id) as { checkpoint: number } | undefined;
        return {
          id: l.id, name: l.name, emoji: l.emoji, packId: l.pack, completed: Boolean(done),
          gems: got, gemsTotal: layout?.gems.length ?? 0, eggs, eggsTotal: layout?.eggs.length ?? 0, checkpoint: run?.checkpoint ?? 0,
        };
      }),
    })),
  };
}

// ---------- runs ----------

/** Resume the unfinished run for this level, or start a new one. */
export function startLevel(db: DB, content: GameContent, levelId: string) {
  const found = findLevel(content, levelId);
  if (!found?.pack) return null;
  let run = db.prepare("SELECT id, checkpoint FROM game_run WHERE level_id = ? AND completed = 0 ORDER BY updated_at DESC LIMIT 1").get(levelId) as { id: string; checkpoint: number } | undefined;
  if (!run) {
    run = { id: randomUUID(), checkpoint: 0 };
    db.prepare("INSERT INTO game_run (id, level_id) VALUES (?, ?)").run(run.id, levelId);
  }
  const gems = (db.prepare("SELECT gem_id FROM game_gem WHERE level_id = ?").all(levelId) as { gem_id: string }[]).map((g) => g.gem_id);
  const eggs = (db.prepare("SELECT egg_id FROM game_egg WHERE level_id = ?").all(levelId) as { egg_id: string }[]).map((e) => e.egg_id);
  return { runId: run.id, checkpoint: run.checkpoint, gems, eggs, realm: found.realm.id, pack: packView(found.pack) };
}

// ---------- questions ----------

/** Band from his level in the gate's strand, nudged by the parent's difficulty for this realm. */
export function bandFor(db: DB, realmId: string, gate: GateType): Band {
  const snap = snapshot(db, () => undefined);
  const level = snap.levels[GATE_INFO[gate].strand];
  let band = level <= 2 ? 1 : level === 3 ? 2 : 3;
  const setting = getSetting(db, "gameDifficulty")[realmId] ?? "normal";
  if (setting === "easy") band -= 1;
  if (setting === "hard") band += 1;
  return Math.max(1, Math.min(3, band)) as Band;
}

const SKILL: Partial<Record<GateType, SkillId>> = { listen: "reading.listening", word: "reading.word-meaning", science: "inquiry.concepts" };

function makeQuestion(pack: Pack, gate: GateType, band: Band, seed: string, seen: Set<string>): Generated {
  if (gate === "number") return numberQuestion(band, pack, seed);
  if (gate === "puzzle") return puzzleQuestion(band, seed);
  if (gate === "write") return hashSeed(seed) % 2 === 0 ? spellingQuestion(band, pack, seed) : sentenceQuestion(band, pack, seed);
  // Pack questions: this band first, then the nearest bands, never one already seen this run.
  const pool = pack.questions[gate];
  const byDistance = [...pool].sort((a, b) => Math.abs(a.band - band) - Math.abs(b.band - band));
  const q = byDistance.find((x) => !seen.has(`pack:${x.id}`)) ?? byDistance[hashSeed(seed) % byDistance.length]!;
  const g = fromPack(q, seed);
  g.skill = SKILL[gate] ?? (q.band === 3 ? "reading.inference" : "reading.recall");
  return g;
}

function hashSeed(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function toChild(id: string, gate: GateType, band: Band, g: Generated): GateQuestion {
  switch (g.kind) {
    case "choice": return { id, gate, band, kind: "choice", prompt: g.prompt, say: g.say, options: g.options! };
    case "number": return { id, gate, band, kind: "number", prompt: g.prompt, say: g.say, unit: g.unit };
    case "tiles": return { id, gate, band, kind: "tiles", prompt: g.prompt, say: g.say, tiles: g.tiles! };
    case "letters": return { id, gate, band, kind: "letters", prompt: g.prompt, say: g.say!, letters: g.letters!, length: g.length! };
  }
}

/**
 * The question waiting at a gate. If one is already open for this run and gate it is
 * returned again (a reload doesn't reroll); after a wrong answer a fresh one is made,
 * of the same kind and band, never repeating anything seen in this run.
 */
export function gateQuestion(db: DB, content: GameContent, runId: string, gateIndex: number): GateQuestion | null {
  const run = db.prepare("SELECT level_id, completed FROM game_run WHERE id = ?").get(runId) as { level_id: string; completed: number } | undefined;
  const found = run && findLevel(content, run.level_id);
  const gate = GATES[gateIndex];
  if (!run || run.completed || !found?.pack || !gate) return null;

  const open = db.prepare("SELECT payload FROM game_question WHERE run_id = ? AND gate = ? AND status = 'issued' ORDER BY created_at DESC LIMIT 1").get(runId, gateIndex) as { payload: string } | undefined;
  if (open) return JSON.parse(open.payload) as GateQuestion;
  const seen = new Set((db.prepare("SELECT source_key FROM game_question WHERE run_id = ?").all(runId) as { source_key: string }[]).map((r) => r.source_key));
  const tries = (db.prepare("SELECT COUNT(*) AS n FROM game_question WHERE run_id = ? AND gate = ?").get(runId, gateIndex) as { n: number }).n;
  const band = bandFor(db, found.realm.id, gate);
  let g: Generated | null = null;
  let id = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    id = `${runId}:${gateIndex}:${tries}:${attempt}`;
    g = makeQuestion(found.pack, gate, band, id, seen);
    if (!seen.has(g.key)) break;
  }
  const child = toChild(id, gate, band, g!);
  db.prepare("INSERT INTO game_question (id, run_id, level_id, gate, gate_type, band, source_key, skill, answer, answer_text, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, runId, run.level_id, gateIndex, gate, band, g!.key, g!.skill, g!.answer, g!.answerText, JSON.stringify(child));
  return child;
}

function recordAttempt(db: DB, skill: string, activityId: string, answer: string, correct: boolean) {
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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Mark a gate answer. Right: the gate opens and the checkpoint moves past it.
 * Wrong: with a Shield, it absorbs the miss (no warp); otherwise he warps back to the
 * previous checkpoint and this gate will ask a fresh question.
 */
export function answerGate(db: DB, questionId: string, answer: string | number): GateResult | null {
  const q = db.prepare("SELECT run_id, gate, skill, answer, answer_text, status FROM game_question WHERE id = ?").get(questionId) as
    { run_id: string; gate: number; skill: string; answer: string; answer_text: string; status: string } | undefined;
  if (!q || q.status !== "issued") return null;
  const correct = norm(String(answer)) === norm(q.answer);
  db.prepare("UPDATE game_question SET status = ? WHERE id = ?").run(correct ? "right" : "wrong", questionId);
  recordAttempt(db, q.skill, `game:${questionId}`, String(answer), correct);

  let shielded = false;
  if (correct) {
    db.prepare("UPDATE game_run SET checkpoint = MAX(checkpoint, ?), updated_at = datetime('now') WHERE id = ?").run(q.gate + 1, q.run_id);
    db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES ('blocks', 2, ?)").run(`gate:${questionId}`);
  } else if (perkCount(db, "shield") > 0) {
    addPerk(db, "shield", -1);
    shielded = true;
  }
  const run = db.prepare("SELECT checkpoint FROM game_run WHERE id = ?").get(q.run_id) as { checkpoint: number };
  return { correct, answer: q.answer_text, shielded, checkpoint: run.checkpoint, shields: perkCount(db, "shield") };
}

/** Pick up a gem or an easter egg. Gems count once per level, ever; eggs give their perk. */
export function collect(db: DB, content: GameContent, levelId: string, kind: "gem" | "egg", id: string) {
  const found = findLevel(content, levelId);
  if (!found?.pack) return null;
  const layout = layoutFor(found.pack);
  if (kind === "gem") {
    const gem = layout.gems.find((g) => g.id === id);
    if (!gem) return null;
    const res = db.prepare("INSERT OR IGNORE INTO game_gem (level_id, gem_id) VALUES (?, ?)").run(levelId, id);
    if (res.changes) db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES ('gems', ?, ?)").run(gem.big ? 5 : 1, `game-gem:${levelId}`);
    return { perk: null as Perk | null };
  }
  const egg = layout.eggs.find((e) => e.id === id);
  if (!egg) return null;
  const res = db.prepare("INSERT OR IGNORE INTO game_egg (level_id, egg_id, perk) VALUES (?, ?, ?)").run(levelId, id, egg.perk);
  if (!res.changes) return { perk: null };
  // Shields stack up (one is used per save); the Jet boost is yours for good.
  addPerk(db, egg.perk, egg.perk === "shield" ? 2 : 1);
  db.prepare("INSERT INTO journal_entry (kind, title, ref) VALUES ('milestone', ?, ?)").run(`Found an easter egg in ${found.level.name}`, levelId);
  return { perk: egg.perk };
}

export function finishLevel(db: DB, runId: string, minutes: { perUnit: number; cap: number }) {
  const run = db.prepare("SELECT level_id, checkpoint, completed FROM game_run WHERE id = ?").get(runId) as { level_id: string; checkpoint: number; completed: number } | undefined;
  if (!run || run.completed || run.checkpoint < GATES.length) return null;
  db.prepare("UPDATE game_run SET completed = 1, updated_at = datetime('now') WHERE id = ?").run(runId);
  db.prepare("INSERT INTO game_level_done (level_id) VALUES (?) ON CONFLICT(level_id) DO UPDATE SET times = times + 1").run(run.level_id);
  db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES ('gems', 10, ?)").run(`level:${run.level_id}`);
  const minutesEarned = earnUnitMinutes(db, `level:${run.level_id}`, minutes.perUnit, minutes.cap);
  return { minutesEarned, bonusGems: 10 };
}
