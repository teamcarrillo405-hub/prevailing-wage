/**
 * Integration tests for auth routes: POST /api/auth/register, login, logout, GET /api/auth/me
 *
 * Infrastructure notes:
 * - vitest.config.ts runs tests/helpers/db.ts as a setupFile, which creates an
 *   in-memory SQLite DB, runs migrations, and exposes it on globalThis.__testDb.
 * - src/server/db/index.ts uses that global via getDb(), so no extra wiring needed.
 * - The express app checks req.headers.origin on mutating requests; we pass the
 *   allowed origin on every POST to avoid 403s.
 * - Rate limiters use MemoryStore keyed by IP.  The express app has trust proxy=1
 *   so we set X-Forwarded-For per describe block to give each block its own IP
 *   bucket — avoiding 429s when register/login limits are exhausted.
 */

// Env vars must be set before any server module is imported.
// dotenv/config (imported inside index.ts) does NOT override already-set vars,
// so setting these first means our values win over the .env file.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-okay';
// Use the same CORS origin that the .env file specifies so our requests pass the
// origin-check middleware.  If CORS_ORIGIN is already set (e.g. in CI) keep it.
if (!process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN = 'http://localhost:4200';
}
// INVITE_CODE must be absent so register works without an invite.
delete process.env.INVITE_CODE;

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';

// Import app after env vars are set.
import { app } from '../index.js';
import { users } from '../db/schema.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Must match CORS_ORIGIN set above (and in .env for local dev).
const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:4200';

/**
 * Build a supertest request helper that pins a specific fake IP.
 * express-rate-limit keys by IP (trust proxy=1 reads X-Forwarded-For), so each
 * describe block gets its own IP bucket and never races into another block's limit.
 */
function makeRequester(fakeIp: string) {
  return {
    post(path: string) {
      return request(app)
        .post(path)
        .set('Origin', ORIGIN)
        .set('X-Forwarded-For', fakeIp);
    },
    agent() {
      return request
        .agent(app)
        .set('Origin', ORIGIN)
        .set('X-Forwarded-For', fakeIp);
    },
  };
}

// Delete test users by email to keep the DB clean between tests.
async function deleteUser(email: string) {
  const db = (globalThis as any).__testDb;
  if (db) {
    await db.delete(users).where(eq(users.email, email));
  }
}

// ── Shared password ───────────────────────────────────────────────────────────

const TEST_PASSWORD = 'securePassword1';

