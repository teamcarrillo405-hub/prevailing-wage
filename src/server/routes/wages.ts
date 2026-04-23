// src/server/routes/wages.ts
// Wage API routes. All lookups go through wageLookup.ts — never call fetchers directly.
// Registered in index.ts at /api/wages.

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { lookupWageDetermination, fetchAndCacheByWdNumber } from '../services/wageLookup.js';
import { upsertWageDetermination, upsertClassifications, getWdById, getCachedClassifications } from '../services/wageCache.js';
import { runWageSync } from '../services/wdolSync.js';

export const wagesRouter = Router();

// Zod schemas for request validation
const LookupQuerySchema = z.object({
  state: z.string().length(2, 'state must be 2-letter code').toUpperCase(),
  county: z.string().min(1, 'county is required'),
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

  const { state, county } = parsed.data;
  const wd = await lookupWageDetermination(state, county);
  if (!wd) {
    return res.status(404).json({ error: `No wage determination found for ${county}, ${state}` });
  }

  return res.json({ wds: [wd], classifications: [wd.classifications ?? []] });
});

// GET /api/wages/coverage
// Aggregate health view: per-state WD counts, distinct counties, last-sync status.
// Powers the admin coverage dashboard.
wagesRouter.get('/coverage', async (_req, res) => {
  const { getDb } = await import('../db/index.js');
  const { wageDeterminations, wageSyncMeta } = await import('../db/schema.js');
  const { sql, desc } = await import('drizzle-orm');
  const db = getDb();

  // Per-state aggregate
  const byStateRaw = db
    .select({
      state: wageDeterminations.state,
      wdCount: sql<number>`count(*)`.as('wdCount'),
      countyCount: sql<number>`count(distinct coalesce(${wageDeterminations.county}, '__statewide__'))`.as('countyCount'),
      cached: sql<number>`sum(case when ${wageDeterminations.rawDocument} is not null then 1 else 0 end)`.as('cached'),
    })
    .from(wageDeterminations)
    .where(sql`${wageDeterminations.isActive} = 1`)
    .groupBy(wageDeterminations.state)
    .orderBy(wageDeterminations.state)
    .all();

  const byState = byStateRaw.map((r: typeof byStateRaw[number]) => ({
    state: r.state,
    wdCount: Number(r.wdCount),
    countyCount: Number(r.countyCount),
    cached: Number(r.cached),
  }));

  // Latest sync run
  const [latestSync] = db
    .select()
    .from(wageSyncMeta)
    .orderBy(desc(wageSyncMeta.startedAt))
    .limit(1)
    .all();

  return res.json({
    byState,
    totalStates: byState.length,
    totalWds: byState.reduce((sum: number, r: typeof byState[number]) => sum + r.wdCount, 0),
    totalCounties: byState.reduce((sum: number, r: typeof byState[number]) => sum + r.countyCount, 0),
    latestSync: latestSync ?? null,
  });
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
wagesRouter.get('/:id', (req, res) => {
  const id = String(req.params.id); // Express 5 params type is string | string[]
  const wd = getWdById(id);
  if (!wd) return res.status(404).json({ error: 'Wage determination not found' });

  const classifications = getCachedClassifications(id);
  return res.json({ wd, classifications });
});

// POST /api/wages/manual
// Creates a WD with source='manual'. Does not call SAM.gov.
// Manual entries expire after 365 days (not 30 — manual data doesn't get stale the same way).
wagesRouter.post('/manual', (req, res) => {
  const parsed = ManualWdSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', issues: parsed.error.issues });
  }

  const { state, county, wdNumber, constructionType, classifications } = parsed.data;
  const now = new Date();
  const nowIso = now.toISOString();
  const cacheExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const wdId = crypto.randomUUID();

  upsertWageDetermination({
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

  upsertClassifications(wdId, classifications.map((c) => ({
    code: c.tradeCode,
    description: c.tradeDescription,
    baseRate: c.baseRate,
    fringeRate: c.fringeRate,
    totalRate: c.totalRate,
  })));

  const inserted = getCachedClassifications(wdId);
  return res.status(201).json({
    wd: {
      id: wdId, source: 'manual', wdNumber, revisionNumber: 0, state, county,
      constructionType: constructionType ?? null, publishDate: nowIso.slice(0, 10),
      isActive: true, cachedAt: nowIso, cacheExpiresAt, createdAt: nowIso, updatedAt: nowIso,
    },
    classifications: inserted,
  });
});

// POST /api/wages/sync
// Triggers runWageSync() asynchronously — returns 202 immediately.
// Never await the sync in the request handler.
wagesRouter.post('/sync', (_req, res) => {
  void runWageSync().catch((err) => console.error('[wages/sync] Background sync failed:', err));
  return res.status(202).json({ message: 'Wage sync started' });
});
