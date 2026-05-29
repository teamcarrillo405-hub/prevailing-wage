import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/server/index.js';
import { upsertClassifications, upsertWageDetermination } from '../../src/server/services/wageCache.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

async function registerAndLogin(suffix: string): Promise<string> {
  const email = `contractor-scenario-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({
      email,
      password: 'password123',
      hccMembershipNumber: `HCC-${suffix}`,
      companyName: 'Scenario Concrete LLC',
    });
  expect(res.status).toBe(201);
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function registerAndLoginWithUser(suffix: string): Promise<{ cookie: string; userId: string }> {
  const email = `contractor-scenario-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({
      email,
      password: 'password123',
      hccMembershipNumber: `HCC-${suffix}`,
      companyName: 'Scenario Agency LLC',
    });
  expect(res.status).toBe(201);
  const cookies = res.headers['set-cookie'] as string[] | string;
  return {
    cookie: Array.isArray(cookies) ? cookies.join('; ') : cookies,
    userId: res.body.data.user.id as string,
  };
}

async function createProject(cookie: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Scenario Library Renovation',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2026-04-15',
      fundingType: 'federal',
    });
  expect(res.status).toBe(201);
  return res.body.data.project.id as string;
}

async function seedFederalWd(): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();
  await upsertWageDetermination({
    id,
    source: 'federal-dol',
    wdNumber: `CA2026SCENARIO${Date.now()}`,
    revisionNumber: 0,
    state: 'CA',
    county: 'Los Angeles',
    constructionType: 'Building',
    publishDate: '2026-01-02',
    rawDocument: 'Scenario cached federal WD used instead of live SAM.gov network calls.',
    cachedAt: now.toISOString(),
    cacheExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  await upsertClassifications(id, [
    { code: 'CARP', description: 'Carpenter', baseRate: 45, fringeRate: 20, totalRate: 65 },
  ]);
  return id;
}

async function createWorker(cookie: string, projectId: string): Promise<{ workerId: string; classificationId: string }> {
  const workerRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Jose Scenario' });
  expect(workerRes.status).toBe(201);
  const workerId = workerRes.body.data.worker.id as string;

  const classRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
    });
  expect(classRes.status).toBe(201);
  return { workerId, classificationId: classRes.body.data.classification.id as string };
}

async function createSubcontractor(cookie: string, projectId: string): Promise<string> {
  const res = await supertest(app)
    .post(`/api/projects/${projectId}/subcontractors`)
    .set('Cookie', cookie)
    .send({
      name: 'Brightline Electrical LLC',
      contactName: 'Maya Singh',
      contactEmail: 'maya.singh@example.com',
      licenseNumber: 'CA-998877',
      dbeClassification: 'mbe',
    });
  expect(res.status).toBe(201);
  return res.body.data.subcontractor.id as string;
}