// ── POST /api/auth/register ───────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  // Dedicated IP: register tests use up to 4 register calls — well under the 5/hr limit.
  const { post } = makeRequester('10.0.0.1');
  const TEST_EMAIL = 'reg-test@example.com';
  const DUP_EMAIL  = 'dup-test@example.com';

  afterEach(async () => {
    await deleteUser(TEST_EMAIL);
    await deleteUser(DUP_EMAIL);
  });

  it('Test 1: returns 201 with user data on valid registration', async () => {
    const res = await post('/api/auth/register').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: TEST_EMAIL });
    expect(res.body.data.user.id).toBeTruthy();
  });

  it('Test 2: sets a session cookie on successful registration', async () => {
    const res = await post('/api/auth/register').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(201);
    const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    expect(cookies.some((c: string) => c.startsWith('pw_session='))).toBe(true);
  });

  it('Test 3: returns 400 on missing email', async () => {
    const res = await post('/api/auth/register').send({ password: TEST_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('Test 4: returns 400 on password too short (< 8 chars)', async () => {
    const res = await post('/api/auth/register').send({
      email: TEST_EMAIL,
      password: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('Test 5: returns 400 on invalid email format', async () => {
    const res = await post('/api/auth/register').send({
      email: 'not-an-email',
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(400);
  });

  it('Test 6: returns 409 on duplicate email', async () => {
    // Use a separate IP so this block's two register calls don't count against
    // the same bucket as Tests 1-5.
    const { post: post2 } = makeRequester('10.0.0.2');

    // First registration — should succeed.
    const first = await post2('/api/auth/register').send({
      email: DUP_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(first.status).toBe(201);

    // Second registration with same email — should conflict.
    const res = await post2('/api/auth/register').send({
      email: DUP_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  // Dedicated IPs: one for setup (register) and one for login tests.
  const { post: regPost } = makeRequester('10.1.0.1');
  const { post: loginPost } = makeRequester('10.1.0.2');
  const LOGIN_EMAIL = 'login-test@example.com';

  beforeAll(async () => {
    // Ensure a known user exists for login tests.
    await deleteUser(LOGIN_EMAIL);
    const res = await regPost('/api/auth/register').send({
      email: LOGIN_EMAIL,
      password: TEST_PASSWORD,
    });
    // Fail fast if setup itself failed (e.g. rate-limited).
    if (res.status !== 201) {
      throw new Error(`Login test setup failed: POST /register returned ${res.status} – ${JSON.stringify(res.body)}`);
    }
  });

  it('Test 7: returns 200 with user data on valid credentials', async () => {
    const res = await loginPost('/api/auth/login').send({
      email: LOGIN_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: LOGIN_EMAIL });
    expect(res.body.data.user.id).toBeTruthy();
  });

  it('Test 8: sets a session cookie on successful login', async () => {
    const res = await loginPost('/api/auth/login').send({
      email: LOGIN_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    expect(cookies.some((c: string) => c.startsWith('pw_session='))).toBe(true);
  });

  it('Test 9: returns 401 on wrong password (not 404)', async () => {
    const res = await loginPost('/api/auth/login').send({
      email: LOGIN_EMAIL,
      password: 'wrongPassword99',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('Test 10: returns 401 on unknown email — timing-attack fix (not 404)', async () => {
    const res = await loginPost('/api/auth/login').send({
      email: 'nobody@example.com',
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('Test 11: returns 400 on missing email field', async () => {
    const res = await loginPost('/api/auth/login').send({ password: TEST_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('Test 12: returns 400 on missing password field', async () => {
    const res = await loginPost('/api/auth/login').send({ email: LOGIN_EMAIL });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  const { post: regPost } = makeRequester('10.2.0.1');
  const { agent: makeAgent } = makeRequester('10.2.0.2');
  const LOGOUT_EMAIL = 'logout-test@example.com';

  beforeAll(async () => {
    await deleteUser(LOGOUT_EMAIL);
    const res = await regPost('/api/auth/register').send({
      email: LOGOUT_EMAIL,
      password: TEST_PASSWORD,
    });
    if (res.status !== 201) {
      throw new Error(`Logout test setup failed: POST /register returned ${res.status} – ${JSON.stringify(res.body)}`);
    }
  });

  it('Test 13: returns 200 and clears the session cookie', async () => {
    const sess = makeAgent();

    // Log in to get a cookie.
    const loginRes = await sess.post('/api/auth/login').send({
      email: LOGOUT_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(loginRes.status).toBe(200);

    const res = await sess.post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/logged out/i);

    // The cleared cookie should have an empty value (Max-Age=0 or Expires in the past).
    const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const sessionCookie = cookies.find((c: string) => c.startsWith('pw_session='));
    expect(sessionCookie).toBeTruthy();
    // express clearCookie sets value to empty string.
    expect(sessionCookie).toMatch(/pw_session=;/);
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  const { post: regPost } = makeRequester('10.3.0.1');
  const { agent: makeAgent } = makeRequester('10.3.0.2');
  const ME_EMAIL = 'me-test@example.com';

  beforeAll(async () => {
    await deleteUser(ME_EMAIL);
    const res = await regPost('/api/auth/register').send({
      email: ME_EMAIL,
      password: TEST_PASSWORD,
    });
    if (res.status !== 201) {
      throw new Error(`Me test setup failed: POST /register returned ${res.status} – ${JSON.stringify(res.body)}`);
    }
  });

  it('Test 14: returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('Test 15: returns 200 with user data when authenticated via cookie', async () => {
    const sess = makeAgent();

    // Log in and keep the session cookie.
    const loginRes = await sess.post('/api/auth/login').send({
      email: ME_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(loginRes.status).toBe(200);

    const res = await sess.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: ME_EMAIL });
    expect(res.body.data.user.id).toBeTruthy();
  });
});
