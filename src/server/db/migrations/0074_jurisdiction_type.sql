-- 0074_jurisdiction_type.sql
-- Add jurisdiction_type to wage_determinations so county/local WDs are distinguishable.
-- 'federal' = Davis-Bacon WDOL, 'state' = state agency, 'county' = county ordinance,
-- 'local' = municipal ordinance, 'sca' = Service Contract Act
ALTER TABLE `wage_determinations` ADD COLUMN `jurisdiction_type` text NOT NULL DEFAULT 'federal';
--> statement-breakpoint
-- locality_name stores sub-county name (e.g. "NYC", "Cook County", "DC")
ALTER TABLE `wage_determinations` ADD COLUMN `locality_name` text;
