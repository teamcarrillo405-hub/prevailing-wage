// tests/routes/integrations.test.ts
// Integration tests for QB integration routes.
// Phase 121 Plan 01 — QB Employee Import (QB-02).

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string): Promise<string> {
  const email = `integrations-route-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'QB Integration Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  expect(res.status).toBe(201);
  return res.body.data?.project?.id as string;
}

// ── QB Integration Routes ─────────────────────────────────────────────────

describe('QB integration routes', () => {
  // Test 1: GET /qbo/employees — unauthenticated returns 401/403
  it('GET /api/integrations/qbo/employees without auth cookie returns 401 or 403', async () => {
    const res = await supertest(app)
      .get('/api/integrations/qbo/employees');
    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  // Test 2: GET /qbo/timeactivities — unauthenticated returns 401/403
  it('GET /api/integrations/qbo/timeactivities without auth cookie returns 401 or 403', async () => {
    const res = await supertest(app)
      .get('/api/integrations/qbo/timeactivities');
    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  // Test 3: POST /qbo/import-employees — unauthenticated returns 401/403
  // RED until Task 2 mounts the route; will pass once route is mounted.
  it('POST /api/integrations/qbo/import-employees without auth cookie returns 401 or 403', async () => {
    const res = await supertest(app)
      .post('/api/integrations/qbo/import-employees')
      .send({ projectId: 'some-project-id', qboIds: ['1'] });
    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  // Test 4: POST /qbo/import-employees — authenticated but missing projectId returns 400
  // RED until Task 2 mounts the route; will pass once route is mounted.
  it('POST /api/integrations/qbo/import-employees with auth but no projectId returns 400 with projectId in error', async () => {
    const cookie = await registerAndLogin('qbo-import-emp-validation');
    const res = await supertest(app)
      .post('/api/integrations/qbo/import-employees')
      .set('Cookie', cookie)
      .send({ employees: [{ qboId: '1', displayName: 'Test' }] });
    expect(res.status).toBe(400);
    expect(String(res.body.error ?? '')).toContain('projectId');
  });

  // Test 5: GET /qbo/timeactivities — authenticated but no startDate/endDate returns 400
  it('GET /api/integrations/qbo/timeactivities with auth but no startDate/endDate returns 400 with startDate in error', async () => {
    const cookie = await registerAndLogin('qbo-timeactivities-regression');
    const res = await supertest(app)
      .get('/api/integrations/qbo/timeactivities')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(String(res.body.error ?? '')).toContain('startDate');
  });
});
