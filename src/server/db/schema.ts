import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
