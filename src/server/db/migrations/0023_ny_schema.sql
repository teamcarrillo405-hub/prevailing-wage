ALTER TABLE projects ADD COLUMN nyp_rc_number TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN nys_contractor_reg_number TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN project_settings TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN nys_registered_apprentice INTEGER NOT NULL DEFAULT 0;
