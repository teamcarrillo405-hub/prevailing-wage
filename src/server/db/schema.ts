import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  hccMembershipNumber: text('hcc_membership_number'),
  companyName: text('company_name'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  planTier: text('plan_tier').notNull().default('starter').$type<'starter' | 'pro' | 'enterprise'>(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeSubscriptionStatus: text('stripe_subscription_status'),
  // ── Phase 78: TOTP MFA (SOC 2 — SEC-01..03) ────────────────────────────
  // totpSecret stored as AES-256-GCM envelope via encryptSsn/decryptSsn.
  // totpBackupCodes stored as JSON array of AES-256-GCM envelopes (one per code).
  totpSecret: text('totp_secret'),
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).default(false),
  totpBackupCodes: text('totp_backup_codes'),
  // ── Phase 82 (Gap-2): Session invalidation (SOC 2 SEC-02 — revoke all sessions) ──
  // Incremented when the user invokes "Revoke all sessions". JWTs carry an `sv`
  // claim; mismatched JWTs are rejected by the auth middleware. Default 0.
  sessionVersion: integer('session_version').notNull().default(0),
});

export const onboardingProfiles = sqliteTable('onboarding_profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  contractorRole: text('contractor_role').notNull()
    .$type<'general_contractor' | 'subcontractor' | 'both'>(),
  companySize: text('company_size').notNull()
    .$type<'1_10' | '11_50' | '51_200' | '201_plus'>(),
  primaryStates: text('primary_states').notNull(), // JSON string[]
  workTypes: text('work_types').notNull(), // JSON string[]
  payrollProvider: text('payroll_provider')
    .$type<'quickbooks' | 'adp' | 'gusto' | 'paychex' | 'sage_300' | 'sage_100' | 'other' | 'none'>(),
  accountingProvider: text('accounting_provider')
    .$type<'quickbooks' | 'sage_300' | 'other' | 'none'>(),
  projectManagementProvider: text('project_management_provider')
    .$type<'procore' | 'other' | 'none'>(),
  averageWeeklyWorkers: integer('average_weekly_workers'),
  usesSubcontractors: integer('uses_subcontractors', { mode: 'boolean' }).notNull().default(false),
  usesApprentices: integer('uses_apprentices', { mode: 'boolean' }).notNull().default(false),
  fieldTrackingNeeded: integer('field_tracking_needed', { mode: 'boolean' }).notNull().default(false),
  onboardingAnswers: text('onboarding_answers').notNull(),
  recommendedNextSteps: text('recommended_next_steps').notNull(),
  completedAt: text('completed_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  state: text('state').notNull(),
  county: text('county').notNull(),
  contractType: text('contract_type').notNull()
    .$type<'federal-davis-bacon' | 'state-prevailing' | 'gsa-schedule' | 'private'>(),

  // IMMUTABLE LOCK FIELDS — set at project creation; never updated
  awardDate: text('award_date').notNull(),
  fundingType: text('funding_type').notNull()
    .$type<'federal' | 'state' | 'mixed'>(),

  // WD lock fields — populated when user assigns a wage determination in Phase 2
  wdIdentifier: text('wd_identifier'),
  wdModNumber: integer('wd_mod_number'),
  wdLockedAt: text('wd_locked_at'),

  status: text('status').notNull().default('active').$type<'active' | 'closed'>(),
  // Phase 24 — California-specific fields
  cslbLicense: text('cslb_license'),
  wcPolicyNumber: text('wc_policy_number'),
  // Phase 25 — Washington-specific fields
  ubiNumber: text('ubi_number'),
  lniCertificate: text('lni_certificate'),
  wcAccount: text('wc_account'),
  // Phase 29 — CA eCPR export fields (persisted from pre-generation modal)
  contractorFein: text('contractor_fein'),
  dirProjectId: text('dir_project_id'),
  awardingAgency: text('awarding_agency'),
  contractNumber: text('contract_number'),
  // Phase 30 — WA PWIA export field (persisted from pre-generation modal)
  pwiaIntentId: text('pwia_intent_id'),
  // Phase 40 — New York-specific fields
  nyprcNumber: text('nyp_rc_number'),
  nysContractorRegNumber: text('nys_contractor_reg_number'),
  // Phase 47 — Texas-specific fields
  txdotProjectId: text('txdot_project_id'),
  txContractorLicense: text('tx_contractor_license'),
  txAwardingAgency: text('tx_awarding_agency'),
  // Phase 49 — Massachusetts-specific project fields
  maDlsProjectId: text('ma_dls_project_id'),
  maSicCode: text('ma_sic_code'),
  // Phase 51 — New Jersey-specific fields
  njPwcNumber: text('nj_pwc_number'),
  njContractId: text('nj_contract_id'),
  // Phase 91 — Minnesota-specific fields
  mnContractId: text('mn_contract_id'),
  // Phase 92 — Virginia-specific fields
  vaContractId: text('va_contract_id'),
  projectSettings: text('project_settings'),
  // Phase 70 — Apprenticeship ratio enforcement
  apprenticeshipRequirements: text('apprenticeship_requirements'), // JSON: { "Electrician": { "maxRatio": "1:2" }, ... }
  isIraIijaProject: integer('is_ira_iija_project', { mode: 'boolean' }).default(false),
  // Phase 75 — GPS clock-in settings
  gpsClockInEnabled: integer('gps_clock_in_enabled', { mode: 'boolean' }).default(false),
  gpsLatitude: real('gps_latitude'),   // job site center lat
  gpsLongitude: real('gps_longitude'), // job site center lng
  gpsRadiusMeters: real('gps_radius_meters').default(500),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectMembers = sqliteTable('project_members', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role').notNull().$type<'owner' | 'member' | 'auditor'>(),
  joinedAt: text('joined_at').notNull(),
  removedAt: text('removed_at'),
}, (table) => ({
  projectMemberUnique: uniqueIndex('project_member_unique').on(table.projectId, table.userId),
}));

export const teamInvites = sqliteTable('team_invites', {
  id: text('id').primaryKey(),
  inviterUserId: text('inviter_user_id').notNull().references(() => users.id),
  inviteeEmail: text('invitee_email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  revokedAt: text('revoked_at'),
  inviteeRole: text('invitee_role').notNull().default('member').$type<'member' | 'auditor'>(),
  createdAt: text('created_at').notNull(),
});

export const workers = sqliteTable('workers', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ssnLast4: text('ssn_last4'),
  ssnEncrypted: text('ssn_encrypted'),
  tradeUnion: text('trade_union'),
  address: text('address'),   // street, city, state zip — keep for backward compat; stop writing for new records
  // Phase 39 — structured address fields (replacing single address column for new records)
  addressStreet: text('address_street'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressZip: text('address_zip'),
  // Phase 39 — union card fields
  unionLocal: text('union_local'),
  unionBookNumber: text('union_book_number'),
  // Phase 39 — apprenticeship fields
  apprenticeshipCommittee: text('apprenticeship_committee'),
  apprenticeshipRegNumber: text('apprenticeship_reg_number'),
  // Phase 40 — NYS registered apprentice flag
  nysRegisteredApprentice: integer('nys_registered_apprentice', { mode: 'boolean' }).notNull().default(false),
  // Phase 42 — IL compliance demographics (nullable; IL projects only)
  race: text('race'),
  ethnicity: text('ethnicity'),
  gender: text('gender'),
  veteranStatus: text('veteran_status'),
  skillLevel: text('skill_level'),
  // Phase 49 — MA nullable boolean columns (workers may decline to self-identify)
  isWoman: integer('is_woman', { mode: 'boolean' }),
  isMinority: integer('is_minority', { mode: 'boolean' }),
  oshaTraining: integer('osha_training', { mode: 'boolean' }),
  // Phase 51 — NJ EEO field (legally-required sex, distinct from gender identity)
  workerSex: text('worker_sex'),
  // Phase 70 — Apprenticeship program identity fields
  apprenticeshipProgramName: text('apprenticeship_program_name'),
  rapidsNumber: text('rapids_number'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const workerClassifications = sqliteTable('worker_classifications', {
  id: text('id').primaryKey(),
  workerId: text('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tradeCode: text('trade_code').notNull(),
  tradeDescription: text('trade_description').notNull(),
  laborType: text('labor_type').notNull()
    .$type<'journeyworker' | 'apprentice' | 'foreman'>(),
  apprenticePercent: integer('apprentice_percent'),
  programName: text('program_name'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  // Phase 25 — WA manual prevailing wage rate (SAM.gov not used for WA)
  waManualRate: real('wa_manual_rate'),
  // Phase 25 — WA-specific 4-letter trade code override (for F700-065-000)
  waTradeCode: text('wa_trade_code'),
  createdAt: text('created_at').notNull(),
});

// ── Phase 39: Payroll Week Classification Overrides ────────────────────────
// Stores per-week classification overrides for workers. When a worker works
// under a different trade classification for a specific payroll week, this
// table records the override. The unique index ensures only one override per
// worker per week.
export const payrollWeekClassifications = sqliteTable('payroll_week_classifications', {
  id: text('id').primaryKey(),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id, { onDelete: 'cascade' }),
  workerId: text('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  classificationId: text('classification_id').notNull().references(() => workerClassifications.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  pwcUnique: uniqueIndex('pwc_unique').on(table.payrollWeekId, table.workerId),
}));

// ── Phase 2: Wage Data Tables ─────────────────────────────────────────────

export const wageDeterminations = sqliteTable('wage_determinations', {
  id: text('id').primaryKey(),
  source: text('source').notNull()
    .$type<'federal-dol' | 'ca-dir' | 'wa-li' | 'ny-dol' | 'manual'>(),
  wdNumber: text('wd_number').notNull(),
  revisionNumber: integer('revision_number').notNull().default(0),
  state: text('state').notNull(),
  county: text('county'),
  constructionType: text('construction_type'),
  publishDate: text('publish_date'),
  rawDocument: text('raw_document'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  cachedAt: text('cached_at').notNull(),
  cacheExpiresAt: text('cache_expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastFetchedAt: text('last_fetched_at'),
}, (table) => ({
  wdRevUnique: uniqueIndex('wd_rev_unique').on(table.wdNumber, table.revisionNumber),
}));

export const wageClassifications = sqliteTable('wage_classifications', {
  id: text('id').primaryKey(),
  wageDeterminationId: text('wage_determination_id').notNull()
    .references(() => wageDeterminations.id, { onDelete: 'cascade' }),
  tradeCode: text('trade_code').notNull(),
  tradeDescription: text('trade_description').notNull(),
  laborType: text('labor_type').notNull()
    .$type<'journeyworker' | 'foreman' | 'apprentice'>()
    .default('journeyworker'),
  baseRate: real('base_rate').notNull(),
  fringeRate: real('fringe_rate').notNull(),
  totalRate: real('total_rate').notNull(),
  createdAt: text('created_at').notNull(),
});

export const projectWageDeterminations = sqliteTable('project_wage_determinations', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  wageDeterminationId: text('wage_determination_id').notNull()
    .references(() => wageDeterminations.id, { onDelete: 'cascade' }),
  constructionType: text('construction_type')
    .$type<'Building' | 'Heavy' | 'Highway' | 'Residential'>(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  pinnedAt: text('pinned_at').notNull(),
  pinnedByUserId: text('pinned_by_user_id')
    .references(() => users.id),
}, (table) => ({
  projWdUnique: uniqueIndex('idx_proj_wd_unique').on(table.projectId, table.wageDeterminationId),
}));

export const wageSyncMeta = sqliteTable('wage_sync_meta', {
  id: text('id').primaryKey(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  status: text('status').notNull()
    .$type<'running' | 'success' | 'partial' | 'failed'>(),
  wdsFetched: integer('wds_fetched').default(0),
  wdsFailed: integer('wds_failed').default(0),
  errorMessage: text('error_message'),
});

// ── Phase 88: WD Revision Log — COMP-07 ───────────────────────────────────

export const wdRevisionLog = sqliteTable('wd_revision_log', {
  id: text('id').primaryKey(),
  wdId: text('wd_id').notNull()
    .references(() => wageDeterminations.id, { onDelete: 'cascade' }),
  oldRevision: integer('old_revision').notNull(),
  newRevision: integer('new_revision').notNull(),
  detectedAt: text('detected_at').notNull(),
  changeSummary: text('change_summary'),
});

// ── Phase 4: Certified Payroll Tables ─────────────────────────────────────

export const payrollWeeks = sqliteTable('payroll_weeks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  weekEndingDate: text('week_ending_date').notNull(), // ISO 8601 date string
  payrollNumber: integer('payroll_number').notNull(),
  isFinal: integer('is_final', { mode: 'boolean' }).notNull().default(false),
  // Phase 17 migration columns — nullable, for Phases 19 and 21
  submittedAt: text('submitted_at'),
  submittedTo: text('submitted_to'),
  amendmentNumber: integer('amendment_number'),
  originalWeekId: text('original_week_id'),
  // Phase 34 — Agency submission tracking (CA eCPR, WA L&I)
  caEcprSubmittedAt: text('ca_ecpr_submitted_at'),
  waLniSubmittedAt: text('wa_lni_submitted_at'),
  // Phase 41 — NY MPWR submission tracking
  nyMpwrSubmittedAt: text('ny_mpwr_submitted_at'),
  // Phase 43 -- IL IDOL submission tracking
  ilIdolSubmittedAt: text('il_idol_submitted_at'),
  // Phase 47 — TX CPR submission tracking
  txCprSubmittedAt: text('tx_cpr_submitted_at'),
  // Phase 153 — QBO journal entry link (optional)
  qboJournalEntryId: text('qbo_journal_entry_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const payrollEntries = sqliteTable('payroll_entries', {
  id: text('id').primaryKey(),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id, { onDelete: 'cascade' }),
  workerId: text('worker_id').notNull().references(() => workers.id),
  classificationId: text('classification_id').notNull().references(() => workerClassifications.id),
  // Daily straight-time hours (Mon–Sun)
  monSt: real('mon_st').notNull().default(0),
  tueSt: real('tue_st').notNull().default(0),
  wedSt: real('wed_st').notNull().default(0),
  thuSt: real('thu_st').notNull().default(0),
  friSt: real('fri_st').notNull().default(0),
  satSt: real('sat_st').notNull().default(0),
  sunSt: real('sun_st').notNull().default(0),
  // Daily overtime hours (Mon–Sun)
  monOt: real('mon_ot').notNull().default(0),
  tueOt: real('tue_ot').notNull().default(0),
  wedOt: real('wed_ot').notNull().default(0),
  thuOt: real('thu_ot').notNull().default(0),
  friOt: real('fri_ot').notNull().default(0),
  satOt: real('sat_ot').notNull().default(0),
  sunOt: real('sun_ot').notNull().default(0),
  // Daily double-time hours (Mon-Sun) — CA projects only
  monDt: real('mon_dt').notNull().default(0),
  tueDt: real('tue_dt').notNull().default(0),
  wedDt: real('wed_dt').notNull().default(0),
  thuDt: real('thu_dt').notNull().default(0),
  friDt: real('fri_dt').notNull().default(0),
  satDt: real('sat_dt').notNull().default(0),
  sunDt: real('sun_dt').notNull().default(0),
  // Rate snapshots at time of entry
  baseRateSnapshot: real('base_rate_snapshot').notNull(),
  fringeRateSnapshot: real('fringe_rate_snapshot').notNull(),
  // Computed pay fields
  grossWages: real('gross_wages'),
  deductions: real('deductions').notNull().default(0),
  netPay: real('net_pay'),
  // Phase 29 — CA fringe disaggregation (nullable; null = non-CA, 0 = entered as zero)
  fringeHealthWelfare: real('fringe_health_welfare'),
  fringePension: real('fringe_pension'),
  fringeVacation: real('fringe_vacation'),
  fringeTraining: real('fringe_training'),
  // Phase 42 — IL non-prevailing-wage hours (nullable; IL projects only)
  nonPwHours: real('non_pw_hours'),
  // Phase 49 — MA nullable payroll entry fields
  checkNumber: text('check_number'),
  allOtherHours: real('all_other_hours'),
  totalWeekGrossWages: real('total_week_gross_wages'),
  // Phase 52 — NJ deduction breakdown columns (nullable; NJ projects only)
  ficaTax: real('fica_tax'),
  federalIncomeTax: real('federal_income_tax'),
  stateIncomeTax: real('state_income_tax'),
  // Phase 66 — CA SDI (State Disability Insurance); CA projects only
  sdiTax: real('sdi_tax'),
  // CA A-1-131 section (8) itemized deductions, contributions, and payments.
  deductionVacationHoliday: real('deduction_vacation_holiday'),
  deductionHealthWelfare: real('deduction_health_welfare'),
  deductionPension: real('deduction_pension'),
  deductionTraining: real('deduction_training'),
  deductionFundAdmin: real('deduction_fund_admin'),
  deductionDues: real('deduction_dues'),
  deductionTravelSubsistence: real('deduction_travel_subsistence'),
  deductionSavings: real('deduction_savings'),
  deductionOther: real('deduction_other'),
  deductionOtherDescription: text('deduction_other_description'),
  // Phase 32 — user attribution (nullable for all existing rows per D-09)
  createdByUserId: text('created_by_user_id').references(() => users.id),
  updatedByUserId: text('updated_by_user_id').references(() => users.id),
  // Phase 108 (DBE-08): optional sub attribution for DBE participation reporting
  // null = GC direct labor. SET NULL on sub delete preserves payroll data integrity.
  subcontractorId: text('subcontractor_id').references(() => subcontractors.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  payrollEntryUnique: uniqueIndex('payroll_entry_unique').on(
    table.payrollWeekId,
    table.workerId,
    table.classificationId,
  ),
}));

// ── Phase 35: Payroll Import Audit ─────────────────────────────────────────
export const payrollImports = sqliteTable('payroll_imports', {
  id: text('id').primaryKey(),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id),
  importedByUserId: text('imported_by_user_id').notNull().references(() => users.id),
  provider: text('provider').notNull().$type<'quickbooks' | 'adp' | 'gusto' | 'paychex' | 'sage_300'>(),
  sourceFilename: text('source_filename'),
  committedCount: integer('committed_count').notNull(),
  unmatchedCount: integer('unmatched_count').notNull(),
  createdAt: text('created_at').notNull(),
});

export const submitReadyAcknowledgements = sqliteTable('submit_ready_acknowledgements', {
  id: text('id').primaryKey(),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id, { onDelete: 'cascade' }),
  issueId: text('issue_id').notNull(),
  acknowledgedByUserId: text('acknowledged_by_user_id').notNull().references(() => users.id),
  note: text('note'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  submitReadyAckUnique: uniqueIndex('submit_ready_ack_unique').on(table.payrollWeekId, table.issueId),
  submitReadyAckWeekIdx: index('idx_submit_ready_ack_week').on(table.payrollWeekId),
}));

// ── Phase 44: Provider Mappings (IMPORT-04) ────────────────────────────────
// Stores user-confirmed links between a provider's worker ID and our internal
// worker. Mappings persist across imports. Unique per (project, provider, providerWorkerId).
export const payrollProviderMappings = sqliteTable('payroll_provider_mappings', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerWorkerId: text('provider_worker_id').notNull(),
  workerId: text('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  providerMappingUnique: uniqueIndex('provider_mapping_unique').on(
    table.projectId,
    table.provider,
    table.providerWorkerId,
  ),
}));

// ── Phase 5: Union Trade Configurations ─────────────────────────────────
// Stores named trade/union configs per project. Wage rate fields are
// informational labels — actual cost is always derived from payroll_entries
// rate snapshots, never from these fields.

export const unionTradeConfigs = sqliteTable('union_trade_configs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tradeCode: text('trade_code').notNull(),      // matches workerClassifications.tradeCode
  tradeName: text('trade_name').notNull(),       // display label, e.g. "Ironworkers Local 433"
  unionName: text('union_name'),                 // optional CBA/union name
  baseRate: real('base_rate').notNull(),         // for display/reference only
  fringeRate: real('fringe_rate').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const otThresholds = sqliteTable('ot_thresholds', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  weeklyOtThreshold: real('weekly_ot_threshold').notNull().default(40),
  dailyOtThreshold: real('daily_ot_threshold'),    // null = no daily OT trigger
  dailyDtThreshold: real('daily_dt_threshold'),    // null = no daily DT trigger
  otMultiplier: real('ot_multiplier').notNull().default(1.5),
  dtMultiplier: real('dt_multiplier').notNull().default(2.0),
  source: text('source').notNull().default('cwhssa')
    .$type<'cwhssa' | 'cba' | 'state'>(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ── Phase 5: GSA Rate Configurations ─────────────────────────────────────
// Stores named fully-loaded GSA labor rate builds per project.

export const gsaRates = sqliteTable('gsa_rates', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                   // user-defined label, e.g. "2026 GSA Electrician"
  baseRate: real('base_rate').notNull(),
  fringeRate: real('fringe_rate').notNull().default(0),
  overheadPct: real('overhead_pct').notNull(),    // 0–200
  gaPct: real('ga_pct').notNull(),                // 0–200
  profitPct: real('profit_pct').notNull(),        // 0–100
  billableRate: real('billable_rate').notNull(),  // computed and stored for quick display
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ── Phase 5: Project Budget Configuration ────────────────────────────────
// One row per project. Stores the working budget and configuration for
// variance reporting. varianceThresholdPct: flag weeks where
// |variancePct| exceeds this value.

export const projectBudgets = sqliteTable('project_budgets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  bidAmount: real('bid_amount'),               // original bid — display only
  workingBudget: real('working_budget').notNull(),  // used for burn rate calculation
  totalWeeks: integer('total_weeks').notNull(),     // denominator for linear burn rate
  varianceThresholdPct: real('variance_threshold_pct').notNull().default(10), // default 10%
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ── Audit Trail ──────────────────────────────────────────────────────
export const auditLogs = sqliteTable('audit_logs', {
  id:          text('id').primaryKey(),
  createdAt:   text('created_at').notNull(),

  userId:      text('user_id').references(() => users.id),
  userEmail:   text('user_email'),
  ipAddress:   text('ip_address'),

  projectId:   text('project_id').references(() => projects.id, { onDelete: 'set null' }),

  entityType:  text('entity_type').notNull(),
  entityId:    text('entity_id').notNull(),
  action:      text('action').notNull(),

  diff:        text('diff'),
  snapshot:    text('snapshot'),
  meta:        text('meta'),

  // ── Phase 79: Hash-chain audit integrity (SOC 2 — SEC-04) ──────────────
  // previousHash = entryHash of the immediately preceding row (NULL for genesis).
  // entryHash    = SHA-256(id|action|previousHash|createdAt) computed at insert
  //                time. Both fields are nullable for backfill-safe deploy; new
  //                rows always populate both. integrity-check endpoint walks the
  //                chain and re-computes entryHash to detect tampering.
  previousHash: text('previous_hash'),
  entryHash:    text('entry_hash'),
}, (table) => ({
  idxAuditProject: index('idx_audit_project_time').on(table.projectId, table.createdAt),
  idxAuditEntity:  index('idx_audit_entity').on(table.entityType, table.entityId, table.createdAt),
  idxAuditUser:    index('idx_audit_user').on(table.userId, table.createdAt),
}));

// ── Phase 54: Subcontractor Tracking ──────────────────────────────────────
// subcontractors is project-scoped; subs may have different contacts/licenses
// per project. assertProjectAccess scopes access via projectId.
export const subcontractors = sqliteTable('subcontractors', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  licenseNumber: text('license_number'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  address: text('address'),
  // Phase 107 (DBE-07): DBE classification flag
  dbeClassification: text('dbe_classification').notNull().default('none')
    .$type<'none' | 'dbe' | 'mbe' | 'wbe' | 'sdvosb'>(),
  createdAt: text('created_at').notNull(),
});

// Tracks weekly CPR receipt and compliance status per sub per calendar week.
// weekEndingDate is a text ISO 8601 date — NOT a FK to payrollWeeks.
// UNIQUE(subcontractorId, weekEndingDate) enforced at DB level.
export const subcontractorCprWeeks = sqliteTable('subcontractor_cpr_weeks', {
  id: text('id').primaryKey(),
  subcontractorId: text('subcontractor_id').notNull().references(() => subcontractors.id, { onDelete: 'cascade' }),
  weekEndingDate: text('week_ending_date').notNull(),
  receivedDate: text('received_date'),
  isCompliant: integer('is_compliant'),   // null=unknown, 0=non-compliant, 1=compliant
  notes: text('notes'),
  uploadToken:          text('upload_token'),
  uploadTokenExpiresAt: text('upload_token_expires_at'),
  uploadedAt:           text('uploaded_at'),
  uploadPath:           text('upload_path'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  subCprWeekUnique: uniqueIndex('sub_cpr_week_unique').on(table.subcontractorId, table.weekEndingDate),
}));

// ── Phase 71: Subcontractor DBE/MBE/WBE Certifications ───────────────────
// Stores certification records per subcontractor. certTypes is CSV (e.g. "DBE,MBE").
// reevaluationStatus tracks DOT IFR Oct 2025 compliance status.
export const subcontractorCertifications = sqliteTable('subcontractor_certifications', {
  id: text('id').primaryKey(),
  subcontractorId: text('subcontractor_id').notNull().references(() => subcontractors.id, { onDelete: 'cascade' }),
  certTypes: text('cert_types').notNull(), // CSV: "DBE,MBE" for multi-type
  certifyingAgency: text('certifying_agency'),
  certNumber: text('cert_number'),
  naicsCodes: text('naics_codes'), // CSV: "236220,238110"
  issueDate: text('issue_date'), // YYYY-MM-DD
  expiresDate: text('expires_date'), // YYYY-MM-DD
  ownerRace: text('owner_race'),
  ownerGender: text('owner_gender'),
  personalNetWorthUsd: integer('personal_net_worth_usd'),
  // DOT IFR Oct 2025: 'not_required' | 'pending' | 'cleared' | 'suspended'
  reevaluationStatus: text('reevaluation_status').default('not_required'),
  selfCertified: integer('self_certified', { mode: 'boolean' }).default(false),
  documentPath: text('document_path'),
  // ── Phase 82 (Gap-2): SAM.gov entity verification fields ─────────────────
  uei: text('uei'),                                      // SAM.gov Unique Entity Identifier (12-char alphanumeric)
  cageCode: text('cage_code'),                            // CAGE / NCAGE code (5-char)
  samRegistrationStatus: text('sam_registration_status'), // 'Active' | 'Inactive' | 'Submitted' | etc.
  samLastVerifiedAt: text('sam_last_verified_at'),        // ISO 8601 timestamp of last SAM.gov lookup
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_sub_certs_sub').on(table.subcontractorId),
  index('idx_sub_certs_expires').on(table.expiresDate, table.reevaluationStatus),
]);

// ── Phase 68: QuickBooks Online OAuth Tokens ─────────────────────────────
// Stores encrypted OAuth tokens per user. One row per user (upsert pattern).
// Tokens encrypted AES-256-GCM via cryptoService — never stored plaintext.
export const qboTokens = sqliteTable('qbo_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  realmId: text('realm_id').notNull(),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  accessTokenExpiresAt: text('access_token_expires_at').notNull(),
  refreshTokenExpiresAt: text('refresh_token_expires_at').notNull(),
  connectedAt: text('connected_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  idxQboTokensUser: index('idx_qbo_tokens_user').on(table.userId),
}));

// ── Phase 90: Procore OAuth Tokens ───────────────────────────────────────────
// Stores encrypted OAuth tokens per user. One row per user (upsert pattern).
// Tokens encrypted AES-256-GCM via cryptoService — never stored plaintext.
export const procoreTokens = sqliteTable('procore_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull(),  // Procore company ID (equivalent of QBO realmId)
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  accessTokenExpiresAt: text('access_token_expires_at').notNull(),
  refreshTokenExpiresAt: text('refresh_token_expires_at').notNull(),
  connectedAt: text('connected_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  idxProcoreUser: index('idx_procore_tokens_user').on(table.userId),
}));

// ── Phase 126: Integration Foundation (v9.0) ────────────────────────────
// Generic ERP connection registry (per D-01: add alongside procore_tokens, do NOT migrate).
// Phases 127-134 read from this table; Phase 127 also reads procore_tokens for OAuth.
export const integrationConnections = sqliteTable('integration_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  erpType: text('erp_type').notNull().$type<'procore' | 'sage300' | 'vista'>(),
  credentialsEncrypted: text('credentials_encrypted'),
  filePathConfig: text('file_path_config'),
  syncStatus: text('sync_status').notNull().default('idle').$type<'idle' | 'running' | 'error'>(),
  consecutiveFailureCount: integer('consecutive_failure_count').notNull().default(0),
  lastSyncAt: text('last_sync_at'),
  lastError: text('last_error'),
  connectedAt: text('connected_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  idxIntegrationConnUser: index('idx_integration_connections_user').on(table.userId),
  idxIntegrationConnType: index('idx_integration_connections_type').on(table.erpType),
}));

export const integrationSyncRuns = sqliteTable('integration_sync_runs', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull().references(() => integrationConnections.id, { onDelete: 'cascade' }),
  erpType: text('erp_type').notNull().$type<'procore' | 'sage300' | 'vista'>(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  recordsSynced: integer('records_synced').notNull().default(0),
  errorsCount: integer('errors_count').notNull().default(0),
  errorDetail: text('error_detail'),
  trigger: text('trigger').notNull().$type<'cron' | 'manual'>(),
}, (table) => ({
  idxSyncRunsConn: index('idx_sync_runs_connection').on(table.connectionId),
}));

// ── Phase 64: SOC 2 Security Audit Tables ────────────────────────────────
export const securityEvents = sqliteTable('security_events', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').references(() => users.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  metadata:  text('metadata'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxSecEventsUserTime: index('idx_sec_events_user_time').on(table.userId, table.createdAt),
}));

export const loginAttempts = sqliteTable('login_attempts', {
  id:            text('id').primaryKey(),
  email:         text('email').notNull(),
  success:       integer('success', { mode: 'boolean' }).notNull().default(false),
  ipAddress:     text('ip_address'),
  createdAt:     text('created_at').notNull(),
  failureReason: text('failure_reason'),
}, (table) => ({
  idxLoginAttemptsEmailTime: index('idx_login_attempts_email_time').on(table.email, table.createdAt),
}));

// ── Phase 76: Field Photo Capture ────────────────────────────────────────
// Photos are linked to a project + payroll week. filePath is relative to
// PHOTOS_DIR env var (persisted disk on Render, local subfolder in dev).
export const weekPhotos = sqliteTable('week_photos', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id, { onDelete: 'cascade' }),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  filePath: text('file_path').notNull(),   // relative to PHOTOS_DIR
  caption: text('caption'),
  takenAt: text('taken_at').notNull(),     // ISO 8601 from EXIF or Date.now()
  latitude: real('latitude'),
  longitude: real('longitude'),
  createdAt: text('created_at').notNull(),
});

// ── Phase 96: Project-level Site Photos ───────────────────────────────────
export const projectPhotos = sqliteTable('project_photos', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  filePath: text('file_path').notNull(),   // relative to PHOTOS_DIR/project-photos/
  caption: text('caption'),
  takenAt: text('taken_at').notNull(),     // ISO 8601 (from EXIF or upload time)
  latitude: real('latitude'),
  longitude: real('longitude'),
  createdAt: text('created_at').notNull(),
});

// ── Phase 96: Contractor Digital Signatures ───────────────────────────────
// One signature per project (upsert). Stored as PNG blob on disk.
export const contractorSignatures = sqliteTable('contractor_signatures', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  filePath: text('file_path').notNull(),   // relative to SIGNATURES_DIR
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ── Phase 75: GPS Clock-In / Clock-Out ────────────────────────────────────
// Records individual clock-in and clock-out punches per worker per project.
// GPS fields are nullable — GPS is opt-in per project and may fail gracefully.
// CA AB 1355: location data is used only for job site verification, never for
// continuous tracking.
export const timePunches = sqliteTable('time_punches', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  workerId: text('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  punchType: text('punch_type').notNull().$type<'in' | 'out'>(),
  punchedAt: text('punched_at').notNull(), // ISO 8601
  // GPS fields — nullable because GPS is opt-in and may fail gracefully
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracyMeters: real('accuracy_meters'),
  // Audit
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  projectWorkerIdx: index('time_punch_project_worker_idx').on(table.projectId, table.workerId),
}));

// ── Phase 81: API Keys + Webhooks ────────────────────────────────────────
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  scopes: text('scopes').notNull(), // JSON array: ['projects:read','payroll:read','workers:read']
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
  revokedAt: text('revoked_at'),
}, (table) => ({
  keyHashUniqueIdx: uniqueIndex('idx_api_keys_key_hash_unique').on(table.keyHash),
  userIdx: index('idx_api_keys_user').on(table.userId),
}));

