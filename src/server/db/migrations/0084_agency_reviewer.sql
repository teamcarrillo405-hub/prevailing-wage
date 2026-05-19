CREATE TABLE IF NOT EXISTS reviewer_project_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reviewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  granted_by TEXT NOT NULL REFERENCES users(id),
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(reviewer_user_id, project_id)
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS payroll_week_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id TEXT NOT NULL REFERENCES payroll_weeks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  review_stamp TEXT CHECK(review_stamp IN ('approved','flagged','pending')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
