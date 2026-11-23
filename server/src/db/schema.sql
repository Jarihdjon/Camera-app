-- Version 1 schema. Tables match the build plan's data model.
CREATE TABLE IF NOT EXISTS child (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  first_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skill (
  id TEXT PRIMARY KEY,               -- e.g. 'maths.times-tables'
  strand TEXT NOT NULL,
  mastery REAL NOT NULL DEFAULT 0.3, -- 0..1
  difficulty INTEGER NOT NULL DEFAULT 2, -- 1..5, current pitch
  streak_correct INTEGER NOT NULL DEFAULT 0,
  streak_missed INTEGER NOT NULL DEFAULT 0,
  last_practised TEXT,
  due_at TEXT,
  review_step INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS unit (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('bank','claude')),
  theme TEXT NOT NULL,
  body TEXT NOT NULL,                -- validated Unit JSON
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','served','completed','retired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES unit(id),
  kind TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attempt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  answer TEXT,
  correct INTEGER NOT NULL,
  used_hint INTEGER NOT NULL DEFAULT 0,
  ms_taken INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS word (
  word TEXT PRIMARY KEY,
  meaning TEXT,
  source TEXT NOT NULL CHECK (source IN ('tapped','missed','mystery')),
  times_tapped INTEGER NOT NULL DEFAULT 1,
  review_step INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  first_seen TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallet_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT NOT NULL CHECK (currency IN ('minutes','blocks','gems')),
  amount INTEGER NOT NULL,            -- positive earns, negative spends
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS upload (
  id TEXT PRIMARY KEY,
  activity_id TEXT,
  file_name TEXT NOT NULL,            -- relative to data/uploads
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','thumbs-up','redo')),
  parent_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS journal_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                 -- writing, build, milestone, robot, clip
  title TEXT NOT NULL,
  ref TEXT,                           -- upload id, build id, etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS world_build (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  blocks TEXT NOT NULL,               -- JSON array of placed blocks
  snapshot_file TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS robot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT,
  parts TEXT NOT NULL DEFAULT '[]'    -- JSON array of unlocked part ids
);

CREATE TABLE IF NOT EXISTS generation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purpose TEXT NOT NULL,              -- unit, hint, robot-line, digest
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  output TEXT,
  valid INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_aud REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
