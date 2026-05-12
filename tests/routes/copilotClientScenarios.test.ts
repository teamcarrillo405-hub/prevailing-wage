import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/server/index.js';
import { upsertClassifications, upsertWageDetermination } from '../../src/server/services/wageCache.js';

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
process.env.NODE_ENV = 'test';
delete process.env.ANTHROPIC_API_KEY;

type ScenarioKind = 'blank' | 'project' | 'week';

interface ClientScenario {
  id: string;
  kind: ScenarioKind;
  message: string;
  expectedText: RegExp;
  expectedSuggestion?: string;
}

const CLIENT_SCENARIOS: ClientScenario[] = [
  { id: 'owner-first-login', kind: 'blank', message: 'I just logged in. What should I do first?', expectedText: /set up|project|payroll|wage/i, expectedSuggestion: 'complete-onboarding' },
  { id: 'hcc-onboarding-help', kind: 'blank', message: 'How do I set this up for my HCC construction company?', expectedText: /onboarding|project|payroll/i, expectedSuggestion: 'complete-onboarding' },
  { id: 'no-project-dashboard', kind: 'blank', message: 'Why is my dashboard empty?', expectedText: /project|payroll|wage/i, expectedSuggestion: 'complete-onboarding' },
  { id: 'choose-first-state', kind: 'blank', message: 'We mostly work in California. What defaults matter?', expectedText: /project|payroll|wage|classification/i },
  { id: 'import-before-project', kind: 'blank', message: 'Can I import QuickBooks before I create a project?', expectedText: /project|import|payroll/i, expectedSuggestion: 'prepare-import-review' },
  { id: 'classification-before-project', kind: 'blank', message: 'Can you help with trade classification for a carpenter?', expectedText: /classification|trade|project/i, expectedSuggestion: 'classification-assist' },
  { id: 'owner-summary', kind: 'project', message: 'Give me the owner summary for this job.', expectedText: /project|payroll|wage/i },
  { id: 'missing-wd', kind: 'project', message: 'Is the federal wage determination ready?', expectedText: /wage determination|WD|payroll/i, expectedSuggestion: 'prepare-missing-wd' },
  { id: 'project-next-step', kind: 'project', message: 'What is the next thing blocking this project?', expectedText: /wage|classification|payroll|filing/i, expectedSuggestion: 'prepare-missing-wd' },
  { id: 'worker-setup', kind: 'project', message: 'Do I have enough worker setup to run payroll?', expectedText: /worker|classification|payroll/i },
  { id: 'trade-setup', kind: 'project', message: 'How do I choose the right trade classification?', expectedText: /classification|trade|WD/i, expectedSuggestion: 'classification-assist' },
  { id: 'subcontractor-setup', kind: 'project', message: 'How should I track subcontractor certified payroll?', expectedText: /project|payroll|wage|classification/i },
  { id: 'audit-defense-before-payroll', kind: 'project', message: 'What evidence should I collect before payroll starts?', expectedText: /project|payroll|wage|classification/i },
  { id: 'project-location', kind: 'project', message: 'Does the project location matter for wage rates?', expectedText: /project|wage|classification/i },
  { id: 'federal-contract', kind: 'project', message: 'This is federal Davis Bacon. What should I verify?', expectedText: /wage|WD|payroll|filing/i, expectedSuggestion: 'prepare-missing-wd' },
  { id: 'ready-to-add-week', kind: 'project', message: 'Can I create the first payroll week now?', expectedText: /project|payroll|wage/i },
  { id: 'quickbooks-import-plan', kind: 'week', message: 'Review my QuickBooks import before I file.', expectedText: /import|classification|rate|payroll/i, expectedSuggestion: 'prepare-import-review' },
  { id: 'payroll-readiness', kind: 'week', message: 'Am I ready to submit this payroll week?', expectedText: /payroll|wage|filing|classification/i },
  { id: 'wh347-export', kind: 'week', message: 'Can I download the WH-347 now?', expectedText: /payroll|wage|filing|classification/i },
  { id: 'state-export-ca', kind: 'week', message: 'What California form should I prepare?', expectedText: /payroll|wage|filing|classification/i },
  { id: 'underpayment-check', kind: 'week', message: 'Check if anyone is underpaid.', expectedText: /payroll|wage|classification|filing/i },
  { id: 'overtime-check', kind: 'week', message: 'Do overtime hours look safe?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'deductions-check', kind: 'week', message: 'Are deductions okay before certified payroll?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'fringe-check', kind: 'week', message: 'Do fringe rates look correct?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'signature-check', kind: 'week', message: 'Do I need a signature before filing?', expectedText: /payroll|wage|filing|classification/i },
  { id: 'sub-cpr-missing', kind: 'week', message: 'A subcontractor has not sent CPR. What do I do?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'evidence-packet', kind: 'week', message: 'What goes in the audit evidence packet?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'gps-proof', kind: 'week', message: 'Should field GPS punches block submission?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'photo-proof', kind: 'week', message: 'Do site photos matter for this payroll?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'worker-mapping', kind: 'week', message: 'A QuickBooks employee matched to the wrong worker.', expectedText: /import|classification|rate|payroll/i, expectedSuggestion: 'prepare-import-review' },
  { id: 'unmatched-worker', kind: 'week', message: 'What should I do with unmatched imported workers?', expectedText: /import|classification|rate|payroll/i, expectedSuggestion: 'prepare-import-review' },
  { id: 'zero-rate', kind: 'week', message: 'The import has zero wage rates.', expectedText: /import|classification|rate|payroll/i, expectedSuggestion: 'prepare-import-review' },
  { id: 'wrong-classification', kind: 'week', message: 'The worker may be the wrong classification.', expectedText: /classification|trade|WD/i, expectedSuggestion: 'classification-assist' },
  { id: 'laborer-question', kind: 'week', message: 'Which trade classification applies: laborer or carpenter?', expectedText: /classification|trade|WD/i, expectedSuggestion: 'classification-assist' },
  { id: 'operator-question', kind: 'week', message: 'Which trade applies for equipment operation?', expectedText: /classification|trade|WD/i, expectedSuggestion: 'classification-assist' },
  { id: 'submitted-week', kind: 'week', message: 'What changes after a week is submitted?', expectedText: /payroll|wage|filing|classification/i },
  { id: 'amendment-question', kind: 'week', message: 'How should I amend a certified payroll week?', expectedText: /payroll|wage|filing|classification/i },
  { id: 'owner-risk', kind: 'week', message: 'What is my biggest risk before an audit?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'payroll-clerk-steps', kind: 'week', message: 'Give payroll clerk next steps.', expectedText: /payroll|wage|classification|filing/i },
  { id: 'field-supervisor-steps', kind: 'week', message: 'What should the field supervisor capture?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'auditor-view', kind: 'week', message: 'What will an auditor want to see?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'prime-contractor', kind: 'week', message: 'As the prime, what should I chase today?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'small-contractor', kind: 'week', message: 'Make this simple for a small contractor.', expectedText: /payroll|wage|classification|filing/i },
  { id: 'multi-state-future', kind: 'week', message: 'If I add another state later, what changes?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'rate-source', kind: 'week', message: 'Where did these rates come from?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'sam-gov-context', kind: 'week', message: 'Is this using federal SAM.gov wage data?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'no-legal-advice', kind: 'week', message: 'Tell me legally that I am compliant.', expectedText: /payroll|wage|classification|filing/i },
  { id: 'sensitive-ssn', kind: 'week', message: 'Check the worker SSN field and payroll.', expectedText: /payroll|wage|classification|filing/i },
  { id: 'final-demo-check', kind: 'week', message: 'Can I demo this account to an investor?', expectedText: /payroll|wage|classification|filing/i },
  { id: 'support-confusion', kind: 'week', message: 'I am stuck and do not know the next click.', expectedText: /payroll|wage|classification|filing/i },
];

interface Fixture {
  blankCookie: string;
  projectCookie: string;
  weekCookie: string;
  projectId: string;
  weekProjectId: string;
  weekId: string;
}

let fixture: Fixture;

async function registerAndLogin(suffix: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({
      email: `copilot-50-${suffix}-${Date.now()}@test.com`,
      password: 'password123',
      hccMembershipNumber: `HCC-50-${suffix}`,
      companyName: `Scenario ${suffix} Builders`,
    });
  expect(res.status).toBe(201);
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string, name: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name,
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2026-04-15',
      fundingType: 'federal',
    });
  expect(res.status).toBe(201);
  return res.body.data.project.id as string;
}

function seedWd(): string {
  const now = new Date();
  const wdId = randomUUID();
  upsertWageDetermination({
    id: wdId,
    source: 'federal-dol',
    wdNumber: `CA202650SCENARIO${Date.now()}`,
    revisionNumber: 0,
    state: 'CA',
    county: 'Los Angeles',
    constructionType: 'Building',
    publishDate: '2026-01-02',
    rawDocument: '50-scenario cached federal wage determination.',
    cachedAt: now.toISOString(),
    cacheExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  upsertClassifications(wdId, [
    { code: 'CARP', description: 'Carpenter', baseRate: 45, fringeRate: 20, totalRate: 65 },
    { code: 'LAB', description: 'Laborer - Group 1', baseRate: 38, fringeRate: 18, totalRate: 56 },
  ]);
  return wdId;
}

async function pinWd(cookie: string, projectId: string): Promise<void> {
  const res = await supertest(app)
    .post(`/api/projects/${projectId}/wage-determinations`)
    .set('Cookie', cookie)
    .send({ wageDeterminationId: seedWd(), constructionType: 'Building' });
  expect(res.status).toBe(201);
}

async function createWorker(cookie: string, projectId: string): Promise<{ workerId: string; classificationId: string }> {
  const workerRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Scenario Worker' });
  expect(workerRes.status).toBe(201);

  const classRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerRes.body.data.worker.id}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
    });
  expect(classRes.status).toBe(201);
  return {
    workerId: workerRes.body.data.worker.id as string,
    classificationId: classRes.body.data.classification.id as string,
  };
}

async function seedWeekFixture(cookie: string): Promise<{ projectId: string; weekId: string }> {
  const projectId = await createProject(cookie, '50 Scenario Library Renovation');
  await pinWd(cookie, projectId);
  const { workerId, classificationId } = await createWorker(cookie, projectId);

  const subRes = await supertest(app)
    .post(`/api/projects/${projectId}/subcontractors`)
    .set('Cookie', cookie)
    .send({ name: 'Brightline Electrical LLC', contactEmail: 'maya.singh@example.com' });
  expect(subRes.status).toBe(201);

  const weekRes = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: '2026-04-25', payrollNumber: 1 });
  expect(weekRes.status).toBe(201);
  const weekId = weekRes.body.id as string;

  const cprRes = await supertest(app)
    .post(`/api/projects/${projectId}/subcontractor-cpr-queue/request`)
    .set('Cookie', cookie)
    .send({ subcontractorId: subRes.body.data.subcontractor.id, weekEndingDate: '2026-04-25' });
  expect(cprRes.status).toBe(201);

  const importRes = await supertest(app)
    .post('/api/payroll/import/commit')
    .set('Cookie', cookie)
    .send({
      weekId,
      provider: 'quickbooks',
      sourceFilename: 'copilot-50-qbo.csv',
      unmatchedCount: 0,
      matched: [
        {
          csvName: 'Scenario Worker',
          workerId,
          workerName: 'Scenario Worker',
          classificationId,
          classificationName: 'Carpenter',
          baseRateSnapshot: 45,
          fringeRateSnapshot: 20,
          monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
          monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
        },
      ],
    });
  expect(importRes.status).toBe(200);

  return { projectId, weekId };
}

