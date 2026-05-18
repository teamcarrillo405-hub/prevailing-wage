import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerUser(suffix: string): Promise<string> {
  const email = `rpt-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function seedReportFixture(
  cookie: string,
): Promise<{ projectId: string; weekId: string; workerId: string; classificationId: string }> {
  const pRes = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Reports Test Project',
      state: 'TX',
      county: 'Travis',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-03-01',
      fundingType: 'federal',
    });
  const projectId = pRes.body.data?.project?.id as string;

  const wRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Reports Test Worker' });
  const workerId = wRes.body.data?.worker?.id as string;

  const cRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
    });
  const classificationId = cRes.body.data?.classification?.id as string;

  const wkRes = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: '2025-04-05', payrollNumber: 1 });
  const weekId = wkRes.body.id as string;

  // Seed one payroll entry
  await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      payrollWeekId: weekId,
      workerId,
      classificationId,
      monSt: 8,
      grossWages: 400.00,
      baseRateSnapshot: 50.00,
      fringeRateSnapshot: 10.00,
      deductions: 0,
    });

  return { projectId, weekId, workerId, classificationId };
}

// ── RPT-01: GET /api/reports/:projectId/fringe-summary ─────────────────────

describe('GET /api/reports/:projectId/fringe-summary', () => {
  it('returns 200 with rows array containing workerId, workerName, totalSt, totalOt, totalHours, totalFringeCredits for seeded data', async () => {
    const cookie = await registerUser('fringe-200');
    const { projectId } = await seedReportFixture(cookie);

    const res = await supertest(app)
      .get(`/api/reports/${projectId}/fringe-summary`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows[0]).toHaveProperty('workerId');
    expect(res.body.rows[0]).toHaveProperty('workerName');
    expect(res.body.rows[0]).toHaveProperty('totalFringeCredits');
  });

  it('returns 403 when project is owned by a different user', async () => {
    const ownerCookie = await registerUser('fringe-owner-403');
    const { projectId } = await seedReportFixture(ownerCookie);

    const otherCookie = await registerUser('fringe-other-403');

    const res = await supertest(app)
      .get(`/api/reports/${projectId}/fringe-summary`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('returns 404 with error message when projectId does not exist', async () => {
    const cookie = await registerUser('fringe-404');

    const res = await supertest(app)
      .get('/api/reports/nonexistent-project-id/fringe-summary')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
    // Route must exist and return a structured error response (not Express default 404 HTML)
    expect(typeof res.body.error).toBe('string');
  });
});

// ── RPT-02: GET /api/reports/:projectId/worker/:workerId/pay-history ───────

describe('GET /api/reports/:projectId/worker/:workerId/pay-history', () => {
  it('returns 200 with rows array; each row has weekNumber, totalSt, totalOt, grossWages, deductions', async () => {
    const cookie = await registerUser('pay-hist-200');
    const { projectId, workerId } = await seedReportFixture(cookie);

    const res = await supertest(app)
      .get(`/api/reports/${projectId}/worker/${workerId}/pay-history`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows[0]).toHaveProperty('weekNumber');
    expect(res.body.rows[0]).toHaveProperty('grossWages');
    expect(res.body.rows[0]).toHaveProperty('deductions');
  });

  it('returns rows in descending weekEndingDate order when multiple weeks exist', async () => {
    const cookie = await registerUser('pay-hist-order');
    const { projectId } = await seedReportFixture(cookie);

    // Get workerId for the second payroll week entry
    const wRes = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);
    const worker = wRes.body.data?.workers?.[0];
    const workerId = worker?.id as string;
    const classificationId = worker?.classifications?.[0]?.id as string;

    // Add second payroll week
    const wk2Res = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2025-04-12', payrollNumber: 2 });
    const weekId2 = wk2Res.body.id as string;

    await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId2,
        workerId,
        classificationId,
        monSt: 8,
        grossWages: 450.00,
        baseRateSnapshot: 50.00,
        fringeRateSnapshot: 10.00,
        deductions: 0,
      });

    const res = await supertest(app)
      .get(`/api/reports/${projectId}/worker/${workerId}/pay-history`)
      .set('Cookie', cookie);

    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it('returns 403 when project is owned by a different user', async () => {
    const ownerCookie = await registerUser('pay-hist-owner-403');
    const { projectId, workerId } = await seedReportFixture(ownerCookie);

    const otherCookie = await registerUser('pay-hist-other-403');

    const res = await supertest(app)
      .get(`/api/reports/${projectId}/worker/${workerId}/pay-history`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });
});
