CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  user_email TEXT,
  ip_address TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  diff TEXT,
  snapshot TEXT,
  meta TEXT
);
--> statement-breakpoint
CREATE INDEX idx_audit_project_time ON audit_logs(project_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
