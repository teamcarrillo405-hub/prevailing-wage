// src/server/services/wageCache.ts
// All SQLite wage reads and writes go through here.
// Uses the getDb() pattern from Phase 1.
// wdolSync.ts and wageLookup.ts both import from here — never access the tables directly.

import { eq, and, gt, desc, isNull, or, sql } from 'drizzle-orm';
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
// Returns the actual DB row id (may differ from data.id on conflict — caller must use
// the returned id when inserting classifications to avoid FK constraint failure).
export function upsertWageDetermination(data: NewWageDetermination): string {
  const db = getDb();
  const existing = db
    .select({ id: wageDeterminations.id })
    .from(wageDeterminations)
    .where(
      and(
        eq(wageDeterminations.wdNumber, data.wdNumber),
        eq(wageDeterminations.revisionNumber, data.revisionNumber),
      )
    )
    .get() as { id: string } | undefined;

  if (existing) {
    db.update(wageDeterminations)
      .set({
        rawDocument: data.rawDocument,
        cachedAt: data.cachedAt,
        cacheExpiresAt: data.cacheExpiresAt,
        updatedAt: data.updatedAt,
      })
      .where(eq(wageDeterminations.id, existing.id))
      .run();
    return existing.id;
  }

  db.insert(wageDeterminations).values({ ...data, isActive: true }).run();
  return data.id;
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

// Returns the freshest unexpired WD for state+county.
// Tries exact county match first; falls back to statewide (county IS NULL) for the same state.
export function getCachedWd(
  state: string,
  county: string
): typeof wageDeterminations.$inferSelect | undefined {
  const db = getDb();
  const now = new Date().toISOString();

  // Exact county match first (case-insensitive — project stores lowercase, WD may be title case)
  const exact = db
    .select()
    .from(wageDeterminations)
    .where(
      and(
        eq(wageDeterminations.state, state),
        sql`LOWER(${wageDeterminations.county}) = LOWER(${county})`,
        gt(wageDeterminations.cacheExpiresAt, now)
      )
    )
    .orderBy(desc(wageDeterminations.publishDate))
    .limit(1)
    .get() as typeof wageDeterminations.$inferSelect | undefined;

  if (exact) return exact;

  // Fallback: statewide WD (county IS NULL) for same state
  return db
    .select()
    .from(wageDeterminations)
    .where(
      and(
        eq(wageDeterminations.state, state),
        isNull(wageDeterminations.county),
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
