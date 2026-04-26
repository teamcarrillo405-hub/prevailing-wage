-- Phase 78: TOTP MFA columns on users (SOC 2 SEC-01..03)
ALTER TABLE `users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_backup_codes` text;--> statement-breakpoint
-- Phase 79: Hash-chain audit integrity (SOC 2 SEC-04)
ALTER TABLE `audit_logs` ADD `previous_hash` text;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `entry_hash` text;
