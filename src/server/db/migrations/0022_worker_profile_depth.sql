ALTER TABLE workers ADD COLUMN address_street TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_city TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_state TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_zip TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN union_local TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN union_book_number TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN apprenticeship_committee TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN apprenticeship_reg_number TEXT;
--> statement-breakpoint
UPDATE workers SET address_street = address WHERE address IS NOT NULL;
--> statement-breakpoint
CREATE TABLE payroll_week_classifications (id TEXT PRIMARY KEY NOT NULL, payroll_week_id TEXT NOT NULL REFERENCES payroll_weeks(id) ON DELETE CASCADE, worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE, classification_id TEXT NOT NULL REFERENCES worker_classifications(id) ON DELETE CASCADE, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX pwc_unique ON payroll_week_classifications(payroll_week_id, worker_id);
