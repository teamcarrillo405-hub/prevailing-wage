CREATE TABLE `copilot_interactions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text,
  `payroll_week_id` text,
  `page_path` text,
  `user_message` text NOT NULL,
  `assistant_message` text NOT NULL,
  `context_json` text NOT NULL,
  `suggestions_json` text NOT NULL,
  `model_used` text NOT NULL,
  `latency_ms` integer,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`payroll_week_id`) REFERENCES `payroll_weeks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_copilot_user_time` ON `copilot_interactions` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_copilot_project_time` ON `copilot_interactions` (`project_id`,`created_at`);
