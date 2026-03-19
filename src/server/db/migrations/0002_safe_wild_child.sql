CREATE TABLE `ot_thresholds` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`weekly_ot_threshold` real DEFAULT 40 NOT NULL,
	`daily_ot_threshold` real,
	`daily_dt_threshold` real,
	`ot_multiplier` real DEFAULT 1.5 NOT NULL,
	`dt_multiplier` real DEFAULT 2 NOT NULL,
	`source` text DEFAULT 'cwhssa' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payroll_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_week_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`classification_id` text NOT NULL,
	`mon_st` real DEFAULT 0 NOT NULL,
	`tue_st` real DEFAULT 0 NOT NULL,
	`wed_st` real DEFAULT 0 NOT NULL,
	`thu_st` real DEFAULT 0 NOT NULL,
	`fri_st` real DEFAULT 0 NOT NULL,
	`sat_st` real DEFAULT 0 NOT NULL,
	`sun_st` real DEFAULT 0 NOT NULL,
	`mon_ot` real DEFAULT 0 NOT NULL,
	`tue_ot` real DEFAULT 0 NOT NULL,
	`wed_ot` real DEFAULT 0 NOT NULL,
	`thu_ot` real DEFAULT 0 NOT NULL,
	`fri_ot` real DEFAULT 0 NOT NULL,
	`sat_ot` real DEFAULT 0 NOT NULL,
	`sun_ot` real DEFAULT 0 NOT NULL,
	`base_rate_snapshot` real NOT NULL,
	`fringe_rate_snapshot` real NOT NULL,
	`gross_wages` real,
	`deductions` real DEFAULT 0 NOT NULL,
	`net_pay` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`payroll_week_id`) REFERENCES `payroll_weeks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`classification_id`) REFERENCES `worker_classifications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_entry_unique` ON `payroll_entries` (`payroll_week_id`,`worker_id`,`classification_id`);--> statement-breakpoint
CREATE TABLE `payroll_weeks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`week_ending_date` text NOT NULL,
	`payroll_number` integer NOT NULL,
	`is_final` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