export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secret: text('secret').notNull(), // HMAC signing secret (encrypted with encryptSsn)
  events: text('events').notNull(), // JSON array: ['payroll.submitted','violation.detected']
  active: integer('active', { mode: 'boolean' }).default(true),
  failureCount: integer('failure_count').default(0),
  lastDeliveredAt: text('last_delivered_at'),
  createdAt: text('created_at').notNull(),
});

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: text('payload').notNull(), // JSON
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  deliveredAt: text('delivered_at'),
  failedAt: text('failed_at'),
  retryCount: integer('retry_count').default(0),
  // API-05: delivery status for retry poller
  status: text('status').notNull().default('pending').$type<'pending' | 'succeeded' | 'failed'>(),
}, (table) => ({
  idxDeliveryStatus: index('idx_webhook_deliveries_status').on(table.status, table.retryCount),
}));

// ── Phase 98: Offline Checklist Sync Log ──────────────────────────────────
export const checklistSyncs = sqliteTable('checklist_syncs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  payload: text('payload').notNull(), // JSON string of Checklist
  syncedAt: text('synced_at').notNull(),
});

// ── Phase 100: ROI Calculator Leads ─────────────────────────────────────
export const roiLeads = sqliteTable('roi_leads', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  projectCount: integer('project_count').notNull(),
  workerCount: integer('worker_count').notNull(),
  estimatedSavings: real('estimated_savings').notNull(),
  capturedAt: text('captured_at').notNull(),  // ISO 8601
});

