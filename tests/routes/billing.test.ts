import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function registerUser(email: string, password = 'password123') {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string) {
  return supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Quota Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-09-01',
      fundingType: 'federal',
    });
}

async function createWorkerOnProject(cookie: string, projectId: string) {
  return supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: `Worker ${Date.now()}` });
}

// Set planTier on a user via the DB directly
async function setUserPlanTier(userId: string, tier: 'starter' | 'pro' | 'enterprise') {
  const db = (globalThis as any).__testDb;
  const { users } = await import('../../src/server/db/schema.js');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ planTier: tier }).where(eq(users.id, userId));
}

// Get userId from the cookie by calling /api/auth/me or /api/team
async function getUserId(cookie: string): Promise<string> {
  const res = await supertest(app)
    .get('/api/billing/status')
    .set('Cookie', cookie);
  // userId comes from the users table — get it via a register response trick
  // Actually: register returns the user session. Let's get it from the DB directly
  // by querying via email embedded in the cookie's JWT.
  // Simpler: query the DB for the most recently created user with a known email.
  // We store the email in test setup, so just return via team endpoint.
  const teamRes = await supertest(app)
    .get('/api/team')
    .set('Cookie', cookie);
  // The team endpoint returns the owner's info; for a fresh account there's 1 member
  // We need the userId for DB manipulation. Use a direct DB lookup via email.
  // Since we don't have email here, we'll decode from auth or use the test DB.
  // Fallback: look at the session user from the cookie.
  return teamRes.body?.data?.userId ?? '';
}

// Better: extract userId from JWT cookie
async function extractUserIdFromCookie(cookie: string): Promise<string> {
  // Use a protected endpoint that returns user info
  // POST /api/auth/register returns user data — but we need a GET /api/auth/me
  // Use billing status which queries the DB by userId from the JWT
  // We'll manipulate DB by looking at the email. Instead, use a helper.

  // Actually the simplest: call an endpoint that echoes userId.
  // Since we don't have /api/auth/me, query the DB for the session token's userId.
  // Decode the JWT from the cookie string.
  const tokenMatch = cookie.match(/session=([^;]+)/);
  if (!tokenMatch) return '';
  const token = tokenMatch[1];
  const [, payloadB64] = token.split('.');
  if (!payloadB64) return '';
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  return payload.userId ?? '';
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── GET /api/billing/usage ────────────────────────────────────────────────────

describe('GET /api/billing/usage', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/billing/usage');
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct shape for authenticated starter user', async () => {
    const cookie = await registerUser(`billing-usage-${Date.now()}@test.com`);
    const res = await supertest(app)
      .get('/api/billing/usage')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.projectCount).toBe('number');
    expect(typeof res.body.workerCount).toBe('number');
    expect(typeof res.body.memberCount).toBe('number');
    expect(res.body.limits).toBeDefined();
    expect(res.body.limits.maxProjects).toBe(3);
    expect(res.body.limits.maxWorkers).toBe(25);
    expect(res.body.limits.maxMembers).toBe(2);
    expect(res.body.planTier).toBe('starter');
  });

  it('increments projectCount after creating a project', async () => {
    const cookie = await registerUser(`billing-usage-count-${Date.now()}@test.com`);

    const before = await supertest(app).get('/api/billing/usage').set('Cookie', cookie);
    expect(before.body.projectCount).toBe(0);

    await createProject(cookie);

    const after = await supertest(app).get('/api/billing/usage').set('Cookie', cookie);
    expect(after.body.projectCount).toBe(1);
  });
});

// ── POST /api/projects — project quota enforcement ───────────────────────────

describe('POST /api/projects — quota enforcement', () => {
  it('returns 409 with upgradeRequired when starter account reaches 3-project cap', async () => {
    const ts = Date.now();
    const cookie = await registerUser(`proj-quota-${ts}@test.com`);

    // Create 3 projects (cap for starter)
    const r1 = await createProject(cookie);
    expect(r1.status).toBe(201);
    const r2 = await createProject(cookie);
    expect(r2.status).toBe(201);
    const r3 = await createProject(cookie);
    expect(r3.status).toBe(201);

    // 4th project must be rejected
    const r4 = await createProject(cookie);
    expect(r4.status).toBe(409);
    expect(r4.body.upgradeRequired).toBe(true);
    expect(r4.body.error).toMatch(/project limit/i);
  });

  it('allows creating a project below the 3-project cap', async () => {
    const cookie = await registerUser(`proj-below-cap-${Date.now()}@test.com`);
    const r1 = await createProject(cookie);
    expect(r1.status).toBe(201);
    const r2 = await createProject(cookie);
    expect(r2.status).toBe(201);
    // 2 < 3, so a 3rd should succeed
    const r3 = await createProject(cookie);
    expect(r3.status).toBe(201);
  });

  it('never blocks a pro account regardless of project count', async () => {
    const ts = Date.now();
    const cookie = await registerUser(`proj-pro-${ts}@test.com`);
    const userId = await extractUserIdFromCookie(cookie);
    if (userId) await setUserPlanTier(userId, 'pro');

    // Create 4 projects — should all succeed
    for (let i = 0; i < 4; i++) {
      const r = await createProject(cookie);
      expect(r.status).toBe(201);
    }
  });
});

// ── POST /api/projects/:id/workers — worker quota enforcement ────────────────

describe('POST /api/projects/:id/workers — quota enforcement', () => {
  it('returns 409 with upgradeRequired when starter account reaches 25-worker cap', async () => {
    const ts = Date.now();
    const cookie = await registerUser(`worker-quota-${ts}@test.com`);

    const projRes = await createProject(cookie);
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data?.project?.id as string;

    // Create 25 workers (cap for starter)
    for (let i = 0; i < 25; i++) {
      const r = await createWorkerOnProject(cookie, projectId);
      expect(r.status).toBe(201);
    }

    // 26th worker must be rejected
    const overflow = await createWorkerOnProject(cookie, projectId);
    expect(overflow.status).toBe(409);
    expect(overflow.body.upgradeRequired).toBe(true);
    expect(overflow.body.error).toMatch(/worker limit/i);
  }, 30000);

  it('allows adding a worker below the 25-worker cap', async () => {
    const cookie = await registerUser(`worker-below-cap-${Date.now()}@test.com`);
    const projRes = await createProject(cookie);
    const projectId = projRes.body.data?.project?.id as string;

    const r = await createWorkerOnProject(cookie, projectId);
    expect(r.status).toBe(201);
  });

  it('never blocks a pro account from adding workers', async () => {
    const ts = Date.now();
    const cookie = await registerUser(`worker-pro-${ts}@test.com`);
    const userId = await extractUserIdFromCookie(cookie);
    if (userId) await setUserPlanTier(userId, 'pro');

    const projRes = await createProject(cookie);
    const projectId = projRes.body.data?.project?.id as string;

    // Add 3 workers without hitting any cap
    for (let i = 0; i < 3; i++) {
      const r = await createWorkerOnProject(cookie, projectId);
      expect(r.status).toBe(201);
    }
  });
});
