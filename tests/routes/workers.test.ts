import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string) {
  const email = `workers-route-${suffix}-${Date.now()}@test.com`;
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
      name: 'Workers Test Project',
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

async function createApprenticeWithProgramName(
  cookie: string,
  projectId: string,
  programName: string,
) {
  const wRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Jane Apprentice' });
  const workerId = wRes.body.data?.worker?.id as string;

  const cRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'ELEC',
      tradeDescription: 'Electrician',
      laborType: 'apprentice',
      apprenticePercent: 80,
      programName,
    });

  return { workerId, res: cRes };
}

async function createWaProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'WA Workers Test Project',
      state: 'WA',
      county: 'King',
      contractType: 'state-prevailing',
      awardDate: '2025-01-01',
      fundingType: 'state',
    });
  return res.body.data?.project?.id as string;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('waManualRate on classifications - WAL-01', () => {
  it('accepts waManualRate on journeyworker classification for WA project', async () => {
    const cookie = await registerAndLogin('wa-manual-rate-jw');
    const projectId = await createWaProject(cookie);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'WA Worker One' });
    const workerId = wRes.body.data?.worker?.id as string;

    const cRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
      .set('Cookie', cookie)
      .send({
        tradeCode: 'CARP',
        tradeDescription: 'Carpenter',
        laborType: 'journeyworker',
        waManualRate: 52.75,
      });

    expect(cRes.status).toBe(201);
    expect(cRes.body.data?.classification?.waManualRate).toBe(52.75);
  });

  it('stores waManualRate in the DB and returns it on GET workers', async () => {
    const cookie = await registerAndLogin('wa-manual-rate-get');
    const projectId = await createWaProject(cookie);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'WA Worker Two' });
    const workerId = wRes.body.data?.worker?.id as string;

    await supertest(app)
      .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
      .set('Cookie', cookie)
      .send({
        tradeCode: 'ELEC',
        tradeDescription: 'Electrician',
        laborType: 'journeyworker',
        waManualRate: 68.50,
      });

    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    const workers = getRes.body.data?.workers ?? [];
    const cls = workers[0]?.classifications?.[0];
    expect(cls?.waManualRate).toBe(68.50);
  });

  it('waManualRate defaults to null when not provided', async () => {
    const cookie = await registerAndLogin('wa-manual-rate-null');
    const projectId = await createWaProject(cookie);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'WA Worker Three' });
    const workerId = wRes.body.data?.worker?.id as string;

    const cRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
      .set('Cookie', cookie)
      .send({
        tradeCode: 'LABO',
        tradeDescription: 'Laborer',
        laborType: 'journeyworker',
      });

    expect(cRes.status).toBe(201);
    expect(cRes.body.data?.classification?.waManualRate).toBeNull();
  });
});

describe('POST /classifications programName', () => {
  it('accepts programName on apprentice classification and returns it in response', async () => {
    const cookie = await registerAndLogin('post-classification-programname');
    const projectId = await createProject(cookie);

    const { res } = await createApprenticeWithProgramName(
      cookie,
      projectId,
      'IBEW Apprenticeship Program',
    );

    expect(res.status).toBe(201);
    expect(res.body.data.classification.programName).toBe('IBEW Apprenticeship Program');
  });
});

describe('GET /workers programName field', () => {
  it('returns programName field on classifications (null when not set)', async () => {
    const cookie = await registerAndLogin('get-workers-programname');
    const projectId = await createProject(cookie);

    await createWorkerWithClassification(cookie, projectId);

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const workers = res.body.data?.workers ?? res.body.workers ?? res.body;
    expect(Array.isArray(workers)).toBe(true);
    expect(workers.length).toBeGreaterThan(0);
    expect(workers[0].classifications[0]).toHaveProperty('programName');
  });
});
