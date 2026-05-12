CREATE TABLE `integration_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `erp_type` text NOT NULL,
  `credentials_encrypted` text,
  `file_path_config` text,
  `sync_status` text NOT NULL DEFAULT 'idle',
  `consecutive_failure_count` integer NOT NULL DEFAULT 0,
  `last_sync_at` text,
  `last_error` text,
  `connected_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_integration_connections_user` ON `integration_connections` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_integration_connections_type` ON `integration_connections` (`erp_type`);
--> statement-breakpoint
CREATE TABLE `integration_sync_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `connection_id` text NOT NULL,
  `erp_type` text NOT NULL,
  `started_at` text NOT NULL,
  `completed_at` text,
  `records_synced` integer NOT NULL DEFAULT 0,
  `errors_count` integer NOT NULL DEFAULT 0,
  `error_detail` text,
  `trigger` text NOT NULL,
  FOREIGN KEY (`connection_id`) REFERENCES `integration_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sync_runs_connection` ON `integration_sync_runs` (`connection_id`);
