// tests/routes/wages.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/server/index.js';
import { upsertWageDetermination, upsertClassifications } from '../../src/server/services/wageCache.js';

// Mock fetcher to prevent live network calls
vi.mock('../../src/server/services/wdolFetcher.js', () => ({
  fetchWdFromSamGov: vi.fn().mockResolvedValue(null),
}));

// Mock runWageSync to prevent it from running during tests
vi.mock('../../src/server/services/wdolSync.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/server/services/wdolSync.js')>();
  return { ...actual, runWageSync: vi.fn().mockResolvedValue({ fetched: 0, failed: 0 }) };
});

function seedWd(overrides = {}) {
  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const id = crypto.randomUUID();
  const wd = {
    id,
    source: 'federal-dol' as const,
    wdNumber: `CA2025ROUTE${Date.now()}`,
    revisionNumber: 0,
    state: 'CA',
    county: 'Test County',
    constructionType: 'Building',
    publishDate: '2025-01-01',
    rawDocument: null,
    cachedAt: now.toISOString(),
    cacheExpiresAt: future,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
  upsertWageDetermination(wd);
  upsertClassifications(id, [
    { code: 'CARP', description: 'Carpenter', baseRate: 45.00, fringeRate: 20.00, totalRate: 65.00 },
    { code: 'ELEC', description: 'Electrician', baseRate: 55.00, fringeRate: 25.00, totalRate: 80.00 },
  ]);
  return id;
}

describe('GET /api/wages/lookup', () => {
  it('returns 200 with WD data when cache has a fresh entry', async () => {
    const county = `County${Date.now()}`;
    seedWd({ state: 'CA', county });
    const res = await request(app).get(`/api/wages/lookup?state=CA&county=${encodeURIComponent(county)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('wd');
    expect(res.body).toHaveProperty('classifications');
    expect(Array.isArray(res.body.classifications)).toBe(true);
    expect(res.body.classifications.length).toBeGreaterThan(0);
  });

  it('returns 400 when state param is missing', async () => {
    const res = await request(app).get('/api/wages/lookup?county=Los+Angeles');
    expect(res.status).toBe(400);
  });

  it('returns 400 when county param is missing', async () => {
    const res = await request(app).get('/api/wages/lookup?state=CA');
    expect(res.status).toBe(400);
  });

  it('returns 404 when no WD found (not a crash)', async () => {
    const res = await request(app).get('/api/wages/lookup?state=ZZ&county=Nowhere');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/wages/:id', () => {
  it('returns 200 with WD and classifications when id exists', async () => {
    const id = seedWd({ state: 'CA', county: `IDTest${Date.now()}` });
    const res = await request(app).get(`/api/wages/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.wd.id).toBe(id);
    expect(Array.isArray(res.body.classifications)).toBe(true);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/wages/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/wages/manual', () => {
  it('returns 201 with source=manual when all fields are valid', async () => {
    const res = await request(app)
      .post('/api/wages/manual')
      .send({
        state: 'CA',
        county: `Manual${Date.now()}`,
        wdNumber: 'CA99TEST',
        constructionType: 'Building',
        classifications: [
          { tradeCode: 'CARP', tradeDescription: 'Carpenter', laborType: 'journeyworker', baseRate: 45.00, fringeRate: 20.00, totalRate: 65.00 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.wd.source).toBe('manual');
    expect(res.body.wd.wdNumber).toBe('CA99TEST');
    expect(res.body.classifications.length).toBe(1);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/wages/manual')
      .send({ state: 'CA' }); // missing county, wdNumber, classifications
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('issues');
  });

  it('returns 400 when classifications array is empty', async () => {
    const res = await request(app)
      .post('/api/wages/manual')
      .send({ state: 'CA', county: 'Test', wdNumber: 'TEST001', classifications: [] });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/wages/sync', () => {
  it('returns 202 Accepted immediately', async () => {
    const res = await request(app).post('/api/wages/sync');
    expect(res.status).toBe(202);
    expect(res.body.message).toMatch(/sync started/i);
  });
});
