// src/server/services/wageLookup.ts
// Cache-first wage lookup with adapter dispatch.
// All routes call lookupWageDetermination() — never fetch directly.
//
// Adapter order: state adapters take priority, FederalWdolAdapter is the fallback.
// 02-03 will import WAGE_ADAPTERS from stateWageAdapter.ts and replace the array below.
// For now (02-02), only FederalWdolAdapter is active.

import crypto from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { wageDeterminations } from '../db/schema.js';
import { getDb } from '../db/index.js';
import { getCachedWd, upsertWageDetermination, upsertClassifications, getCachedClassifications } from './wageCache.js';
import { fetchWdFromSamGov } from './wdolFetcher.js';
import { parseWdDocument } from './wdolParser.js';
import { WD_SEED_LIST } from './wdolSync.js';
import type { WageDetermination, WageClassification } from '../../shared/types.js';

export type { WageDetermination, WageClassification };

export interface WageAdapter {
  source: 'federal-dol' | 'ca-dir' | 'wa-li' | 'ny-dol' | 'pa-dli' | 'oh-com' |
          'co-cowc' | 'md-dllr' | 'or-boli' | 'ct-dol' | 'hi-dlir' | 'ky-labor' |
          'nm-dol' | 'nv-dir' | 'ri-dlt' | 'wv-labor' | 'me-dol' | 'vt-dfr' |
          'mt-dli' | 'nd-dlt' | 'de-dol' | 'nh-dol' | 'ak-dol' | 'local' | 'sca-dol' | 'manual';
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

    const actualId = upsertWageDetermination({
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
    upsertClassifications(actualId, classifications);

    return {
      id: actualId,
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

// Direct WD number lookup — cache-first, falls back to live SAM.gov fetch.
// Called by GET /api/wages/fetch. Never call fetchWdFromSamGov directly from routes.
export async function fetchAndCacheByWdNumber(wdNumber: string): Promise<WageDetermination | null> {
  const db = getDb();
  const now = new Date().toISOString();

  // Cache hit: return if unexpired
  const cached = db
    .select()
    .from(wageDeterminations)
    .where(eq(wageDeterminations.wdNumber, wdNumber))
    .orderBy(desc(wageDeterminations.revisionNumber))
    .limit(1)
    .get() as typeof wageDeterminations.$inferSelect | undefined;

  if (cached && cached.cacheExpiresAt > now) {
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

  // Cache miss — fetch live from SAM.gov
  const response = await fetchWdFromSamGov(wdNumber, 0);
  if (!response) return null;

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const cacheExpiresAt = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const wdId = crypto.randomUUID();

  // Extract state from WD number prefix (e.g. "CA20250001" → "CA") — more reliable than location.description.
  const stateCode = /^([A-Z]{2})\d/.exec(response.fullReferenceNumber)?.[1] ?? 'XX';

  const actualId = upsertWageDetermination({
    id: wdId,
    source: 'federal-dol',
    wdNumber: response.fullReferenceNumber,
    revisionNumber: response.revisionNumber,
    state: stateCode,
    county: null,
    constructionType: null,
    publishDate: response.publishDate,
    rawDocument: response.document ?? null,
    cachedAt: nowIso,
    cacheExpiresAt,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastFetchedAt: nowIso,
  });

  const classifications = response.document ? parseWdDocument(response.document) : [];
  upsertClassifications(actualId, classifications);

  return {
    id: actualId,
    source: 'federal-dol',
    wdNumber: response.fullReferenceNumber,
    revisionNumber: response.revisionNumber,
    state: stateCode,
    county: null,
    constructionType: null,
    publishDate: response.publishDate,
    isActive: true,
    cachedAt: nowIso,
    cacheExpiresAt,
    createdAt: nowIso,
    updatedAt: nowIso,
    classifications: classifications.map((c, i) => ({
      id: `${actualId}-${i}`,
      wageDeterminationId: actualId,
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
