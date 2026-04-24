import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/server/index.js';
import { upsertWageDetermination } from '../../src/server/services/wageCache.js';

async function registerUser(email: string) {
  const res = await supertest(app).post('/api/auth/register').send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'WD Pin Test',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  return res.body.data.project.id as string;
}

function seedWd() {
  const now = new Date();
  const id = crypto.randomUUID();
  upsertWageDetermination({
    id,
    source: 'federal-dol',
    wdNumber: `CA2025PIN${Date.now()}`,
    revisionNumber: 0,
    state: 'CA',
    county: 'Los Angeles',
    constructionType: 'Building',
    publishDate: '2025-01-01',
    rawDocument: null,
    cachedAt: now.toISOString(),
    cacheExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  return id;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

describe('project wage-determinations routes', () => {
  it('POST /api/projects/:id/wage-determinations pins a WD', async () => {
    const cookie = await registerUser(`wd-pin-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId = seedWd();
    const res = await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    expect(res.status).toBe(201);
  });

  it('GET /api/projects/:id/wage-determinations lists pinned WDs', async () => {
    const cookie = await registerUser(`wd-list-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId = seedWd();
    await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    const res = await supertest(app)
      .get(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.pins)).toBe(true);
    expect(res.body.pins).toHaveLength(1);
    expect(res.body.pins[0].wageDeterminationId).toBe(wdId);
  });

  it('POST duplicate pin returns 409', async () => {
    const cookie = await registerUser(`wd-dup-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId = seedWd();
    await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    const res = await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    expect(res.status).toBe(409);
  });

  it('DELETE /api/projects/:id/wage-determinations/:wdId unpins', async () => {
    const cookie = await registerUser(`wd-del-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId = seedWd();
    await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    const del = await supertest(app)
      .delete(`/api/projects/${projectId}/wage-determinations/${wdId}`)
      .set('Cookie', cookie);
    expect(del.status).toBe(200);
    const list = await supertest(app)
      .get(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie);
    expect(list.body.pins).toHaveLength(0);
  });

  it('PATCH /api/projects/:id/wage-determinations/:wdId sets primary', async () => {
    const cookie = await registerUser(`wd-patch-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId1 = seedWd();
    const wdId2 = seedWd();
    await supertest(app).post(`/api/projects/${projectId}/wage-determinations`).set('Cookie', cookie).send({ wageDeterminationId: wdId1, constructionType: 'Building' });
    await supertest(app).post(`/api/projects/${projectId}/wage-determinations`).set('Cookie', cookie).send({ wageDeterminationId: wdId2, constructionType: 'Highway' });
    const patch = await supertest(app)
      .patch(`/api/projects/${projectId}/wage-determinations/${wdId1}`)
      .set('Cookie', cookie)
      .send({ isPrimary: true });
    expect(patch.status).toBe(200);
    const list = await supertest(app).get(`/api/projects/${projectId}/wage-determinations`).set('Cookie', cookie);
    const primary = list.body.pins.find((p: any) => p.wageDeterminationId === wdId1);
    expect(primary.isPrimary).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/projects/any/wage-determinations');
    expect(res.status).toBe(401);
  });
});
