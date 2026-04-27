-- Phase 107 (DBE-07): add dbeClassification flag to subcontractors
ALTER TABLE `subcontractors` ADD COLUMN `dbe_classification` text NOT NULL DEFAULT 'none';
