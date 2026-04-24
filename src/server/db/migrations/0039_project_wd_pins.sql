ALTER TABLE wage_determinations ADD COLUMN last_fetched_at TEXT;
--> statement-breakpoint
CREATE TABLE project_wage_determinations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wage_determination_id TEXT NOT NULL REFERENCES wage_determinations(id) ON DELETE CASCADE,
  construction_type TEXT CHECK(construction_type IN ('Building','Heavy','Highway','Residential')),
  is_primary INTEGER NOT NULL DEFAULT 0,
  pinned_at TEXT NOT NULL,
  pinned_by_user_id TEXT REFERENCES users(id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_proj_wd_unique ON project_wage_determinations(project_id, wage_determination_id);
