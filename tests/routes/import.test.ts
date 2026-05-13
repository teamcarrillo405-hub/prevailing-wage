// tests/routes/import.test.ts
// Integration tests for POST /api/payroll/import/preview and /commit endpoints.
// Phase 35 Plan 02 — Payroll Import Server Pipeline.

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string): Promise<string> {
  const email = `import-route-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Import Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  expect(res.status).toBe(201);
  return res.body.data?.project?.id as string;
}

async function createWorker(cookie: string, projectId: string, name: string): Promise<{ workerId: string; classificationId: string }> {
  const wRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name });
  expect(wRes.status).toBe(201);
  const workerId = wRes.body.data?.worker?.id as string;

  const cRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
    });
  expect(cRes.status).toBe(201);
  const classificationId = cRes.body.data?.classification?.id as string;

  return { workerId, classificationId };
}

async function createPayrollWeek(
  cookie: string,
  projectId: string,
  weekEndingDate = '2025-01-12',
  payrollNumber = 1
): Promise<string> {
  const res = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate, payrollNumber });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function submitWeek(cookie: string, weekId: string): Promise<void> {
  const res = await supertest(app)
    .patch(`/api/payroll/weeks/${weekId}/submit`)
    .set('Cookie', cookie)
    .send({ submittedAt: '2025-01-12', submittedTo: 'DOL Region 9' });
  expect(res.status).toBe(200);
}

// ── QB CSV Test Fixtures ──────────────────────────────────────────────────
// Week ending 2025-01-12 (Sunday) — week starts 2025-01-06 (Monday)
// Mon=01/06/2025, Tue=01/07/2025, Wed=01/08/2025, Thu=01/09/2025, Fri=01/10/2025

const QB_CSV_WITH_JOHN_SMITH = `Employee,Date,Duration,Payroll Item,Customer:Job
John Smith,01/06/2025,8.00,Regular Pay,Test Project
John Smith,01/07/2025,8.00,Regular Pay,Test Project
John Smith,01/06/2025,2.00,Overtime Pay,Test Project
Jane Doe,01/06/2025,8.00,Regular Pay,Test Project
`;

const QB_CSV_JOHN_ONLY = `Employee,Date,Duration,Payroll Item,Customer:Job
John Smith,01/06/2025,8.00,Regular Pay,Test Project
John Smith,01/07/2025,8.00,Regular Pay,Test Project
John Smith,01/06/2025,2.00,Overtime Pay,Test Project
`;

const ADP_CSV = `Co Code,Batch ID,File #,First Name,Last Name,Week,Reg Hours,O/T Hours
ABC,001,101,John,Smith,01,40.00,5.00
ABC,001,102,Jane,Doe,01,32.00,0.00
`;

const UNKNOWN_CSV = `Company,Invoice,Amount,Date
Acme Corp,INV-001,500.00,2025-01-06
Acme Corp,INV-002,750.00,2025-01-07
`;

// ── Tests: POST /api/payroll/import/preview ───────────────────────────────

describe('POST /api/payroll/import/preview', () => {
  it('downloads provider CSV templates for authenticated users', async () => {
    const cookie = await registerAndLogin('template-download');

    const res = await supertest(app)
      .get('/api/payroll/import/templates/quickbooks.csv')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Employee,Project/Customer,Class/Trade');
    expect(res.text).toContain('Maria Santos');
  });

  it('downloads CSV templates for every supported import provider', async () => {
    const cookie = await registerAndLogin('template-all-providers');

    for (const provider of ['quickbooks', 'adp', 'gusto', 'paychex', 'sage_300', 'sage_100']) {
      const res = await supertest(app)
        .get(`/api/payroll/import/templates/${provider}.csv`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain(`${provider}-payroll-import-template.csv`);
      expect(res.text.split('\n')[0].length).toBeGreaterThan(10);
    }
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app)
      .post('/api/payroll/import/preview')
      .field('weekId', 'any-week-id')
      .attach('file', Buffer.from(QB_CSV_JOHN_ONLY), { filename: 'test.csv', contentType: 'text/csv' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when no file uploaded', async () => {
    const cookie = await registerAndLogin('preview-nofile');
    const projectId = await createProject(cookie);
    const weekId = await createPayrollWeek(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/import/preview')
      .set('Cookie', cookie)
      .field('weekId', weekId);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No file uploaded/i);
  });

  it('returns 400 for unknown CSV format', async () => {
    const cookie = await registerAndLogin('preview-unknown');
    const projectId = await createProject(cookie);
    const weekId = await createPayrollWeek(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/import/preview')
      .set('Cookie', cookie)
      .field('weekId', weekId)
      .attach('file', Buffer.from(UNKNOWN_CSV), { filename: 'unknown.csv', contentType: 'text/csv' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Could not detect payroll provider/i);
  });

  it('returns 423 when week is submitted', async () => {
    const cookie = await registerAndLogin('preview-submitted');
    const projectId = await createProject(cookie);
    const weekId = await createPayrollWeek(cookie, projectId);
    await submitWeek(cookie, weekId);

    const res = await supertest(app)
      .post('/api/payroll/import/preview')
      .set('Cookie', cookie)
      .field('weekId', weekId)
      .attach('file', Buffer.from(QB_CSV_JOHN_ONLY), { filename: 'test.csv', contentType: 'text/csv' });

    expect(res.status).toBe(423);
    expect(res.body.error).toMatch(/submitted/i);
  });

  it('QB CSV: matched worker appears in matched[], unmatched in unmatched[]', async () => {
    const cookie = await registerAndLogin('preview-qb-matched');
    const projectId = await createProject(cookie);
    // Create "John Smith" in the project — will match CSV
    await createWorker(cookie, projectId, 'John Smith');
    // "Jane Doe" is in CSV but NOT in the project — will be unmatched
    const weekId = await createPayrollWeek(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/import/preview')
      .set('Cookie', cookie)
      .field('weekId', weekId)
      .attach('file', Buffer.from(QB_CSV_WITH_JOHN_SMITH), { filename: 'qb.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('quickbooks');
    expect(Array.isArray(res.body.matched)).toBe(true);
    expect(Array.isArray(res.body.unmatched)).toBe(true);
    expect(Array.isArray(res.body.conflicts)).toBe(true);

    // John Smith should be matched
    const johnMatch = res.body.matched.find((r: any) => r.csvName === 'John Smith');
    expect(johnMatch).toBeDefined();
    // mon=01/06 => monSt=8, tueSt=8, monOt=2
    expect(johnMatch.monSt).toBe(8);
    expect(johnMatch.tueSt).toBe(8);
    expect(johnMatch.monOt).toBe(2);

    // Jane Doe should be unmatched (not in project)
    const janeDoeUnmatched = res.body.unmatched.find((r: any) => r.csvName === 'Jane Doe');
    expect(janeDoeUnmatched).toBeDefined();
  });

  it('ADP CSV: returns provider=adp, adpWeeklyTotalsOnly=true, hours on Monday', async () => {
    const cookie = await registerAndLogin('preview-adp');
    const projectId = await createProject(cookie);
    // Create "John Smith" in project
    await createWorker(cookie, projectId, 'John Smith');
    const weekId = await createPayrollWeek(cookie, projectId);

    const res = await supertest(app)
      .post('/api/payroll/import/preview')
      .set('Cookie', cookie)
      .field('weekId', weekId)
      .attach('file', Buffer.from(ADP_CSV), { filename: 'adp.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('adp');
    expect(res.body.adpWeeklyTotalsOnly).toBe(true);

    // John Smith matched — hours placed on Monday
    const johnMatch = res.body.matched.find((r: any) => r.csvName === 'John Smith');
    expect(johnMatch).toBeDefined();
    expect(johnMatch.monSt).toBe(40);
    expect(johnMatch.monOt).toBe(5);
    // All other days should be 0
    expect(johnMatch.tueSt).toBe(0);
    expect(johnMatch.wedSt).toBe(0);
  });
});

// ── Tests: POST /api/payroll/import/commit ────────────────────────────────

describe('POST /api/payroll/import/commit', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app)
      .post('/api/payroll/import/commit')
      .send({ weekId: 'any', provider: 'quickbooks', matched: [] });

    expect(res.status).toBe(401);
  });

  it('returns 423 when week is submitted', async () => {
    const cookie = await registerAndLogin('commit-submitted');
    const projectId = await createProject(cookie);
    const weekId = await createPayrollWeek(cookie, projectId);
    await submitWeek(cookie, weekId);
    const { workerId, classificationId } = await createWorker(cookie, projectId, 'Test Worker Commit Sub');

    const res = await supertest(app)
      .post('/api/payroll/import/commit')
      .set('Cookie', cookie)
      .send({
        weekId,
        provider: 'quickbooks',
        matched: [
          {
            csvName: 'Test Worker Commit Sub',
            workerId,
            workerName: 'Test Worker Commit Sub',
            classificationId,
            classificationName: 'Carpenter',
            baseRateSnapshot: 45.00,
            fringeRateSnapshot: 20.00,
            monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
            monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
          },
        ],
        unmatchedCount: 0,
        sourceFilename: 'payroll.csv',
      });

    expect(res.status).toBe(423);
    expect(res.body.error).toMatch(/submitted/i);
  });

  it('creates payrollEntries and payrollImports audit row on success', async () => {
    const cookie = await registerAndLogin('commit-success');
    const projectId = await createProject(cookie);
    const weekId = await createPayrollWeek(cookie, projectId, '2025-02-09');
    const { workerId, classificationId } = await createWorker(cookie, projectId, 'Commit Worker One');

    const res = await supertest(app)
      .post('/api/payroll/import/commit')
      .set('Cookie', cookie)
      .send({
        weekId,
        provider: 'quickbooks',
        matched: [
          {
            csvName: 'Commit Worker One',
            workerId,
            workerName: 'Commit Worker One',
            classificationId,
            classificationName: 'Carpenter',
            baseRateSnapshot: 45.00,
            fringeRateSnapshot: 20.00,
            monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
            monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
          },
        ],
        unmatchedCount: 1,
        sourceFilename: 'payroll-week5.csv',
      });

    expect(res.status).toBe(200);
    expect(res.body.committed).toBe(1);

    // Verify payrollEntry was created via GET week endpoint
    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${weekId}`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.entries.length).toBe(1);
    // getPayrollEntries returns { entry: { workerId, monSt, ... }, workerName, ... }
    const { entry } = getRes.body.entries[0];
    expect(entry.workerId).toBe(workerId);
    expect(entry.monSt).toBe(8);
    expect(entry.tueSt).toBe(8);
    expect(entry.friSt).toBe(8);
    expect(entry.monOt).toBe(0);

    // Verify payrollImports audit row via test DB
    const db = (globalThis as any).__testDb;
    const { payrollImports, payrollProviderMappings } = await import('../../src/server/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const auditRows = await db
      .select()
      .from(payrollImports)
      .where(eq(payrollImports.payrollWeekId, weekId));

    expect(auditRows.length).toBe(1);
    const audit = auditRows[0];
    expect(audit.provider).toBe('quickbooks');
    expect(audit.committedCount).toBe(1);
    expect(audit.unmatchedCount).toBe(1);
    expect(audit.sourceFilename).toBe('payroll-week5.csv');

    const mappingRows = await db
      .select()
      .from(payrollProviderMappings)
      .where(eq(payrollProviderMappings.projectId, projectId));
    expect(mappingRows.length).toBe(1);
    expect(mappingRows[0].providerWorkerId).toBe('Commit Worker One');
    expect(mappingRows[0].workerId).toBe(workerId);
  });

  it('returns 409 when worker already has an entry for the week', async () => {
    const cookie = await registerAndLogin('commit-conflict');
    const projectId = await createProject(cookie);
    const weekId = await createPayrollWeek(cookie, projectId, '2025-03-09');
    const { workerId, classificationId } = await createWorker(cookie, projectId, 'Conflict Worker');

    // First commit succeeds
    const firstCommit = await supertest(app)
      .post('/api/payroll/import/commit')
      .set('Cookie', cookie)
      .send({
        weekId,
        provider: 'quickbooks',
        matched: [
          {
            csvName: 'Conflict Worker',
            workerId,
            workerName: 'Conflict Worker',
            classificationId,
            classificationName: 'Carpenter',
            baseRateSnapshot: 45.00,
            fringeRateSnapshot: 20.00,
            monSt: 8, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
            monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
          },
        ],
        unmatchedCount: 0,
      });
    expect(firstCommit.status).toBe(200);

    // Second commit on same worker/week => 409
    const secondCommit = await supertest(app)
      .post('/api/payroll/import/commit')
      .set('Cookie', cookie)
      .send({
        weekId,
        provider: 'quickbooks',
        matched: [
          {
            csvName: 'Conflict Worker',
            workerId,
            workerName: 'Conflict Worker',
            classificationId,
            classificationName: 'Carpenter',
            baseRateSnapshot: 45.00,
            fringeRateSnapshot: 20.00,
            monSt: 8, tueSt: 8, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
            monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
          },
        ],
        unmatchedCount: 0,
      });
    expect(secondCommit.status).toBe(409);
    expect(secondCommit.body.error).toMatch(/already have entries/i);
  });

  it('commits multiple workers and returns correct committed count', async () => {
    const cookie = await registerAndLogin('commit-multi');
    const projectId = await createProject(cookie);
    const weekId = await createPayrollWeek(cookie, projectId, '2025-04-06');
    const { workerId: worker1Id, classificationId: class1Id } = await createWorker(cookie, projectId, 'Multi Worker A');
    const { workerId: worker2Id, classificationId: class2Id } = await createWorker(cookie, projectId, 'Multi Worker B');

    const res = await supertest(app)
      .post('/api/payroll/import/commit')
      .set('Cookie', cookie)
      .send({
        weekId,
        provider: 'adp',
        matched: [
          {
            csvName: 'Multi Worker A',
            workerId: worker1Id,
            workerName: 'Multi Worker A',
            classificationId: class1Id,
            classificationName: 'Carpenter',
            baseRateSnapshot: 45.00,
            fringeRateSnapshot: 20.00,
            monSt: 40, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
            monOt: 5, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
          },
          {
            csvName: 'Multi Worker B',
            workerId: worker2Id,
            workerName: 'Multi Worker B',
            classificationId: class2Id,
            classificationName: 'Carpenter',
            baseRateSnapshot: 45.00,
            fringeRateSnapshot: 20.00,
            monSt: 32, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
            monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
          },
        ],
        unmatchedCount: 0,
        sourceFilename: 'adp-import.csv',
      });

    expect(res.status).toBe(200);
    expect(res.body.committed).toBe(2);

    // Verify both entries created
    const getRes = await supertest(app)
      .get(`/api/payroll/weeks/${weekId}`)
      .set('Cookie', cookie);
    expect(getRes.body.entries.length).toBe(2);

    // Verify audit row has committedCount=2
    const db = (globalThis as any).__testDb;
    const { payrollImports } = await import('../../src/server/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const auditRows = await db
      .select()
      .from(payrollImports)
      .where(eq(payrollImports.payrollWeekId, weekId));
    expect(auditRows[0].committedCount).toBe(2);
    expect(auditRows[0].provider).toBe('adp');
  });
});

