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
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const workers = sqliteTable('workers', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ssnLast4: text('ssn_last4'),
  tradeUnion: text('trade_union'),
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
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
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
