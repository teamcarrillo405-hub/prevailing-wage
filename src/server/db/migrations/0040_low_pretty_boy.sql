CREATE TABLE `time_punches` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`punch_type` text NOT NULL,
	`punched_at` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy_meters` real,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `time_punch_project_worker_idx` ON `time_punches` (`project_id`,`worker_id`);--> statement-breakpoint
ALTER TABLE `projects` ADD `gps_clock_in_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `projects` ADD `gps_latitude` real;--> statement-breakpoint
ALTER TABLE `projects` ADD `gps_longitude` real;--> statement-breakpoint
ALTER TABLE `projects` ADD `gps_radius_meters` real DEFAULT 500;