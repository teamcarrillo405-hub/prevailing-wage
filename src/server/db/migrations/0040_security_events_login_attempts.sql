CREATE TABLE security_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_sec_events_user_time ON security_events(user_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  failure_reason TEXT
);
--> statement-breakpoint
CREATE INDEX idx_login_attempts_email_time ON login_attempts(email, created_at DESC);
