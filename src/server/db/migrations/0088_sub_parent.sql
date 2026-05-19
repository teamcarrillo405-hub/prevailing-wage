ALTER TABLE subcontractors ADD COLUMN parent_sub_id INTEGER REFERENCES subcontractors(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE subcontractors ADD COLUMN dbe_certification TEXT CHECK(dbe_certification IN ('DBE','MBE','WBE','SBE',NULL));
--> statement-breakpoint
ALTER TABLE subcontractors ADD COLUMN contract_value REAL DEFAULT 0;
