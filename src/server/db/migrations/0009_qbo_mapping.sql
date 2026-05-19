CREATE TABLE IF NOT EXISTS qbo_account_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK(account_type IN ('labor','fringe','tax')),
  qbo_account_id TEXT NOT NULL,
  qbo_account_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