describe('internal contractor scenario', () => {
  it('runs project setup, federal WD pin, QuickBooks import, CPR follow-up, submit-ready, submission, and evidence packet', async () => {
    const cookie = await registerAndLogin('launch-demo');
    const projectId = await createProject(cookie);
    const wdId = await seedFederalWd();

    const pinRes = await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    expect(pinRes.status).toBe(201);

    const { workerId, classificationId } = await createWorker(cookie, projectId);
    const subId = await createSubcontractor(cookie, projectId);

    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-04-25', payrollNumber: 1 });
    expect(weekRes.status).toBe(201);
    const weekId = weekRes.body.id as string;

    const cprRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractor-cpr-queue/request`)
      .set('Cookie', cookie)
      .send({ subcontractorId: subId, weekEndingDate: '2026-04-25' });
    expect(cprRes.status).toBe(201);
    expect(cprRes.body.data.uploadUrl).toContain('/sub-upload/');

    const importRes = await supertest(app)
      .post('/api/payroll/import/commit')
      .set('Cookie', cookie)
      .send({
        weekId,
        provider: 'quickbooks',
        sourceFilename: 'scenario-qbo-week1.csv',
        unmatchedCount: 0,
        matched: [
          {
            csvName: 'Jose Scenario',
            workerId,
            workerName: 'Jose Scenario',
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
    expect(importRes.status).toBe(200);
    expect(importRes.body.committed).toBe(1);

    const reconciliationRes = await supertest(app)
      .get(`/api/payroll/import/reconciliation/${weekId}`)
      .set('Cookie', cookie);
    expect(reconciliationRes.status).toBe(200);
    expect(reconciliationRes.body.data.status).toBe('reconciled');
    expect(reconciliationRes.body.data.latestImport.provider).toBe('quickbooks');

    const submitReadyRes = await supertest(app)
      .get(`/api/compliance/${weekId}/submit-ready`)
      .set('Cookie', cookie);
    expect(submitReadyRes.status).toBe(200);
    expect(submitReadyRes.body.blockers).toBe(0);
    expect(submitReadyRes.body.summary.entryCount).toBe(1);
    expect(submitReadyRes.body.summary.exportFormat).toContain('CA');
    expect(submitReadyRes.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wd-lock', severity: 'pass' }),
        expect.objectContaining({ id: 'import-review', severity: 'pass' }),
        expect.objectContaining({
          id: 'subcontractor-cpr',
          severity: 'warning',
          fix: expect.objectContaining({
            label: 'Open subcontractor CPR queue',
            routeScope: 'project',
            hash: 'subcontractor-cpr',
          }),
        }),
      ]),
    );

    const submitRes = await supertest(app)
      .patch(`/api/payroll/weeks/${weekId}/submit`)
      .set('Cookie', cookie)
      .send({ submittedAt: '2026-04-27', submittedTo: 'Contracting Officer - Scenario' });
    expect(submitRes.status).toBe(200);

    const evidenceRes = await supertest(app)
      .get(`/api/audit/${projectId}/evidence-packet`)
      .set('Cookie', cookie);
    expect(evidenceRes.status).toBe(200);
    expect(evidenceRes.body.payrollWeeks).toEqual([
      expect.objectContaining({
        id: weekId,
        submittedTo: 'Contracting Officer - Scenario',
      }),
    ]);
    expect(evidenceRes.body.submitReadyWeeks).toEqual([
      expect.objectContaining({
        weekId,
        status: 'submitted',
        score: 100,
      }),
    ]);
    expect(evidenceRes.body.payrollImports).toEqual([
      expect.objectContaining({
        payrollWeekId: weekId,
        provider: 'quickbooks',
        committedCount: 1,
        unmatchedCount: 0,
      }),
    ]);
    expect(evidenceRes.body.subcontractorCprWeeks).toEqual([
      expect.objectContaining({
        subcontractorName: 'Brightline Electrical LLC',
        weekEndingDate: '2026-04-25',
      }),
    ]);

    const pilotSummaryRes = await supertest(app)
      .get(`/api/audit/${projectId}/pilot-summary`)
      .set('Cookie', cookie);
    expect(pilotSummaryRes.status).toBe(200);
    expect(pilotSummaryRes.body.data.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'two-payroll-weeks', status: 'blocker' }),
        expect.objectContaining({ id: 'source-reconciliation', status: 'pass' }),
      ]),
    );
    expect(pilotSummaryRes.body.data.sourceReconciliation.completeSourceRows).toBe(1);

    const reviewerWorkbenchRes = await supertest(app)
      .get(`/api/audit/${projectId}/reviewer-workbench`)
      .set('Cookie', cookie);
    expect(reviewerWorkbenchRes.status).toBe(200);
    expect(reviewerWorkbenchRes.body.data.permissions).toEqual(
      expect.objectContaining({ canReview: true, canEditPayroll: true }),
    );
    expect(reviewerWorkbenchRes.body.data.reviewActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'subcontractor-cpr-open' }),
      ]),
    );

    const auditor = await registerAndLoginWithUser('agency-auditor');
    const { getDb } = await import('../../src/server/db/index.js');
    const { projectMembers } = await import('../../src/server/db/schema.js');
    await getDb().insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId,
      userId: auditor.userId,
      role: 'auditor',
      joinedAt: new Date().toISOString(),
    });

    const auditorWorkbenchRes = await supertest(app)
      .get(`/api/audit/${projectId}/reviewer-workbench`)
      .set('Cookie', auditor.cookie);
    expect(auditorWorkbenchRes.status).toBe(200);
    expect(auditorWorkbenchRes.body.data.role).toBe('auditor');
    expect(auditorWorkbenchRes.body.data.permissions).toEqual(
      expect.objectContaining({
        canReview: true,
        canEditPayroll: false,
        canApproveEvidence: false,
      }),
    );
  });
});
