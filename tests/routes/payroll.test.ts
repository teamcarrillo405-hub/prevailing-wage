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
      wdNumber: `TEST-WD-${wdId}`,
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
    // Use a unique state/county so prior test WDs don't interfere
    const uniqueState = 'WY';
    const uniqueCounty = `copy-no-rate-county-${Date.now()}`;
    const projRes = await supertest(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({
        name: 'No Rate Test Project',
        state: uniqueState,
        county: uniqueCounty,
        contractType: 'federal-davis-bacon',
        awardDate: '2025-01-01',
        fundingType: 'federal',
      });
    const projectId = projRes.body.data?.project?.id as string;

    // Seed a WD for this state/county with only PLUM (no CARP)
    const { getDb } = await import('../../src/server/db/index.js');
    const { wageDeterminations, wageClassifications } = await import('../../src/server/db/schema.js');
    const db = getDb();
    const wdId = `test-wd-nocar-${Date.now()}`;
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.insert(wageDeterminations).values({
      id: wdId, source: 'federal-dol', wdNumber: `WD-NOCAR-${wdId}`, revisionNumber: 0,
      state: uniqueState, county: uniqueCounty, isActive: true,
      cachedAt: now, cacheExpiresAt: expires, createdAt: now, updatedAt: now,
    }).run();
    // Insert a PLUM classification (not CARP) so the rate map has no CARP entry
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

describe('POST /api/payroll/weeks/amend — AMD-01 + AMD-03', () => {
  // Seed helper: create worker, classification, payroll week, entry, then submit the week
  async function seedSubmittedWeek(cookie: string, projectId: string) {
    // Create worker
    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Amend Worker' });
    const workerId = wRes.body.data?.worker?.id as string;

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
      .send({ projectId, weekEndingDate: '2026-03-01', payrollNumber: 200 });
    const weekId = wkRes.body.id as string;

    // Create entry with hours and snapshots
    await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
        baseRateSnapshot: 55.00,
        fringeRateSnapshot: 22.00,
      });

    // Submit the week
    await supertest(app)
      .patch(`/api/payroll/weeks/${weekId}/submit`)
      .set('Cookie', cookie)
      .send({ submittedAt: '2026-03-01', submittedTo: 'DOL Region 9' });

    return { weekId, workerId, classificationId };
  }

  it('Test 1: POST /weeks/amend with valid submitted week returns 201 + { weekId, amendmentNumber: 1, copiedCount }', async () => {
    const cookie = await registerAndLogin('amend-basic');
    const projectId = await createProject(cookie);
    const { weekId } = await seedSubmittedWeek(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: weekId });

    expect(res.status).toBe(201);
    expect(typeof res.body.weekId).toBe('string');
    expect(res.body.amendmentNumber).toBe(1);
    expect(typeof res.body.copiedCount).toBe('number');
  });

  it('Test 2: POST /weeks/amend on unsubmitted week returns 409', async () => {
    const cookie = await registerAndLogin('amend-unsubmitted');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);

    const wkRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-03-08', payrollNumber: 201 });
    const weekId = wkRes.body.id as string;

    await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8,
        baseRateSnapshot: 45.00,
        fringeRateSnapshot: 18.00,
      });

    // Do NOT submit — amend an unsubmitted week
    const res = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: weekId });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/submitted/i);
  });

  it('Test 3: POST /weeks/amend on non-existent week returns 404', async () => {
    const cookie = await registerAndLogin('amend-404');

    const res = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: 'non-existent-week-uuid' });

    expect(res.status).toBe(404);
  });

  it('Test 4: Second amendment to same root week returns amendmentNumber: 2', async () => {
    const cookie = await registerAndLogin('amend-second');
    const projectId = await createProject(cookie);
    const { weekId } = await seedSubmittedWeek(cookie, projectId);

    // First amendment
    const res1 = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: weekId });
    expect(res1.status).toBe(201);
    expect(res1.body.amendmentNumber).toBe(1);

    // Second amendment (amending the original again)
    const res2 = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: weekId });
    expect(res2.status).toBe(201);
    expect(res2.body.amendmentNumber).toBe(2);
  });

  it('Test 5: Amendment of amendment links to root week (originalWeekId = root)', async () => {
    const cookie = await registerAndLogin('amend-chain');
    const projectId = await createProject(cookie);
    const { weekId: rootWeekId } = await seedSubmittedWeek(cookie, projectId);

    // First amendment of root
    const res1 = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: rootWeekId });
    expect(res1.status).toBe(201);
    const amendWeekId1 = res1.body.weekId as string;

    // Submit amendment 1 so it can be amended
    await supertest(app)
      .patch(`/api/payroll/weeks/${amendWeekId1}/submit`)
      .set('Cookie', cookie)
      .send({ submittedAt: '2026-03-02', submittedTo: 'DOL Region 9' });

    // Amendment of amendment 1
    const res2 = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: amendWeekId1 });
    expect(res2.status).toBe(201);

    // Verify the second amendment points to the root, not the intermediate amendment
    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${res2.body.weekId}`)
      .set('Cookie', cookie);
    expect(getRes.body.week.originalWeekId).toBe(rootWeekId);
  });

  it('Test 6: Amendment entries have same baseRateSnapshot/fringeRateSnapshot as source (cloned, not re-fetched)', async () => {
    const cookie = await registerAndLogin('amend-snapshots');
    const projectId = await createProject(cookie);
    const { weekId } = await seedSubmittedWeek(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: weekId });
    expect(res.status).toBe(201);

    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${res.body.weekId}`)
      .set('Cookie', cookie);

    expect(getRes.body.entries.length).toBeGreaterThanOrEqual(1);
    const entry = getRes.body.entries[0].entry;
    expect(entry.baseRateSnapshot).toBe(55.00);
    expect(entry.fringeRateSnapshot).toBe(22.00);
  });

  it('Test 7: Amendment entries have same daily hour fields as source', async () => {
    const cookie = await registerAndLogin('amend-hours');
    const projectId = await createProject(cookie);
    const { weekId } = await seedSubmittedWeek(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: weekId });
    expect(res.status).toBe(201);

    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${res.body.weekId}`)
      .set('Cookie', cookie);

    expect(getRes.body.entries.length).toBeGreaterThanOrEqual(1);
    const entry = getRes.body.entries[0].entry;
    // seedSubmittedWeek sets monSt..friSt = 8
    expect(entry.monSt).toBe(8);
    expect(entry.friSt).toBe(8);
    expect(entry.satSt).toBe(0);
    expect(entry.sunSt).toBe(0);
  });

  it('Test 8: Amendment week has submittedAt: null (editable)', async () => {
    const cookie = await registerAndLogin('amend-editable');
    const projectId = await createProject(cookie);
    const { weekId } = await seedSubmittedWeek(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: weekId });
    expect(res.status).toBe(201);

    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${res.body.weekId}`)
      .set('Cookie', cookie);

    expect(getRes.body.week.submittedAt).toBeNull();
  });

  it('Test 9: Amendment week has same weekEndingDate and payrollNumber as original', async () => {
    const cookie = await registerAndLogin('amend-dates');
    const projectId = await createProject(cookie);
    const { weekId } = await seedSubmittedWeek(cookie, projectId);

    // Get original week details
    const origRes = await supertest(app)
      .get(`/api/payroll/weeks/${weekId}`)
      .set('Cookie', cookie);
    const origWeek = origRes.body.week;

    const res = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: weekId });
    expect(res.status).toBe(201);

    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${res.body.weekId}`)
      .set('Cookie', cookie);

    expect(getRes.body.week.weekEndingDate).toBe(origWeek.weekEndingDate);
    expect(getRes.body.week.payrollNumber).toBe(origWeek.payrollNumber);
  });
});

describe('GET /api/export/wh347 — AMD-02', () => {
  async function seedAndSubmitWeek(cookie: string, projectId: string) {
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);

    const wkRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-04-01', payrollNumber: 300 });
    const weekId = wkRes.body.id as string;

    await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8,
        baseRateSnapshot: 55.00,
        fringeRateSnapshot: 22.00,
      });

    await supertest(app)
      .patch(`/api/payroll/weeks/${weekId}/submit`)
      .set('Cookie', cookie)
      .send({ submittedAt: '2026-04-01', submittedTo: 'DOL Region 9' });

    return { weekId };
  }

  it('AMD-02: Normal week WH-347 filename does not contain "amended"', async () => {
    const cookie = await registerAndLogin('export-normal');
    const projectId = await createProject(cookie);
    const { weekId } = await seedAndSubmitWeek(cookie, projectId);

    const res = await supertest(app)
      .get(`/api/export/wh347/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).not.toMatch(/amended/i);
  });

  it('AMD-02: Amendment week WH-347 Content-Disposition filename contains "amended"', async () => {
    const cookie = await registerAndLogin('export-amended');
    const projectId = await createProject(cookie);
    const { weekId } = await seedAndSubmitWeek(cookie, projectId);

    // Create amendment
    const amendRes = await supertest(app)
      .post('/api/payroll/weeks/amend')
      .set('Cookie', cookie)
      .send({ originalWeekId: weekId });
    expect(amendRes.status).toBe(201);
    const amendWeekId = amendRes.body.weekId as string;

    const res = await supertest(app)
      .get(`/api/export/wh347/${amendWeekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/amended/i);
  });
});

describe('DT hours - CAL-03', () => {
  it('should accept monDt-sunDt fields in payroll entry for CA project', async () => {
    const cookie = await registerAndLogin('cal03-dt-fields');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);

    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-04-01', payrollNumber: 400 });
    const weekId = weekRes.body.id as string;

    const res = await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8,
        monDt: 2,
        tueDt: 1.5,
        baseRateSnapshot: 45.00,
        fringeRateSnapshot: 20.00,
      });

    expect(res.status).toBe(201);

    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${weekId}`)
      .set('Cookie', cookie);
    expect(getRes.body.entries.length).toBeGreaterThanOrEqual(1);
    const entry = getRes.body.entries[0].entry;
    expect(entry.monDt).toBe(2);
    expect(entry.tueDt).toBe(1.5);
  });

  it('should default DT fields to 0 when not provided', async () => {
    const cookie = await registerAndLogin('cal03-no-dt');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);

    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-04-08', payrollNumber: 401 });
    const weekId = weekRes.body.id as string;

    const res = await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8,
        tueSt: 8,
        baseRateSnapshot: 45.00,
        fringeRateSnapshot: 20.00,
      });

    expect(res.status).toBe(201);

    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${weekId}`)
      .set('Cookie', cookie);
    expect(getRes.body.entries.length).toBeGreaterThanOrEqual(1);
    const entry = getRes.body.entries[0].entry;
    expect(entry.monDt).toBe(0);
    expect(entry.tueDt).toBe(0);
    expect(entry.sunDt).toBe(0);
  });
});
