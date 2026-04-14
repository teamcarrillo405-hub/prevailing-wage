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

async function createNjProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'NJ Workers Test Project',
      state: 'NJ',
      county: 'Essex',
      contractType: 'state-prevailing',
      awardDate: '2025-01-01',
      fundingType: 'state',
    });
  return res.body.data?.project?.id as string;
}

async function createMaProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'MA Workers Test Project',
      state: 'MA',
      county: 'Suffolk',
      contractType: 'state-prevailing',
      awardDate: '2025-01-01',
      fundingType: 'state',
    });
  return res.body.data?.project?.id as string;
}

describe('MA worker demographics (MA-02)', () => {
  it('should accept isWoman, isMinority, oshaTraining on worker create', async () => {
    const cookie = await registerAndLogin('ma-create-all');
    const projectId = await createMaProject(cookie);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'MA Worker', isWoman: true, isMinority: true, oshaTraining: true });

    expect(wRes.status).toBe(201);

    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    const workers = getRes.body.data?.workers ?? [];
    const worker = workers.find((w: any) => w.name === 'MA Worker');
    expect(worker).toBeDefined();
    expect(worker.isWoman).toBe(true);
    expect(worker.isMinority).toBe(true);
    expect(worker.oshaTraining).toBe(true);
  });

  it('should accept null values for MA boolean fields', async () => {
    const cookie = await registerAndLogin('ma-create-null');
    const projectId = await createMaProject(cookie);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'MA Worker Null' });

    expect(wRes.status).toBe(201);
    const workerId = wRes.body.data?.worker?.id as string;

    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    const workers = getRes.body.data?.workers ?? [];
    const worker = workers.find((w: any) => w.id === workerId);
    expect(worker).toBeDefined();
    expect(worker.isWoman).toBeNull();
    expect(worker.isMinority).toBeNull();
    expect(worker.oshaTraining).toBeNull();
  });

  it('should update MA boolean fields via PUT', async () => {
    const cookie = await registerAndLogin('ma-update');
    const projectId = await createMaProject(cookie);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'MA Worker Update' });
    const workerId = wRes.body.data?.worker?.id as string;

    const putRes = await supertest(app)
      .put(`/api/projects/${projectId}/workers/${workerId}`)
      .set('Cookie', cookie)
      .send({ name: 'MA Worker Update', isWoman: true });

    expect(putRes.status).toBe(200);

    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    const workers = getRes.body.data?.workers ?? [];
    const worker = workers.find((w: any) => w.id === workerId);
    expect(worker.isWoman).toBe(true);
    expect(worker.isMinority).toBeNull();
    expect(worker.oshaTraining).toBeNull();
  });

  it('should allow setting MA boolean fields back to null', async () => {
    const cookie = await registerAndLogin('ma-null-roundtrip');
    const projectId = await createMaProject(cookie);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'MA Worker Null RT', isWoman: true });
    const workerId = wRes.body.data?.worker?.id as string;

    const putRes = await supertest(app)
      .put(`/api/projects/${projectId}/workers/${workerId}`)
      .set('Cookie', cookie)
      .send({ name: 'MA Worker Null RT', isWoman: null });

    expect(putRes.status).toBe(200);

    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    const workers = getRes.body.data?.workers ?? [];
    const worker = workers.find((w: any) => w.id === workerId);
    expect(worker.isWoman).toBeNull();
  });
});

describe('nysRegisteredApprentice field', () => {
  it('worker with nysRegisteredApprentice=true is accepted and returned', async () => {
    const cookie = await registerAndLogin('nys-app-true');
    const projectId = await createProject(cookie);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'NY Apprentice Worker', nysRegisteredApprentice: true });

    expect(wRes.status).toBe(201);
    expect(wRes.body.data?.worker?.nysRegisteredApprentice).toBe(true);
  });

  it('worker defaults nysRegisteredApprentice=false when not provided', async () => {
    const cookie = await registerAndLogin('nys-app-default');
    const projectId = await createProject(cookie);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Regular Worker' });
    const workerId = wRes.body.data?.worker?.id as string;

    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    const workers = getRes.body.data?.workers ?? [];
    const worker = workers.find((w: any) => w.id === workerId);
    expect(worker).toBeDefined();
    expect(worker.nysRegisteredApprentice).toBeFalsy();
  });
});

describe('workerSex field (NJ-01)', () => {
  it('creates a worker with workerSex M for NJ project', async () => {
    const cookie = await registerAndLogin('nj-workersex-create');
    const projectId = await createNjProject(cookie);

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Jane Doe', workerSex: 'M' });
    expect(res.status).toBe(201);
    expect(res.body.data?.worker?.workerSex).toBe('M');
  });

  it('updates workerSex to F then null (round-trip)', async () => {
    const cookie = await registerAndLogin('nj-workersex-roundtrip');
    const projectId = await createNjProject(cookie);

    const createRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Test Worker' });
    expect(createRes.status).toBe(201);
    const workerId = createRes.body.data?.worker?.id as string;

    const updateF = await supertest(app)
      .put(`/api/projects/${projectId}/workers/${workerId}`)
      .set('Cookie', cookie)
      .send({ workerSex: 'F' });
    expect(updateF.status).toBe(200);
    expect(updateF.body.data?.worker?.workerSex).toBe('F');

    const updateNull = await supertest(app)
      .put(`/api/projects/${projectId}/workers/${workerId}`)
      .set('Cookie', cookie)
      .send({ workerSex: null });
    expect(updateNull.status).toBe(200);
    expect(updateNull.body.data?.worker?.workerSex).toBeNull();
  });

  it('rejects invalid workerSex values', async () => {
    const cookie = await registerAndLogin('nj-workersex-invalid');
    const projectId = await createNjProject(cookie);

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Invalid Sex Worker', workerSex: 'INVALID' });
    expect(res.status).toBe(400);
  });

  it('workerSex is null by default when not provided', async () => {
    const cookie = await registerAndLogin('nj-workersex-default');
    const projectId = await createNjProject(cookie);

    const createRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'No Sex Field Worker' });
    expect(createRes.status).toBe(201);
    const workerId = createRes.body.data?.worker?.id as string;

    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);
    const workers = getRes.body.data?.workers ?? [];
    const worker = workers.find((w: any) => w.id === workerId);
    expect(worker).toBeDefined();
    expect(worker.workerSex).toBeNull();
  });
});
