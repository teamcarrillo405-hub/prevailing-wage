ALTER TABLE webhook_deliveries ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
--> statement-breakpoint
UPDATE webhook_deliveries SET status = 'succeeded' WHERE delivered_at IS NOT NULL AND status = 'pending';
--> statement-breakpoint
UPDATE webhook_deliveries SET status = 'failed' WHERE failed_at IS NOT NULL AND retry_count >= 5 AND status = 'pending';
--> statement-breakpoint
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status, retry_count);
