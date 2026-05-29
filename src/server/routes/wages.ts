import { logger } from '../logger.js';
// src/server/routes/wages.ts
// Wage API routes. All lookups go through wageLookup.ts — never call fetchers directly.
// Registered in index.ts at /api/wages.

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { lookupWageDetermination, fetchAndCacheByWdNumber } from '../services/wageLookup.js';
import { upsertWageDetermination, upsertClassifications, getWdById, getCachedClassifications } from '../services/wageCache.js';
import { runWageSync, WD_SEED_LIST } from '../services/wdolSync.js';
import { getCountyCoverageAudit } from '../services/countyCoverageAudit.js';

export const wagesRouter = Router();

// Zod schemas for request validation
const LookupQuerySchema = z.object({
  state: z.string().length(2, 'state must be 2-letter code').toUpperCase(),
  county: z.string().min(1, 'county is required'),
  constructionType: z.enum(['Building', 'Heavy', 'Highway', 'Residential']).optional(),
});

const ClassificationInputSchema = z.object({
  tradeCode: z.string().min(1),
  tradeDescription: z.string().min(1),
  laborType: z.enum(['journeyworker', 'foreman', 'apprentice']).default('journeyworker'),
  baseRate: z.number().positive(),
  fringeRate: z.number().min(0),
  totalRate: z.number().positive(),
});

const ManualWdSchema = z.object({
  state: z.string().length(2).toUpperCase(),
  county: z.string().min(1),
  wdNumber: z.string().min(1),
  constructionType: z.enum(['Building', 'Heavy', 'Highway', 'Residential']).optional(),
  classifications: z.array(ClassificationInputSchema).min(1, 'at least one classification required'),
});

// GET /api/wages/lookup?state=CA&county=Los+Angeles
// Returns { wd, classifications } or 404 when no WD found.
// Callers show ManualWageEntryForm on 404 — never return 500 on empty cache.
wagesRouter.get('/lookup', async (req, res) => {
  const parsed = LookupQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });
  }

  const { state, county, constructionType } = parsed.data;
  const wd = await lookupWageDetermination(state, county);
  if (!wd) {
    return res.status(404).json({ error: `No wage determination found for ${county}, ${state}` });
  }

  // Filter by constructionType when provided; a WD with null constructionType matches any filter.
  if (constructionType && wd.constructionType && wd.constructionType !== constructionType) {
    return res.status(404).json({ error: `No ${constructionType} wage determination found for ${county}, ${state}` });
  }

  return res.json({ wds: [wd], classifications: [wd.classifications ?? []] });
});

