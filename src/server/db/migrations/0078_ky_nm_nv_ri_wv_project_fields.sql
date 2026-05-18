-- 0078_ky_nm_nv_ri_wv_project_fields.sql
ALTER TABLE `projects` ADD COLUMN `ky_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `nm_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `nv_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `nv_contractor_license` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `ri_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `wv_contract_id` text;
