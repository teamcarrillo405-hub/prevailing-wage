CREATE TABLE `qbo_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text NOT NULL,
	`access_token_expires_at` text NOT NULL,
	`refresh_token_expires_at` text NOT NULL,
	`connected_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_qbo_tokens_user` ON `qbo_tokens` (`user_id`);
--> statement-breakpoint
ALTER TABLE `projects` ADD `apprenticeship_requirements` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `is_ira_iija_project` integer DEFAULT false;
--> statement-breakpoint
ALTER TABLE `workers` ADD `apprenticeship_program_name` text;
--> statement-breakpoint
ALTER TABLE `workers` ADD `rapids_number` text;
