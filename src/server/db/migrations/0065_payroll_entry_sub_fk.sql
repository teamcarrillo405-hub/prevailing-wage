-- Phase 108 (DBE-08): nullable subcontractor FK on payroll_entries
-- null = GC direct labor; existing rows remain null (unaffected)
ALTER TABLE `payroll_entries` ADD COLUMN `subcontractor_id` text REFERENCES `subcontractors`(`id`) ON DELETE SET NULL;
