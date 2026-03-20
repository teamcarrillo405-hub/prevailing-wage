import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerUser(suffix: string): Promise<string> {
  const email = `compliance-route-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function seedFixture(cookie: string): Promise<{ weekId: string }> {
  const pRes = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Compliance Route Test Project',
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
    .send({ name: 'Route Test Worker' });
  const workerId = wRes.body.data?.worker?.id as string;

  await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
    });

  const wkRes = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: '2025-04-06', payrollNumber: 1 });
  const weekId = wkRes.body.id as string;

  return { weekId };
}

// ── Project-level fixture helpers ─────────────────────────────────────────

async function seedProjectFixture(
  cookie: string,
): Promise<{ projectId: string; weekId: string }> {
  const pRes = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Compliance Project Route Test',
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
    .send({ name: 'Project Route Test Worker' });
  const workerId = wRes.body.data?.worker?.id as string;

  await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
    });

  const wkRes = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: '2025-04-06', payrollNumber: 1 });
  const weekId = wkRes.body.id as string;

  return { projectId, weekId };
}

async function seedProjectWithViolation(
  cookie: string,
): Promise<{ projectId: string; weekId: string }> {
  const { projectId, weekId } = await seedProjectFixture(cookie);

  const wRes = await supertest(app)
    .get(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie);
  const workerId = wRes.body.data?.workers?.[0]?.id as string;

  // Post a payroll entry with grossWages far below baseRateSnapshot × hours
  await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      weekId,
      workerId,
      tradeCode: 'CARP',
      straightTimeHours: 8,
      overtimeHours: 0,
      grossWages: 1.00,
      baseRateSnapshot: 50.00,
      fringeRateSnapshot: 10.00,
      deductions: 0,
    });

  return { projectId, weekId };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/compliance/:weekId', () => {
  it('returns 200 with compliance result shape for a valid week', async () => {
    const cookie = await registerUser('200');
    const { weekId } = await seedFixture(cookie);

    const res = await supertest(app)
      .get(`/api/compliance/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.weekId).toBe('string');
    expect(typeof res.body.projectId).toBe('string');
    expect(typeof res.body.hasViolations).toBe('boolean');
    expect(typeof res.body.certProperPayment).toBe('boolean');
    expect(typeof res.body.certAccuratePayroll).toBe('boolean');
  });

  it('returns 403 when the week belongs to a different user', async () => {
    const ownerCookie = await registerUser('owner-403');
    const { weekId } = await seedFixture(ownerCookie);

    // Different user — does not own this week
    const otherCookie = await registerUser('other-403');

    const res = await supertest(app)
      .get(`/api/compliance/${weekId}`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('returns 404 when weekId does not exist', async () => {
    const cookie = await registerUser('404');

    const res = await supertest(app)
      .get('/api/compliance/nonexistent-week-id')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('200 response violations array is an array, not null or undefined', async () => {
    const cookie = await registerUser('violations-array');
    const { weekId } = await seedFixture(cookie);

    const res = await supertest(app)
      .get(`/api/compliance/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.violations)).toBe(true);
  });
});

describe('GET /api/compliance/project/:projectId', () => {
  it('returns 200 with badge, weekCount, lastWeekNumber shape', async () => {
    const cookie = await registerUser('proj-200');
    const { projectId } = await seedProjectFixture(cookie);

    const res = await supertest(app)
      .get(`/api/compliance/project/${projectId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.badge).toBe('string');
    expect(typeof res.body.weekCount).toBe('number');
    // lastWeekNumber is number or null
    expect(
      res.body.lastWeekNumber === null || typeof res.body.lastWeekNumber === 'number',
    ).toBe(true);
  });

  it('returns 403 when project is owned by a different user', async () => {
    const ownerCookie = await registerUser('proj-owner-403');
    const { projectId } = await seedProjectFixture(ownerCookie);

    const otherCookie = await registerUser('proj-other-403');

    const res = await supertest(app)
      .get(`/api/compliance/project/${projectId}`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('returns 404 when projectId does not exist', async () => {
    const cookie = await registerUser('proj-404');

    const res = await supertest(app)
      .get('/api/compliance/project/nonexistent-project-id')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('badge is "violations" when a week has an under-wage violation', async () => {
    const cookie = await registerUser('proj-violations');
    const { projectId } = await seedProjectWithViolation(cookie);

    const res = await supertest(app)
      .get(`/api/compliance/project/${projectId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.badge).toBe('violations');
  });

  it('badge is "clean" and weekCount is 0 when project has no payroll weeks', async () => {
    const cookie = await registerUser('proj-clean');

    // Create a project with no payroll weeks
    const pRes = await supertest(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({
        name: 'Empty Project',
        state: 'TX',
        county: 'Travis',
        contractType: 'federal-davis-bacon',
        awardDate: '2025-03-01',
        fundingType: 'federal',
      });
    const projectId = pRes.body.data?.project?.id as string;

    const res = await supertest(app)
      .get(`/api/compliance/project/${projectId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.badge).toBe('clean');
    expect(res.body.weekCount).toBe(0);
  });
});