// GET /api/wages/coverage
// Aggregate health view: per-state WD counts, distinct counties, last-sync status.
// Powers the admin coverage dashboard.
wagesRouter.get('/coverage', async (_req, res) => {
  const { getDb } = await import('../db/index.js');
  const { wageClassifications, wageDeterminations, wageSyncMeta } = await import('../db/schema.js');
  const { sql, desc } = await import('drizzle-orm');
  const db = getDb();
  const nowIso = new Date().toISOString();

  const seedByState = new Map<string, {
    seededWds: number;
    seededCountyKeys: Set<string>;
  }>();

  for (const seed of WD_SEED_LIST) {
    const current = seedByState.get(seed.state) ?? {
      seededWds: 0,
      seededCountyKeys: new Set<string>(),
    };
    current.seededWds += 1;
    current.seededCountyKeys.add(seed.county ?? '__statewide__');
    seedByState.set(seed.state, current);
  }

  // Per-state aggregate
  const byStateRaw = await db
    .select({
      state: wageDeterminations.state,
      wdCount: sql<number>`count(*)`.as('wdCount'),
      countyCount: sql<number>`count(distinct coalesce(${wageDeterminations.county}, '__statewide__'))`.as('countyCount'),
      cached: sql<number>`sum(case when ${wageDeterminations.rawDocument} is not null then 1 else 0 end)`.as('cached'),
      fresh: sql<number>`sum(case when ${wageDeterminations.cacheExpiresAt} > ${nowIso} then 1 else 0 end)`.as('fresh'),
      expired: sql<number>`sum(case when ${wageDeterminations.cacheExpiresAt} <= ${nowIso} then 1 else 0 end)`.as('expired'),
    })
    .from(wageDeterminations)
    .where(sql`${wageDeterminations.isActive} = 1`)
    .groupBy(wageDeterminations.state)
    .orderBy(wageDeterminations.state);

  const classificationsByStateRaw = await db
    .select({
      state: wageDeterminations.state,
      classificationCount: sql<number>`count(${wageClassifications.id})`.as('classificationCount'),
    })
    .from(wageDeterminations)
    .leftJoin(wageClassifications, sql`${wageClassifications.wageDeterminationId} = ${wageDeterminations.id}`)
    .where(sql`${wageDeterminations.isActive} = 1`)
    .groupBy(wageDeterminations.state);

  const classificationCountByState = new Map<string, number>(
    classificationsByStateRaw.map((r: typeof classificationsByStateRaw[number]) => [
      r.state,
      Number(r.classificationCount),
    ] as [string, number]),
  );

  type CachedStateRow = typeof byStateRaw[number];
  const cachedByState = new Map<string, CachedStateRow>(
    byStateRaw.map((r: CachedStateRow) => [r.state, r] as [string, CachedStateRow]),
  );
  const stateCodes = [...new Set([...seedByState.keys(), ...cachedByState.keys()])].sort();
  const byState = stateCodes.map((state) => {
    const seed = seedByState.get(state);
    const cached = cachedByState.get(state);
    const seededWds = seed?.seededWds ?? 0;
    const wdCount = cached ? Number(cached.wdCount) : 0;
    const cachedDocuments = cached ? Number(cached.cached) : 0;
    return {
      state,
      seededWds,
      seededCountyKeys: seed?.seededCountyKeys.size ?? 0,
      wdCount,
      countyCount: cached ? Number(cached.countyCount) : 0,
      cached: cachedDocuments,
      fresh: cached ? Number(cached.fresh) : 0,
      expired: cached ? Number(cached.expired) : 0,
      classificationCount: classificationCountByState.get(state) ?? 0,
      uncachedSeededWds: Math.max(seededWds - wdCount, 0),
      percentCached: seededWds > 0 ? Math.round((Math.min(wdCount, seededWds) / seededWds) * 100) : 0,
    };
  });

  // Latest sync run
  const [latestSync] = await db
    .select()
    .from(wageSyncMeta)
    .orderBy(desc(wageSyncMeta.startedAt))
    .limit(1);

  const totals = byState.reduce((acc, row) => {
    acc.seededWds += row.seededWds;
    acc.seededCountyKeys += row.seededCountyKeys;
    acc.wdCount += row.wdCount;
    acc.countyCount += row.countyCount;
    acc.cachedDocuments += row.cached;
    acc.fresh += row.fresh;
    acc.expired += row.expired;
    acc.classificationCount += row.classificationCount;
    acc.uncachedSeededWds += row.uncachedSeededWds;
    return acc;
  }, {
    seededWds: 0,
    seededCountyKeys: 0,
    wdCount: 0,
    countyCount: 0,
    cachedDocuments: 0,
    fresh: 0,
    expired: 0,
    classificationCount: 0,
    uncachedSeededWds: 0,
  });

  return res.json({
    source: {
      label: 'DOL/SAM.gov Wage Determinations API',
      federalScope: 'Davis-Bacon and Related Acts',
      verifiedAt: nowIso,
      syncModel: 'Known WD index plus live federal document fetch/cache',
    },
    byState,
    totalStates: stateCodes.length,
    totalSeededStates: seedByState.size,
    totalSeededWds: totals.seededWds,
    totalSeededCountyKeys: totals.seededCountyKeys,
    totalWds: totals.wdCount,
    totalCounties: totals.countyCount,
    totalCachedDocuments: totals.cachedDocuments,
    totalFreshWds: totals.fresh,
    totalExpiredWds: totals.expired,
    totalClassifications: totals.classificationCount,
    totalUncachedSeededWds: totals.uncachedSeededWds,
    percentSeedCacheComplete: totals.seededWds > 0 ? Math.round((Math.min(totals.wdCount, totals.seededWds) / totals.seededWds) * 100) : 0,
    latestSync: latestSync ?? null,
  });
});

