import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { unzipSync } from "fflate";
import type { DB } from "../db/db.js";
import { getSetting, setSetting } from "../db/settings.js";
import { earnUnitMinutes } from "../engine/chapters.js";
import { recordAttempt } from "../engine/attempts.js";

/**
 * The Arcade: games made by other services, played inside the app.
 *
 * - "embed" games are another site's game shown in a frame. Only sites on the trusted list
 *   (a setting the parent can change) are allowed.
 * - "h5p" games are H5P files the parent adds. They are unpacked on the PC and played
 *   offline, and they report a score, which can count towards one of his skills.
 */

export const CATEGORIES = ["numbers", "words", "puzzles", "science"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface ArcadeGame {
  id: string;
  kind: "embed" | "h5p";
  title: string;
  category: Category;
  url: string | null;
  folder: string | null;
  skill: string | null;
  sort: number;
  hidden: number;
}

// ---------- links ----------

/**
 * Turn what the parent pasted (a share link, or a whole `<iframe …>` embed code) into the
 * game's address. Only https addresses on a trusted site are accepted.
 */
export function parseGameLink(input: string, trustedHosts: string[]): { url: string } | { error: string } {
  const text = input.trim();
  const fromIframe = /<iframe\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i.exec(text)?.[1];
  let raw = (fromIframe ?? text).replaceAll("&amp;", "&");
  if (raw.startsWith("//")) raw = `https:${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "That doesn't look like a link. Paste the game's share link or its embed code." };
  }
  if (url.protocol !== "https:") return { error: "Only secure (https) game links can be added." };
  const host = url.hostname.toLowerCase();
  const trusted = trustedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (!trusted) return { error: `${host} isn't on the trusted game sites list. Add it below if you trust it.` };
  return { url: url.toString() };
}

// ---------- H5P files ----------

const MAX_FILES = 5000;
const MAX_UNPACKED = 300 * 1024 * 1024;

export interface H5PInfo { title: string; mainLibrary: string; missing: string[] }

/** A safe relative path inside the game's folder, or null for anything that could escape it. */
export function safeEntry(name: string): string | null {
  if (!name || name.includes("\0") || name.includes("\\") || name.startsWith("/") || /^[a-z]:/i.test(name)) return null;
  const norm = path.posix.normalize(name);
  if (norm.startsWith("../") || norm === ".." || norm.includes("/../")) return null;
  return norm;
}

/**
 * Unpack an .h5p file (a zip) into `dir`. Refuses entries that would land outside the
 * folder, and very large or very many files. Reports the game's title and any H5P
 * libraries it needs that aren't included.
 */
export function unpackH5p(zip: Uint8Array, dir: string): H5PInfo {
  let count = 0;
  let total = 0;
  const files = unzipSync(zip, {
    filter: (f) => {
      count++;
      total += f.originalSize;
      if (count > MAX_FILES || total > MAX_UNPACKED) throw new Error("This H5P file is too big.");
      return true;
    },
  });
  const entries = Object.entries(files).filter(([name]) => !name.endsWith("/"));
  for (const [name] of entries) if (!safeEntry(name)) throw new Error(`This H5P file has an unsafe path in it (${name}).`);
  const h5pJson = files["h5p.json"];
  if (!h5pJson) throw new Error("This isn't an H5P file (there's no h5p.json inside).");
  const meta = JSON.parse(new TextDecoder().decode(h5pJson)) as {
    title?: string;
    mainLibrary?: string;
    preloadedDependencies?: { machineName: string; majorVersion: number | string; minorVersion: number | string }[];
  };
  if (!meta.mainLibrary) throw new Error("This H5P file doesn't say which game type it is.");

  mkdirSync(dir, { recursive: true });
  for (const [name, data] of entries) {
    const target = path.join(dir, safeEntry(name)!);
    if (!target.startsWith(path.resolve(dir) + path.sep)) throw new Error(`Unsafe path: ${name}`);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  const missing = (meta.preloadedDependencies ?? [])
    .map((d) => `${d.machineName}-${d.majorVersion}.${d.minorVersion}`)
    .filter((folder) => !existsSync(path.join(dir, folder)));
  return { title: meta.title ?? "H5P game", mainLibrary: meta.mainLibrary, missing };
}

// ---------- games ----------

export function listGames(db: DB, includeHidden = false) {
  const rows = db.prepare(`
    SELECT g.*, COUNT(p.id) AS plays, MAX(CASE WHEN p.max_score > 0 THEN p.score / p.max_score END) AS best,
      MAX(CASE WHEN p.rewarded = 1 AND date(p.finished_at) = date('now') THEN 1 ELSE 0 END) AS rewardedToday
    FROM arcade_game g LEFT JOIN arcade_play p ON p.game_id = g.id AND p.finished_at IS NOT NULL
    ${includeHidden ? "" : "WHERE g.hidden = 0"}
    GROUP BY g.id ORDER BY g.category, g.sort, g.created_at`).all() as unknown as (ArcadeGame & { plays: number; best: number | null; rewardedToday: number })[];
  return rows;
}

export function addEmbedGame(db: DB, link: string, title: string, category: Category, skill: string | null) {
  const parsed = parseGameLink(link, getSetting(db, "arcadeHosts"));
  if ("error" in parsed) return parsed;
  const id = randomUUID();
  db.prepare("INSERT INTO arcade_game (id, kind, title, category, url, skill) VALUES (?, 'embed', ?, ?, ?, ?)").run(id, title, category, parsed.url, skill);
  return { id };
}

export function addH5pGame(db: DB, zip: Uint8Array, h5pRoot: string, title: string | null, category: Category, skill: string | null) {
  const id = randomUUID();
  const dir = path.join(h5pRoot, id);
  try {
    const info = unpackH5p(zip, dir);
    db.prepare("INSERT INTO arcade_game (id, kind, title, category, folder, skill) VALUES (?, 'h5p', ?, ?, ?, ?)").run(id, title || info.title, category, id, skill);
    return { id, ...info };
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function removeGame(db: DB, id: string, h5pRoot: string) {
  const g = db.prepare("SELECT folder FROM arcade_game WHERE id = ?").get(id) as { folder: string | null } | undefined;
  if (!g) return false;
  db.prepare("DELETE FROM arcade_game WHERE id = ?").run(id);
  if (g.folder) rmSync(path.join(h5pRoot, path.basename(g.folder)), { recursive: true, force: true });
  return true;
}

// ---------- playing ----------

export function startPlay(db: DB, gameId: string) {
  const g = db.prepare("SELECT id FROM arcade_game WHERE id = ? AND hidden = 0").get(gameId);
  if (!g) return null;
  const id = randomUUID();
  db.prepare("INSERT INTO arcade_play (id, game_id) VALUES (?, ?)").run(id, gameId);
  return { playId: id };
}

/** He must play at least this long before "I finished!" earns anything. */
export const MIN_SECONDS_FOR_FINISH = 120;

export interface FinishResult { gems: number; minutes: number; reason: "score" | "finished" | "too-quick" | "already-today" }

/**
 * A game ended. A reported score (H5P) earns gems by how well he did, play minutes, and,
 * if the game is linked to a skill, counts towards that skill. "I finished!" without a
 * score earns a couple of gems after two minutes of play. Each game rewards once a day.
 */
export function finishPlay(db: DB, playId: string, result: { score?: number; max?: number }, minutes: { perUnit: number; cap: number }): FinishResult | null {
  const play = db.prepare(`SELECT p.id, p.game_id, p.finished_at, g.skill, (julianday('now') - julianday(p.started_at)) * 86400 AS seconds
    FROM arcade_play p JOIN arcade_game g ON g.id = p.game_id WHERE p.id = ?`).get(playId) as
    { id: string; game_id: string; finished_at: string | null; skill: string | null; seconds: number } | undefined;
  if (!play || play.finished_at) return null;
  const hasScore = typeof result.score === "number" && typeof result.max === "number" && result.max > 0;
  const score = hasScore ? Math.max(0, Math.min(result.score!, result.max!)) : null;
  db.prepare("UPDATE arcade_play SET finished_at = datetime('now'), score = ?, max_score = ? WHERE id = ?").run(score, hasScore ? result.max! : null, playId);

  if (hasScore && play.skill) recordAttempt(db, play.skill, `arcade:${playId}`, `${score}/${result.max}`, score! / result.max! >= 0.7);

  const already = db.prepare("SELECT 1 FROM arcade_play WHERE game_id = ? AND rewarded = 1 AND date(finished_at) = date('now') AND id != ?").get(play.game_id, playId);
  if (already) return { gems: 0, minutes: 0, reason: "already-today" };
  if (!hasScore && play.seconds < MIN_SECONDS_FOR_FINISH) return { gems: 0, minutes: 0, reason: "too-quick" };

  const gems = hasScore ? 3 + Math.round((5 * score!) / result.max!) : 2;
  db.prepare("UPDATE arcade_play SET rewarded = 1 WHERE id = ?").run(playId);
  db.prepare("INSERT INTO wallet_entry (currency, amount, reason) VALUES ('gems', ?, ?)").run(gems, `arcade:${play.game_id}`);
  const mins = hasScore ? earnUnitMinutes(db, `arcade:${play.game_id}:${new Date().toISOString().slice(0, 10)}`, minutes.perUnit, minutes.cap) : 0;
  return { gems, minutes: mins, reason: hasScore ? "score" : "finished" };
}

/** Keep what embedded games say to the app (newest 200 per game), for the parent to see. */
export function logMessage(db: DB, gameId: string, origin: string, data: string) {
  if (!db.prepare("SELECT 1 FROM arcade_game WHERE id = ?").get(gameId)) return;
  db.prepare("INSERT INTO arcade_message (game_id, origin, data) VALUES (?, ?, ?)").run(gameId, origin.slice(0, 200), data.slice(0, 2000));
  db.prepare("DELETE FROM arcade_message WHERE game_id = ? AND id NOT IN (SELECT id FROM arcade_message WHERE game_id = ? ORDER BY id DESC LIMIT 200)").run(gameId, gameId);
}

/**
 * On first start, put the built-in sample (Number Sums, an H5P game made for this app) on
 * the shelf, so the Arcade is never empty. Done once: if the parent removes it, it stays gone.
 */
export function seedSample(db: DB, h5pRoot: string, sampleDir: string) {
  if (getSetting(db, "arcadeSeeded") || !existsSync(path.join(sampleDir, "h5p.json"))) return;
  const id = "sample-number-sums";
  cpSync(sampleDir, path.join(h5pRoot, id), { recursive: true });
  db.prepare("INSERT OR IGNORE INTO arcade_game (id, kind, title, category, folder, skill) VALUES (?, 'h5p', 'Number Sums', 'numbers', ?, 'maths.add-subtract')").run(id, id);
  setSetting(db, "arcadeSeeded", true);
}
