import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';

// Set env vars before any module with startup assertions
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// Dynamic imports AFTER env setup to avoid cryptoService process.exit
const { app } = await import('../../src/server/index.js');
const { getDb } = await import('../../src/server/db/index.js');
const { auditLogs } = await import('../../src/server/db/schema.js');
const { eq, and } = await import('drizzle-orm');

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string) {
  const email = `payroll-audit-${suffix}-${Date.now()}@test.com`;
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
      name: 'Payroll Audit Test Project',
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
    .send({ name: 'Payroll Test Worker' });
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
    .send({
      projectId,
      weekEndingDate: '2025-01-11',
      payrollNumber: 1,
    });
  return res.body.id as string;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Payroll entry audit logging', () => {
  it('payroll_entry.created: POST new entry produces audit row with snapshot', async () => {
    const cookie = await registerAndLogin('entry-created');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);

    const entryRes = await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8,
        baseRateSnapshot: 45.00,
        fringeRateSnapshot: 12.00,
      });

    expect(entryRes.status).toBe(201);
    const entryId = entryRes.body.id as string;
    expect(entryId).toBeTruthy();

    const db = getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, 'payroll_entry'),
        eq(auditLogs.entityId, entryId),
        eq(auditLogs.action, 'payroll_entry.created'),
      ));

    expect(rows.length).toBe(1);
    expect(rows[0].snapshot).toBeTruthy();
    const snapshot = JSON.parse(rows[0].snapshot!);
    expect(snapshot.id).toBe(entryId);
  });

  it('payroll_entry.updated: second POST to same entry produces audit row with diff', async () => {
    const cookie = await registerAndLogin('entry-updated');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);

    // First POST — creates entry
    const firstRes = await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8,
        baseRateSnapshot: 45.00,
        fringeRateSnapshot: 12.00,
      });
    expect(firstRes.status).toBe(201);
    const entryId = firstRes.body.id as string;

    // Second POST — updates entry (same key: weekId + workerId + classificationId)
    const secondRes = await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 10,  // changed from 8 to 10
        baseRateSnapshot: 45.00,
        fringeRateSnapshot: 12.00,
      });
    expect(secondRes.status).toBe(201);

    const db = getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, 'payroll_entry'),
        eq(auditLogs.entityId, entryId),
        eq(auditLogs.action, 'payroll_entry.updated'),
      ));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const diff = JSON.parse(rows[0].diff!);
    expect(diff.before).toBeTruthy();
    expect(diff.after).toBeTruthy();
  });

  it('payroll_entry.deleted: DELETE entry produces audit row with snapshot', async () => {
    const cookie = await registerAndLogin('entry-deleted');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);

    // Create entry
    const createRes = await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8,
        baseRateSnapshot: 45.00,
        fringeRateSnapshot: 12.00,
      });
    expect(createRes.status).toBe(201);
    const entryId = createRes.body.id as string;

    // Delete entry
    const deleteRes = await supertest(app)
      .delete(`/api/payroll/entries/${entryId}`)
      .set('Cookie', cookie);

    expect(deleteRes.status).toBe(200);

    const db = getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, 'payroll_entry'),
        eq(auditLogs.entityId, entryId),
        eq(auditLogs.action, 'payroll_entry.deleted'),
      ));

    expect(rows.length).toBe(1);
    expect(rows[0].snapshot).toBeTruthy();
    const snapshot = JSON.parse(rows[0].snapshot!);
    expect(snapshot.id).toBe(entryId);
  });
});
