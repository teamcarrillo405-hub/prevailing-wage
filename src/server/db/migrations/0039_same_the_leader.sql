CREATE TABLE `subcontractor_certifications` (
	`id` text PRIMARY KEY NOT NULL,
	`subcontractor_id` text NOT NULL,
	`cert_types` text NOT NULL,
	`certifying_agency` text,
	`cert_number` text,
	`naics_codes` text,
	`issue_date` text,
	`expires_date` text,
	`owner_race` text,
	`owner_gender` text,
	`personal_net_worth_usd` integer,
	`reevaluation_status` text DEFAULT 'not_required',
	`self_certified` integer DEFAULT false,
	`document_path` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sub_certs_sub` ON `subcontractor_certifications` (`subcontractor_id`);--> statement-breakpoint
CREATE INDEX `idx_sub_certs_expires` ON `subcontractor_certifications` (`expires_date`,`reevaluation_status`);