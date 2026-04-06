ALTER TABLE workers ADD COLUMN race TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN ethnicity TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN gender TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN veteran_status TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN skill_level TEXT;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN non_pw_hours REAL;