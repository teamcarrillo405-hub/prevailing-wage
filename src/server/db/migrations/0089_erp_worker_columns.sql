ALTER TABLE workers ADD COLUMN erp_external_id TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN erp_source TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS workers_erp_unique ON workers(project_id, erp_source, erp_external_id) WHERE erp_external_id IS NOT NULL;
