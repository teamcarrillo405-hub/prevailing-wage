ALTER TABLE payroll_entries ADD COLUMN fringe_health_welfare REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN fringe_pension REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN fringe_vacation REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN fringe_training REAL;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN contractor_fein TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN dir_project_id TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN awarding_agency TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN contract_number TEXT;
