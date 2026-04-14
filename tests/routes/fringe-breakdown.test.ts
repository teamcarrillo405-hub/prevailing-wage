import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerUser(suffix: string): Promise<string> {
  const email = `fringe-bd-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function seedFixtureWithFringes(cookie: string): Promise<{ projectId: string }> {
  // 1. Create project
  const pRes = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Fringe Breakdown Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-03-01',
      fundingType: 'federal',
    });
  const projectId = pRes.body.data?.project?.id as string;

  // 2. Create worker
  const wRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Fringe Test Worker', unionLocal: 'Carpenters Local 409' });
  const workerId = wRes.body.data?.worker?.id as string;

  // 3. Create classification for that worker
  await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
    });

  // 4. Create payroll week
  const wkRes = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: '2025-04-06', payrollNumber: 1 });
  const weekId = wkRes.body.id as string;

  // 5. GET workers to retrieve classificationId
  const workersRes = await supertest(app)
    .get(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie);
  const workerData = workersRes.body.data?.workers?.[0];
  const resolvedWorkerId = workerData?.id as string;
  const classificationId = workerData?.classifications?.[0]?.id as string;

  // 6. Post payroll entry with fringe columns
  await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      payrollWeekId: weekId,
      workerId: resolvedWorkerId,
      classificationId,
      monSt: 8,
      baseRateSnapshot: 50.00,
      fringeRateSnapshot: 12.00,
      deductions: 0,
      fringeHealthWelfare: 40.00,
      fringePension: 24.00,
      fringeVacation: 8.00,
      fringeTraining: 4.00,
    });

  return { projectId };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/reports/:projectId/fringe-breakdown', () => {
  it('returns 403 when project is owned by a different user', async () => {
    const ownerCookie = await registerUser('fringe-bd-owner');
    const { projectId } = await seedFixtureWithFringes(ownerCookie);
    const otherCookie = await registerUser('fringe-bd-other');
    const res = await supertest(app)
      .get(`/api/reports/${projectId}/fringe-breakdown`)
      .set('Cookie', otherCookie);
    expect(res.status).toBe(403);
  });

  it('returns 200 with rows having fundType, unionLocal, classificationLevel, totalAmount, workerCount', async () => {
    const cookie = await registerUser('fringe-bd-200');
    const { projectId } = await seedFixtureWithFringes(cookie);
    const res = await supertest(app)
      .get(`/api/reports/${projectId}/fringe-breakdown`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows.length).toBeGreaterThan(0);
    const row = res.body.rows[0];
    expect(typeof row.fundType).toBe('string');
    expect(typeof row.unionLocal).toBe('string');
    expect(typeof row.classificationLevel).toBe('string');
    expect(typeof row.totalAmount).toBe('number');
    expect(typeof row.workerCount).toBe('number');
  });
});
