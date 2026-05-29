import { pgTable, text, integer, doublePrecision, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
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
  totpSecret: text('totp_secret'),
  totpEnabled: integer('totp_enabled').default(0),
  totpBackupCodes: text('totp_backup_codes'),
  sessionVersion: integer('session_version').notNull().default(0),
});

export const onboardingProfiles = pgTable('onboarding_profiles', {
  userId: text('user_id').primaryKey().references(() => users.id),
  contractorRole: text('contractor_role').notNull()
    .$type<'general_contractor' | 'subcontractor' | 'both'>(),
  companySize: text('company_size').notNull()
    .$type<'1_10' | '11_50' | '51_200' | '201_plus'>(),
  primaryStates: text('primary_states').notNull(),
  workTypes: text('work_types').notNull(),
  payrollProvider: text('payroll_provider')
    .$type<'quickbooks' | 'adp' | 'gusto' | 'paychex' | 'sage_300' | 'sage_100' | 'other' | 'none'>(),
  accountingProvider: text('accounting_provider')
    .$type<'quickbooks' | 'sage_300' | 'other' | 'none'>(),
  projectManagementProvider: text('project_management_provider')
    .$type<'procore' | 'other' | 'none'>(),
  averageWeeklyWorkers: integer('average_weekly_workers'),
  usesSubcontractors: integer('uses_subcontractors').notNull().default(0),
  usesApprentices: integer('uses_apprentices').notNull().default(0),
  fieldTrackingNeeded: integer('field_tracking_needed').notNull().default(0),
  onboardingAnswers: text('onboarding_answers').notNull(),
  recommendedNextSteps: text('recommended_next_steps').notNull(),
  completedAt: text('completed_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  state: text('state').notNull(),
  county: text('county').notNull(),
  contractType: text('contract_type').notNull()
    .$type<'federal-davis-bacon' | 'state-prevailing' | 'gsa-schedule' | 'private'>(),
  awardDate: text('award_date').notNull(),
  fundingType: text('funding_type').notNull()
    .$type<'federal' | 'state' | 'mixed'>(),
  wdIdentifier: text('wd_identifier'),
  wdModNumber: integer('wd_mod_number'),
  wdLockedAt: text('wd_locked_at'),
  status: text('status').notNull().default('active').$type<'active' | 'closed'>(),
  projectType: text('project_type').notNull().default('davis-bacon').$type<'davis-bacon' | 'sca' | 'both'>(),
  cslbLicense: text('cslb_license'),
  wcPolicyNumber: text('wc_policy_number'),
  ubiNumber: text('ubi_number'),
  lniCertificate: text('lni_certificate'),
  wcAccount: text('wc_account'),
  contractorFein: text('contractor_fein'),
  dirProjectId: text('dir_project_id'),
  awardingAgency: text('awarding_agency'),
  contractNumber: text('contract_number'),
  pwiaIntentId: text('pwia_intent_id'),
  nyprcNumber: text('nyp_rc_number'),
  nysContractorRegNumber: text('nys_contractor_reg_number'),
  txdotProjectId: text('txdot_project_id'),
  txContractorLicense: text('tx_contractor_license'),
  txAwardingAgency: text('tx_awarding_agency'),
  maDlsProjectId: text('ma_dls_project_id'),
  maSicCode: text('ma_sic_code'),
  njPwcNumber: text('nj_pwc_number'),
  njContractId: text('nj_contract_id'),
  mnContractId: text('mn_contract_id'),
  vaContractId: text('va_contract_id'),
  projectSettings: text('project_settings'),
  apprenticeshipRequirements: text('apprenticeship_requirements'),
  isIraIijaProject: integer('is_ira_iija_project').default(0),
  gpsClockInEnabled: integer('gps_clock_in_enabled').default(0),
  gpsLatitude: doublePrecision('gps_latitude'),
  gpsLongitude: doublePrecision('gps_longitude'),
  gpsRadiusMeters: doublePrecision('gps_radius_meters').default(500),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectMembers = pgTable('project_members', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role').notNull().$type<'owner' | 'member' | 'auditor'>(),
  joinedAt: text('joined_at').notNull(),
  removedAt: text('removed_at'),
}, (table) => ({
  projectMemberUnique: uniqueIndex('project_member_unique').on(table.projectId, table.userId),
}));

export const teamInvites = pgTable('team_invites', {
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

export const workers = pgTable('workers', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  ssnLast4: text('ssn_last4'),
  ssnEncrypted: text('ssn_encrypted'),
  tradeUnion: text('trade_union'),
  address: text('address'),
  addressStreet: text('address_street'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressZip: text('address_zip'),
  unionLocal: text('union_local'),
  unionBookNumber: text('union_book_number'),
  apprenticeshipCommittee: text('apprenticeship_committee'),
  apprenticeshipRegNumber: text('apprenticeship_reg_number'),
  nysRegisteredApprentice: integer('nys_registered_apprentice').notNull().default(0),
  race: text('race'),
  ethnicity: text('ethnicity'),
  gender: text('gender'),
  veteranStatus: text('veteran_status'),
  skillLevel: text('skill_level'),
  isWoman: integer('is_woman'),
  isMinority: integer('is_minority'),
  oshaTraining: integer('osha_training'),
  workerSex: text('worker_sex'),
  apprenticeshipProgramName: text('apprenticeship_program_name'),
  rapidsNumber: text('rapids_number'),
  isActive: integer('is_active').notNull().default(1),
  erpExternalId: text('erp_external_id'),
  erpSource: text('erp_source'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const workerClassifications = pgTable('worker_classifications', {
  id: text('id').primaryKey(),
  workerId: text('worker_id').notNull().references(() => workers.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  tradeCode: text('trade_code').notNull(),
  tradeDescription: text('trade_description').notNull(),
  laborType: text('labor_type').notNull()
    .$type<'journeyworker' | 'apprentice' | 'foreman'>(),
  apprenticePercent: integer('apprentice_percent'),
  programName: text('program_name'),
  isActive: integer('is_active').notNull().default(1),
  waManualRate: doublePrecision('wa_manual_rate'),
  waTradeCode: text('wa_trade_code'),
  createdAt: text('created_at').notNull(),
});

export const payrollWeekClassifications = pgTable('payroll_week_classifications', {
  id: text('id').primaryKey(),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id),
  workerId: text('worker_id').notNull().references(() => workers.id),
  classificationId: text('classification_id').notNull().references(() => workerClassifications.id),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  pwcUnique: uniqueIndex('pwc_unique').on(table.payrollWeekId, table.workerId),
}));

export const wageDeterminations = pgTable('wage_determinations', {
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
  isActive: integer('is_active').notNull().default(1),
  cachedAt: text('cached_at').notNull(),
  cacheExpiresAt: text('cache_expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastFetchedAt: text('last_fetched_at'),
}, (table) => ({
  wdRevUnique: uniqueIndex('wd_rev_unique').on(table.wdNumber, table.revisionNumber),
}));

export const wageClassifications = pgTable('wage_classifications', {
  id: text('id').primaryKey(),
  wageDeterminationId: text('wage_determination_id').notNull()
    .references(() => wageDeterminations.id),
  tradeCode: text('trade_code').notNull(),
  tradeDescription: text('trade_description').notNull(),
  laborType: text('labor_type').notNull()
    .$type<'journeyworker' | 'foreman' | 'apprentice'>()
    .default('journeyworker'),
  baseRate: doublePrecision('base_rate').notNull(),
  fringeRate: doublePrecision('fringe_rate').notNull(),
  totalRate: doublePrecision('total_rate').notNull(),
  createdAt: text('created_at').notNull(),
});

export const projectWageDeterminations = pgTable('project_wage_determinations', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull()
    .references(() => projects.id),
  wageDeterminationId: text('wage_determination_id').notNull()
    .references(() => wageDeterminations.id),
  constructionType: text('construction_type')
    .$type<'Building' | 'Heavy' | 'Highway' | 'Residential'>(),
  isPrimary: integer('is_primary').notNull().default(0),
  pinnedAt: text('pinned_at').notNull(),
  pinnedByUserId: text('pinned_by_user_id')
    .references(() => users.id),
}, (table) => ({
  projWdUnique: uniqueIndex('idx_proj_wd_unique').on(table.projectId, table.wageDeterminationId),
}));

export const wageSyncMeta = pgTable('wage_sync_meta', {
  id: text('id').primaryKey(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  status: text('status').notNull()
    .$type<'running' | 'success' | 'partial' | 'failed'>(),
  wdsFetched: integer('wds_fetched').default(0),
  wdsFailed: integer('wds_failed').default(0),
  errorMessage: text('error_message'),
});

export const wdRevisionLog = pgTable('wd_revision_log', {
  id: text('id').primaryKey(),
  wdId: text('wd_id').notNull()
    .references(() => wageDeterminations.id),
  oldRevision: integer('old_revision').notNull(),
  newRevision: integer('new_revision').notNull(),
  detectedAt: text('detected_at').notNull(),
  changeSummary: text('change_summary'),
});

export const payrollWeeks = pgTable('payroll_weeks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  weekEndingDate: text('week_ending_date').notNull(),
  payrollNumber: integer('payroll_number').notNull(),
  isFinal: integer('is_final').notNull().default(0),
  submittedAt: text('submitted_at'),
  submittedTo: text('submitted_to'),
  amendmentNumber: integer('amendment_number'),
  originalWeekId: text('original_week_id'),
  caEcprSubmittedAt: text('ca_ecpr_submitted_at'),
  waLniSubmittedAt: text('wa_lni_submitted_at'),
  nyMpwrSubmittedAt: text('ny_mpwr_submitted_at'),
  ilIdolSubmittedAt: text('il_idol_submitted_at'),
  txCprSubmittedAt: text('tx_cpr_submitted_at'),
  qboJournalEntryId: text('qbo_journal_entry_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const payrollEntries = pgTable('payroll_entries', {
  id: text('id').primaryKey(),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id),
  workerId: text('worker_id').notNull().references(() => workers.id),
  classificationId: text('classification_id').notNull().references(() => workerClassifications.id),
  monSt: doublePrecision('mon_st').notNull().default(0),
  tueSt: doublePrecision('tue_st').notNull().default(0),
  wedSt: doublePrecision('wed_st').notNull().default(0),
  thuSt: doublePrecision('thu_st').notNull().default(0),
  friSt: doublePrecision('fri_st').notNull().default(0),
  satSt: doublePrecision('sat_st').notNull().default(0),
  sunSt: doublePrecision('sun_st').notNull().default(0),
  monOt: doublePrecision('mon_ot').notNull().default(0),
  tueOt: doublePrecision('tue_ot').notNull().default(0),
  wedOt: doublePrecision('wed_ot').notNull().default(0),
  thuOt: doublePrecision('thu_ot').notNull().default(0),
  friOt: doublePrecision('fri_ot').notNull().default(0),
  satOt: doublePrecision('sat_ot').notNull().default(0),
  sunOt: doublePrecision('sun_ot').notNull().default(0),
  monDt: doublePrecision('mon_dt').notNull().default(0),
  tueDt: doublePrecision('tue_dt').notNull().default(0),
  wedDt: doublePrecision('wed_dt').notNull().default(0),
  thuDt: doublePrecision('thu_dt').notNull().default(0),
  friDt: doublePrecision('fri_dt').notNull().default(0),
  satDt: doublePrecision('sat_dt').notNull().default(0),
  sunDt: doublePrecision('sun_dt').notNull().default(0),
  baseRateSnapshot: doublePrecision('base_rate_snapshot').notNull(),
  fringeRateSnapshot: doublePrecision('fringe_rate_snapshot').notNull(),
  grossWages: doublePrecision('gross_wages'),
  deductions: doublePrecision('deductions').notNull().default(0),
  netPay: doublePrecision('net_pay'),
  fringeHealthWelfare: doublePrecision('fringe_health_welfare'),
  fringePension: doublePrecision('fringe_pension'),
  fringeVacation: doublePrecision('fringe_vacation'),
  fringeTraining: doublePrecision('fringe_training'),
  nonPwHours: doublePrecision('non_pw_hours'),
  checkNumber: text('check_number'),
  allOtherHours: doublePrecision('all_other_hours'),
  totalWeekGrossWages: doublePrecision('total_week_gross_wages'),
  ficaTax: doublePrecision('fica_tax'),
  federalIncomeTax: doublePrecision('federal_income_tax'),
  stateIncomeTax: doublePrecision('state_income_tax'),
  sdiTax: doublePrecision('sdi_tax'),
  deductionVacationHoliday: doublePrecision('deduction_vacation_holiday'),
  deductionHealthWelfare: doublePrecision('deduction_health_welfare'),
  deductionPension: doublePrecision('deduction_pension'),
  deductionTraining: doublePrecision('deduction_training'),
  deductionFundAdmin: doublePrecision('deduction_fund_admin'),
  deductionDues: doublePrecision('deduction_dues'),
  deductionTravelSubsistence: doublePrecision('deduction_travel_subsistence'),
  deductionSavings: doublePrecision('deduction_savings'),
  deductionOther: doublePrecision('deduction_other'),
  deductionOtherDescription: text('deduction_other_description'),
  createdByUserId: text('created_by_user_id').references(() => users.id),
  updatedByUserId: text('updated_by_user_id').references(() => users.id),
  subcontractorId: text('subcontractor_id').references(() => subcontractors.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  payrollEntryUnique: uniqueIndex('payroll_entry_unique').on(
    table.payrollWeekId,
    table.workerId,
    table.classificationId,
  ),
}));

export const payrollImports = pgTable('payroll_imports', {
  id: text('id').primaryKey(),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id),
  importedByUserId: text('imported_by_user_id').notNull().references(() => users.id),
  provider: text('provider').notNull().$type<'quickbooks' | 'adp' | 'gusto' | 'paychex' | 'sage_300'>(),
  sourceFilename: text('source_filename'),
  committedCount: integer('committed_count').notNull(),
  unmatchedCount: integer('unmatched_count').notNull(),
  createdAt: text('created_at').notNull(),
});

export const submitReadyAcknowledgements = pgTable('submit_ready_acknowledgements', {
  id: text('id').primaryKey(),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id),
  issueId: text('issue_id').notNull(),
  acknowledgedByUserId: text('acknowledged_by_user_id').notNull().references(() => users.id),
  note: text('note'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  submitReadyAckUnique: uniqueIndex('submit_ready_ack_unique').on(table.payrollWeekId, table.issueId),
  submitReadyAckWeekIdx: index('idx_submit_ready_ack_week').on(table.payrollWeekId),
}));

export const payrollProviderMappings = pgTable('payroll_provider_mappings', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  provider: text('provider').notNull(),
  providerWorkerId: text('provider_worker_id').notNull(),
  workerId: text('worker_id').notNull().references(() => workers.id),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  providerMappingUnique: uniqueIndex('provider_mapping_unique').on(
    table.projectId,
    table.provider,
    table.providerWorkerId,
  ),
}));

export const unionTradeConfigs = pgTable('union_trade_configs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  tradeCode: text('trade_code').notNull(),
  tradeName: text('trade_name').notNull(),
  unionName: text('union_name'),
  baseRate: doublePrecision('base_rate').notNull(),
  fringeRate: doublePrecision('fringe_rate').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const otThresholds = pgTable('ot_thresholds', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  weeklyOtThreshold: doublePrecision('weekly_ot_threshold').notNull().default(40),
  dailyOtThreshold: doublePrecision('daily_ot_threshold'),
  dailyDtThreshold: doublePrecision('daily_dt_threshold'),
  otMultiplier: doublePrecision('ot_multiplier').notNull().default(1.5),
  dtMultiplier: doublePrecision('dt_multiplier').notNull().default(2.0),
  source: text('source').notNull().default('cwhssa')
    .$type<'cwhssa' | 'cba' | 'state'>(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const gsaRates = pgTable('gsa_rates', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  baseRate: doublePrecision('base_rate').notNull(),
  fringeRate: doublePrecision('fringe_rate').notNull().default(0),
  overheadPct: doublePrecision('overhead_pct').notNull(),
  gaPct: doublePrecision('ga_pct').notNull(),
  profitPct: doublePrecision('profit_pct').notNull(),
  billableRate: doublePrecision('billable_rate').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectBudgets = pgTable('project_budgets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().unique().references(() => projects.id),
  bidAmount: doublePrecision('bid_amount'),
  workingBudget: doublePrecision('working_budget').notNull(),
  totalWeeks: integer('total_weeks').notNull(),
  varianceThresholdPct: doublePrecision('variance_threshold_pct').notNull().default(10),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id:          text('id').primaryKey(),
  createdAt:   text('created_at').notNull(),
  userId:      text('user_id').references(() => users.id),
  userEmail:   text('user_email'),
  ipAddress:   text('ip_address'),
  projectId:   text('project_id').references(() => projects.id),
  entityType:  text('entity_type').notNull(),
  entityId:    text('entity_id').notNull(),
  action:      text('action').notNull(),
  diff:        text('diff'),
  snapshot:    text('snapshot'),
  meta:        text('meta'),
  previousHash: text('previous_hash'),
  entryHash:    text('entry_hash'),
}, (table) => ({
  idxAuditProject: index('idx_audit_project_time').on(table.projectId, table.createdAt),
  idxAuditEntity:  index('idx_audit_entity').on(table.entityType, table.entityId, table.createdAt),
  idxAuditUser:    index('idx_audit_user').on(table.userId, table.createdAt),
}));

export const subcontractors = pgTable('subcontractors', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  licenseNumber: text('license_number'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  address: text('address'),
  dbeClassification: text('dbe_classification').notNull().default('none')
    .$type<'none' | 'dbe' | 'mbe' | 'wbe' | 'sdvosb'>(),
  createdAt: text('created_at').notNull(),
});

export const subcontractorCprWeeks = pgTable('subcontractor_cpr_weeks', {
  id: text('id').primaryKey(),
  subcontractorId: text('subcontractor_id').notNull().references(() => subcontractors.id),
  weekEndingDate: text('week_ending_date').notNull(),
  receivedDate: text('received_date'),
  isCompliant: integer('is_compliant'),
  notes: text('notes'),
  uploadToken:          text('upload_token'),
  uploadTokenExpiresAt: text('upload_token_expires_at'),
  uploadedAt:           text('uploaded_at'),
  uploadPath:           text('upload_path'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  subCprWeekUnique: uniqueIndex('sub_cpr_week_unique').on(table.subcontractorId, table.weekEndingDate),
}));

export const subcontractorCertifications = pgTable('subcontractor_certifications', {
  id: text('id').primaryKey(),
  subcontractorId: text('subcontractor_id').notNull().references(() => subcontractors.id),
  certTypes: text('cert_types').notNull(),
  certifyingAgency: text('certifying_agency'),
  certNumber: text('cert_number'),
  naicsCodes: text('naics_codes'),
  issueDate: text('issue_date'),
  expiresDate: text('expires_date'),
  ownerRace: text('owner_race'),
  ownerGender: text('owner_gender'),
  personalNetWorthUsd: integer('personal_net_worth_usd'),
  reevaluationStatus: text('reevaluation_status').default('not_required'),
  selfCertified: integer('self_certified').default(0),
  documentPath: text('document_path'),
  uei: text('uei'),
  cageCode: text('cage_code'),
  samRegistrationStatus: text('sam_registration_status'),
  samLastVerifiedAt: text('sam_last_verified_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_sub_certs_sub').on(table.subcontractorId),
  index('idx_sub_certs_expires').on(table.expiresDate, table.reevaluationStatus),
]);

export const qboTokens = pgTable('qbo_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
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

export const procoreTokens = pgTable('procore_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  companyId: text('company_id').notNull(),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  accessTokenExpiresAt: text('access_token_expires_at').notNull(),
  refreshTokenExpiresAt: text('refresh_token_expires_at').notNull(),
  connectedAt: text('connected_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  idxProcoreUser: index('idx_procore_tokens_user').on(table.userId),
}));

export const integrationConnections = pgTable('integration_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
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

export const integrationSyncRuns = pgTable('integration_sync_runs', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull().references(() => integrationConnections.id),
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

export const securityEvents = pgTable('security_events', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  metadata:  text('metadata'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxSecEventsUserTime: index('idx_sec_events_user_time').on(table.userId, table.createdAt),
}));

export const loginAttempts = pgTable('login_attempts', {
  id:            text('id').primaryKey(),
  email:         text('email').notNull(),
  success:       integer('success').notNull().default(0),
  ipAddress:     text('ip_address'),
  createdAt:     text('created_at').notNull(),
  failureReason: text('failure_reason'),
}, (table) => ({
  idxLoginAttemptsEmailTime: index('idx_login_attempts_email_time').on(table.email, table.createdAt),
}));

export const weekPhotos = pgTable('week_photos', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  filePath: text('file_path').notNull(),
  caption: text('caption'),
  takenAt: text('taken_at').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  createdAt: text('created_at').notNull(),
});

export const projectPhotos = pgTable('project_photos', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  filePath: text('file_path').notNull(),
  caption: text('caption'),
  takenAt: text('taken_at').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  createdAt: text('created_at').notNull(),
});

export const contractorSignatures = pgTable('contractor_signatures', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().unique().references(() => projects.id),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  filePath: text('file_path').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const timePunches = pgTable('time_punches', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  workerId: text('worker_id').notNull().references(() => workers.id),
  punchType: text('punch_type').notNull().$type<'in' | 'out'>(),
  punchedAt: text('punched_at').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  accuracyMeters: doublePrecision('accuracy_meters'),
  status: text('status').notNull().default('approved').$type<'draft' | 'submitted' | 'approved' | 'rejected'>(),
  rejectionReason: text('rejection_reason'),
  supervisorId: text('supervisor_id').references(() => users.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  projectWorkerIdx: index('time_punch_project_worker_idx').on(table.projectId, table.workerId),
}));

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  scopes: text('scopes').notNull(),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
  revokedAt: text('revoked_at'),
}, (table) => ({
  keyHashUniqueIdx: uniqueIndex('idx_api_keys_key_hash_unique').on(table.keyHash),
  userIdx: index('idx_api_keys_user').on(table.userId),
}));

export const webhooks = pgTable('webhooks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: text('events').notNull(),
  active: integer('active').default(1),
  failureCount: integer('failure_count').default(0),
  lastDeliveredAt: text('last_delivered_at'),
  createdAt: text('created_at').notNull(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull().references(() => webhooks.id),
  event: text('event').notNull(),
  payload: text('payload').notNull(),
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  deliveredAt: text('delivered_at'),
  failedAt: text('failed_at'),
  retryCount: integer('retry_count').default(0),
  status: text('status').notNull().default('pending').$type<'pending' | 'succeeded' | 'failed'>(),
}, (table) => ({
  idxDeliveryStatus: index('idx_webhook_deliveries_status').on(table.status, table.retryCount),
}));

export const checklistSyncs = pgTable('checklist_syncs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  payload: text('payload').notNull(),
  syncedAt: text('synced_at').notNull(),
});

export const roiLeads = pgTable('roi_leads', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  projectCount: integer('project_count').notNull(),
  workerCount: integer('worker_count').notNull(),
  estimatedSavings: doublePrecision('estimated_savings').notNull(),
  capturedAt: text('captured_at').notNull(),
});