// GET /api/wages/county-coverage
// Compares cached federal WD locations against Census county/county-equivalent geography.
// A county is treated as covered when it has either an explicit named-county WD or a statewide WD fallback.
wagesRouter.get('/county-coverage', async (_req, res) => {
  try {
    const audit = await getCountyCoverageAudit();
    res.json(audit);
  } catch (err) {
    logger.error({ err }, '[wages/county-coverage] audit failed');
    res.status(502).json({
      error: 'County coverage audit failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

// GET /api/wages/fetch?wdNumber=CA20250001
wagesRouter.get('/fetch', async (req, res) => {
  const wdNumber = req.query['wdNumber'];
  if (typeof wdNumber !== 'string' || !wdNumber.trim()) {
    res.status(400).json({ error: 'wdNumber query param is required' });
    return;
  }
  const wd = await fetchAndCacheByWdNumber(wdNumber.trim().toUpperCase());
  if (!wd) {
    res.status(404).json({ error: `WD ${wdNumber} not found on SAM.gov` });
    return;
  }
  res.json({ wd, classifications: wd.classifications ?? [] });
});

// GET /api/wages/:id
// Returns { wd, classifications } or 404.
wagesRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id); // Express 5 params type is string | string[]
  const wd = await getWdById(id);
  if (!wd) return res.status(404).json({ error: 'Wage determination not found' });

  const classifications = await getCachedClassifications(id);
  return res.json({ wd, classifications });
});

// POST /api/wages/manual
// Creates a WD with source='manual'. Does not call SAM.gov.
// Manual entries expire after 365 days (not 30 — manual data doesn't get stale the same way).
wagesRouter.post('/manual', async (req, res) => {
  const parsed = ManualWdSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', issues: parsed.error.issues });
  }

  const { state, county, wdNumber, constructionType, classifications } = parsed.data;
  const now = new Date();
  const nowIso = now.toISOString();
  const cacheExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const wdId = crypto.randomUUID();

  await upsertWageDetermination({
    id: wdId,
    source: 'manual',
    wdNumber,
    revisionNumber: 0,
    state,
    county,
    constructionType: constructionType ?? null,
    publishDate: nowIso.slice(0, 10),
    rawDocument: null,
    cachedAt: nowIso,
    cacheExpiresAt,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  await upsertClassifications(wdId, classifications.map((c) => ({
    code: c.tradeCode,
    description: c.tradeDescription,
    baseRate: c.baseRate,
    fringeRate: c.fringeRate,
    totalRate: c.totalRate,
  })));

  const inserted = await getCachedClassifications(wdId);
  return res.status(201).json({
    wd: {
      id: wdId, source: 'manual', wdNumber, revisionNumber: 0, state, county,
      constructionType: constructionType ?? null, publishDate: nowIso.slice(0, 10),
      isActive: true, cachedAt: nowIso, cacheExpiresAt, createdAt: nowIso, updatedAt: nowIso,
    },
    classifications: inserted,
  });
});

// GET /api/wages/local-ordinances?state=CA
// Returns local wage ordinance metadata for a state (table created in migration 0075).
// Used to surface county/municipal wage law overrides in the UI.
wagesRouter.get('/local-ordinances', async (req, res) => {
  const state = typeof req.query['state'] === 'string' ? req.query['state'].toUpperCase() : null;
  const { getDb } = await import('../db/index.js');
  const { localWageOrdinances } = await import('../db/schema.js');
  const { eq } = await import('drizzle-orm');
  const db = getDb();

  const rows = state
    ? await db.select().from(localWageOrdinances).where(eq(localWageOrdinances.state, state))
    : await db.select().from(localWageOrdinances);

  res.json({ data: rows });
});

// GET /api/wages/state-sources
// Returns sync status and metadata for all state wage sources (CA, NY, WA, etc.)
wagesRouter.get('/state-sources', async (_req, res) => {
  const { getDb } = await import('../db/index.js');
  const { stateWageSources } = await import('../db/schema.js');
  const db = getDb();
  const rows = await db.select().from(stateWageSources);
  res.json({ data: rows });
});

// POST /api/wages/sync
// Triggers runWageSync() asynchronously — returns 202 immediately.
// Never await the sync in the request handler.
wagesRouter.post('/sync', (_req, res) => {
  void runWageSync().catch((err) => logger.error({ err: err }, '[wages/sync] Background sync failed:'));
  return res.status(202).json({ message: 'Wage sync started' });
});
