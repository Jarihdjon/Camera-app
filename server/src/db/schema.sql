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
  source TEXT NOT NULL CHECK (source IN ('bank','claude','built')),
  theme TEXT NOT NULL,
  body TEXT NOT NULL,                -- validated Unit JSON
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','served','completed','retired','chapter','built','variant')),
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

-- Open answers, tune-in ideas, reflections and self-checks. Never marked.
CREATE TABLE IF NOT EXISTS response (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id TEXT NOT NULL,
  activity_id TEXT,
  kind TEXT NOT NULL,                 -- open, tune-in, reflect, self-check
  text TEXT NOT NULL,
  talk_later INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Everything he asked the robot, and what it said. Shown in the parent area.
CREATE TABLE IF NOT EXISTS ask_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id TEXT,
  activity_id TEXT,
  question TEXT NOT NULL,
  reply TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- answer, word, off-topic, grown-up, offline, limit
  flagged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chapters and stages: only progress is stored; locked/open is worked out from it.
CREATE TABLE IF NOT EXISTS stage_progress (
  chapter_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','done')),  -- 'open' = unlocked by a parent
  stars INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  PRIMARY KEY (chapter_id, stage_id)
);

-- Where he is inside a unit, so closing the app never loses his place.
CREATE TABLE IF NOT EXISTS unit_progress (
  unit_id TEXT PRIMARY KEY,
  chapter_id TEXT,
  stage_id TEXT,
  step INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT '{}',
  label TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Questions he missed come back on the 1, 3, 7, 14 day schedule.
CREATE TABLE IF NOT EXISTS review_item (
  unit_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  review_step INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (unit_id, activity_id)
);

-- Chapters Claude wrote for him. Bank chapters live in content/chapters.json.
CREATE TABLE IF NOT EXISTS chapter (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  body TEXT NOT NULL,                 -- ChapterDef JSON
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','retired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
