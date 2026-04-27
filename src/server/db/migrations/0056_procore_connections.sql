CREATE TABLE `procore_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `company_id` text NOT NULL,
  `access_token_encrypted` text NOT NULL,
  `refresh_token_encrypted` text NOT NULL,
  `access_token_expires_at` text NOT NULL,
  `refresh_token_expires_at` text NOT NULL,
  `connected_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_procore_tokens_user` ON `procore_tokens` (`user_id`);
