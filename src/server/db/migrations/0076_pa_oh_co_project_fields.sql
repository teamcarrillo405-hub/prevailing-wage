-- 0076_pa_oh_co_project_fields.sql
ALTER TABLE `projects` ADD COLUMN `pa_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `pa_contractor_license` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `oh_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `oh_awarding_authority` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `co_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `co_awarding_agency` text;
