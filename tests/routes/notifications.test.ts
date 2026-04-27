// tests/routes/notifications.test.ts
// Supertest integration tests for POST and GET /api/notifications/unsubscribe (NOTIF-06).
// Uses the real Express app (with in-memory SQLite test DB) — same pattern as
// tests/routes/projects.test.ts.

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';
import { getDb } from '../../src/server/db/index.js';
import { projects, projectMembers, users } from '../../src/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function registerAndLogin(email: string) {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123!' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string, overrides: Record<string, unknown> = {}) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Notif Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
      ...overrides,
    });
  return res.body?.data?.project as { id: string };
}

async function setProjectSettings(projectId: string, settings: Record<string, unknown>) {
  const db = getDb();
  await db
    .update(projects)
    .set({ projectSettings: JSON.stringify(settings) })
    .where(eq(projects.id, projectId));
}

async function getProjectSettings(projectId: string): Promise<Record<string, unknown> | null> {
  const db = getDb();
  const [row] = await db
    .select({ projectSettings: projects.projectSettings })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!row?.projectSettings) return null;
  return JSON.parse(row.projectSettings);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/notifications/unsubscribe', () => {

  it('Test 1: returns 400 with error when body has no token', async () => {
    const res = await supertest(app)
      .post('/api/notifications/unsubscribe')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('Test 2: returns 404 when token does not match any project', async () => {
    const res = await supertest(app)
      .post('/api/notifications/unsubscribe')
      .send({ token: 'totally-unknown-token-xyz' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Token not found');
  });

  it('Test 3: returns 200 and sets reportSchedule="off" when token is valid', async () => {
    const cookie = await registerAndLogin(`unsub-post-${Date.now()}@test.com`);
    const project = await createProject(cookie);
    const token = `tok-${randomUUID()}`;

    await setProjectSettings(project.id, {
      reportSchedule: 'weekly',
      reportEmail: 'a@b.com',
      reportUnsubscribeToken: token,
      notifyViolations: false,
    });

    const res = await supertest(app)
      .post('/api/notifications/unsubscribe')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Unsubscribed successfully');

    const settings = await getProjectSettings(project.id);
    expect(settings?.reportSchedule).toBe('off');
  });

  it('Test 4: sibling keys in projectSettings are preserved after unsubscribe', async () => {
    const cookie = await registerAndLogin(`unsub-sibling-${Date.now()}@test.com`);
    const project = await createProject(cookie);
    const token = `tok-${randomUUID()}`;

    const originalSettings = {
      reportSchedule: 'weekly',
      reportEmail: 'sibling@example.com',
      reportUnsubscribeToken: token,
      notifyViolations: false,
      lastDueSoonNotifiedAt: '2026-01-01',
    };
    await setProjectSettings(project.id, originalSettings);

    const res = await supertest(app)
      .post('/api/notifications/unsubscribe')
      .send({ token });

    expect(res.status).toBe(200);

    const settings = await getProjectSettings(project.id);
    // reportSchedule changed
    expect(settings?.reportSchedule).toBe('off');
    // siblings preserved
    expect(settings?.reportEmail).toBe('sibling@example.com');
    expect(settings?.reportUnsubscribeToken).toBe(token);
    expect(settings?.notifyViolations).toBe(false);
    expect(settings?.lastDueSoonNotifiedAt).toBe('2026-01-01');
  });

});

describe('GET /api/notifications/unsubscribe', () => {

  it('Test 5: GET with valid token returns 200 HTML response and unsubscribes', async () => {
    const cookie = await registerAndLogin(`unsub-get-${Date.now()}@test.com`);
    const project = await createProject(cookie);
    const token = `tok-${randomUUID()}`;

    await setProjectSettings(project.id, {
      reportSchedule: 'daily',
      reportEmail: 'get@example.com',
      reportUnsubscribeToken: token,
    });

    const res = await supertest(app)
      .get(`/api/notifications/unsubscribe?token=${token}`);

    expect(res.status).toBe(200);
    expect(res.type).toContain('html');
    expect(res.text).toContain('unsubscribed');

    const settings = await getProjectSettings(project.id);
    expect(settings?.reportSchedule).toBe('off');
  });

  it('Test 6: GET with unknown token returns 404 HTML response', async () => {
    const res = await supertest(app)
      .get('/api/notifications/unsubscribe?token=bogus-token-never-set');
    expect(res.status).toBe(404);
    expect(res.type).toContain('html');
  });

  it('Test 7: GET with missing token returns 400 HTML response', async () => {
    const res = await supertest(app)
      .get('/api/notifications/unsubscribe');
    expect(res.status).toBe(400);
    expect(res.type).toContain('html');
  });

});
