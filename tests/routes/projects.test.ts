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

describe('GET /api/projects status filter', () => {
  it('returns only active projects by default (no ?status param)', async () => {
    const cookie = await registerUser(`filter-default-${Date.now()}@test.com`);
    await createProject(cookie, { name: 'Active Project' });
    // Archive one project
    const archiveRes = await createProject(cookie, { name: 'Archived Project' });
    const archivedId = archiveRes.body.data?.project?.id;
    await supertest(app).delete(`/api/projects/${archivedId}`).set('Cookie', cookie);

    const res = await supertest(app).get('/api/projects').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const names = res.body.data.projects.map((p: any) => p.name);
    expect(names).toContain('Active Project');
    expect(names).not.toContain('Archived Project');
  });

  it('returns all projects when ?status=all', async () => {
    const cookie = await registerUser(`filter-all-${Date.now()}@test.com`);
    await createProject(cookie, { name: 'Active Project 2' });
    const archiveRes = await createProject(cookie, { name: 'Archived Project 2' });
    const archivedId = archiveRes.body.data?.project?.id;
    await supertest(app).delete(`/api/projects/${archivedId}`).set('Cookie', cookie);

    const res = await supertest(app).get('/api/projects?status=all').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const names = res.body.data.projects.map((p: any) => p.name);
    expect(names).toContain('Active Project 2');
    expect(names).toContain('Archived Project 2');
  });

  it('returns only active projects when ?status=active', async () => {
    const cookie = await registerUser(`filter-active-${Date.now()}@test.com`);
    await createProject(cookie, { name: 'Active Explicit' });
    const archiveRes = await createProject(cookie, { name: 'Closed Explicit' });
    const archivedId = archiveRes.body.data?.project?.id;
    await supertest(app).delete(`/api/projects/${archivedId}`).set('Cookie', cookie);

    const res = await supertest(app).get('/api/projects?status=active').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const names = res.body.data.projects.map((p: any) => p.name);
    expect(names).toContain('Active Explicit');
    expect(names).not.toContain('Closed Explicit');
  });
});

describe('DELETE /api/projects/:id advisory behavior', () => {
  it('archives project without compliance check (no 409)', async () => {
    const cookie = await registerUser(`advisory-${Date.now()}@test.com`);
    const createRes = await createProject(cookie, { name: 'Advisory Test' });
    const projectId = createRes.body.data?.project?.id;

    // DELETE should succeed regardless of compliance state
    const res = await supertest(app)
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data?.message).toBe('Project closed');
  });
});

describe('PATCH /api/projects/:id restore', () => {
  it('restores a closed project to active status', async () => {
    const cookie = await registerUser(`restore-${Date.now()}@test.com`);
    const createRes = await createProject(cookie, { name: 'Restore Test' });
    const projectId = createRes.body.data?.project?.id;

    // Archive it
    await supertest(app).delete(`/api/projects/${projectId}`).set('Cookie', cookie);

    // Restore it
    const res = await supertest(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.data?.project?.status).toBe('active');

    // Verify it appears in default list again
    const listRes = await supertest(app).get('/api/projects').set('Cookie', cookie);
    const names = listRes.body.data.projects.map((p: any) => p.name);
    expect(names).toContain('Restore Test');
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

describe('CA project fields - CAL-01', () => {
  it('should persist cslbLicense and wcPolicyNumber on CA project creation', async () => {
    const cookie = await registerUser(`cal01-with-fields-${Date.now()}@test.com`);
    const res = await createProject(cookie, {
      state: 'CA',
      cslbLicense: '123456',
      wcPolicyNumber: 'WC-789',
    });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.cslbLicense).toBe('123456');
    expect(res.body.data?.project?.wcPolicyNumber).toBe('WC-789');
  });

  it('should allow CA project creation without CSLB fields (optional)', async () => {
    const cookie = await registerUser(`cal01-no-fields-${Date.now()}@test.com`);
    const res = await createProject(cookie, { state: 'CA' });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.cslbLicense).toBeNull();
    expect(res.body.data?.project?.wcPolicyNumber).toBeNull();
  });

  it('should NOT include CA fields in response for non-CA project', async () => {
    const cookie = await registerUser(`cal01-tx-${Date.now()}@test.com`);
    const res = await createProject(cookie, { state: 'TX' });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.cslbLicense).toBeNull();
  });
});

describe('WA project fields - WAL-02', () => {
  it('should persist ubiNumber, lniCertificate, and wcAccount on WA project creation', async () => {
    const cookie = await registerUser(`wal02-with-fields-${Date.now()}@test.com`);
    const res = await createProject(cookie, {
      state: 'WA',
      ubiNumber: '123456789',
      lniCertificate: 'HCCCO1234LI',
      wcAccount: '234-56-7',
    });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.ubiNumber).toBe('123456789');
    expect(res.body.data?.project?.lniCertificate).toBe('HCCCO1234LI');
    expect(res.body.data?.project?.wcAccount).toBe('234-56-7');
  });

  it('should allow WA project creation without WA fields (all optional)', async () => {
    const cookie = await registerUser(`wal02-no-fields-${Date.now()}@test.com`);
    const res = await createProject(cookie, { state: 'WA' });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.ubiNumber).toBeNull();
    expect(res.body.data?.project?.lniCertificate).toBeNull();
    expect(res.body.data?.project?.wcAccount).toBeNull();
  });

  it('should return WA fields as null for non-WA project', async () => {
    const cookie = await registerUser(`wal02-tx-${Date.now()}@test.com`);
    const res = await createProject(cookie, { state: 'TX' });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.ubiNumber).toBeNull();
    expect(res.body.data?.project?.lniCertificate).toBeNull();
    expect(res.body.data?.project?.wcAccount).toBeNull();
  });
});

