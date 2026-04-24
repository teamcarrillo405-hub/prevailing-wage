import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

describe('POST /api/auth/register', () => {
  it('creates a new user and returns 201 with pw_session cookie', async () => {
    const email = `register-${Date.now()}@test.com`;
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.data?.user?.email).toBe(email);
    expect(res.body.data?.user?.id).toBeDefined();
    const cookies = res.headers['set-cookie'] as string[] | string;
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieArr.some((c: string) => c.startsWith('pw_session='))).toBe(true);
  });

  it('returns 409 when email already registered', async () => {
    const email = `dup-${Date.now()}@test.com`;
    await supertest(app).post('/api/auth/register').send({ email, password: 'password123' });
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('returns 400 when password is fewer than 8 characters', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ email: `short-${Date.now()}@test.com`, password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  describe('invite code gating', () => {
    it('returns 403 when INVITE_CODE is set and no code provided', async () => {
      process.env.INVITE_CODE = 'secret-abc-123';
      try {
        const res = await supertest(app)
          .post('/api/auth/register')
          .send({ email: `noinvite-${Date.now()}@test.com`, password: 'password123' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Invalid invitation code');
      } finally {
        delete process.env.INVITE_CODE;
      }
    });

    it('returns 201 when INVITE_CODE is set and correct code provided', async () => {
      process.env.INVITE_CODE = 'secret-abc-123';
      try {
        const res = await supertest(app)
          .post('/api/auth/register')
          .send({ email: `withinvite-${Date.now()}@test.com`, password: 'password123', inviteCode: 'secret-abc-123' });
        expect(res.status).toBe(201);
      } finally {
        delete process.env.INVITE_CODE;
      }
    });

    it('returns 201 when INVITE_CODE env var is absent (open registration)', async () => {
      delete process.env.INVITE_CODE;
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ email: `openreg-${Date.now()}@test.com`, password: 'password123' });
      expect(res.status).toBe(201);
    });
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 with pw_session cookie on valid credentials', async () => {
    const email = `login-${Date.now()}@test.com`;
    await supertest(app).post('/api/auth/register').send({ email, password: 'password123' });
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email, password: 'password123' });
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as string[] | string;
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieArr.some((c: string) => c.startsWith('pw_session='))).toBe(true);
  });

  it('returns 401 on wrong password', async () => {
    const email = `wrongpw-${Date.now()}@test.com`;
    await supertest(app).post('/api/auth/register').send({ email, password: 'password123' });
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when email not found (prevents user enumeration)', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: `notfound-${Date.now()}@test.com`, password: 'password123' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears pw_session cookie and returns 200', async () => {
    const res = await supertest(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    // Cookie should be cleared (max-age=0 or expires in past)
    const cookies = res.headers['set-cookie'] as string[] | string | undefined;
    if (cookies) {
      const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArr.find((c: string) => c.startsWith('pw_session='));
      if (sessionCookie) {
        expect(sessionCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
      }
    }
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user when authenticated', async () => {
    const email = `me-${Date.now()}@test.com`;
    const registerRes = await supertest(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123' });
    const cookies = registerRes.headers['set-cookie'] as string[] | string;
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;

    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Cookie', cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data?.user?.email).toBe(email);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
