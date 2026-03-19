CREATE TABLE IF NOT EXISTS gsa_rates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_rate REAL NOT NULL,
  fringe_rate REAL NOT NULL DEFAULT 0,
  overhead_pct REAL NOT NULL,
  ga_pct REAL NOT NULL,
  profit_pct REAL NOT NULL,
  billable_rate REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
