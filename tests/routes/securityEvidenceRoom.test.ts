import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

async function registerAndLogin(suffix: string): Promise<string> {
  const email = `security-evidence-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

describe('security evidence room', () => {
  it('packages trust controls and next actions for enterprise review', async () => {
    const cookie = await registerAndLogin('controls');
    const res = await supertest(app)
      .get('/api/security/evidence-room')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.generatedAt).toBeTruthy();
    expect(res.body.data.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'mfa', status: 'action-needed' }),
        expect.objectContaining({ id: 'session-revocation', status: 'implemented' }),
        expect.objectContaining({ id: 'audit-integrity', status: 'implemented' }),
        expect.objectContaining({ id: 'access-boundaries', status: 'implemented' }),
      ]),
    );
    expect(res.body.data.nextActions).toEqual(
      expect.arrayContaining([expect.stringMatching(/Enable TOTP/i)]),
    );
  });
});
