-- 0079_me_vt_mt_nd_de_nh_ak_fields.sql
ALTER TABLE `projects` ADD COLUMN `me_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `vt_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `mt_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `nd_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `de_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `nh_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `ak_contract_id` text;
