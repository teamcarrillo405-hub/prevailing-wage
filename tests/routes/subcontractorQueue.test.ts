import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

async function registerAndLogin(suffix: string): Promise<string> {
  const email = `sub-queue-${suffix}-${Date.now()}@test.com`;
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
      name: 'Sub Queue Project',
      state: 'TX',
      county: 'Travis',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  expect(res.status).toBe(201);
  return res.body.data.project.id as string;
}

async function createSub(cookie: string, projectId: string, name = 'Queue Sub'): Promise<string> {
  const res = await supertest(app)
    .post(`/api/projects/${projectId}/subcontractors`)
    .set('Cookie', cookie)
    .send({ name, contactEmail: 'queue-sub@example.com' });
  expect(res.status).toBe(201);
  return res.body.data.subcontractor.id as string;
}

async function createPayrollWeek(cookie: string, projectId: string, weekEndingDate = '2025-01-12'): Promise<string> {
  const res = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate, payrollNumber: 1 });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

describe('subcontractor CPR chase board', () => {
  it('shows virtual missing CPR rows for each subcontractor payroll week', async () => {
    const cookie = await registerAndLogin('virtual-row');
    const projectId = await createProject(cookie);
    const subId = await createSub(cookie, projectId);
    const payrollWeekId = await createPayrollWeek(cookie, projectId, '2025-01-12');

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/subcontractor-cpr-queue`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subcontractorId: subId,
          payrollWeekId,
          weekId: null,
          weekEndingDate: '2025-01-12',
          canRequestUpload: true,
          evidenceState: 'not-requested',
          nextAction: 'Send CPR upload request.',
        }),
      ]),
    );
    expect(res.body.data.summary.readyToRequest).toBeGreaterThanOrEqual(1);
  });

  it('creates an upload request from the chase board', async () => {
    const cookie = await registerAndLogin('request');
    const projectId = await createProject(cookie);
    const subId = await createSub(cookie, projectId, 'Request Sub');
    await createPayrollWeek(cookie, projectId, '2025-01-19');

    const requestRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractor-cpr-queue/request`)
      .set('Cookie', cookie)
      .send({ subcontractorId: subId, weekEndingDate: '2025-01-19' });

    expect(requestRes.status).toBe(201);
    expect(requestRes.body.data.uploadUrl).toContain('/sub-upload/');
    expect(requestRes.body.data.emailed).toBe(true);

    const queueRes = await supertest(app)
      .get(`/api/projects/${projectId}/subcontractor-cpr-queue`)
      .set('Cookie', cookie);
    const item = queueRes.body.data.queue.find((row: any) => row.subcontractorId === subId);
    expect(item.weekId).toBeTruthy();
    expect(item.uploadTokenExpiresAt).toBeTruthy();
    expect(item.evidenceState).toBe('request-sent');
    expect(item.nextAction).toBe('Follow up on the active upload request.');
  });
});
