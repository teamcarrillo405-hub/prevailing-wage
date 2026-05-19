ALTER TABLE time_punches ADD COLUMN status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('draft','submitted','approved','rejected'));
-->statement-breakpoint
ALTER TABLE time_punches ADD COLUMN rejection_reason TEXT;
-->statement-breakpoint
ALTER TABLE time_punches ADD COLUMN supervisor_id TEXT REFERENCES users(id);
