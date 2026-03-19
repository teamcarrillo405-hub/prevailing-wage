CREATE TABLE IF NOT EXISTS union_trade_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trade_code TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  union_name TEXT,
  base_rate REAL NOT NULL,
  fringe_rate REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
