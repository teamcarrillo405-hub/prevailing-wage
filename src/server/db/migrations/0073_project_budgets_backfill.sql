CREATE TABLE IF NOT EXISTS project_budgets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  bid_amount REAL,
  working_budget REAL NOT NULL,
  total_weeks INTEGER NOT NULL,
  variance_threshold_pct REAL NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
