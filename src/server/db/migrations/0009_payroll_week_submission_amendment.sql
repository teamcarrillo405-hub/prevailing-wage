ALTER TABLE payroll_weeks ADD COLUMN submitted_at TEXT;
--> statement-breakpoint
ALTER TABLE payroll_weeks ADD COLUMN submitted_to TEXT;
--> statement-breakpoint
ALTER TABLE payroll_weeks ADD COLUMN amendment_number INTEGER;
--> statement-breakpoint
ALTER TABLE payroll_weeks ADD COLUMN original_week_id TEXT REFERENCES payroll_weeks(id);