// ── Phase 102: Enterprise SSO Configuration (ENT-02) ──────────────────────
// One row per enterprise tenant. Stores IdP metadata for Okta / Azure AD /
// Google Workspace / generic SAML. status transitions: pending → active → disabled.
export const ssoConfigs = sqliteTable('sso_configs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull()
    .$type<'okta' | 'azure_ad' | 'google_workspace' | 'generic_saml'>(),
  status: text('status').notNull().default('pending')
    .$type<'pending' | 'active' | 'disabled'>(),
  // IdP metadata (from XML metadata download or manual entry)
  idpEntityId: text('idp_entity_id'),
  idpSsoUrl: text('idp_sso_url'),
  idpCertificate: text('idp_certificate'),
  // SP metadata (we provide to the IdP)
  spEntityId: text('sp_entity_id'),
  spAcsUrl: text('sp_acs_url'),
  // Email domain that triggers SSO redirect (e.g. "acme.com")
  domain: text('domain'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ── Phase 103: AI Classification Assist Audit Trail (AI-02) ───────────────
// Every POST /api/ai/classify call is persisted here. Required for IL AI Act
// disclosure compliance and SOC 2 audit trail.
export const aiClassifications = sqliteTable('ai_classifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  jobDescription: text('job_description').notNull(),
  tradeCode: text('trade_code').notNull(),
  tradeDescription: text('trade_description').notNull(),
  confidence: real('confidence').notNull(),
  reasoning: text('reasoning'),
  alternativesJson: text('alternatives_json'), // JSON array
  modelUsed: text('model_used').notNull(),
  latencyMs: integer('latency_ms'),
  createdAt: text('created_at').notNull(),
});

// ── Phase 153: Compliance Cache (PERF-01) ────────────────────────────────
// Write-through cache keyed by (project_id, week_id). TTL = 5 minutes.
// Invalidated on every payroll entry save. Eliminates N+1 in getBatchProjectCompliance.
export const complianceCache = sqliteTable('compliance_cache', {
  projectId: text('project_id').notNull(),
  weekId: text('week_id').notNull(),
  computedAt: integer('computed_at').notNull(),
  violationCount: integer('violation_count').notNull().default(0),
  hasCritical: integer('has_critical').notNull().default(0),
  violationsJson: text('violations_json').notNull().default('[]'),
}, (table) => ({
  complianceCachePk: uniqueIndex('compliance_cache_pk').on(table.projectId, table.weekId),
}));

// PrevWage Copilot interactions. The Copilot is advisory by default: it may
// explain and prepare fixes, but user approval is required before any mutation.
export const copilotInteractions = sqliteTable('copilot_interactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  payrollWeekId: text('payroll_week_id').references(() => payrollWeeks.id, { onDelete: 'set null' }),
  pagePath: text('page_path'),
  userMessage: text('user_message').notNull(),
  assistantMessage: text('assistant_message').notNull(),
  contextJson: text('context_json').notNull(),
  suggestionsJson: text('suggestions_json').notNull(),
  modelUsed: text('model_used').notNull(),
  latencyMs: integer('latency_ms'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxCopilotUserTime: index('idx_copilot_user_time').on(table.userId, table.createdAt),
  idxCopilotProjectTime: index('idx_copilot_project_time').on(table.projectId, table.createdAt),
}));
