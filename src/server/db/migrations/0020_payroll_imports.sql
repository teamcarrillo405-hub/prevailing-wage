CREATE TABLE payroll_imports (
  id TEXT PRIMARY KEY,
  payroll_week_id TEXT NOT NULL REFERENCES payroll_weeks(id),
  imported_by_user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  source_filename TEXT,
  committed_count INTEGER NOT NULL,
  unmatched_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
