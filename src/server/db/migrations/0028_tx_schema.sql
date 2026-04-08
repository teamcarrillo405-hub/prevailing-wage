ALTER TABLE projects ADD COLUMN txdot_project_id TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN tx_contractor_license TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN tx_awarding_agency TEXT;
--> statement-breakpoint
ALTER TABLE payroll_weeks ADD COLUMN tx_cpr_submitted_at TEXT;
