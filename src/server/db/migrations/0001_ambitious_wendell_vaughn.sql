CREATE TABLE `wage_classifications` (
	`id` text PRIMARY KEY NOT NULL,
	`wage_determination_id` text NOT NULL,
	`trade_code` text NOT NULL,
	`trade_description` text NOT NULL,
	`labor_type` text DEFAULT 'journeyworker' NOT NULL,
	`base_rate` real NOT NULL,
	`fringe_rate` real NOT NULL,
	`total_rate` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wage_determination_id`) REFERENCES `wage_determinations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wage_determinations` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`wd_number` text NOT NULL,
	`revision_number` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`county` text,
	`construction_type` text,
	`publish_date` text,
	`raw_document` text,
	`is_active` integer DEFAULT true NOT NULL,
	`cached_at` text NOT NULL,
	`cache_expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wd_rev_unique` ON `wage_determinations` (`wd_number`,`revision_number`);--> statement-breakpoint
CREATE TABLE `wage_sync_meta` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`wds_fetched` integer DEFAULT 0,
	`wds_failed` integer DEFAULT 0,
	`error_message` text
);
