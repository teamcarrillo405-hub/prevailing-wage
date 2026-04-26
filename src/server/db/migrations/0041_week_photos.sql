CREATE TABLE week_photos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payroll_week_id TEXT NOT NULL REFERENCES payroll_weeks(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  file_path TEXT NOT NULL,
  caption TEXT,
  taken_at TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_week_photos_project_week ON week_photos(project_id, payroll_week_id);
