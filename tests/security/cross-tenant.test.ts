import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

// ── Helpers ────────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email: `cross-tenant-${suffix}-${Date.now()}@test.com`, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string, name: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name,
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  return res.body.data?.project?.id as string;
}

async function createPayrollWeek(cookie: string, projectId: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: '2025-01-05', payrollNumber: 1 });
  return res.body.id as string;
}

async function createWorker(cookie: string, projectId: string, name: string): Promise<string> {
  const res = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({
      name,
      address: '123 Main St, Los Angeles, CA 90001',
    });
  return res.body.data?.worker?.id as string;
}

// ── Setup ──────────────────────────────────────────────────────────────────

describe('Cross-tenant IDOR protection', () => {
  let cookieA: string;
  let cookieB: string;
  let projectIdA: string;
  let projectIdB: string;
  let weekIdA: string;
  let workerIdA: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
    process.env.NODE_ENV = 'test';

    cookieA = await registerAndLogin('cross-a');
    cookieB = await registerAndLogin('cross-b');

    // Create one project per user — POST /api/projects inserts project_members row automatically
    projectIdA = await createProject(cookieA, 'Project Alpha');
    projectIdB = await createProject(cookieB, 'Project Beta');

    // Create a payroll week under userA's project (for export.ts route test)
    weekIdA = await createPayrollWeek(cookieA, projectIdA);

    // Create a worker under userA's project (for compliance worker history route test)
    workerIdA = await createWorker(cookieA, projectIdA, 'Alice Worker');
  });

  // ── projects.ts (3 routes) ─────────────────────────────────────────────

  it('GET /api/projects/:id — userB gets 403 on userA project', async () => {
    const res = await supertest(app)
      .get(`/api/projects/${projectIdA}`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });

  it('PATCH /api/projects/:id — userB gets 403 on userA project', async () => {
    const res = await supertest(app)
      .patch(`/api/projects/${projectIdA}`)
      .set('Cookie', cookieB)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('DELETE /api/projects/:id — userB gets 403 on userA project', async () => {
    // Use a throwaway project so userA's main project remains for other tests
    const throwawayId = await createProject(cookieA, 'Throwaway');
    const res = await supertest(app)
      .delete(`/api/projects/${throwawayId}`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });

  // ── workers.ts (2 routes) — mounted at /api/projects ─────────────────

  it('GET /api/projects/:projectId/workers — userB gets 403 on userA project', async () => {
    const res = await supertest(app)
      .get(`/api/projects/${projectIdA}/workers`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });

  it('POST /api/projects/:projectId/workers — userB gets 403 on userA project', async () => {
    const res = await supertest(app)
      .post(`/api/projects/${projectIdA}/workers`)
      .set('Cookie', cookieB)
      .send({ name: 'Ghost Worker', trade: 'Laborer' });
    expect(res.status).toBe(403);
  });

  // ── reports.ts (1 route) ───────────────────────────────────────────────

  it('GET /api/reports/:projectId/fringe-summary — userB gets 403 on userA project', async () => {
    const res = await supertest(app)
      .get(`/api/reports/${projectIdA}/fringe-summary`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });

  // ── compliance.ts (1 route) ────────────────────────────────────────────

  it('GET /api/compliance/project/:projectId — userB gets 403 on userA project', async () => {
    const res = await supertest(app)
      .get(`/api/compliance/project/${projectIdA}`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });

  // ── compliance.ts — worker history route ──────────────────────────────

  it('GET /api/compliance/worker/:workerId/history — userB gets 403 on userA worker', async () => {
    const res = await supertest(app)
      .get(`/api/compliance/worker/${workerIdA}/history`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });

  // ── export.ts (1 route — week-scoped, project resolved via payroll week) ─

  it('GET /api/export/wh347/:weekId — userB gets 403 on userA payroll week', async () => {
    const res = await supertest(app)
      .get(`/api/export/wh347/${weekIdA}`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });

  // ── payroll.ts (1 route) ───────────────────────────────────────────────

  it('GET /api/payroll/projects/:projectId/weeks — userB gets 403 on userA project', async () => {
    const res = await supertest(app)
      .get(`/api/payroll/projects/${projectIdA}/weeks`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });

  // ── Symmetric + positive controls ─────────────────────────────────────

  it('GET /api/projects/:id — userA gets 403 on userB project (symmetric)', async () => {
    const res = await supertest(app)
      .get(`/api/projects/${projectIdB}`)
      .set('Cookie', cookieA);
    expect(res.status).toBe(403);
  });

  it('GET /api/projects/:id — userA gets 200 on their own project', async () => {
    const res = await supertest(app)
      .get(`/api/projects/${projectIdA}`)
      .set('Cookie', cookieA);
    expect(res.status).toBe(200);
  });
});
