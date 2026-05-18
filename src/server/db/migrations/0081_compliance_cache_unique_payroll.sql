CREATE TABLE IF NOT EXISTS `compliance_cache` (
  `project_id` text NOT NULL,
  `week_id` text NOT NULL,
  `computed_at` integer NOT NULL,
  `violation_count` integer NOT NULL DEFAULT 0,
  `has_critical` integer NOT NULL DEFAULT 0,
  `violations_json` text NOT NULL DEFAULT '[]',
  PRIMARY KEY (`project_id`, `week_id`)
);
--> statement-breakpoint
ALTER TABLE `payroll_weeks` ADD COLUMN `qbo_journal_entry_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uniq_project_payroll` ON `payroll_weeks`(`project_id`, `payroll_number`);
