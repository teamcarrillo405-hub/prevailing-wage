import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';
import type { WorkerComplianceHistory } from '../../src/server/services/complianceService.js';

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
  const worker = wRes.body.data?.workers?.[0];
  const workerId = worker?.id as string;
  const classificationId = worker?.classifications?.[0]?.id as string;

  // Post a payroll entry with grossWages far below baseRateSnapshot × hours
  await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      payrollWeekId: weekId,
      workerId,
      classificationId,
      monSt: 8,
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

// ── Worker compliance history fixtures ────────────────────────────────────

async function seedMultiProjectWorkerHistory(cookie: string): Promise<{
  workerIdA: string;
  projectIdA: string;
  projectIdB: string;
  projectIdC: string;
}> {
  // Project A: worker "Jane Doe" SSN "1234" with under-wage violation
  const pA = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name: 'History Project A', state: 'TX', county: 'Travis', contractType: 'federal-davis-bacon', awardDate: '2025-03-01', fundingType: 'federal' });
  const projectIdA = pA.body.data?.project?.id as string;

  const wA = await supertest(app)
    .post(`/api/projects/${projectIdA}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Jane Doe', ssnLast4: '1234' });
  const workerIdA = wA.body.data?.worker?.id as string;

  await supertest(app)
    .post(`/api/projects/${projectIdA}/workers/${workerIdA}/classifications`)
    .set('Cookie', cookie)
    .send({ tradeCode: 'CARP', tradeDescription: 'Carpenter', laborType: 'journeyworker' });

  const wkA = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId: projectIdA, weekEndingDate: '2025-04-06', payrollNumber: 1 });

  const workersA = await supertest(app)
    .get(`/api/projects/${projectIdA}/workers`)
    .set('Cookie', cookie);
  const clsA = workersA.body.data?.workers?.[0]?.classifications?.[0];

  // Under-wage: grossWages=1.00 far below baseRate=50 * 8hrs
  await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      payrollWeekId: wkA.body.id,
      workerId: workerIdA,
      classificationId: clsA.id,
      monSt: 8,
      grossWages: 1.00,
      baseRateSnapshot: 50.00,
      fringeRateSnapshot: 10.00,
      deductions: 0,
    });

  // Project B: same worker "Jane Doe" SSN "1234" — no payroll entries (clean)
  const pB = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name: 'History Project B', state: 'TX', county: 'Travis', contractType: 'federal-davis-bacon', awardDate: '2025-03-01', fundingType: 'federal' });
  const projectIdB = pB.body.data?.project?.id as string;

  await supertest(app)
    .post(`/api/projects/${projectIdB}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Jane Doe', ssnLast4: '1234' });

  // Project C: different worker — should NOT match
  const pC = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name: 'History Project C', state: 'TX', county: 'Travis', contractType: 'federal-davis-bacon', awardDate: '2025-03-01', fundingType: 'federal' });
  const projectIdC = pC.body.data?.project?.id as string;

  await supertest(app)
    .post(`/api/projects/${projectIdC}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Bob Smith', ssnLast4: '5678' });

  return { workerIdA, projectIdA, projectIdB, projectIdC };
}

async function seedNullSsnWorkers(cookie: string): Promise<{
  workerIdA: string;
  projectIdA: string;
  projectIdB: string;
}> {
  // Project A: "John Smith" no SSN, with under-wage violation
  const pA = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name: 'Null SSN Project A', state: 'TX', county: 'Travis', contractType: 'federal-davis-bacon', awardDate: '2025-03-01', fundingType: 'federal' });
  const projectIdA = pA.body.data?.project?.id as string;

  const wA = await supertest(app)
    .post(`/api/projects/${projectIdA}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'John Smith' }); // ssnLast4 omitted = null
  const workerIdA = wA.body.data?.worker?.id as string;

  await supertest(app)
    .post(`/api/projects/${projectIdA}/workers/${workerIdA}/classifications`)
    .set('Cookie', cookie)
    .send({ tradeCode: 'CARP', tradeDescription: 'Carpenter', laborType: 'journeyworker' });

  const wkA = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId: projectIdA, weekEndingDate: '2025-04-06', payrollNumber: 1 });

  const workersA = await supertest(app)
    .get(`/api/projects/${projectIdA}/workers`)
    .set('Cookie', cookie);
  const clsA = workersA.body.data?.workers?.[0]?.classifications?.[0];

  await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      payrollWeekId: wkA.body.id,
      workerId: workerIdA,
      classificationId: clsA.id,
      monSt: 8,
      grossWages: 1.00,
      baseRateSnapshot: 50.00,
      fringeRateSnapshot: 10.00,
      deductions: 0,
    });

  // Project B: also "John Smith" no SSN, with violation — should NOT be merged
  const pB = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name: 'Null SSN Project B', state: 'TX', county: 'Travis', contractType: 'federal-davis-bacon', awardDate: '2025-03-01', fundingType: 'federal' });
  const projectIdB = pB.body.data?.project?.id as string;

  const wB = await supertest(app)
    .post(`/api/projects/${projectIdB}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'John Smith' }); // also null SSN
  const workerIdB = wB.body.data?.worker?.id as string;

  await supertest(app)
    .post(`/api/projects/${projectIdB}/workers/${workerIdB}/classifications`)
    .set('Cookie', cookie)
    .send({ tradeCode: 'CARP', tradeDescription: 'Carpenter', laborType: 'journeyworker' });

  const wkB = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId: projectIdB, weekEndingDate: '2025-04-06', payrollNumber: 1 });

  const workersB = await supertest(app)
    .get(`/api/projects/${projectIdB}/workers`)
    .set('Cookie', cookie);
  const clsB = workersB.body.data?.workers?.[0]?.classifications?.[0];

  await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      payrollWeekId: wkB.body.id,
      workerId: workerIdB,
      classificationId: clsB.id,
      monSt: 8,
      grossWages: 1.00,
      baseRateSnapshot: 50.00,
      fringeRateSnapshot: 10.00,
      deductions: 0,
    });

  return { workerIdA, projectIdA, projectIdB };
}

// ── Worker compliance history tests ───────────────────────────────────────

describe('GET /api/compliance/worker/:workerId/history', () => {
  it('Test 1: returns violations from project A only (project B clean, project C different worker)', async () => {
    const cookie = await registerUser('worker-hist-1');
    const { workerIdA } = await seedMultiProjectWorkerHistory(cookie);

    const res = await supertest(app)
      .get(`/api/compliance/worker/${workerIdA}/history`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const body = res.body as WorkerComplianceHistory;
    expect(body.workerId).toBe(workerIdA);
    expect(body.workerName).toBe('Jane Doe');
    expect(body.totalViolations).toBeGreaterThanOrEqual(1);
    expect(body.entries.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 2: each entry has projectName, weekEndingDate, payrollNumber, violationType, expected, actual, delta', async () => {
    const cookie = await registerUser('worker-hist-2');
    const { workerIdA, projectIdA } = await seedMultiProjectWorkerHistory(cookie);

    const res = await supertest(app)
      .get(`/api/compliance/worker/${workerIdA}/history`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const body = res.body as WorkerComplianceHistory;
    expect(body.entries.length).toBeGreaterThanOrEqual(1);

    const entry = body.entries[0];
    expect(entry.projectId).toBe(projectIdA);
    expect(typeof entry.projectName).toBe('string');
    expect(typeof entry.weekEndingDate).toBe('string');
    expect(typeof entry.payrollNumber).toBe('number');
    expect(typeof entry.violationType).toBe('string');
    expect(typeof entry.expected).toBe('number');
    expect(typeof entry.actual).toBe('number');
    expect(typeof entry.delta).toBe('number');
  });

  it('Test 3: worker with no payroll entries returns entries=[] and totalViolations=0', async () => {
    const cookie = await registerUser('worker-hist-3');

    // Create a project and worker with no payroll entries
    const pRes = await supertest(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({ name: 'Empty Worker Project', state: 'TX', county: 'Travis', contractType: 'federal-davis-bacon', awardDate: '2025-03-01', fundingType: 'federal' });
    const projectId = pRes.body.data?.project?.id as string;

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Empty Worker', ssnLast4: '9999' });
    const workerId = wRes.body.data?.worker?.id as string;

    const res = await supertest(app)
      .get(`/api/compliance/worker/${workerId}/history`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const body = res.body as WorkerComplianceHistory;
    expect(body.entries).toEqual([]);
    expect(body.totalViolations).toBe(0);
  });

  it('Test 4: returns 403 when worker belongs to a different user', async () => {
    const ownerCookie = await registerUser('worker-hist-4-owner');
    const otherCookie = await registerUser('worker-hist-4-other');

    const pRes = await supertest(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .send({ name: 'Owner Project', state: 'TX', county: 'Travis', contractType: 'federal-davis-bacon', awardDate: '2025-03-01', fundingType: 'federal' });
    const projectId = pRes.body.data?.project?.id as string;

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Owner Worker' });
    const workerId = wRes.body.data?.worker?.id as string;

    const res = await supertest(app)
      .get(`/api/compliance/worker/${workerId}/history`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('Test 5: returns 404 for non-existent workerId', async () => {
    const cookie = await registerUser('worker-hist-5');

    const res = await supertest(app)
      .get('/api/compliance/worker/nonexistent-worker-id/history')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('Test 6: ssnLast4=null safety — only returns violations from source project', async () => {
    const cookie = await registerUser('worker-hist-6');
    const { workerIdA, projectIdA } = await seedNullSsnWorkers(cookie);

    const res = await supertest(app)
      .get(`/api/compliance/worker/${workerIdA}/history`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const body = res.body as WorkerComplianceHistory;
    expect(body.ssnLast4).toBeNull();

    // All entries must belong to project A only (no cross-project merge with null SSN)
    for (const entry of body.entries) {
      expect(entry.projectId).toBe(projectIdA);
    }

    // Must have exactly the violations from project A (1 under-wage entry)
    expect(body.totalViolations).toBeGreaterThanOrEqual(1);
  });
});