describe('GET /api/payroll/import/reconciliation/:weekId', () => {
  it('returns an actionable reconciliation summary after import commit', async () => {
    const cookie = await registerAndLogin('reconciliation-commit');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorker(cookie, projectId, 'Reconcile Worker');
    const weekId = await createPayrollWeek(cookie, projectId, '2025-02-09');

    const commitRes = await supertest(app)
      .post('/api/payroll/import/commit')
      .set('Cookie', cookie)
      .send({
        weekId,
        provider: 'quickbooks',
        sourceFilename: 'qb.csv',
        unmatchedCount: 1,
        matched: [
          {
            csvName: 'Reconcile Worker',
            workerId,
            workerName: 'Reconcile Worker',
            classificationId,
            classificationName: 'Carpenter',
            baseRateSnapshot: 45,
            fringeRateSnapshot: 20,
            monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
            monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
            grossWages: 2600,
            deductions: 300,
            netPay: 2300,
            checkNumber: '1001',
            ficaTax: 100,
            federalIncomeTax: 120,
            stateIncomeTax: 50,
            sdiTax: 10,
            deductionDues: 20,
            fringeHealthWelfare: 4,
            fringePension: 6,
            fringeVacation: 5,
            fringeTraining: 5,
          },
        ],
      });
    expect(commitRes.status).toBe(200);

    const res = await supertest(app)
      .get(`/api/payroll/import/reconciliation/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.latestImport.provider).toBe('quickbooks');
    expect(res.body.data.summary.entryCount).toBe(1);
    expect(res.body.data.summary.totalHours).toBe(40);
    expect(res.body.data.status).toBe('needs_review');
    expect(res.body.data.issues.some((issue: any) => issue.id === 'unmatched-workers')).toBe(true);
    expect(res.body.data.summary.sourceDetailCompleteCount).toBe(1);
    expect(res.body.data.summary.sourceCoverage.taxBreakdown).toBe(100);
    expect(res.body.data.summary.sourceCoverage.deductionBreakdown).toBe(100);
    expect(res.body.data.summary.itemizedDeductionMismatchCount).toBe(0);
    expect(res.body.data.automation.confidenceScore).toBeGreaterThanOrEqual(75);
    expect(res.body.data.automation.tasks.some((task: any) => task.id === 'mapping-memory')).toBe(true);
    expect(res.body.data.summary.automationConfidenceScore).toBe(res.body.data.automation.confidenceScore);
  });

  it('warns when a week has no import and no entries', async () => {
    const cookie = await registerAndLogin('reconciliation-empty');
    const projectId = await createProject(cookie);
    const weekId = await createPayrollWeek(cookie, projectId, '2025-02-16');

    const res = await supertest(app)
      .get(`/api/payroll/import/reconciliation/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('needs_review');
    expect(res.body.data.latestImport).toBeNull();
    expect(res.body.data.issues[0].id).toBe('no-import');
  });

  it('returns changed-row review when a prior week baseline exists', async () => {
    const cookie = await registerAndLogin('reconciliation-delta');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorker(cookie, projectId, 'Delta Worker');
    const weekOneId = await createPayrollWeek(cookie, projectId, '2025-02-09', 1);
    const weekTwoId = await createPayrollWeek(cookie, projectId, '2025-02-16', 2);

    async function commitWeek(weekId: string, grossWages: number) {
      const res = await supertest(app)
        .post('/api/payroll/import/commit')
        .set('Cookie', cookie)
        .send({
          weekId,
          provider: 'quickbooks',
          sourceFilename: 'qb.csv',
          unmatchedCount: 0,
          matched: [
            {
              csvName: 'Delta Worker',
              workerId,
              workerName: 'Delta Worker',
              classificationId,
              classificationName: 'Carpenter',
              baseRateSnapshot: 45,
              fringeRateSnapshot: 20,
              monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
              monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
              grossWages,
              deductions: 300,
              netPay: grossWages - 300,
              checkNumber: '1001',
              ficaTax: 100,
              federalIncomeTax: 120,
              stateIncomeTax: 50,
              sdiTax: 10,
              deductionDues: 20,
              fringeHealthWelfare: 4,
              fringePension: 6,
              fringeVacation: 5,
              fringeTraining: 5,
            },
          ],
        });
      expect(res.status).toBe(200);
    }

    await commitWeek(weekOneId, 2600);
    await commitWeek(weekTwoId, 2800);

    const res = await supertest(app)
      .get(`/api/payroll/import/reconciliation/${weekTwoId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.automation.changedRowReview.priorWeekRows).toBe(1);
    expect(res.body.data.automation.changedRowReview.changedRows).toBe(1);
    expect(res.body.data.automation.changedRowReview.mode).toBe('exceptions_only');
    expect(res.body.data.automation.changedRowReview.status).toBe('pending');

    const ackRes = await supertest(app)
      .post(`/api/compliance/${weekTwoId}/submit-ready/acknowledgements`)
      .set('Cookie', cookie)
      .send({ issueId: 'payroll-automation-exceptions' });

    expect(ackRes.status).toBe(201);

    const reviewedRes = await supertest(app)
      .get(`/api/payroll/import/reconciliation/${weekTwoId}`)
      .set('Cookie', cookie);

    expect(reviewedRes.status).toBe(200);
    expect(reviewedRes.body.data.status).toBe('reconciled');
    expect(reviewedRes.body.data.summary.payDeltaReviewed).toBe(true);
    expect(reviewedRes.body.data.automation.changedRowReview.status).toBe('reviewed');
    expect(reviewedRes.body.data.automation.exceptionCount).toBe(0);
  });
});

// ── Tests: GET /api/payroll/import/mappings/:projectId ────────────────────

describe('GET /api/payroll/import/mappings/:projectId', () => {
  it('returns 200 with mappings for authenticated project owner', async () => {
    const cookie = await registerAndLogin('mappings-get-owner');
    const projectId = await createProject(cookie);
    const { workerId } = await createWorker(cookie, projectId, 'Mapping Worker A');

    // Seed a mapping via POST first
    const postRes = await supertest(app)
      .post('/api/payroll/import/mappings')
      .set('Cookie', cookie)
      .send({
        projectId,
        provider: 'paychex',
        mappings: [{ providerWorkerId: 'PX-001', workerId }],
      });
    expect(postRes.status).toBe(200);

    const res = await supertest(app)
      .get(`/api/payroll/import/mappings/${projectId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.mappings)).toBe(true);
    expect(res.body.mappings.length).toBe(1);
    const mapping = res.body.mappings[0];
    expect(mapping.projectId).toBe(projectId);
    expect(mapping.provider).toBe('paychex');
    expect(mapping.providerWorkerId).toBe('PX-001');
    expect(mapping.workerId).toBe(workerId);
    expect(mapping.id).toBeDefined();
    expect(mapping.createdAt).toBeDefined();
  });

  it('filters by ?provider= query param', async () => {
    const cookie = await registerAndLogin('mappings-get-filter');
    const projectId = await createProject(cookie);
    const { workerId: worker1Id } = await createWorker(cookie, projectId, 'Filter Worker A');
    const { workerId: worker2Id } = await createWorker(cookie, projectId, 'Filter Worker B');

    // Insert two mappings for different providers
    await supertest(app)
      .post('/api/payroll/import/mappings')
      .set('Cookie', cookie)
      .send({
        projectId,
        provider: 'paychex',
        mappings: [{ providerWorkerId: 'PX-100', workerId: worker1Id }],
      });
    await supertest(app)
      .post('/api/payroll/import/mappings')
      .set('Cookie', cookie)
      .send({
        projectId,
        provider: 'sage_300',
        mappings: [{ providerWorkerId: '200', workerId: worker2Id }],
      });

    const res = await supertest(app)
      .get(`/api/payroll/import/mappings/${projectId}?provider=paychex`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.mappings.length).toBe(1);
    expect(res.body.mappings[0].provider).toBe('paychex');
    expect(res.body.mappings[0].providerWorkerId).toBe('PX-100');
  });

  it('returns 403 without project access (NFR-03)', async () => {
    const cookieA = await registerAndLogin('mappings-get-owner-nfr');
    const projectId = await createProject(cookieA);

    const cookieB = await registerAndLogin('mappings-get-intruder-nfr');
    const res = await supertest(app)
      .get(`/api/payroll/import/mappings/${projectId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app)
      .get('/api/payroll/import/mappings/any-project-id');

    expect(res.status).toBe(401);
  });
});

// ── Tests: POST /api/payroll/import/mappings ──────────────────────────────

describe('POST /api/payroll/import/mappings', () => {
  it('saves mappings and returns count', async () => {
    const cookie = await registerAndLogin('mappings-post-save');
    const projectId = await createProject(cookie);
    const { workerId: worker1Id } = await createWorker(cookie, projectId, 'Post Worker A');
    const { workerId: worker2Id } = await createWorker(cookie, projectId, 'Post Worker B');

    const res = await supertest(app)
      .post('/api/payroll/import/mappings')
      .set('Cookie', cookie)
      .send({
        projectId,
        provider: 'paychex',
        mappings: [
          { providerWorkerId: 'PX-001', workerId: worker1Id },
          { providerWorkerId: 'PX-002', workerId: worker2Id },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(2);

    // Verify they're stored
    const getRes = await supertest(app)
      .get(`/api/payroll/import/mappings/${projectId}`)
      .set('Cookie', cookie);
    expect(getRes.body.mappings.length).toBe(2);
  });

  it('upserts: updating existing providerWorkerId changes workerId', async () => {
    const cookie = await registerAndLogin('mappings-post-upsert');
    const projectId = await createProject(cookie);
    const { workerId: worker1Id } = await createWorker(cookie, projectId, 'Upsert Worker A');
    const { workerId: worker2Id } = await createWorker(cookie, projectId, 'Upsert Worker B');

    // Initial insert
    await supertest(app)
      .post('/api/payroll/import/mappings')
      .set('Cookie', cookie)
      .send({
        projectId,
        provider: 'paychex',
        mappings: [{ providerWorkerId: 'PX-UPSERT', workerId: worker1Id }],
      });

    // Re-map same providerWorkerId to a different worker
    const res = await supertest(app)
      .post('/api/payroll/import/mappings')
      .set('Cookie', cookie)
      .send({
        projectId,
        provider: 'paychex',
        mappings: [{ providerWorkerId: 'PX-UPSERT', workerId: worker2Id }],
      });

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(1);

    // Verify only one row and it points to worker2
    const getRes = await supertest(app)
      .get(`/api/payroll/import/mappings/${projectId}?provider=paychex`)
      .set('Cookie', cookie);
    expect(getRes.body.mappings.length).toBe(1);
    expect(getRes.body.mappings[0].workerId).toBe(worker2Id);
  });

  it('returns 400 when required fields are missing', async () => {
    const cookie = await registerAndLogin('mappings-post-400');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .post('/api/payroll/import/mappings')
      .set('Cookie', cookie)
      .send({ projectId, provider: 'paychex' }); // missing mappings array

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 403 without project access (NFR-03)', async () => {
    const cookieA = await registerAndLogin('mappings-post-owner-nfr');
    const projectId = await createProject(cookieA);
    const { workerId } = await createWorker(cookieA, projectId, 'NFR Worker');

    const cookieB = await registerAndLogin('mappings-post-intruder-nfr');
    const res = await supertest(app)
      .post('/api/payroll/import/mappings')
      .set('Cookie', cookieB)
      .send({
        projectId,
        provider: 'paychex',
        mappings: [{ providerWorkerId: 'PX-NFR', workerId }],
      });

    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app)
      .post('/api/payroll/import/mappings')
      .send({ projectId: 'any', provider: 'paychex', mappings: [] });

    expect(res.status).toBe(401);
  });
});
