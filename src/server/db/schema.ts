import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
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
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const workers = sqliteTable('workers', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ssnLast4: text('ssn_last4'),
  tradeUnion: text('trade_union'),
  address: text('address'),   // street, city, state zip — required for WH-347
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
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  payrollEntryUnique: uniqueIndex('payroll_entry_unique').on(
    table.payrollWeekId,
    table.workerId,
    table.classificationId,
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
