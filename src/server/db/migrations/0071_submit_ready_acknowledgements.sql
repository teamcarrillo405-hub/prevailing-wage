CREATE TABLE `submit_ready_acknowledgements` (
  `id` text PRIMARY KEY NOT NULL,
  `payroll_week_id` text NOT NULL,
  `issue_id` text NOT NULL,
  `acknowledged_by_user_id` text NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`payroll_week_id`) REFERENCES `payroll_weeks`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`acknowledged_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submit_ready_ack_unique` ON `submit_ready_acknowledgements` (`payroll_week_id`, `issue_id`);
--> statement-breakpoint
CREATE INDEX `idx_submit_ready_ack_week` ON `submit_ready_acknowledgements` (`payroll_week_id`);
