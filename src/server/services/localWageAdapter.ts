// src/server/services/localWageAdapter.ts
// Adapter for county/municipal prevailing wage schedules.
// Locality is resolved by project's state + locality_name project field.
// Rate data imported via admin CSV — same flow as state adapters.

import { eq, and } from 'drizzle-orm';
import { wageDeterminations } from '../db/schema.js';
import { getDb } from '../db/index.js';
import { getCachedClassifications } from './wageCache.js';
import type { WageAdapter } from './wageLookup.js';
import type { WageDetermination, WageClassification } from '../../shared/types.js';

export class LocalWageAdapter implements WageAdapter {
  source = 'local' as const;
  private localityName: string;
  private stateCode: string;

  constructor(stateCode: string, localityName: string) {
    this.stateCode = stateCode.toUpperCase();
    this.localityName = localityName;
  }

  supportsLookup(state: string): boolean {
    return state.toUpperCase() === this.stateCode;
  }

  async fetchDetermination(state: string, _county: string): Promise<WageDetermination | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(wageDeterminations)
      .where(
        and(
          eq(wageDeterminations.source, 'local'),
          eq(wageDeterminations.state, state.toUpperCase()),
          eq(wageDeterminations.county, this.localityName),
          eq(wageDeterminations.isActive, true),
        )
      )
      .limit(1);

    if (!row) return null;

    const classifications = await getCachedClassifications(row.id);
    return {
      id: row.id,
      source: 'local',
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
