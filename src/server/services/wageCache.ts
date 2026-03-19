// src/server/services/wageCache.ts
// All SQLite wage reads and writes go through here.
// Uses the getDb() pattern from Phase 1.
// wdolSync.ts and wageLookup.ts both import from here — never access the tables directly.

import { eq, and, gt, desc } from 'drizzle-orm';
import { wageDeterminations, wageClassifications } from '../db/schema.js';
import { getDb } from '../db/index.js';
import type { ParsedClassification } from './wdolParser.js';

export interface NewWageDetermination {
  id: string;
  source: 'federal-dol' | 'ca-dir' | 'wa-li' | 'ny-dol' | 'manual';
  wdNumber: string;
  revisionNumber: number;
  state: string;
  county: string | null;
  constructionType: string | null;
  publishDate: string | null;
  rawDocument: string | null;
  cachedAt: string;
  cacheExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// Upsert: if (wdNumber, revisionNumber) already exists, update the cache fields.
// Requires the unique index on (wd_number, revision_number) in the schema.
export function upsertWageDetermination(data: NewWageDetermination): void {
  const db = getDb();
  db.insert(wageDeterminations)
    .values({ ...data, isActive: true })
    .onConflictDoUpdate({
      target: [wageDeterminations.wdNumber, wageDeterminations.revisionNumber],
      set: {
        rawDocument: data.rawDocument,
        cachedAt: data.cachedAt,
        cacheExpiresAt: data.cacheExpiresAt,
        updatedAt: data.updatedAt,
      },
    })
    .run();
}

// Insert parsed classifications for a WD. Deletes existing rows first to prevent
// duplicate classifications on re-sync. Uses the cascade-delete FK but we delete
// explicitly here because upsertWageDetermination may reuse the existing row id.
export function upsertClassifications(
  wageDeterminationId: string,
  classifications: ParsedClassification[]
): void {
  const db = getDb();
  db.delete(wageClassifications)
    .where(eq(wageClassifications.wageDeterminationId, wageDeterminationId))
    .run();

  if (classifications.length === 0) return;

  const now = new Date().toISOString();
  const rows = classifications.map((c) => ({
    id: crypto.randomUUID(),
    wageDeterminationId,
    tradeCode: c.code,
    tradeDescription: c.description,
    laborType: 'journeyworker' as const,
    baseRate: c.baseRate,
    fringeRate: c.fringeRate,
    totalRate: c.totalRate,
    createdAt: now,
  }));

  db.insert(wageClassifications).values(rows).run();
}

// Returns the freshest unexpired WD for state+county, or undefined if none.
export function getCachedWd(
  state: string,
  county: string
): typeof wageDeterminations.$inferSelect | undefined {
  const db = getDb();
  const now = new Date().toISOString();
  return db
    .select()
    .from(wageDeterminations)
    .where(
      and(
        eq(wageDeterminations.state, state),
        eq(wageDeterminations.county, county),
        gt(wageDeterminations.cacheExpiresAt, now)
      )
    )
    .orderBy(desc(wageDeterminations.publishDate))
    .limit(1)
    .get() as typeof wageDeterminations.$inferSelect | undefined;
}

// Returns all classification rows for a WD.
export function getCachedClassifications(
  wageDeterminationId: string
): (typeof wageClassifications.$inferSelect)[] {
  const db = getDb();
  return db
    .select()
    .from(wageClassifications)
    .where(eq(wageClassifications.wageDeterminationId, wageDeterminationId))
    .all() as (typeof wageClassifications.$inferSelect)[];
}

// Returns a WD by primary key id.
export function getWdById(
  id: string
): typeof wageDeterminations.$inferSelect | undefined {
  const db = getDb();
  return db
    .select()
    .from(wageDeterminations)
    .where(eq(wageDeterminations.id, id))
    .get() as typeof wageDeterminations.$inferSelect | undefined;
}
