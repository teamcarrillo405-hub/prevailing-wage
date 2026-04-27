-- Migration 0055: wd_revision_log table — Phase 88 COMP-07
-- Records every revision bump detected during the weekly WD sync.
-- Add-only; never drop columns (PROJECT.md constraint).

CREATE TABLE IF NOT EXISTS wd_revision_log (
  id             TEXT PRIMARY KEY NOT NULL,
  wd_id          TEXT NOT NULL REFERENCES wage_determinations(id) ON DELETE CASCADE,
  old_revision   INTEGER NOT NULL,
  new_revision   INTEGER NOT NULL,
  detected_at    TEXT NOT NULL,
  change_summary TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_wd_revision_log_wd_id       ON wd_revision_log(wd_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_wd_revision_log_detected_at ON wd_revision_log(detected_at);
