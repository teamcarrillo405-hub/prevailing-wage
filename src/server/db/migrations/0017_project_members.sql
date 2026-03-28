-- 1. Create project_members table (per D-01, D-02)
CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  UNIQUE(project_id, user_id)
);
--> statement-breakpoint

-- 2. Backfill owner rows for all existing projects (per D-05)
-- Must come AFTER CREATE TABLE — ordering matters
INSERT INTO project_members (id, project_id, user_id, role, joined_at)
SELECT lower(hex(randomblob(16))), id, user_id, 'owner', created_at
FROM projects;
--> statement-breakpoint

-- 3. Add user attribution columns to payroll_entries (per D-09)
-- Nullable only — no NOT NULL, no backfill
ALTER TABLE payroll_entries ADD COLUMN created_by_user_id TEXT REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN updated_by_user_id TEXT REFERENCES users(id);
