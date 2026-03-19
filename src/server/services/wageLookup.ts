// src/server/services/wageLookup.ts
// Cache-first wage lookup with adapter dispatch.
// All routes call lookupWageDetermination() — never fetch directly.
//
// Adapter order: state adapters take priority, FederalWdolAdapter is the fallback.
// 02-03 will import WAGE_ADAPTERS from stateWageAdapter.ts and replace the array below.
// For now (02-02), only FederalWdolAdapter is active.

import crypto from 'crypto';
import { getCachedWd, upsertWageDetermination, upsertClassifications, getCachedClassifications } from './wageCache.js';
import { fetchWdFromSamGov } from './wdolFetcher.js';
import { parseWdDocument } from './wdolParser.js';
import { WD_SEED_LIST } from './wdolSync.js';
import type { WageDetermination, WageClassification } from '../../shared/types.js';

export type { WageDetermination, WageClassification };

export interface WageAdapter {
  source: 'federal-dol' | 'ca-dir' | 'wa-li' | 'ny-dol' | 'manual';
  supportsLookup(state: string): boolean;
  fetchDetermination(state: string, county: string): Promise<WageDetermination | null>;
}

// Resolves state+county → WD identifier using the seed list.
// Returns undefined if no matching seed entry is found.
function resolveWdIdentifier(
  state: string,
  county: string
): typeof WD_SEED_LIST[0] | undefined {
  // First try exact county match
  const exact = WD_SEED_LIST.find(
    (s) => s.state === state && s.county === county
  );
  if (exact) return exact;
  // Fall back to statewide WD (county = null) for this state
  return WD_SEED_LIST.find((s) => s.state === state && s.county === null);
}

export class FederalWdolAdapter implements WageAdapter {
  source = 'federal-dol' as const;

  supportsLookup(_state: string): boolean {
    return true; // Federal WDOL covers all states
  }

  async fetchDetermination(state: string, county: string): Promise<WageDetermination | null> {
    const seed = resolveWdIdentifier(state, county);
    if (!seed) return null;

    const response = await fetchWdFromSamGov(seed.wdNumber, seed.revision);
    if (!response) return null;

    const now = new Date();
    const nowIso = now.toISOString();
    const cacheExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const wdId = crypto.randomUUID();

    upsertWageDetermination({
      id: wdId,
      source: 'federal-dol',
      wdNumber: response.fullReferenceNumber,
      revisionNumber: response.revisionNumber,
      state,
      county,
      constructionType: null,
      publishDate: response.publishDate,
      rawDocument: response.document,
      cachedAt: nowIso,
      cacheExpiresAt,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const classifications = response.document ? parseWdDocument(response.document) : [];
    upsertClassifications(wdId, classifications);

    return {
      id: wdId,
      source: 'federal-dol',
      wdNumber: response.fullReferenceNumber,
      revisionNumber: response.revisionNumber,
      state,
      county,
      constructionType: null,
      publishDate: response.publishDate,
      isActive: true,
      cachedAt: nowIso,
      cacheExpiresAt,
      createdAt: nowIso,
      updatedAt: nowIso,
      classifications: classifications.map((c, i) => ({
        id: `${wdId}-${i}`,
        wageDeterminationId: wdId,
        tradeCode: c.code,
        tradeDescription: c.description,
        laborType: 'journeyworker' as const,
        baseRate: c.baseRate,
        fringeRate: c.fringeRate,
        totalRate: c.totalRate,
        createdAt: nowIso,
      })),
    };
  }
}

// WAGE_ADAPTERS: 02-03 replaces this with the full state adapter list.
// State adapters will be prepended to this array.
let WAGE_ADAPTERS: WageAdapter[] = [new FederalWdolAdapter()];

// Called by 02-03's stateWageAdapter.ts to register state adapters without
// modifying this file.
export function registerAdapters(adapters: WageAdapter[]): void {
  WAGE_ADAPTERS = adapters;
}

// Cache-first lookup entry point. Never call wdolFetcher from route handlers.
export async function lookupWageDetermination(
  state: string,
  county: string
): Promise<WageDetermination | null> {
  // 1. Check cache first
  const cached = getCachedWd(state, county);
  if (cached) {
    const classifications = getCachedClassifications(cached.id);
    return {
      ...cached,
      county: cached.county ?? null,
      constructionType: cached.constructionType ?? null,
      publishDate: cached.publishDate ?? null,
      isActive: Boolean(cached.isActive),
      classifications: classifications.map((c) => ({
        id: c.id,
        wageDeterminationId: c.wageDeterminationId,
        tradeCode: c.tradeCode,
        tradeDescription: c.tradeDescription,
        laborType: c.laborType as 'journeyworker' | 'foreman' | 'apprentice',
        baseRate: c.baseRate,
        fringeRate: c.fringeRate,
        totalRate: c.totalRate,
        createdAt: c.createdAt,
      })),
    };
  }

  // 2. Cache miss — find the first adapter that supports this state
  const adapter = WAGE_ADAPTERS.find((a) => a.supportsLookup(state));
  if (!adapter) return null;

  return adapter.fetchDetermination(state, county);
}
