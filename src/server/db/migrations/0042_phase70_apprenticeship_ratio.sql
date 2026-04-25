ALTER TABLE `projects` ADD `apprenticeship_requirements` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `is_ira_iija_project` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `workers` ADD `apprenticeship_program_name` text;--> statement-breakpoint
ALTER TABLE `workers` ADD `rapids_number` text;
