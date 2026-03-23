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

describe('PATCH /api/payroll/weeks/:id/submit — SUB-01', () => {
  it('marks a week as submitted with date and agency', async () => {
    const cookie = await registerAndLogin('sub-01-submit');
    const projectId = await createProject(cookie);
    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-03-23', payrollNumber: 10 });
    const weekId = weekRes.body.id as string;

    const res = await supertest(app)
      .patch(`/api/payroll/weeks/${weekId}/submit`)
      .set('Cookie', cookie)
      .send({ submittedAt: '2026-03-23', submittedTo: 'DOL Region 9' });

    expect(res.status).toBe(200);

    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${weekId}`)
      .set('Cookie', cookie);
    expect(getRes.body.week.submittedAt).toBe('2026-03-23');
    expect(getRes.body.week.submittedTo).toBe('DOL Region 9');
  });
});

describe('DELETE /api/payroll/weeks/:id/submit — SUB-03', () => {
  it('clears submission status and is idempotent', async () => {
    const cookie = await registerAndLogin('sub-03-unsubmit');
    const projectId = await createProject(cookie);
    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-03-23', payrollNumber: 11 });
    const weekId = weekRes.body.id as string;

    // Submit first
    await supertest(app)
      .patch(`/api/payroll/weeks/${weekId}/submit`)
      .set('Cookie', cookie)
      .send({ submittedAt: '2026-03-23', submittedTo: 'DOL Region 9' });

    // Un-submit
    const res = await supertest(app)
      .delete(`/api/payroll/weeks/${weekId}/submit`)
      .set('Cookie', cookie);
    expect(res.status).toBeLessThan(300);

    // Confirm cleared
    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${weekId}`)
      .set('Cookie', cookie);
    expect(getRes.body.week.submittedAt).toBeNull();
    expect(getRes.body.week.submittedTo).toBeNull();
  });

  it('is idempotent — un-submitting an already-unsubmitted week returns success', async () => {
    const cookie = await registerAndLogin('sub-03-idempotent');
    const projectId = await createProject(cookie);
    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-03-24', payrollNumber: 12 });
    const weekId = weekRes.body.id as string;

    const res = await supertest(app)
      .delete(`/api/payroll/weeks/${weekId}/submit`)
      .set('Cookie', cookie);
    expect(res.status).toBeLessThan(300);
  });
});

describe('server-side edit lock on submitted weeks — SUB-02', () => {
  async function setupSubmittedWeek(suffix: string) {
    const cookie = await registerAndLogin(`lock-${suffix}`);
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-03-25', payrollNumber: 20 });
    const weekId = weekRes.body.id as string;

    await supertest(app)
      .patch(`/api/payroll/weeks/${weekId}/submit`)
      .set('Cookie', cookie)
      .send({ submittedAt: '2026-03-25', submittedTo: 'DOL Region 9' });

    return { cookie, weekId, workerId, classificationId };
  }

  const entryPayload = (weekId: string, workerId: string, classificationId: string) => ({
    payrollWeekId: weekId,
    workerId,
    classificationId,
    monSt: 8,
    baseRateSnapshot: 45.00,
    fringeRateSnapshot: 20.00,
  });

  it('POST /api/payroll/entries returns 409 on a submitted week', async () => {
    const { cookie, weekId, workerId, classificationId } = await setupSubmittedWeek('post');
    const res = await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send(entryPayload(weekId, workerId, classificationId));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/submitted/i);
  });

  it('PUT /api/payroll/entries/:id returns 409 on a submitted week', async () => {
    const { cookie, weekId, workerId, classificationId } = await setupSubmittedWeek('put');
    const res = await supertest(app)
      .put(`/api/payroll/entries/${weekId}`)
      .set('Cookie', cookie)
      .send(entryPayload(weekId, workerId, classificationId));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/submitted/i);
  });
});
