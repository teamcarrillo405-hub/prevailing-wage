import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string) {
  const email = `payroll-route-${suffix}-${Date.now()}@test.com`;
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
      name: 'Payroll Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  return res.body.data?.project?.id as string;
}

async function createWorkerWithClassification(cookie: string, projectId: string) {
  const wRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'John Doe' });
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

// ── Tests ─────────────────────────────────────────────────────────────────

describe('payroll routes', () => {
  it('POST /api/payroll/weeks creates a new week for a project', async () => {
    const cookie = await registerAndLogin('post-weeks');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2025-01-05', payrollNumber: 1 });

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.payrollNumber).toBe(1);
  });

  it('GET /api/payroll/weeks/:id returns week with entries', async () => {
    const cookie = await registerAndLogin('get-week');
    const projectId = await createProject(cookie);

    const createRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2025-01-12', payrollNumber: 2 });

    const weekId = createRes.body.id as string;

    const res = await supertest(app)
      .get(`/api/payroll/weeks/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.week.id).toBe(weekId);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it('PUT /api/payroll/entries/:id upserts daily hours for a worker', async () => {
    const cookie = await registerAndLogin('put-entries');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);

    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2025-01-19', payrollNumber: 3 });

    const weekId = weekRes.body.id as string;

    const res = await supertest(app)
      .put(`/api/payroll/entries/${weekId}`)
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8,
        tueSt: 8,
        wedSt: 8,
        thuSt: 8,
        friSt: 8,
        baseRateSnapshot: 45.00,
        fringeRateSnapshot: 20.00,
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.id).toBe('string');
  });

  it('GET /api/payroll/projects/:projectId/weeks lists all weeks', async () => {
    const cookie = await registerAndLogin('list-weeks');
    const projectId = await createProject(cookie);

    await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2025-01-26', payrollNumber: 4 });

    await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2025-02-02', payrollNumber: 5 });

    const res = await supertest(app)
      .get(`/api/payroll/projects/${projectId}/weeks`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.weeks)).toBe(true);
    expect(res.body.weeks.length).toBeGreaterThanOrEqual(2);
    // Sorted descending by weekEndingDate
    expect(res.body.weeks[0].weekEndingDate >= res.body.weeks[1].weekEndingDate).toBe(true);
  });
});
