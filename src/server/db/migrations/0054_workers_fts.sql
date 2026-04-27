-- Phase 85: FTS5 full-text search for workers (name + trade_union)
-- Standalone (non-content) FTS5 virtual table; triggers keep it in sync with workers.
-- Per RESEARCH §"Critical Finding: trade Column Clarification": there is NO `trade` column on workers — index `name` and `trade_union` only.
CREATE VIRTUAL TABLE IF NOT EXISTS workers_fts
  USING fts5(worker_id UNINDEXED, project_id UNINDEXED, name, trade_union);
--> statement-breakpoint
-- Backfill from existing workers (runs once when migration first applies)
INSERT INTO workers_fts(worker_id, project_id, name, trade_union)
  SELECT id, project_id, name, COALESCE(trade_union, '') FROM workers;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS workers_fts_ai
  AFTER INSERT ON workers BEGIN
    INSERT INTO workers_fts(worker_id, project_id, name, trade_union)
      VALUES (new.id, new.project_id, new.name, COALESCE(new.trade_union, ''));
  END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS workers_fts_au
  AFTER UPDATE ON workers BEGIN
    DELETE FROM workers_fts WHERE worker_id = old.id;
    INSERT INTO workers_fts(worker_id, project_id, name, trade_union)
      VALUES (new.id, new.project_id, new.name, COALESCE(new.trade_union, ''));
  END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS workers_fts_ad
  AFTER DELETE ON workers BEGIN
    DELETE FROM workers_fts WHERE worker_id = old.id;
  END;
