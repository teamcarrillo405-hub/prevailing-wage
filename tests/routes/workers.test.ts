import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/server/index.js';
import {
  pinWdToProject,
  upsertClassifications,
  upsertWageDetermination,
} from '../../src/server/services/wageCache.js';

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

  it('uses the project-pinned wage determination for worker classification rates', async () => {
    const cookie = await registerAndLogin('pinned-wd-rates');
    const projectId = await createProject(cookie);
    const now = new Date();

    const pinnedWdId = await upsertWageDetermination({
      id: randomUUID(),
      source: 'federal-dol',
      wdNumber: `PINNED${Date.now()}`,
      revisionNumber: 0,
      state: 'CA',
      county: 'Los Angeles',
      constructionType: 'Building',
      publishDate: '2025-01-01',
      rawDocument: 'Pinned WD with project classifications.',
      cachedAt: now.toISOString(),
      cacheExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    await upsertClassifications(pinnedWdId, [
      { code: 'CARP', description: 'Carpenter', baseRate: 44.15, fringeRate: 19.82, totalRate: 63.97 },
    ]);
    await pinWdToProject(projectId, pinnedWdId, 'Building', null);

    const newerUnpinnedWdId = await upsertWageDetermination({
      id: randomUUID(),
      source: 'federal-dol',
      wdNumber: `UNPINNED${Date.now()}`,
      revisionNumber: 0,
      state: 'CA',
      county: 'Los Angeles',
      constructionType: 'Heavy',
      publishDate: '2026-01-01',
      rawDocument: 'Newer state/county WD that should not override the project pin.',
      cachedAt: now.toISOString(),
      cacheExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    await upsertClassifications(newerUnpinnedWdId, [
      { code: 'ELEC', description: 'Electrician', baseRate: 70, fringeRate: 25, totalRate: 95 },
    ]);

    await createWorkerWithClassification(cookie, projectId);

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const workers = res.body.data?.workers ?? [];
    expect(workers[0].classifications[0].baseRate).toBe(44.15);
    expect(workers[0].classifications[0].fringeRate).toBe(19.82);
  });

  it('returns apprentice effective base rate using apprentice percent', async () => {
    const cookie = await registerAndLogin('apprentice-effective-rates');
    const projectId = await createProject(cookie);
    const now = new Date();

    const pinnedWdId = await upsertWageDetermination({
      id: randomUUID(),
      source: 'federal-dol',
      wdNumber: `APP-PINNED${Date.now()}`,
      revisionNumber: 0,
      state: 'CA',
      county: 'Los Angeles',
      constructionType: 'Building',
      publishDate: '2025-01-01',
      rawDocument: 'Pinned WD with apprentice rate test classification.',
      cachedAt: now.toISOString(),
      cacheExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    await upsertClassifications(pinnedWdId, [
      { code: 'ELEC', description: 'Electrician', baseRate: 50, fringeRate: 20, totalRate: 70 },
    ]);
    await pinWdToProject(projectId, pinnedWdId, 'Building', null);

    const wRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Apprentice Worker' });
    const workerId = wRes.body.data?.worker?.id as string;

    await supertest(app)
      .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
      .set('Cookie', cookie)
      .send({
        tradeCode: 'ELEC',
        tradeDescription: 'Electrician',
        laborType: 'apprentice',
        apprenticePercent: 60,
        programName: 'IBEW Registered Apprenticeship Program',
      });

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const cls = res.body.data.workers[0].classifications[0];
    expect(cls.baseRate).toBe(30);
    expect(cls.fringeRate).toBe(20);
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

// ── Phase 85: FTS5 Search Tests ───────────────────────────────────────────

describe("GET /:projectId/workers/search", () => {
  it("returns matching workers by name (happy path)", async () => {
    const cookie = await registerAndLogin("search-1");
    const projectId = await createProject(cookie);
    await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set("Cookie", cookie)
      .send({ name: "John Doe", tradeUnion: "Carpenters Local 51" });
    await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set("Cookie", cookie)
      .send({ name: "Jane Smith", tradeUnion: "Electricians Local 11" });
    await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set("Cookie", cookie)
      .send({ name: "Bob Carter" });

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search?q=john`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.workers).toHaveLength(1);
    expect(res.body.data.workers[0].name).toBe("John Doe");
    expect(res.body.data.workers[0].trade_union).toBe("Carpenters Local 51");
  });

  it("scopes results to projectId (no cross-project leakage)", async () => {
    const cookie = await registerAndLogin("search-2");
    const projectA = await createProject(cookie);
    const projectB = await createProject(cookie);

    await supertest(app)
      .post(`/api/projects/${projectA}/workers`)
      .set("Cookie", cookie)
      .send({ name: "Alex Alpha" });
    await supertest(app)
      .post(`/api/projects/${projectB}/workers`)
      .set("Cookie", cookie)
      .send({ name: "Alex Beta" });

    const res = await supertest(app)
      .get(`/api/projects/${projectA}/workers/search?q=alex`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.workers).toHaveLength(1);
    expect(res.body.data.workers[0].name).toBe("Alex Alpha");
  });

  it("returns empty array on empty query (q='' and q absent)", async () => {
    const cookie = await registerAndLogin("search-3");
    const projectId = await createProject(cookie);
    await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set("Cookie", cookie)
      .send({ name: "Someone Here" });

    const resEmpty = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search?q=`)
      .set("Cookie", cookie);
    expect(resEmpty.status).toBe(200);
    expect(resEmpty.body.data.workers).toEqual([]);

    const resAbsent = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search`)
      .set("Cookie", cookie);
    expect(resAbsent.status).toBe(200);
    expect(resAbsent.body.data.workers).toEqual([]);
  });

  it("returns empty array on FTS5-only-special-char query", async () => {
    const cookie = await registerAndLogin("search-4");
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search?q=(((`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.workers).toEqual([]);
  });

  it("returns 401 for unauthenticated request", async () => {
    const cookie = await registerAndLogin("search-5");
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search?q=foo`);

    expect(res.status).toBe(401);
  });

  it("blocks cross-tenant access (>= 400)", async () => {
    const cookieA = await registerAndLogin("search-6a");
    const cookieB = await registerAndLogin("search-6b");
    const projectA = await createProject(cookieA);

    const res = await supertest(app)
      .get(`/api/projects/${projectA}/workers/search?q=foo`)
      .set("Cookie", cookieB);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(200);
  });

  it("does not crash on FTS5 special characters", async () => {
    const cookie = await registerAndLogin("search-7");
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search?q=john(doe)`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.workers)).toBe(true);
  });

  it("resolves search route, not :workerId route (returns array shape)", async () => {
    const cookie = await registerAndLogin("search-8");
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search?q=foo`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("workers");
    expect(Array.isArray(res.body.data.workers)).toBe(true);
  });

  it("removes stale rows from FTS index after worker name update (trigger sync)", async () => {
    const cookie = await registerAndLogin("search-9");
    const projectId = await createProject(cookie);

    const createRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set("Cookie", cookie)
      .send({ name: "Original Name" });
    const workerId = createRes.body.data?.worker?.id as string;

    await supertest(app)
      .put(`/api/projects/${projectId}/workers/${workerId}`)
      .set("Cookie", cookie)
      .send({ name: "Updated Name" });

    const resOld = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search?q=original`)
      .set("Cookie", cookie);
    expect(resOld.status).toBe(200);
    expect(resOld.body.data.workers).toHaveLength(0);

    const resNew = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search?q=updated`)
      .set("Cookie", cookie);
    expect(resNew.status).toBe(200);
    expect(resNew.body.data.workers).toHaveLength(1);
  });

  it("removes row from FTS index after worker delete (trigger sync)", async () => {
    const cookie = await registerAndLogin("search-10");
    const projectId = await createProject(cookie);

    const createRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set("Cookie", cookie)
      .send({ name: "DeleteMe Worker" });
    const workerId = createRes.body.data?.worker?.id as string;

    await supertest(app)
      .delete(`/api/projects/${projectId}/workers/${workerId}`)
      .set("Cookie", cookie);

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/workers/search?q=deleteme`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.workers).toHaveLength(0);
  });
});
