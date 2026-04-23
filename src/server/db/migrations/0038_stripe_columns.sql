ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN stripe_subscription_status TEXT;
