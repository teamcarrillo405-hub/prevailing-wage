import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerUser(suffix: string) {
  const email = `export-a1131-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string, state: string, extra?: Record<string, unknown>) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: `Test Project ${state}`,
      state,
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
      ...extra,
    });
  return res.body.data?.project?.id as string;
}

async function createWorkerWithClassification(cookie: string, projectId: string) {
  const wRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Test Worker' });
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

  return { workerId, classificationId };
}

async function createPayrollWeek(cookie: string, projectId: string) {
  const res = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: '2025-01-05', payrollNumber: 1 });
  return res.body.id as string;
}

async function createPayrollEntry(
  cookie: string,
  weekId: string,
  workerId: string,
  classificationId: string,
) {
  await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      payrollWeekId: weekId,
      workerId,
      classificationId,
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
      monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
      baseRateSnapshot: 45.00,
      fringeRateSnapshot: 12.50,
      grossWages: 1800.00,
      deductions: 250.00,
      netPay: 1550.00,
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/export/a1131/:weekId - CAL-02', () => {
  it('should return 400 for non-CA project', async () => {
    const cookie = await registerUser('non-ca');
    const projectId = await createProject(cookie, 'TX');
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/a1131/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('California');
  });

  it('should return PDF for CA project', async () => {
    const cookie = await registerUser('ca-pdf');
    const projectId = await createProject(cookie, 'CA', {
      cslbLicense: '123456',
      wcPolicyNumber: 'WC-2026-789',
    });
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/a1131/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body).toBeDefined();
  });

  it('should return 403 for unauthorized access', async () => {
    // Create a week as user A
    const cookieA = await registerUser('owner');
    const projectId = await createProject(cookieA, 'CA');
    const weekId = await createPayrollWeek(cookieA, projectId);

    // Try to download as user B
    const cookieB = await registerUser('intruder');
    const res = await supertest(app)
      .get(`/api/export/a1131/${weekId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent week', async () => {
    const cookie = await registerUser('notfound');
    const res = await supertest(app)
      .get('/api/export/a1131/non-existent-week-id')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('should return 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/export/a1131/some-week-id');
    expect(res.status).toBe(401);
  });
});
