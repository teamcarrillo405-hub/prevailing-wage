import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

describe('GET /v1/projects - per-key rate limiting', () => {
  it('isolates rate-limit buckets for two keys owned by the same user', async () => {
    process.env.PUBLIC_API_RATE_LIMIT_TEST_MAX = '1';

    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    const email = `rate-limit-${ts}-${rand}@test.com`;
    const cookie = await registerUser(email);
    const firstKey = await createApiKey(cookie, ['projects:read'], 'first-rate-key');
    const secondKey = await createApiKey(cookie, ['projects:read'], 'second-rate-key');

    const firstRes = await supertest(app)
      .get('/v1/projects')
      .set('Authorization', `Bearer ${firstKey}`);
    expect(firstRes.status).toBe(200);

    const firstResAgain = await supertest(app)
      .get('/v1/projects')
      .set('Authorization', `Bearer ${firstKey}`);
    expect(firstResAgain.status).toBe(429);

    const secondRes = await supertest(app)
      .get('/v1/projects')
      .set('Authorization', `Bearer ${secondKey}`);
    expect(secondRes.status).toBe(200);
  });
});

afterEach(() => {
  delete process.env.PUBLIC_API_RATE_LIMIT_TEST_MAX;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function registerUser(email: string, password = 'password123') {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string, overrides?: Record<string, unknown>) {
  const body = {
    name: 'API Test Project',
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

async function createApiKey(cookie: string, scopes: string[], name = 'test-key') {
  const res = await supertest(app)
    .post('/api/keys')
    .set('Cookie', cookie)
    .send({ name, scopes });
  return res.body.data?.key as string;
}

// ── Test 1: 401 when no Authorization header ──────────────────────────────────

describe('GET /v1/projects — auth enforcement', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await supertest(app).get('/v1/projects');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  // Test 2: 401 with invalid Bearer token
  it('returns 401 with an invalid Bearer token', async () => {
    const res = await supertest(app)
      .get('/v1/projects')
      .set('Authorization', 'Bearer invalid-token-xyz');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});

// ── Test 3: Response shape {data, meta} envelope ──────────────────────────────

describe('GET /v1/projects — response shape', () => {
  it('returns {data, meta} envelope with pagination fields', async () => {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    const email = `testuser-${ts}-${rand}@test.com`;
    const cookie = await registerUser(email);
    const rawKey = await createApiKey(cookie, ['projects:read']);

    const res = await supertest(app)
      .get('/v1/projects')
      .set('Authorization', `Bearer ${rawKey}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('page');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('hasNext');
    expect(res.body.meta).toHaveProperty('requestId');
    expect(res.body.meta).toHaveProperty('timestamp');
  });
});

// ── Test 4: Pagination — limit + hasNext ─────────────────────────────────────

describe('GET /v1/projects — pagination', () => {
  it('returns limit=2 items and hasNext=true when 3 projects exist', async () => {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    const email = `testuser-${ts}-${rand}@test.com`;
    const cookie = await registerUser(email);

    // Create 3 projects
    await createProject(cookie, { name: 'Paginate Project A' });
    await createProject(cookie, { name: 'Paginate Project B' });
    await createProject(cookie, { name: 'Paginate Project C' });

    const rawKey = await createApiKey(cookie, ['projects:read']);

    const res = await supertest(app)
      .get('/v1/projects?limit=2&page=1')
      .set('Authorization', `Bearer ${rawKey}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.meta.hasNext).toBe(true);
  });
});

// ── Test 5: Scope enforcement ─────────────────────────────────────────────────

describe('GET /v1/projects/:id/workers — scope enforcement', () => {
  it('returns 403 when API key does not have workers:read scope', async () => {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    const email = `testuser-${ts}-${rand}@test.com`;
    const cookie = await registerUser(email);

    // Create a project
    const projRes = await createProject(cookie, { name: 'Scope Test Project' });
    const projectId = projRes.body.data?.project?.id as string;

    // Create an API key with only projects:read (no workers:read)
    const rawKey = await createApiKey(cookie, ['projects:read'], 'projects-only-key');

    const res = await supertest(app)
      .get(`/v1/projects/${projectId}/workers`)
      .set('Authorization', `Bearer ${rawKey}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/workers:read/);
  });
});
