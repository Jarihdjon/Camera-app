import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SKILLS, type SkillId } from "@yav/shared";
import { DEFAULT_SETTINGS } from "./settings.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export type DB = DatabaseSync;

/**
 * Opens (or creates) the database and applies the schema. Pass ":memory:" in tests.
 * Uses Node's built-in SQLite, so there is no native module to compile on Windows.
 */
export function openDb(file: string): DB {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.join(here, "schema.sql"), "utf8"));
  seed(db);
  return db;
}

function seed(db: DB) {
  const insertSkill = db.prepare("INSERT OR IGNORE INTO skill (id, strand) VALUES (?, ?)");
  for (const [id, s] of Object.entries(SKILLS) as [SkillId, (typeof SKILLS)[SkillId]][]) {
    insertSkill.run(id, s.strand);
  }
  // Maths is his strength: start those skills higher so he begins with wins.
  db.prepare("UPDATE skill SET mastery = 0.6, difficulty = 3 WHERE strand = 'maths' AND last_practised IS NULL").run();
  db.prepare("INSERT OR IGNORE INTO robot (id) VALUES (1)").run();
  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, JSON.stringify(v));
}
