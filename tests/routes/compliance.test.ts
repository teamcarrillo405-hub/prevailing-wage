import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerUser(suffix: string): Promise<string> {
  const email = `compliance-route-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function seedFixture(cookie: string): Promise<{ weekId: string }> {
  const pRes = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Compliance Route Test Project',
      state: 'TX',
      county: 'Travis',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-03-01',
      fundingType: 'federal',
    });
  const projectId = pRes.body.data?.project?.id as string;

  const wRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Route Test Worker' });
  const workerId = wRes.body.data?.worker?.id as string;

  await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
    });

  const wkRes = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: '2025-04-06', payrollNumber: 1 });
  const weekId = wkRes.body.id as string;

  return { weekId };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/compliance/:weekId', () => {
  it('returns 200 with compliance result shape for a valid week', async () => {
    const cookie = await registerUser('200');
    const { weekId } = await seedFixture(cookie);

    const res = await supertest(app)
      .get(`/api/compliance/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.weekId).toBe('string');
    expect(typeof res.body.projectId).toBe('string');
    expect(typeof res.body.hasViolations).toBe('boolean');
    expect(typeof res.body.certProperPayment).toBe('boolean');
    expect(typeof res.body.certAccuratePayroll).toBe('boolean');
  });

  it('returns 403 when the week belongs to a different user', async () => {
    const ownerCookie = await registerUser('owner-403');
    const { weekId } = await seedFixture(ownerCookie);

    // Different user — does not own this week
    const otherCookie = await registerUser('other-403');

    const res = await supertest(app)
      .get(`/api/compliance/${weekId}`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('returns 404 when weekId does not exist', async () => {
    const cookie = await registerUser('404');

    const res = await supertest(app)
      .get('/api/compliance/nonexistent-week-id')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('200 response violations array is an array, not null or undefined', async () => {
    const cookie = await registerUser('violations-array');
    const { weekId } = await seedFixture(cookie);

    const res = await supertest(app)
      .get(`/api/compliance/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.violations)).toBe(true);
  });
});
