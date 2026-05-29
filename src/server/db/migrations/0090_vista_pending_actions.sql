CREATE TABLE IF NOT EXISTS vista_pending_actions (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
