import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../../src/server/index.js';
import { getDb } from '../../src/server/db/index.js';
import { copilotInteractions, payrollEntries } from '../../src/server/db/schema.js';
import { upsertClassifications, upsertWageDetermination } from '../../src/server/services/wageCache.js';

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
process.env.NODE_ENV = 'test';

async function registerAndLogin(suffix: string) {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email: `copilot-${suffix}-${Date.now()}@test.com`, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function getCurrentUserId(cookie: string) {
  const res = await supertest(app).get('/api/auth/me').set('Cookie', cookie);
  return res.body.data.user.id as string;
}

async function createProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Copilot Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2026-01-01',
      fundingType: 'federal',
    });
  return res.body.data.project.id as string;
}

async function createWorkerWithClassification(cookie: string, projectId: string, tradeCode = 'CARP') {
  const workerRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Copilot Worker' });
  const workerId = workerRes.body.data.worker.id as string;

  const classRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode,
      tradeDescription: tradeCode === 'CARP' ? 'Carpenter' : 'Electrician',
      laborType: 'journeyworker',
    });
  const classificationId = classRes.body.data.classification.id as string;
  return { workerId, classificationId };
}

// Base Saturday: 2026-01-31 (Saturday). Each payrollNumber N maps to the Nth Saturday from that base.
function payrollNumberToSaturday(n: number): string {
  const base = new Date('2026-01-31T12:00:00');
  base.setDate(base.getDate() + (n - 1) * 7);
  return base.toISOString().slice(0, 10);
}

async function createWeek(cookie: string, projectId: string, payrollNumber: number) {
  const res = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: payrollNumberToSaturday(payrollNumber), payrollNumber });
  return res.body.id as string;
}