export const ssoConfigs = pgTable('sso_configs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull()
    .$type<'okta' | 'azure_ad' | 'google_workspace' | 'generic_saml'>(),
  status: text('status').notNull().default('pending')
    .$type<'pending' | 'active' | 'disabled'>(),
  idpEntityId: text('idp_entity_id'),
  idpSsoUrl: text('idp_sso_url'),
  idpCertificate: text('idp_certificate'),
  spEntityId: text('sp_entity_id'),
  spAcsUrl: text('sp_acs_url'),
  domain: text('domain'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const aiClassifications = pgTable('ai_classifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  projectId: text('project_id').references(() => projects.id),
  jobDescription: text('job_description').notNull(),
  tradeCode: text('trade_code').notNull(),
  tradeDescription: text('trade_description').notNull(),
  confidence: doublePrecision('confidence').notNull(),
  reasoning: text('reasoning'),
  alternativesJson: text('alternatives_json'),
  modelUsed: text('model_used').notNull(),
  latencyMs: integer('latency_ms'),
  createdAt: text('created_at').notNull(),
});

export const complianceCache = pgTable('compliance_cache', {
  projectId: text('project_id').notNull(),
  weekId: text('week_id').notNull(),
  computedAt: integer('computed_at').notNull(),
  violationCount: integer('violation_count').notNull().default(0),
  hasCritical: integer('has_critical').notNull().default(0),
  violationsJson: text('violations_json').notNull().default('[]'),
}, (table) => ({
  complianceCachePk: uniqueIndex('compliance_cache_pk').on(table.projectId, table.weekId),
}));

export const qboAccountMapping = pgTable('qbo_account_mapping', {
  id: integer('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  accountType: text('account_type').notNull().$type<'labor' | 'fringe' | 'tax'>(),
  qboAccountId: text('qbo_account_id').notNull(),
  qboAccountName: text('qbo_account_name').notNull(),
  createdAt: text('created_at').notNull(),
});

export const copilotInteractions = pgTable('copilot_interactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  projectId: text('project_id').references(() => projects.id),
  payrollWeekId: text('payroll_week_id').references(() => payrollWeeks.id),
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

export const countyWageDeterminations = pgTable('county_wage_determinations', {
  id: text('id').primaryKey(),
  state: text('state').notNull(),
  county: text('county').notNull(),
  city: text('city'),
  tradeCode: text('trade_code').notNull(),
  laborType: text('labor_type').notNull().default('journeyworker'),
  baseRate: doublePrecision('base_rate').notNull(),
  fringeRate: doublePrecision('fringe_rate').notNull().default(0),
  effectiveDate: text('effective_date').notNull(),
  source: text('source').notNull().default('manual').$type<'dir' | 'dol' | 'lni' | 'manual'>(),
  syncedAt: text('synced_at').notNull(),
  expiresAt: text('expires_at'),
}, (table) => ({
  idxCountyStateCounty: index('idx_county_wd_state_county').on(table.state, table.county),
  idxCountyStateTrade: index('idx_county_wd_state_county_trade').on(table.state, table.county, table.tradeCode),
}));

export const stateWageSources = pgTable('state_wage_sources', {
  state: text('state').primaryKey(),
  sourceType: text('source_type').notNull().default('manual').$type<'api' | 'pdf' | 'csv' | 'manual'>(),
  apiUrl: text('api_url'),
  scrapePath: text('scrape_path'),
  lastSyncedAt: text('last_synced_at'),
  syncStatus: text('sync_status').notNull().default('pending').$type<'ok' | 'error' | 'pending'>(),
});

export const localWageOrdinances = pgTable('local_wage_ordinances', {
  id: text('id').primaryKey(),
  state: text('state').notNull(),
  localityName: text('locality_name').notNull(),
  jurisdictionType: text('jurisdiction_type').notNull().$type<'county' | 'local'>(),
  administeringAgency: text('administering_agency').notNull(),
  effectiveDate: text('effective_date').notNull(),
  expirationDate: text('expiration_date'),
  sourceUrl: text('source_url'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