describe('NY project fields', () => {
  it('POST project with state=NY is accepted and returns state: NY', async () => {
    const cookie = await registerUser(`ny-create-${Date.now()}@test.com`);
    const res = await createProject(cookie, {
      state: 'NY',
      county: 'New York',
      nyprcNumber: 'PRC-12345',
      nysContractorRegNumber: 'CR-67890',
    });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.state).toBe('NY');
  });

  it('NY project has nyprcNumber and nysContractorRegNumber in response', async () => {
    const cookie = await registerUser(`ny-fields-${Date.now()}@test.com`);
    const createRes = await createProject(cookie, {
      state: 'NY',
      county: 'New York',
      nyprcNumber: 'PRC-12345',
      nysContractorRegNumber: 'CR-67890',
    });
    const projectId = createRes.body.data?.project?.id;

    const res = await supertest(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data?.project?.nyprcNumber).toBe('PRC-12345');
    expect(res.body.data?.project?.nysContractorRegNumber).toBe('CR-67890');
  });

  it('PATCH project updates nyprcNumber', async () => {
    const cookie = await registerUser(`ny-patch-${Date.now()}@test.com`);
    const createRes = await createProject(cookie, {
      state: 'NY',
      county: 'New York',
      nyprcNumber: 'PRC-ORIGINAL',
    });
    const projectId = createRes.body.data?.project?.id;

    await supertest(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ nyprcNumber: 'PRC-UPDATED' });

    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data?.project?.nyprcNumber).toBe('PRC-UPDATED');
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

describe('TX-specific project fields (Phase 47)', () => {
  it('should save and return TX-specific fields', async () => {
    const cookie = await registerUser(`tx-fields-${Date.now()}@test.com`);
    const res = await supertest(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({
        name: 'TX Highway Project',
        state: 'TX',
        county: 'Harris',
        contractType: 'state-prevailing',
        awardDate: '2025-06-01',
        fundingType: 'state',
        txdotProjectId: 'STP 2025(001)',
        txContractorLicense: 'TDLR-12345',
        txAwardingAgency: 'Texas DOT',
      });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.txdotProjectId).toBe('STP 2025(001)');
    expect(res.body.data?.project?.txContractorLicense).toBe('TDLR-12345');
    expect(res.body.data?.project?.txAwardingAgency).toBe('Texas DOT');
  });

  it('should create TX project without TX-specific fields (all optional)', async () => {
    const cookie = await registerUser(`tx-optional-${Date.now()}@test.com`);
    const res = await supertest(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({
        name: 'TX Basic Project',
        state: 'TX',
        county: 'Travis',
        contractType: 'federal-davis-bacon',
        awardDate: '2025-07-01',
        fundingType: 'federal',
      });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.state).toBe('TX');
    expect(res.body.data?.project?.txdotProjectId).toBeNull();
  });
});

describe('NJ-specific project fields (Phase 51)', () => {
  it('creates NJ project with njPwcNumber and njContractId', async () => {
    const cookie = await registerUser(`nj-fields-${Date.now()}@test.com`);
    const res = await supertest(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({
        name: 'NJ Test Project',
        state: 'NJ',
        county: 'Essex',
        contractType: 'state-prevailing',
        awardDate: '2025-06-01',
        fundingType: 'state',
        njPwcNumber: 'PWC-123',
        njContractId: 'NJ-CONTRACT-456',
      });
    expect(res.status).toBe(201);
    expect(res.body.data?.project?.njPwcNumber).toBe('PWC-123');
    expect(res.body.data?.project?.njContractId).toBe('NJ-CONTRACT-456');
  });

  it('updates NJ project njPwcNumber and njContractId via PATCH', async () => {
    const cookie = await registerUser(`nj-patch-${Date.now()}@test.com`);
    const createRes = await supertest(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({
        name: 'NJ PATCH Test',
        state: 'NJ',
        county: 'Hudson',
        contractType: 'federal-davis-bacon',
        awardDate: '2025-07-01',
        fundingType: 'federal',
      });
    expect(createRes.status).toBe(201);
    const projectId = createRes.body.data?.project?.id as string;

    const patchRes = await supertest(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ njPwcNumber: 'PWC-999', njContractId: 'CONTRACT-999' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data?.project?.njPwcNumber).toBe('PWC-999');
    expect(patchRes.body.data?.project?.njContractId).toBe('CONTRACT-999');
  });
});
