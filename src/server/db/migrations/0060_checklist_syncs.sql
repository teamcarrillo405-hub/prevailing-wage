-- Phase 98: Offline checklist sync log
CREATE TABLE IF NOT EXISTS checklist_syncs (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
