// tests/routes/workers-bulk.test.ts
// Tests for POST /api/projects/:projectId/workers/bulk

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string) {
  const email = `bulk-workers-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Bulk Import Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  return res.body.data?.project?.id as string;
}

function makeWorker(overrides: Partial<{
  name: string;
  tradeDescription: string;
  laborType: string;
}> = {}) {
  return {
    name: `Worker ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    tradeDescription: 'Carpenter',
    laborType: 'journeyworker',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/projects/:id/workers/bulk', () => {

  it('creates workers from a valid array and returns created count', async () => {
    const cookie = await registerAndLogin('valid');
    const projectId = await createProject(cookie);

    const workers = [
      makeWorker({ name: 'Alice Smith' }),
      makeWorker({ name: 'Bob Jones', laborType: 'apprentice' }),
      makeWorker({ name: 'Carl Davis', laborType: 'foreman' }),
    ];

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers/bulk`)
      .set('Cookie', cookie)
      .send({ workers });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(3);
    expect(res.body.data.skipped).toBe(0);
    expect(res.body.data.errors).toHaveLength(0);
  });

  it('skips duplicate names (same name already in project) rather than erroring', async () => {
    const cookie = await registerAndLogin('dup');
    const projectId = await createProject(cookie);

    // Pre-create a worker with this name via the regular endpoint
    await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Duplicate Worker' });

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers/bulk`)
      .set('Cookie', cookie)
      .send({
        workers: [
          { name: 'Duplicate Worker', tradeDescription: 'Electrician', laborType: 'journeyworker' },
          { name: 'New Worker XYZ', tradeDescription: 'Plumber', laborType: 'journeyworker' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.skipped).toBe(1);
    expect(res.body.data.errors).toHaveLength(0);
  });

  it('skips duplicates within the same batch (same name appears twice in the array)', async () => {
    const cookie = await registerAndLogin('dup-batch');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers/bulk`)
      .set('Cookie', cookie)
      .send({
        workers: [
          { name: 'Same Worker', tradeDescription: 'Mason', laborType: 'journeyworker' },
          { name: 'Same Worker', tradeDescription: 'Mason', laborType: 'journeyworker' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.skipped).toBe(1);
  });

  it('returns 400 when more than 200 workers are sent', async () => {
    const cookie = await registerAndLogin('limit');
    const projectId = await createProject(cookie);

    const tooMany = Array.from({ length: 201 }, (_, i) => ({
      name: `Worker ${i}`,
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
    }));

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers/bulk`)
      .set('Cookie', cookie)
      .send({ workers: tooMany });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum 200/i);
  });

  it('returns 401 without authentication', async () => {
    const res = await supertest(app)
      .post('/api/projects/some-project-id/workers/bulk')
      .send({ workers: [] });

    expect(res.status).toBe(401);
  });

  it('returns 400 when "workers" is not an array', async () => {
    const cookie = await registerAndLogin('notarray');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers/bulk`)
      .set('Cookie', cookie)
      .send({ workers: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workers.*array/i);
  });

  it('records per-row errors for rows missing required fields', async () => {
    const cookie = await registerAndLogin('row-errors');
    const projectId = await createProject(cookie);

    // 2 invalid out of 6 total = 33% < 50% threshold, so it won't 422
    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers/bulk`)
      .set('Cookie', cookie)
      .send({
        workers: [
          // Missing name (invalid)
          { tradeDescription: 'Carpenter', laborType: 'journeyworker' },
          // Valid rows
          { name: 'Good Worker A', tradeDescription: 'Electrician', laborType: 'journeyworker' },
          { name: 'Good Worker B', tradeDescription: 'Mason', laborType: 'journeyworker' },
          { name: 'Good Worker C', tradeDescription: 'Plumber', laborType: 'foreman' },
          { name: 'Good Worker D', tradeDescription: 'Ironworker', laborType: 'apprentice' },
          // Missing tradeDescription (invalid)
          { name: 'Bad Worker 2', laborType: 'journeyworker' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(4);
    expect(res.body.data.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 422 when more than 50% of rows fail validation', async () => {
    const cookie = await registerAndLogin('threshold');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers/bulk`)
      .set('Cookie', cookie)
      .send({
        workers: [
          // 3 invalid (missing required fields)
          { laborType: 'journeyworker' },
          { laborType: 'journeyworker' },
          { laborType: 'journeyworker' },
          // 1 valid
          { name: 'One Good Worker', tradeDescription: 'Mason', laborType: 'journeyworker' },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/50%/i);
    expect(res.body.errors).toBeDefined();
  });

  it('includes optional fields (address, ssnLast4, union) when provided', async () => {
    const cookie = await registerAndLogin('optional-fields');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers/bulk`)
      .set('Cookie', cookie)
      .send({
        workers: [
          {
            name: 'Full Details Worker',
            tradeDescription: 'Ironworker',
            laborType: 'journeyworker',
            addressStreet: '123 Main St',
            addressCity: 'Los Angeles',
            addressState: 'CA',
            addressZip: '90001',
            ssnLast4: '1234',
            tradeUnion: 'Iron Workers Local 433',
            unionLocal: '433',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(1);

    // Verify the worker was actually created by listing workers
    const listRes = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    const created = listRes.body.data.workers.find((w: any) => w.name === 'Full Details Worker');
    expect(created).toBeDefined();
    expect(created.addressStreet).toBe('123 Main St');
    expect(created.ssnLast4).toBe('1234');
  });
});
