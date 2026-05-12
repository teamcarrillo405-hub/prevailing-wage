ALTER TABLE `users` ADD COLUMN `hcc_membership_number` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `company_name` text;
--> statement-breakpoint
CREATE TABLE `onboarding_profiles` (
  `user_id` text PRIMARY KEY NOT NULL,
  `contractor_role` text NOT NULL,
  `company_size` text NOT NULL,
  `primary_states` text NOT NULL,
  `work_types` text NOT NULL,
  `payroll_provider` text,
  `accounting_provider` text,
  `project_management_provider` text,
  `average_weekly_workers` integer,
  `uses_subcontractors` integer DEFAULT false NOT NULL,
  `uses_apprentices` integer DEFAULT false NOT NULL,
  `field_tracking_needed` integer DEFAULT false NOT NULL,
  `onboarding_answers` text NOT NULL,
  `recommended_next_steps` text NOT NULL,
  `completed_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
