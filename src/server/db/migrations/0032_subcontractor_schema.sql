CREATE TABLE subcontractors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  license_number TEXT,
  contact_name TEXT,
  contact_email TEXT,
  address TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE subcontractor_cpr_weeks (
  id TEXT PRIMARY KEY,
  subcontractor_id TEXT NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  week_ending_date TEXT NOT NULL,
  received_date TEXT,
  is_compliant INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (subcontractor_id, week_ending_date)
);
