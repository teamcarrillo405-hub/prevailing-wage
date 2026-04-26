-- Phase 82 (Gap-2): SOC 2 session-version JWT invalidation + SAM.gov DBE fields
ALTER TABLE `users` ADD `session_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subcontractor_certifications` ADD `uei` text;--> statement-breakpoint
ALTER TABLE `subcontractor_certifications` ADD `cage_code` text;--> statement-breakpoint
ALTER TABLE `subcontractor_certifications` ADD `sam_registration_status` text;--> statement-breakpoint
ALTER TABLE `subcontractor_certifications` ADD `sam_last_verified_at` text;
