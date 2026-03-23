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

describe('POST /api/payroll/weeks/copy — PAY-01 + PAY-02', () => {
  // Seed helper: create worker, classification, a payroll week, and an entry
  async function seedWeekWithEntry(cookie: string, projectId: string, opts?: { workerActive?: boolean }) {
    const active = opts?.workerActive !== false;
    // Create worker
    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: active ? 'Jane Active' : 'Bob Inactive' });
    const workerId = wRes.body.data?.worker?.id as string;

    // Optionally deactivate the worker via direct DB access — we need to set isActive=0
    if (!active) {
      const { getDb } = await import('../../src/server/db/index.js');
      const { workers: workersTable } = await import('../../src/server/db/schema.js');
      const { eq } = await import('drizzle-orm');
      getDb().update(workersTable).set({ isActive: false }).where(eq(workersTable.id, workerId)).run();
    }

    // Create classification
    const cRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
      .set('Cookie', cookie)
      .send({ tradeCode: 'CARP', tradeDescription: 'Carpenter', laborType: 'journeyworker' });
    const classificationId = cRes.body.data?.classification?.id as string;

    // Create payroll week
    const wkRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-01-05', payrollNumber: 100 });
    const weekId = wkRes.body.id as string;

    // Create entry with hours
    await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
        baseRateSnapshot: 50.00,
        fringeRateSnapshot: 25.00,
      });

    return { weekId, workerId, classificationId };
  }

  // Seed a WD in cache for CA/Los Angeles so rate lookups succeed
  async function seedWdCache(projectId: string) {
    const { getDb } = await import('../../src/server/db/index.js');
    const { wageDeterminations, wageClassifications } = await import('../../src/server/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const db = getDb();

    // Get project state/county
    const { projects: projectsTable } = await import('../../src/server/db/schema.js');
    const [project] = db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).all();

    const wdId = `test-wd-${Date.now()}`;
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.insert(wageDeterminations).values({
      id: wdId,
      source: 'federal-dol',
      wdNumber: 'TEST-WD-001',
      revisionNumber: 0,
      state: project.state,
      county: project.county,
      isActive: true,
      cachedAt: now,
      cacheExpiresAt: expires,
      createdAt: now,
      updatedAt: now,
    }).run();

    db.insert(wageClassifications).values({
      id: `test-wc-${Date.now()}`,
      wageDeterminationId: wdId,
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
      baseRate: 55.00,
      fringeRate: 22.00,
      totalRate: 77.00,
      createdAt: now,
    }).run();

    return wdId;
  }

  it('Test 1: preview=true returns { weekId: null, copied, skipped } without creating a DB week', async () => {
    const cookie = await registerAndLogin('copy-preview');
    const projectId = await createProject(cookie);
    await seedWdCache(projectId);
    const { weekId: sourceWeekId } = await seedWeekWithEntry(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/weeks/copy')
      .set('Cookie', cookie)
      .send({
        sourceWeekId,
        weekEndingDate: '2026-01-12',
        payrollNumber: 101,
        preview: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.weekId).toBeNull();
    expect(Array.isArray(res.body.copied)).toBe(true);
    expect(Array.isArray(res.body.skipped)).toBe(true);
    expect(res.body.copied.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 2: preview=false creates a new week and returns { weekId: string, copied, skipped }', async () => {
    const cookie = await registerAndLogin('copy-commit');
    const projectId = await createProject(cookie);
    await seedWdCache(projectId);
    const { weekId: sourceWeekId } = await seedWeekWithEntry(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/weeks/copy')
      .set('Cookie', cookie)
      .send({
        sourceWeekId,
        weekEndingDate: '2026-01-12',
        payrollNumber: 102,
        preview: false,
      });

    expect(res.status).toBe(201);
    expect(typeof res.body.weekId).toBe('string');
    expect(res.body.weekId).not.toBeNull();
    expect(Array.isArray(res.body.copied)).toBe(true);
    expect(res.body.copied.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 3: Copied entries have fresh baseRateSnapshot/fringeRateSnapshot from WD cache', async () => {
    const cookie = await registerAndLogin('copy-fresh-rates');
    const projectId = await createProject(cookie);
    await seedWdCache(projectId);
    const { weekId: sourceWeekId } = await seedWeekWithEntry(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/weeks/copy')
      .set('Cookie', cookie)
      .send({
        sourceWeekId,
        weekEndingDate: '2026-01-12',
        payrollNumber: 103,
        preview: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.copied.length).toBeGreaterThanOrEqual(1);
    // Fresh rates from WD (55.00/22.00), NOT source entry rates (50.00/25.00)
    expect(res.body.copied[0].baseRate).toBe(55.00);
    expect(res.body.copied[0].fringeRate).toBe(22.00);
  });

  it('Test 4: Inactive worker appears in skipped[] with reason worker-inactive', async () => {
    const cookie = await registerAndLogin('copy-inactive');
    const projectId = await createProject(cookie);
    await seedWdCache(projectId);
    const { weekId: sourceWeekId } = await seedWeekWithEntry(cookie, projectId, { workerActive: false });

    const res = await supertest(app)
      .post('/api/payroll/weeks/copy')
      .set('Cookie', cookie)
      .send({
        sourceWeekId,
        weekEndingDate: '2026-01-12',
        payrollNumber: 104,
        preview: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.skipped.length).toBeGreaterThanOrEqual(1);
    expect(res.body.skipped[0].reason).toBe('worker-inactive');
  });

  it('Test 5: Entry with unresolvable tradeCode appears in skipped[] with reason rate-lookup-failed', async () => {
    const cookie = await registerAndLogin('copy-no-rate');
    const projectId = await createProject(cookie);
    // Seed WD with no CARP classification
    const { getDb } = await import('../../src/server/db/index.js');
    const { wageDeterminations, wageClassifications } = await import('../../src/server/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const { projects: projectsTable } = await import('../../src/server/db/schema.js');
    const db = getDb();
    const [project] = db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).all();
    const wdId = `test-wd-nocar-${Date.now()}`;
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.insert(wageDeterminations).values({
      id: wdId, source: 'federal-dol', wdNumber: `WD-NOCAR-${Date.now()}`, revisionNumber: 0,
      state: project.state, county: project.county, isActive: true,
      cachedAt: now, cacheExpiresAt: expires, createdAt: now, updatedAt: now,
    }).run();
    // Insert a PLUM classification (not CARP)
    db.insert(wageClassifications).values({
      id: `test-wc-plum-${Date.now()}`, wageDeterminationId: wdId,
      tradeCode: 'PLUM', tradeDescription: 'Plumber', laborType: 'journeyworker',
      baseRate: 60.00, fringeRate: 24.00, totalRate: 84.00, createdAt: now,
    }).run();

    const { weekId: sourceWeekId } = await seedWeekWithEntry(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/weeks/copy')
      .set('Cookie', cookie)
      .send({
        sourceWeekId,
        weekEndingDate: '2026-01-12',
        payrollNumber: 105,
        preview: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.skipped.length).toBeGreaterThanOrEqual(1);
    expect(res.body.skipped[0].reason).toBe('rate-lookup-failed');
  });

  it('Test 6: New week has null submittedAt, submittedTo, amendmentNumber, originalWeekId', async () => {
    const cookie = await registerAndLogin('copy-null-flags');
    const projectId = await createProject(cookie);
    await seedWdCache(projectId);
    const { weekId: sourceWeekId } = await seedWeekWithEntry(cookie, projectId);

    const copyRes = await supertest(app)
      .post('/api/payroll/weeks/copy')
      .set('Cookie', cookie)
      .send({
        sourceWeekId,
        weekEndingDate: '2026-01-12',
        payrollNumber: 106,
        preview: false,
      });

    expect(copyRes.status).toBe(201);
    const newWeekId = copyRes.body.weekId as string;

    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${newWeekId}`)
      .set('Cookie', cookie);

    expect(getRes.body.week.submittedAt).toBeNull();
    expect(getRes.body.week.submittedTo).toBeNull();
    expect(getRes.body.week.amendmentNumber).toBeNull();
    expect(getRes.body.week.originalWeekId).toBeNull();
  });

  it('Test 7: Source entry daily hours (monSt..sunOt) are preserved in copied entries', async () => {
    const cookie = await registerAndLogin('copy-hours');
    const projectId = await createProject(cookie);
    await seedWdCache(projectId);
    const { weekId: sourceWeekId } = await seedWeekWithEntry(cookie, projectId);

    const copyRes = await supertest(app)
      .post('/api/payroll/weeks/copy')
      .set('Cookie', cookie)
      .send({
        sourceWeekId,
        weekEndingDate: '2026-01-12',
        payrollNumber: 107,
        preview: false,
      });

    expect(copyRes.status).toBe(201);
    const newWeekId = copyRes.body.weekId as string;

    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${newWeekId}`)
      .set('Cookie', cookie);

    expect(getRes.body.entries.length).toBeGreaterThanOrEqual(1);
    const entry = getRes.body.entries[0].entry;
    // seedWeekWithEntry sets monSt=8..friSt=8
    expect(entry.monSt).toBe(8);
    expect(entry.friSt).toBe(8);
  });

  it('Test 8: 404 if sourceWeekId does not exist', async () => {
    const cookie = await registerAndLogin('copy-404');

    const res = await supertest(app)
      .post('/api/payroll/weeks/copy')
      .set('Cookie', cookie)
      .send({
        sourceWeekId: 'non-existent-week-id',
        weekEndingDate: '2026-01-12',
        payrollNumber: 108,
        preview: true,
      });

    expect(res.status).toBe(404);
  });

  it('Test 9: 403 if user does not own the project', async () => {
    const ownerCookie = await registerAndLogin('copy-owner');
    const otherCookie = await registerAndLogin('copy-other');
    const projectId = await createProject(ownerCookie);
    await seedWdCache(projectId);
    const { weekId: sourceWeekId } = await seedWeekWithEntry(ownerCookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/weeks/copy')
      .set('Cookie', otherCookie)
      .send({
        sourceWeekId,
        weekEndingDate: '2026-01-12',
        payrollNumber: 109,
        preview: true,
      });

    expect(res.status).toBe(403);
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
