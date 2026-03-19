import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

// Helper: register a user and return cookie header
async function registerUser(email: string, password = 'password123') {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

// Helper: create a project and return it
async function createProject(cookie: string, overrides?: Record<string, unknown>) {
  const body = {
    name: 'Test Project',
    state: 'CA',
    county: 'Los Angeles',
    contractType: 'federal-davis-bacon',
    awardDate: '2025-09-01',
    fundingType: 'federal',
    ...overrides,
  };
  return supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send(body);
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

describe('POST /api/projects (create)', () => {
  it('creates project with all required fields and returns 201', async () => {
    const cookie = await registerUser(`proj-create-${Date.now()}@test.com`);
    const res = await createProject(cookie);
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.id).toBeDefined();
    expect(res.body.data?.project?.name).toBe('Test Project');
    expect(res.body.data?.project?.state).toBe('CA');
    expect(res.body.data?.project?.county).toBe('Los Angeles');
    expect(res.body.data?.project?.contractType).toBe('federal-davis-bacon');
    expect(res.body.data?.project?.awardDate).toBe('2025-09-01');
    expect(res.body.data?.project?.fundingType).toBe('federal');
  });

  it('returns 400 when name is missing', async () => {
    const cookie = await registerUser(`proj-noname-${Date.now()}@test.com`);
    const res = await createProject(cookie, { name: undefined });
    // Send without name
    const res2 = await supertest(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({
        state: 'CA',
        county: 'Los Angeles',
        contractType: 'federal-davis-bacon',
        awardDate: '2025-09-01',
        fundingType: 'federal',
      });
    expect(res2.status).toBe(400);
  });

  it('returns 400 when awardDate format is invalid', async () => {
    const cookie = await registerUser(`proj-baddate-${Date.now()}@test.com`);
    const res = await createProject(cookie, { awardDate: '09/01/2025' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when fundingType is not federal|state|mixed', async () => {
    const cookie = await registerUser(`proj-badfunding-${Date.now()}@test.com`);
    const res = await createProject(cookie, { fundingType: 'private' });
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app)
      .post('/api/projects')
      .send({
        name: 'Test Project',
        state: 'CA',
        county: 'Los Angeles',
        contractType: 'federal-davis-bacon',
        awardDate: '2025-09-01',
        fundingType: 'federal',
      });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/projects (list)', () => {
  it('returns only projects belonging to the authenticated user', async () => {
    const ts = Date.now();
    const cookieA = await registerUser(`list-userA-${ts}@test.com`);
    const cookieB = await registerUser(`list-userB-${ts}@test.com`);

    // User A creates a project
    await createProject(cookieA, { name: 'User A Project' });
    // User B creates a project
    await createProject(cookieB, { name: 'User B Project' });

    // User A should only see their own project
    const res = await supertest(app)
      .get('/api/projects')
      .set('Cookie', cookieA);
    expect(res.status).toBe(200);
    const projects = res.body.data?.projects ?? [];
    expect(projects.length).toBeGreaterThanOrEqual(1);
    // None of user A's projects should belong to user B
    expect(projects.every((p: { name: string }) => p.name !== 'User B Project')).toBe(true);
    expect(projects.some((p: { name: string }) => p.name === 'User A Project')).toBe(true);
  });

  it('returns empty array when user has no projects', async () => {
    const cookie = await registerUser(`list-empty-${Date.now()}@test.com`);
    const res = await supertest(app)
      .get('/api/projects')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data?.projects).toEqual([]);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/projects');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns project when user owns it', async () => {
    const cookie = await registerUser(`getone-owner-${Date.now()}@test.com`);
    const createRes = await createProject(cookie, { name: 'Owned Project' });
    const projectId = createRes.body.data?.project?.id;

    const res = await supertest(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data?.project?.id).toBe(projectId);
  });

  it('returns 404 when project not found', async () => {
    const cookie = await registerUser(`getone-notfound-${Date.now()}@test.com`);
    const res = await supertest(app)
      .get('/api/projects/nonexistent-id-12345')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 403 when project belongs to different user', async () => {
    const ts = Date.now();
    const cookieA = await registerUser(`getone-userA-${ts}@test.com`);
    const cookieB = await registerUser(`getone-userB-${ts}@test.com`);

    const createRes = await createProject(cookieA, { name: 'User A Only' });
    const projectId = createRes.body.data?.project?.id;

    const res = await supertest(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/projects/:id (immutable)', () => {
  async function setupProject() {
    const ts = Date.now();
    const cookie = await registerUser(`patch-${ts}@test.com`);
    const createRes = await createProject(cookie);
    const projectId = createRes.body.data?.project?.id;
    return { cookie, projectId };
  }

  it('returns 400 when request body contains awardDate', async () => {
    const { cookie, projectId } = await setupProject();
    const res = await supertest(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ awardDate: '2026-01-01' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when request body contains fundingType', async () => {
    const { cookie, projectId } = await setupProject();
    const res = await supertest(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ fundingType: 'state' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when request body contains wdIdentifier', async () => {
    const { cookie, projectId } = await setupProject();
    const res = await supertest(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ wdIdentifier: 'CA-2025-1234' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when request body contains wdModNumber', async () => {
    const { cookie, projectId } = await setupProject();
    const res = await supertest(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ wdModNumber: 5 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when request body contains wdLockedAt', async () => {
    const { cookie, projectId } = await setupProject();
    const res = await supertest(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ wdLockedAt: '2026-01-01T00:00:00Z' });
    expect(res.status).toBe(400);
  });

  it('updates mutable fields (name, status) successfully', async () => {
    const { cookie, projectId } = await setupProject();
    const res = await supertest(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ name: 'Updated Name', status: 'closed' });
    expect(res.status).toBe(200);
    expect(res.body.data?.project?.name).toBe('Updated Name');
    expect(res.body.data?.project?.status).toBe('closed');
  });
});

describe('DELETE /api/projects/:id', () => {
  it('soft-deletes project by setting status to closed', async () => {
    const cookie = await registerUser(`delete-${Date.now()}@test.com`);
    const createRes = await createProject(cookie, { name: 'To Delete' });
    const projectId = createRes.body.data?.project?.id;

    const res = await supertest(app)
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);

    // Verify it's now closed
    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', cookie);
    expect(getRes.body.data?.project?.status).toBe('closed');
  });

  it('returns 404 when project not found', async () => {
    const cookie = await registerUser(`delete-notfound-${Date.now()}@test.com`);
    const res = await supertest(app)
      .delete('/api/projects/nonexistent-id-99999')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/projects/:id/workers', () => {
  it('creates worker record and returns 201', async () => {
    const cookie = await registerUser(`worker-create-${Date.now()}@test.com`);
    const createRes = await createProject(cookie);
    const projectId = createRes.body.data?.project?.id;

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'John Smith', ssnLast4: '1234', tradeUnion: 'Ironworkers Local 433' });
    expect(res.status).toBe(201);
    expect(res.body.data?.worker?.id).toBeDefined();
    expect(res.body.data?.worker?.name).toBe('John Smith');
  });
});

describe('POST /api/projects/:id/workers/:wid/classifications', () => {
  it('creates classification record and returns 201', async () => {
    const cookie = await registerUser(`classif-create-${Date.now()}@test.com`);
    const createRes = await createProject(cookie);
    const projectId = createRes.body.data?.project?.id;

    const workerRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Jane Doe' });
    const workerId = workerRes.body.data?.worker?.id;

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
      .set('Cookie', cookie)
      .send({
        tradeCode: 'CARP',
        tradeDescription: 'Carpenter',
        laborType: 'journeyworker',
      });
    expect(res.status).toBe(201);
    expect(res.body.data?.classification?.id).toBeDefined();
    expect(res.body.data?.classification?.tradeCode).toBe('CARP');
  });
});
