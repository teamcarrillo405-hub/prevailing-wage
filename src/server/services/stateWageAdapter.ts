// src/server/services/stateWageAdapter.ts
// Manual-import state adapters for WAGE-05 (v1.x).
// NO live HTTP calls — all data comes from wageDeterminations table seeded via POST /admin/wages/import-state.
// Live scraping is NOT implemented in v1 (CA DIR, WA L&I, NY DOL have no confirmed public APIs).
// To add live scraping in v2: implement fetchDetermination() with HTTP call; supportsLookup() stays the same.

import { eq, and, desc } from 'drizzle-orm';
import { wageDeterminations } from '../db/schema.js';
import { getDb } from '../db/index.js';
import { getCachedClassifications } from './wageCache.js';
import { registerAdapters, FederalWdolAdapter } from './wageLookup.js';
import type { WageAdapter } from './wageLookup.js';
import type { WageDetermination, WageClassification } from '../../shared/types.js';

// Required CSV column names for import validation.
export const STATE_CSV_COLUMNS = [
  'state', 'county', 'wd_number',
  'trade_code', 'trade_description', 'labor_type', 'base_rate', 'fringe_rate',
] as const;

// Maps state code → source value for DB storage.
export const STATE_SOURCE_MAP: Record<string, 'ca-dir' | 'wa-li' | 'ny-dol'> = {
  CA: 'ca-dir',
  WA: 'wa-li',
  NY: 'ny-dol',
};

// Base class for manual-import state adapters.
// All three state adapters share the same read logic — only the state code differs.
abstract class ManualImportStateAdapter implements WageAdapter {
  abstract source: 'ca-dir' | 'wa-li' | 'ny-dol';
  abstract stateCode: string;

  supportsLookup(state: string): boolean {
    return state.toUpperCase() === this.stateCode;
  }

  async fetchDetermination(state: string, county: string): Promise<WageDetermination | null> {
    const db = getDb();
    const row = db
      .select()
      .from(wageDeterminations)
      .where(
        and(
          eq(wageDeterminations.source, this.source),
          eq(wageDeterminations.state, state.toUpperCase()),
          eq(wageDeterminations.county, county),
          eq(wageDeterminations.isActive, true)
        )
      )
      .orderBy(desc(wageDeterminations.publishDate))
      .limit(1)
      .get() as typeof wageDeterminations.$inferSelect | undefined;

    if (!row) return null;

    const classifications = getCachedClassifications(row.id);
    return {
      id: row.id,
      source: this.source,
      wdNumber: row.wdNumber,
      revisionNumber: row.revisionNumber,
      state: row.state,
      county: row.county ?? null,
      constructionType: row.constructionType ?? null,
      publishDate: row.publishDate ?? null,
      isActive: Boolean(row.isActive),
      cachedAt: row.cachedAt,
      cacheExpiresAt: row.cacheExpiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      classifications: classifications.map((c) => ({
        id: c.id,
        wageDeterminationId: c.wageDeterminationId,
        tradeCode: c.tradeCode,
        tradeDescription: c.tradeDescription,
        laborType: c.laborType as WageClassification['laborType'],
        baseRate: c.baseRate,
        fringeRate: c.fringeRate,
        totalRate: c.totalRate,
        createdAt: c.createdAt,
      })),
    };
  }
}

export class CaDirAdapter extends ManualImportStateAdapter {
  source = 'ca-dir' as const;
  stateCode = 'CA';
}

export class WaLiAdapter extends ManualImportStateAdapter {
  source = 'wa-li' as const;
  stateCode = 'WA';
}

export class NyDolAdapter extends ManualImportStateAdapter {
  source = 'ny-dol' as const;
  stateCode = 'NY';
}

// Priority order: state adapters first, FederalWdolAdapter last.
// lookupWageDetermination() finds the first adapter where supportsLookup(state) is true.
export const WAGE_ADAPTERS: WageAdapter[] = [
  new CaDirAdapter(),
  new WaLiAdapter(),
  new NyDolAdapter(),
  new FederalWdolAdapter(),
];

// Register immediately at module load — this replaces the default adapter array in wageLookup.ts.
// This file is imported in index.ts so the adapters are registered at server startup.
registerAdapters(WAGE_ADAPTERS);