async function seedPinnedWd(cookie: string, projectId: string, tradeCode = 'CARP') {
  const now = new Date();
  const wdId = await upsertWageDetermination({
    id: randomUUID(),
    source: 'federal-dol',
    wdNumber: `CA2026COP${Date.now()}`,
    revisionNumber: 1,
    state: 'CA',
    county: 'Los Angeles',
    constructionType: 'Building',
    publishDate: '2026-01-01',
    rawDocument: null,
    cachedAt: now.toISOString(),
    cacheExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  await upsertClassifications(wdId, [{
    code: tradeCode,
    description: tradeCode === 'CARP' ? 'Carpenter' : 'Electrician',
    baseRate: 45,
    fringeRate: 20,
    totalRate: 65,
  }]);
  return supertest(app)
    .post(`/api/projects/${projectId}/wage-determinations`)
    .set('Cookie', cookie)
    .send({ wageDeterminationId: wdId, constructionType: 'Building' });
}

describe('Copilot approved actions', () => {
  it('recomputes payroll week gross and net pay from saved hours and rates', async () => {
    const cookie = await registerAndLogin('recompute');
    const projectId = await createProject(cookie);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createWeek(cookie, projectId, 4);

    await supertest(app)
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
        baseRateSnapshot: 45,
        fringeRateSnapshot: 20,
        grossWages: 1,
        netPay: 1,
      });

    const res = await supertest(app)
      .post('/api/copilot/actions/apply')
      .set('Cookie', cookie)
      .send({ actionId: 'review-week-violations', confirm: true, projectId, payrollWeekId: weekId });

    expect(res.status).toBe(200);
    expect(res.body.data.applied).toBe(true);

    const [entry] = await getDb()
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.payrollWeekId, weekId));
    expect(entry.grossWages).toBe(2600);
    expect(entry.netPay).toBe(2600);
  });

  it('fills zero rate snapshots from the pinned WD and recomputes pay', async () => {
    const cookie = await registerAndLogin('zero-rates');
    const projectId = await createProject(cookie);
    await seedPinnedWd(cookie, projectId);
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId, 'CARP');
    const weekId = await createWeek(cookie, projectId, 5);
    const now = new Date().toISOString();

    await getDb().insert(payrollEntries).values({
      id: randomUUID(),
      payrollWeekId: weekId,
      workerId,
      classificationId,
      monSt: 8,
      tueSt: 8,
      wedSt: 8,
      thuSt: 8,
      friSt: 8,
      monOt: 0,
      tueOt: 0,
      wedOt: 0,
      thuOt: 0,
      friOt: 0,
      satSt: 0,
      sunSt: 0,
      satOt: 0,
      sunOt: 0,
      monDt: 0,
      tueDt: 0,
      wedDt: 0,
      thuDt: 0,
      friDt: 0,
      satDt: 0,
      sunDt: 0,
      baseRateSnapshot: 0,
      fringeRateSnapshot: 0,
      grossWages: 0,
      deductions: 100,
      netPay: 0,
      createdAt: now,
      updatedAt: now,
    });

    const res = await supertest(app)
      .post('/api/copilot/actions/apply')
      .set('Cookie', cookie)
      .send({ actionId: 'prepare-import-review', confirm: true, projectId, payrollWeekId: weekId });

    expect(res.status).toBe(200);
    const [entry] = await getDb()
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.payrollWeekId, weekId));
    expect(entry.baseRateSnapshot).toBe(45);
    expect(entry.fringeRateSnapshot).toBe(20);
    expect(entry.grossWages).toBe(2600);
    expect(entry.netPay).toBe(2500);
  });

  it('refuses to mutate a submitted payroll week', async () => {
    const cookie = await registerAndLogin('submitted');
    const projectId = await createProject(cookie);
    const weekId = await createWeek(cookie, projectId, 6);
    await supertest(app)
      .patch(`/api/payroll/weeks/${weekId}/submit`)
      .set('Cookie', cookie)
      .send({ submittedAt: '2026-02-06', submittedTo: 'DOL' });

    const res = await supertest(app)
      .post('/api/copilot/actions/apply')
      .set('Cookie', cookie)
      .send({ actionId: 'review-week-violations', confirm: true, projectId, payrollWeekId: weekId });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('submitted');
  });

  it('refuses project/payroll-week mismatches without mutating the target week', async () => {
    const ownerCookie = await registerAndLogin('owner');
    const otherCookie = await registerAndLogin('other');
    const ownerProjectId = await createProject(ownerCookie);
    const otherProjectId = await createProject(otherCookie);
    const { workerId, classificationId } = await createWorkerWithClassification(ownerCookie, ownerProjectId);
    const weekId = await createWeek(ownerCookie, ownerProjectId, 7);

    await supertest(app)
      .put(`/api/payroll/entries/${weekId}`)
      .set('Cookie', ownerCookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8,
        baseRateSnapshot: 45,
        fringeRateSnapshot: 20,
        grossWages: 1,
        netPay: 1,
      });

    const res = await supertest(app)
      .post('/api/copilot/actions/apply')
      .set('Cookie', otherCookie)
      .send({
        actionId: 'review-week-violations',
        confirm: true,
        projectId: otherProjectId,
        payrollWeekId: weekId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Payroll week does not belong');

    const [entry] = await getDb()
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.payrollWeekId, weekId));
    expect(entry.grossWages).toBe(1);
    expect(entry.netPay).toBe(1);
  });

  it('rejects unsupported apply action IDs at request validation', async () => {
    const cookie = await registerAndLogin('unsupported');
    const res = await supertest(app)
      .post('/api/copilot/actions/apply')
      .set('Cookie', cookie)
      .send({ actionId: 'classification-assist', confirm: true });

    expect(res.status).toBe(400);
  });

  it('returns audit ledger rows even when an old suggestions payload is malformed', async () => {
    const cookie = await registerAndLogin('bad-audit-json');
    const userId = await getCurrentUserId(cookie);

    await getDb().insert(copilotInteractions).values({
      id: randomUUID(),
      userId,
      projectId: null,
      payrollWeekId: null,
      pagePath: '/dashboard',
      userMessage: 'legacy malformed audit row',
      assistantMessage: 'legacy response',
      contextJson: '{}',
      suggestionsJson: '{bad-json',
      modelUsed: 'test',
      latencyMs: 0,
      createdAt: new Date().toISOString(),
    });

    const res = await supertest(app)
      .get('/api/copilot/interactions')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userMessage: 'legacy malformed audit row',
          suggestions: null,
        }),
      ]),
    );
  });
});
