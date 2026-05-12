import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string) {
  const email = `sub-route-${suffix}-${Date.now()}@test.com`;
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
      name: 'Sub Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  return res.body.data?.project?.id as string;
}

// ── SUB-03: Subcontractor CRUD ─────────────────────────────────────────────

describe('GET /api/projects/:id/subcontractors (SUB-03)', () => {
  it('returns 200 with empty array for a new project', async () => {
    const cookie = await registerAndLogin('sub-get-empty');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data?.subcontractors).toEqual([]);
  });

  it('returns 403 for a non-member user', async () => {
    const cookie = await registerAndLogin('sub-get-owner');
    const projectId = await createProject(cookie);

    const otherCookie = await registerAndLogin('sub-get-nonmember');

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/projects/:id/subcontractor-cpr-queue', () => {
  it('returns project-level CPR follow-up items', async () => {
    const cookie = await registerAndLogin('cpr-queue');
    const projectId = await createProject(cookie);

    const subRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Queue Sub' });
    const subId = subRes.body.data?.subcontractor?.id as string;

    const cprRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2025-06-06' });
    expect(cprRes.status).toBe(201);

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/subcontractor-cpr-queue`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data?.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subcontractorId: subId,
          subcontractorName: 'Queue Sub',
          weekEndingDate: '2025-06-06',
          status: 'overdue',
        }),
      ]),
    );
  });

  it('returns 403 for a non-member user', async () => {
    const cookie = await registerAndLogin('cpr-queue-owner');
    const projectId = await createProject(cookie);
    const otherCookie = await registerAndLogin('cpr-queue-other');

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/subcontractor-cpr-queue`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/projects/:id/subcontractors (SUB-03)', () => {
  it('creates a subcontractor and returns 201 with subcontractor object', async () => {
    const cookie = await registerAndLogin('sub-post-create');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({
        name: 'Acme Electrical',
        licenseNumber: 'LIC-12345',
        contactName: 'Jane Smith',
        contactEmail: 'jane@acme.com',
        address: '123 Main St, Los Angeles CA',
      });

    expect(res.status).toBe(201);
    const sub = res.body.data?.subcontractor;
    expect(sub).toBeDefined();
    expect(sub.id).toBeDefined();
    expect(sub.projectId).toBe(projectId);
    expect(sub.name).toBe('Acme Electrical');
    expect(sub.licenseNumber).toBe('LIC-12345');
    expect(sub.contactName).toBe('Jane Smith');
    expect(sub.contactEmail).toBe('jane@acme.com');
    expect(sub.address).toBe('123 Main St, Los Angeles CA');
    expect(sub.createdAt).toBeDefined();
  });

  it('returns 403 for a non-member user', async () => {
    const cookie = await registerAndLogin('sub-post-owner');
    const projectId = await createProject(cookie);

    const otherCookie = await registerAndLogin('sub-post-nonmember');

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', otherCookie)
      .send({ name: 'Unauthorized Sub' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/projects/:id/subcontractors/:subId (SUB-03)', () => {
  it('updates sub name and returns 200 with updated record', async () => {
    const cookie = await registerAndLogin('sub-patch-update');
    const projectId = await createProject(cookie);

    const postRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Old Name' });
    const subId = postRes.body.data?.subcontractor?.id as string;

    const patchRes = await supertest(app)
      .patch(`/api/projects/${projectId}/subcontractors/${subId}`)
      .set('Cookie', cookie)
      .send({ name: 'New Name' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data?.subcontractor?.name).toBe('New Name');
  });

  it('returns 403 for a non-member user', async () => {
    const cookie = await registerAndLogin('sub-patch-owner');
    const projectId = await createProject(cookie);

    const postRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Sub To Patch' });
    const subId = postRes.body.data?.subcontractor?.id as string;

    const otherCookie = await registerAndLogin('sub-patch-nonmember');

    const res = await supertest(app)
      .patch(`/api/projects/${projectId}/subcontractors/${subId}`)
      .set('Cookie', otherCookie)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/projects/:id/subcontractors/:subId (SUB-03)', () => {
  it('deletes a sub and subsequent GET returns empty list', async () => {
    const cookie = await registerAndLogin('sub-delete-ok');
    const projectId = await createProject(cookie);

    const postRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Sub To Delete' });
    const subId = postRes.body.data?.subcontractor?.id as string;

    const deleteRes = await supertest(app)
      .delete(`/api/projects/${projectId}/subcontractors/${subId}`)
      .set('Cookie', cookie);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data?.deleted).toBe(true);

    const getRes = await supertest(app)
      .get(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data?.subcontractors).toEqual([]);
  });

  it('returns 403 for a non-member user', async () => {
    const cookie = await registerAndLogin('sub-delete-owner');
    const projectId = await createProject(cookie);

    const postRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Sub To Delete 403' });
    const subId = postRes.body.data?.subcontractor?.id as string;

    const otherCookie = await registerAndLogin('sub-delete-nonmember');

    const res = await supertest(app)
      .delete(`/api/projects/${projectId}/subcontractors/${subId}`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });
});

// ── SUB-04: CPR Week tracking ──────────────────────────────────────────────

describe('POST /api/projects/:id/subcontractors/:subId/cpr-weeks (SUB-04)', () => {
  it('creates a CPR week record and returns 201 with cprWeek object', async () => {
    const cookie = await registerAndLogin('cpr-post-create');
    const projectId = await createProject(cookie);

    const subRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'CPR Sub' });
    const subId = subRes.body.data?.subcontractor?.id as string;

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({
        weekEndingDate: '2025-06-06',
        receivedDate: '2025-06-07',
        isCompliant: 1,
        notes: 'first week',
      });

    expect(res.status).toBe(201);
    const week = res.body.data?.cprWeek;
    expect(week).toBeDefined();
    expect(week.id).toBeDefined();
    expect(week.subcontractorId).toBe(subId);
    expect(week.weekEndingDate).toBe('2025-06-06');
    expect(week.receivedDate).toBe('2025-06-07');
    expect(week.isCompliant).toBe(1);
    expect(week.notes).toBe('first week');
    expect(week.createdAt).toBeDefined();
  });

  it('returns 409 for duplicate (subcontractorId, weekEndingDate)', async () => {
    const cookie = await registerAndLogin('cpr-post-409');
    const projectId = await createProject(cookie);

    const subRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Dup CPR Sub' });
    const subId = subRes.body.data?.subcontractor?.id as string;

    await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2025-06-13' });

    const dupRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2025-06-13' });

    expect(dupRes.status).toBe(409);
  });

  it('returns 403 for a non-member user', async () => {
    const cookie = await registerAndLogin('cpr-post-403-owner');
    const projectId = await createProject(cookie);

    const subRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Auth CPR Sub' });
    const subId = subRes.body.data?.subcontractor?.id as string;

    const otherCookie = await registerAndLogin('cpr-post-403-nonmember');

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', otherCookie)
      .send({ weekEndingDate: '2025-07-04' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/projects/:id/subcontractors/:subId/cpr-weeks/:weekId (SUB-04)', () => {
  it('updates receivedDate, isCompliant, notes and returns 200 with updated record', async () => {
    const cookie = await registerAndLogin('cpr-patch-update');
    const projectId = await createProject(cookie);

    const subRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Patch CPR Sub' });
    const subId = subRes.body.data?.subcontractor?.id as string;

    const postRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2025-06-20' });
    const weekId = postRes.body.data?.cprWeek?.id as string;

    const patchRes = await supertest(app)
      .patch(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks/${weekId}`)
      .set('Cookie', cookie)
      .send({ receivedDate: '2025-06-07', isCompliant: 1, notes: 'looks good' });

    expect(patchRes.status).toBe(200);
    const updated = patchRes.body.data?.cprWeek;
    expect(updated?.receivedDate).toBe('2025-06-07');
    expect(updated?.isCompliant).toBe(1);
    expect(updated?.notes).toBe('looks good');
  });

  it('returns 403 for a non-member user', async () => {
    const cookie = await registerAndLogin('cpr-patch-403-owner');
    const projectId = await createProject(cookie);

    const subRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Auth PATCH CPR Sub' });
    const subId = subRes.body.data?.subcontractor?.id as string;

    const postRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2025-06-27' });
    const weekId = postRes.body.data?.cprWeek?.id as string;

    const otherCookie = await registerAndLogin('cpr-patch-403-nonmember');

    const res = await supertest(app)
      .patch(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks/${weekId}`)
      .set('Cookie', otherCookie)
      .send({ notes: 'hacked' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/projects/:id/subcontractors/:subId/cpr-weeks (SUB-04)', () => {
  it('returns 200 with list of cpr-weeks for sub', async () => {
    const cookie = await registerAndLogin('cpr-get-list');
    const projectId = await createProject(cookie);

    const subRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'List CPR Sub' });
    const subId = subRes.body.data?.subcontractor?.id as string;

    await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2025-07-04' });

    await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2025-07-11' });

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const weeks = res.body.data?.cprWeeks;
    expect(Array.isArray(weeks)).toBe(true);
    expect(weeks.length).toBe(2);
  });

  it('returns 403 for a non-member user', async () => {
    const cookie = await registerAndLogin('cpr-get-403-owner');
    const projectId = await createProject(cookie);

    const subRes = await supertest(app)
      .post(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie)
      .send({ name: 'Auth GET CPR Sub' });
    const subId = subRes.body.data?.subcontractor?.id as string;

    const otherCookie = await registerAndLogin('cpr-get-403-nonmember');

    const res = await supertest(app)
      .get(`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });
});

describe('CPR-week cross-project ownership (second-level check)', () => {
  it('returns 404 when :subId belongs to a different project', async () => {
    const cookieA = await registerAndLogin('cross-proj-a');
    const projectA = await createProject(cookieA);

    const subRes = await supertest(app)
      .post(`/api/projects/${projectA}/subcontractors`)
      .set('Cookie', cookieA)
      .send({ name: 'Sub In Project A' });
    const subIdA = subRes.body.data?.subcontractor?.id as string;

    const cookieB = await registerAndLogin('cross-proj-b');
    const projectB = await createProject(cookieB);

    // User B tries to create a CPR week for projectB but using subIdA (from projectA)
    const res = await supertest(app)
      .patch(`/api/projects/${projectB}/subcontractors/${subIdA}/cpr-weeks/nonexistent-week-id`)
      .set('Cookie', cookieB)
      .send({ notes: 'cross-project attack' });

    expect(res.status).toBe(404);
  });
});
