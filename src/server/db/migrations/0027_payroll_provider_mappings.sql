CREATE TABLE payroll_provider_mappings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_worker_id TEXT NOT NULL,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, provider, provider_worker_id)
);
