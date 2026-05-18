-- 0077_md_or_ct_hi_project_fields.sql
ALTER TABLE `projects` ADD COLUMN `md_contract_id` text;
ALTER TABLE `projects` ADD COLUMN `md_awarding_agency` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `or_boli_project_id` text;
ALTER TABLE `projects` ADD COLUMN `or_contractor_ccb` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `ct_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `hi_contract_id` text;
ALTER TABLE `projects` ADD COLUMN `hi_awarding_agency` text;
