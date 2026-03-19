import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import { SignJWT } from 'jose';
import { requireAuth, optionalAuth } from '../../src/server/middleware/auth.js';

const JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

function getSecret(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET);
}

async function makeToken(
  payload: Record<string, unknown>,
  expiresIn = '7d',
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

async function makeExpiredToken(): Promise<string> {
  // expired 1 hour ago
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ userId: 'u1', email: 'a@b.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now - 3700)
    .setExpirationTime(now - 3600)
    .sign(getSecret());
}

function buildApp(middleware: typeof requireAuth) {
  const app = express();
  app.use(cookieParser());
  app.get('/protected', middleware, (req, res) => {
    res.json({ user: (req as any).user });
  });
  return app;
}

describe('requireAuth middleware', () => {
  it('passes request when valid pw_session cookie present', async () => {
    const token = await makeToken({ userId: 'u1', email: 'a@b.com' });
    const app = buildApp(requireAuth);
    const res = await supertest(app)
      .get('/protected')
      .set('Cookie', `pw_session=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe('u1');
  });

  it('attaches req.user with userId and email on success', async () => {
    const token = await makeToken({ userId: 'u42', email: 'user@example.com' });
    const app = buildApp(requireAuth);
    const res = await supertest(app)
      .get('/protected')
      .set('Cookie', `pw_session=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe('u42');
    expect(res.body.user.email).toBe('user@example.com');
  });

  it('returns 401 when no cookie present', async () => {
    const app = buildApp(requireAuth);
    const res = await supertest(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT is expired', async () => {
    const token = await makeExpiredToken();
    const app = buildApp(requireAuth);
    const res = await supertest(app)
      .get('/protected')
      .set('Cookie', `pw_session=${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT signature is invalid', async () => {
    const badSecret = new TextEncoder().encode('wrong-secret-that-is-32chars-long!!');
    const token = await new SignJWT({ userId: 'u1', email: 'a@b.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(badSecret);
    const app = buildApp(requireAuth);
    const res = await supertest(app)
      .get('/protected')
      .set('Cookie', `pw_session=${token}`);
    expect(res.status).toBe(401);
  });
});

describe('optionalAuth middleware', () => {
  it('attaches req.user when valid cookie present', async () => {
    const token = await makeToken({ userId: 'u1', email: 'a@b.com' });
    const app = buildApp(optionalAuth as typeof requireAuth);
    const res = await supertest(app)
      .get('/protected')
      .set('Cookie', `pw_session=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe('u1');
  });

  it('calls next() without error when no cookie present', async () => {
    const app = buildApp(optionalAuth as typeof requireAuth);
    const res = await supertest(app).get('/protected');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeUndefined();
  });
});
