ALTER TABLE subcontractor_cpr_weeks ADD COLUMN upload_token TEXT;
--> statement-breakpoint
ALTER TABLE subcontractor_cpr_weeks ADD COLUMN upload_token_expires_at TEXT;
--> statement-breakpoint
ALTER TABLE subcontractor_cpr_weeks ADD COLUMN uploaded_at TEXT;
--> statement-breakpoint
ALTER TABLE subcontractor_cpr_weeks ADD COLUMN upload_path TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX sub_cpr_upload_token ON subcontractor_cpr_weeks(upload_token) WHERE upload_token IS NOT NULL;
