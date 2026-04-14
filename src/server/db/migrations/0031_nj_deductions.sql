ALTER TABLE payroll_entries ADD COLUMN fica_tax REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN federal_income_tax REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN state_income_tax REAL;