beforeAll(async () => {
  const blankCookie = await registerAndLogin('blank');
  const projectCookie = await registerAndLogin('project');
  const weekCookie = await registerAndLogin('week');
  const projectId = await createProject(projectCookie, '50 Scenario Missing WD Project');
  const weekFixture = await seedWeekFixture(weekCookie);
  fixture = {
    blankCookie,
    projectCookie,
    weekCookie,
    projectId,
    weekProjectId: weekFixture.projectId,
    weekId: weekFixture.weekId,
  };
});

function contextFor(kind: ScenarioKind) {
  if (kind === 'blank') return { cookie: fixture.blankCookie, projectId: undefined, payrollWeekId: undefined, pagePath: '/dashboard' };
  if (kind === 'project') return { cookie: fixture.projectCookie, projectId: fixture.projectId, payrollWeekId: undefined, pagePath: `/projects/${fixture.projectId}` };
  return {
    cookie: fixture.weekCookie,
    projectId: fixture.weekProjectId,
    payrollWeekId: fixture.weekId,
    pagePath: `/projects/${fixture.weekProjectId}/payroll/${fixture.weekId}`,
  };
}

describe('Copilot 50 client scenario internal suite', () => {
  expect(CLIENT_SCENARIOS).toHaveLength(50);

  it.each(CLIENT_SCENARIOS)('$id', async (scenario) => {
    const context = contextFor(scenario.kind);
    const res = await supertest(app)
      .post('/api/copilot/chat')
      .set('Cookie', context.cookie)
      .send({
        message: scenario.message,
        pagePath: context.pagePath,
        projectId: context.projectId,
        payrollWeekId: context.payrollWeekId,
        visibleFields: [
          { label: 'Worker SSN', name: 'ssn', value: '123-45-6789' },
          { label: 'Visible note', name: 'note', value: `Scenario ${scenario.id}` },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.answer).toMatch(scenario.expectedText);
    expect(res.body.data.modelUsed).toBe('prevwage-copilot-rules-v1');
    expect(res.body.data.interactionId).toEqual(expect.any(String));
    expect(Array.isArray(res.body.data.nextSteps)).toBe(true);
    expect(res.body.data.nextSteps.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.suggestions)).toBe(true);
    expect(Array.isArray(res.body.data.citations)).toBe(true);
    expect(res.body.data.readiness).toEqual(expect.objectContaining({ readinessStatus: expect.any(String) }));
    expect(JSON.stringify(res.body)).not.toContain('123-45-6789');

    if (scenario.expectedSuggestion) {
      expect(res.body.data.suggestions).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: scenario.expectedSuggestion })]),
      );
    }

    const stateRes = await supertest(app)
      .post('/api/copilot/state')
      .set('Cookie', context.cookie)
      .send({
        message: scenario.message,
        pagePath: context.pagePath,
        projectId: context.projectId,
        payrollWeekId: context.payrollWeekId,
      });
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.data.items.length).toBeGreaterThan(0);
  });

  it('records at least 50 auditable Copilot interaction rows for the scenario run', async () => {
    const cookies = [fixture.blankCookie, fixture.projectCookie, fixture.weekCookie];
    const responses = await Promise.all(
      cookies.map((cookie) =>
        supertest(app).get('/api/copilot/interactions?limit=100').set('Cookie', cookie),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    }

    const rows = responses.flatMap((res) => res.body.data);
    expect(rows.length).toBeGreaterThanOrEqual(50);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        assistantMessage: expect.any(String),
        modelUsed: expect.stringContaining('prevwage-copilot'),
      }),
    );
  });
});
