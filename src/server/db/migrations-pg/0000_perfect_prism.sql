CREATE TABLE "ai_classifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"job_description" text NOT NULL,
	"trade_code" text NOT NULL,
	"trade_description" text NOT NULL,
	"confidence" double precision NOT NULL,
	"reasoning" text,
	"alternatives_json" text,
	"model_used" text NOT NULL,
	"latency_ms" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"scopes" text NOT NULL,
	"last_used_at" text,
	"expires_at" text,
	"created_at" text NOT NULL,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"user_id" text,
	"user_email" text,
	"ip_address" text,
	"project_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"diff" text,
	"snapshot" text,
	"meta" text,
	"previous_hash" text,
	"entry_hash" text
);
--> statement-breakpoint
CREATE TABLE "checklist_syncs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"payload" text NOT NULL,
	"synced_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_cache" (
	"project_id" text NOT NULL,
	"week_id" text NOT NULL,
	"computed_at" integer NOT NULL,
	"violation_count" integer DEFAULT 0 NOT NULL,
	"has_critical" integer DEFAULT 0 NOT NULL,
	"violations_json" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractor_signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"file_path" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "contractor_signatures_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "copilot_interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"payroll_week_id" text,
	"page_path" text,
	"user_message" text NOT NULL,
	"assistant_message" text NOT NULL,
	"context_json" text NOT NULL,
	"suggestions_json" text NOT NULL,
	"model_used" text NOT NULL,
	"latency_ms" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "county_wage_determinations" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"county" text NOT NULL,
	"city" text,
	"trade_code" text NOT NULL,
	"labor_type" text DEFAULT 'journeyworker' NOT NULL,
	"base_rate" double precision NOT NULL,
	"fringe_rate" double precision DEFAULT 0 NOT NULL,
	"effective_date" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"synced_at" text NOT NULL,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "gsa_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"base_rate" double precision NOT NULL,
	"fringe_rate" double precision DEFAULT 0 NOT NULL,
	"overhead_pct" double precision NOT NULL,
	"ga_pct" double precision NOT NULL,
	"profit_pct" double precision NOT NULL,
	"billable_rate" double precision NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"erp_type" text NOT NULL,
	"credentials_encrypted" text,
	"file_path_config" text,
	"sync_status" text DEFAULT 'idle' NOT NULL,
	"consecutive_failure_count" integer DEFAULT 0 NOT NULL,
	"last_sync_at" text,
	"last_error" text,
	"connected_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"erp_type" text NOT NULL,
	"started_at" text NOT NULL,
	"completed_at" text,
	"records_synced" integer DEFAULT 0 NOT NULL,
	"errors_count" integer DEFAULT 0 NOT NULL,
	"error_detail" text,
	"trigger" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_wage_ordinances" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"locality_name" text NOT NULL,
	"jurisdiction_type" text NOT NULL,
	"administering_agency" text NOT NULL,
	"effective_date" text NOT NULL,
	"expiration_date" text,
	"source_url" text,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"success" integer DEFAULT 0 NOT NULL,
	"ip_address" text,
	"created_at" text NOT NULL,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE "onboarding_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"contractor_role" text NOT NULL,
	"company_size" text NOT NULL,
	"primary_states" text NOT NULL,
	"work_types" text NOT NULL,
	"payroll_provider" text,
	"accounting_provider" text,
	"project_management_provider" text,
	"average_weekly_workers" integer,
	"uses_subcontractors" integer DEFAULT 0 NOT NULL,
	"uses_apprentices" integer DEFAULT 0 NOT NULL,
	"field_tracking_needed" integer DEFAULT 0 NOT NULL,
	"onboarding_answers" text NOT NULL,
	"recommended_next_steps" text NOT NULL,
	"completed_at" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ot_thresholds" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"weekly_ot_threshold" double precision DEFAULT 40 NOT NULL,
	"daily_ot_threshold" double precision,
	"daily_dt_threshold" double precision,
	"ot_multiplier" double precision DEFAULT 1.5 NOT NULL,
	"dt_multiplier" double precision DEFAULT 2 NOT NULL,
	"source" text DEFAULT 'cwhssa' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"payroll_week_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"classification_id" text NOT NULL,
	"mon_st" double precision DEFAULT 0 NOT NULL,
	"tue_st" double precision DEFAULT 0 NOT NULL,
	"wed_st" double precision DEFAULT 0 NOT NULL,
	"thu_st" double precision DEFAULT 0 NOT NULL,
	"fri_st" double precision DEFAULT 0 NOT NULL,
	"sat_st" double precision DEFAULT 0 NOT NULL,
	"sun_st" double precision DEFAULT 0 NOT NULL,
	"mon_ot" double precision DEFAULT 0 NOT NULL,
	"tue_ot" double precision DEFAULT 0 NOT NULL,
	"wed_ot" double precision DEFAULT 0 NOT NULL,
	"thu_ot" double precision DEFAULT 0 NOT NULL,
	"fri_ot" double precision DEFAULT 0 NOT NULL,
	"sat_ot" double precision DEFAULT 0 NOT NULL,
	"sun_ot" double precision DEFAULT 0 NOT NULL,
	"mon_dt" double precision DEFAULT 0 NOT NULL,
	"tue_dt" double precision DEFAULT 0 NOT NULL,
	"wed_dt" double precision DEFAULT 0 NOT NULL,
	"thu_dt" double precision DEFAULT 0 NOT NULL,
	"fri_dt" double precision DEFAULT 0 NOT NULL,
	"sat_dt" double precision DEFAULT 0 NOT NULL,
	"sun_dt" double precision DEFAULT 0 NOT NULL,
	"base_rate_snapshot" double precision NOT NULL,
	"fringe_rate_snapshot" double precision NOT NULL,
	"gross_wages" double precision,
	"deductions" double precision DEFAULT 0 NOT NULL,
	"net_pay" double precision,
	"fringe_health_welfare" double precision,
	"fringe_pension" double precision,
	"fringe_vacation" double precision,
	"fringe_training" double precision,
	"non_pw_hours" double precision,
	"check_number" text,
	"all_other_hours" double precision,
	"total_week_gross_wages" double precision,
	"fica_tax" double precision,
	"federal_income_tax" double precision,
	"state_income_tax" double precision,
	"sdi_tax" double precision,
	"deduction_vacation_holiday" double precision,
	"deduction_health_welfare" double precision,
	"deduction_pension" double precision,
	"deduction_training" double precision,
	"deduction_fund_admin" double precision,
	"deduction_dues" double precision,
	"deduction_travel_subsistence" double precision,
	"deduction_savings" double precision,
	"deduction_other" double precision,
	"deduction_other_description" text,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"subcontractor_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"payroll_week_id" text NOT NULL,
	"imported_by_user_id" text NOT NULL,
	"provider" text NOT NULL,
	"source_filename" text,
	"committed_count" integer NOT NULL,
	"unmatched_count" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_provider_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_worker_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_week_classifications" (
	"id" text PRIMARY KEY NOT NULL,
	"payroll_week_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"classification_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_weeks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"week_ending_date" text NOT NULL,
	"payroll_number" integer NOT NULL,
	"is_final" integer DEFAULT 0 NOT NULL,
	"submitted_at" text,
	"submitted_to" text,
	"amendment_number" integer,
	"original_week_id" text,
	"ca_ecpr_submitted_at" text,
	"wa_lni_submitted_at" text,
	"ny_mpwr_submitted_at" text,
	"il_idol_submitted_at" text,
	"tx_cpr_submitted_at" text,
	"qbo_journal_entry_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procore_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_token_expires_at" text NOT NULL,
	"refresh_token_expires_at" text NOT NULL,
	"connected_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"bid_amount" double precision,
	"working_budget" double precision NOT NULL,
	"total_weeks" integer NOT NULL,
	"variance_threshold_pct" double precision DEFAULT 10 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "project_budgets_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" text NOT NULL,
	"removed_at" text
);
--> statement-breakpoint
CREATE TABLE "project_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"file_path" text NOT NULL,
	"caption" text,
	"taken_at" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_wage_determinations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"wage_determination_id" text NOT NULL,
	"construction_type" text,
	"is_primary" integer DEFAULT 0 NOT NULL,
	"pinned_at" text NOT NULL,
	"pinned_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"county" text NOT NULL,
	"contract_type" text NOT NULL,
	"award_date" text NOT NULL,
	"funding_type" text NOT NULL,
	"wd_identifier" text,
	"wd_mod_number" integer,
	"wd_locked_at" text,
	"status" text DEFAULT 'active' NOT NULL,
	"project_type" text DEFAULT 'davis-bacon' NOT NULL,
	"cslb_license" text,
	"wc_policy_number" text,
	"ubi_number" text,
	"lni_certificate" text,
	"wc_account" text,
	"contractor_fein" text,
	"dir_project_id" text,
	"awarding_agency" text,
	"contract_number" text,
	"pwia_intent_id" text,
	"nyp_rc_number" text,
	"nys_contractor_reg_number" text,
	"txdot_project_id" text,
	"tx_contractor_license" text,
	"tx_awarding_agency" text,
	"ma_dls_project_id" text,
	"ma_sic_code" text,
	"nj_pwc_number" text,
	"nj_contract_id" text,
	"mn_contract_id" text,
	"va_contract_id" text,
	"project_settings" text,
	"apprenticeship_requirements" text,
	"is_ira_iija_project" integer DEFAULT 0,
	"gps_clock_in_enabled" integer DEFAULT 0,
	"gps_latitude" double precision,
	"gps_longitude" double precision,
	"gps_radius_meters" double precision DEFAULT 500,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_account_mapping" (
	"id" integer PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"account_type" text NOT NULL,
	"qbo_account_id" text NOT NULL,
	"qbo_account_name" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"realm_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_token_expires_at" text NOT NULL,
	"refresh_token_expires_at" text NOT NULL,
	"connected_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roi_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"project_count" integer NOT NULL,
	"worker_count" integer NOT NULL,
	"estimated_savings" double precision NOT NULL,
	"captured_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"event_type" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"metadata" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"idp_entity_id" text,
	"idp_sso_url" text,
	"idp_certificate" text,
	"sp_entity_id" text,
	"sp_acs_url" text,
	"domain" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_wage_sources" (
	"state" text PRIMARY KEY NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"api_url" text,
	"scrape_path" text,
	"last_synced_at" text,
	"sync_status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcontractor_certifications" (
	"id" text PRIMARY KEY NOT NULL,
	"subcontractor_id" text NOT NULL,
	"cert_types" text NOT NULL,
	"certifying_agency" text,
	"cert_number" text,
	"naics_codes" text,
	"issue_date" text,
	"expires_date" text,
	"owner_race" text,
	"owner_gender" text,
	"personal_net_worth_usd" integer,
	"reevaluation_status" text DEFAULT 'not_required',
	"self_certified" integer DEFAULT 0,
	"document_path" text,
	"uei" text,
	"cage_code" text,
	"sam_registration_status" text,
	"sam_last_verified_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcontractor_cpr_weeks" (
	"id" text PRIMARY KEY NOT NULL,
	"subcontractor_id" text NOT NULL,
	"week_ending_date" text NOT NULL,
	"received_date" text,
	"is_compliant" integer,
	"notes" text,
	"upload_token" text,
	"upload_token_expires_at" text,
	"uploaded_at" text,
	"upload_path" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcontractors" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"license_number" text,
	"contact_name" text,
	"contact_email" text,
	"address" text,
	"dbe_classification" text DEFAULT 'none' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submit_ready_acknowledgements" (
	"id" text PRIMARY KEY NOT NULL,
	"payroll_week_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"acknowledged_by_user_id" text NOT NULL,
	"note" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"inviter_user_id" text NOT NULL,
	"invitee_email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"accepted_at" text,
	"revoked_at" text,
	"invitee_role" text DEFAULT 'member' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "team_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "time_punches" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"punch_type" text NOT NULL,
	"punched_at" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_meters" double precision,
	"status" text DEFAULT 'approved' NOT NULL,
	"rejection_reason" text,
	"supervisor_id" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "union_trade_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"trade_code" text NOT NULL,
	"trade_name" text NOT NULL,
	"union_name" text,
	"base_rate" double precision NOT NULL,
	"fringe_rate" double precision DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"hcc_membership_number" text,
	"company_name" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"plan_tier" text DEFAULT 'starter' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_status" text,
	"totp_secret" text,
	"totp_enabled" integer DEFAULT 0,
	"totp_backup_codes" text,
	"session_version" integer DEFAULT 0 NOT NULL,
	"terms_accepted_at" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wage_classifications" (
	"id" text PRIMARY KEY NOT NULL,
	"wage_determination_id" text NOT NULL,
	"trade_code" text NOT NULL,
	"trade_description" text NOT NULL,
	"labor_type" text DEFAULT 'journeyworker' NOT NULL,
	"base_rate" double precision NOT NULL,
	"fringe_rate" double precision NOT NULL,
	"total_rate" double precision NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wage_determinations" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"wd_number" text NOT NULL,
	"revision_number" integer DEFAULT 0 NOT NULL,
	"state" text NOT NULL,
	"county" text,
	"construction_type" text,
	"publish_date" text,
	"raw_document" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"cached_at" text NOT NULL,
	"cache_expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"last_fetched_at" text
);
--> statement-breakpoint
CREATE TABLE "wage_sync_meta" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" text NOT NULL,
	"completed_at" text,
	"status" text NOT NULL,
	"wds_fetched" integer DEFAULT 0,
	"wds_failed" integer DEFAULT 0,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "wd_revision_log" (
	"id" text PRIMARY KEY NOT NULL,
	"wd_id" text NOT NULL,
	"old_revision" integer NOT NULL,
	"new_revision" integer NOT NULL,
	"detected_at" text NOT NULL,
	"change_summary" text
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"event" text NOT NULL,
	"payload" text NOT NULL,
	"status_code" integer,
	"response_body" text,
	"delivered_at" text,
	"failed_at" text,
	"retry_count" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text NOT NULL,
	"active" integer DEFAULT 1,
	"failure_count" integer DEFAULT 0,
	"last_delivered_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"payroll_week_id" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"file_path" text NOT NULL,
	"caption" text,
	"taken_at" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_classifications" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"project_id" text NOT NULL,
	"trade_code" text NOT NULL,
	"trade_description" text NOT NULL,
	"labor_type" text NOT NULL,
	"apprentice_percent" integer,
	"program_name" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"wa_manual_rate" double precision,
	"wa_trade_code" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"ssn_last4" text,
	"ssn_encrypted" text,
	"trade_union" text,
	"address" text,
	"address_street" text,
	"address_city" text,
	"address_state" text,
	"address_zip" text,
	"union_local" text,
	"union_book_number" text,
	"apprenticeship_committee" text,
	"apprenticeship_reg_number" text,
	"nys_registered_apprentice" integer DEFAULT 0 NOT NULL,
	"race" text,
	"ethnicity" text,
	"gender" text,
	"veteran_status" text,
	"skill_level" text,
	"is_woman" integer,
	"is_minority" integer,
	"osha_training" integer,
	"worker_sex" text,
	"apprenticeship_program_name" text,
	"rapids_number" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"erp_external_id" text,
	"erp_source" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_signatures" ADD CONSTRAINT "contractor_signatures_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_signatures" ADD CONSTRAINT "contractor_signatures_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_interactions" ADD CONSTRAINT "copilot_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_interactions" ADD CONSTRAINT "copilot_interactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_interactions" ADD CONSTRAINT "copilot_interactions_payroll_week_id_payroll_weeks_id_fk" FOREIGN KEY ("payroll_week_id") REFERENCES "public"."payroll_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsa_rates" ADD CONSTRAINT "gsa_rates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD CONSTRAINT "onboarding_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ot_thresholds" ADD CONSTRAINT "ot_thresholds_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payroll_week_id_payroll_weeks_id_fk" FOREIGN KEY ("payroll_week_id") REFERENCES "public"."payroll_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_classification_id_worker_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."worker_classifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "public"."subcontractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_imports" ADD CONSTRAINT "payroll_imports_payroll_week_id_payroll_weeks_id_fk" FOREIGN KEY ("payroll_week_id") REFERENCES "public"."payroll_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_imports" ADD CONSTRAINT "payroll_imports_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_provider_mappings" ADD CONSTRAINT "payroll_provider_mappings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_provider_mappings" ADD CONSTRAINT "payroll_provider_mappings_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_week_classifications" ADD CONSTRAINT "payroll_week_classifications_payroll_week_id_payroll_weeks_id_fk" FOREIGN KEY ("payroll_week_id") REFERENCES "public"."payroll_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_week_classifications" ADD CONSTRAINT "payroll_week_classifications_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_week_classifications" ADD CONSTRAINT "payroll_week_classifications_classification_id_worker_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."worker_classifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_weeks" ADD CONSTRAINT "payroll_weeks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procore_tokens" ADD CONSTRAINT "procore_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_wage_determinations" ADD CONSTRAINT "project_wage_determinations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_wage_determinations" ADD CONSTRAINT "project_wage_determinations_wage_determination_id_wage_determinations_id_fk" FOREIGN KEY ("wage_determination_id") REFERENCES "public"."wage_determinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_wage_determinations" ADD CONSTRAINT "project_wage_determinations_pinned_by_user_id_users_id_fk" FOREIGN KEY ("pinned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_account_mapping" ADD CONSTRAINT "qbo_account_mapping_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_tokens" ADD CONSTRAINT "qbo_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_configs" ADD CONSTRAINT "sso_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_certifications" ADD CONSTRAINT "subcontractor_certifications_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "public"."subcontractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_cpr_weeks" ADD CONSTRAINT "subcontractor_cpr_weeks_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "public"."subcontractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractors" ADD CONSTRAINT "subcontractors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submit_ready_acknowledgements" ADD CONSTRAINT "submit_ready_acknowledgements_payroll_week_id_payroll_weeks_id_fk" FOREIGN KEY ("payroll_week_id") REFERENCES "public"."payroll_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submit_ready_acknowledgements" ADD CONSTRAINT "submit_ready_acknowledgements_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_punches" ADD CONSTRAINT "time_punches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "union_trade_configs" ADD CONSTRAINT "union_trade_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_classifications" ADD CONSTRAINT "wage_classifications_wage_determination_id_wage_determinations_id_fk" FOREIGN KEY ("wage_determination_id") REFERENCES "public"."wage_determinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wd_revision_log" ADD CONSTRAINT "wd_revision_log_wd_id_wage_determinations_id_fk" FOREIGN KEY ("wd_id") REFERENCES "public"."wage_determinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_photos" ADD CONSTRAINT "week_photos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_photos" ADD CONSTRAINT "week_photos_payroll_week_id_payroll_weeks_id_fk" FOREIGN KEY ("payroll_week_id") REFERENCES "public"."payroll_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_photos" ADD CONSTRAINT "week_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_classifications" ADD CONSTRAINT "worker_classifications_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_classifications" ADD CONSTRAINT "worker_classifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_api_keys_key_hash_unique" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_project_time" ON "audit_logs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_cache_pk" ON "compliance_cache" USING btree ("project_id","week_id");--> statement-breakpoint
CREATE INDEX "idx_copilot_user_time" ON "copilot_interactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_copilot_project_time" ON "copilot_interactions" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_county_wd_state_county" ON "county_wage_determinations" USING btree ("state","county");--> statement-breakpoint
CREATE INDEX "idx_county_wd_state_county_trade" ON "county_wage_determinations" USING btree ("state","county","trade_code");--> statement-breakpoint
CREATE INDEX "idx_integration_connections_user" ON "integration_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_integration_connections_type" ON "integration_connections" USING btree ("erp_type");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_connection" ON "integration_sync_runs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_email_time" ON "login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_entry_unique" ON "payroll_entries" USING btree ("payroll_week_id","worker_id","classification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_mapping_unique" ON "payroll_provider_mappings" USING btree ("project_id","provider","provider_worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pwc_unique" ON "payroll_week_classifications" USING btree ("payroll_week_id","worker_id");--> statement-breakpoint
CREATE INDEX "idx_procore_tokens_user" ON "procore_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_member_unique" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_proj_wd_unique" ON "project_wage_determinations" USING btree ("project_id","wage_determination_id");--> statement-breakpoint
CREATE INDEX "idx_qbo_tokens_user" ON "qbo_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sec_events_user_time" ON "security_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sub_certs_sub" ON "subcontractor_certifications" USING btree ("subcontractor_id");--> statement-breakpoint
CREATE INDEX "idx_sub_certs_expires" ON "subcontractor_certifications" USING btree ("expires_date","reevaluation_status");--> statement-breakpoint
CREATE UNIQUE INDEX "sub_cpr_week_unique" ON "subcontractor_cpr_weeks" USING btree ("subcontractor_id","week_ending_date");--> statement-breakpoint
CREATE UNIQUE INDEX "submit_ready_ack_unique" ON "submit_ready_acknowledgements" USING btree ("payroll_week_id","issue_id");--> statement-breakpoint
CREATE INDEX "idx_submit_ready_ack_week" ON "submit_ready_acknowledgements" USING btree ("payroll_week_id");--> statement-breakpoint
CREATE INDEX "time_punch_project_worker_idx" ON "time_punches" USING btree ("project_id","worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wd_rev_unique" ON "wage_determinations" USING btree ("wd_number","revision_number");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_status" ON "webhook_deliveries" USING btree ("status","retry_count");