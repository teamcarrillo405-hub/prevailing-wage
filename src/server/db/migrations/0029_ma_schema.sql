ALTER TABLE workers ADD COLUMN is_woman INTEGER;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN is_minority INTEGER;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN osha_training INTEGER;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN check_number TEXT;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN all_other_hours REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN total_week_gross_wages REAL;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN ma_dls_project_id TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN ma_sic_code TEXT;
