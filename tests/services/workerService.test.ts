import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';

// Set env vars before any module with startup assertions
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// Dynamic imports AFTER env setup to avoid cryptoService process.exit
const { app } = await import('../../src/server/index.js');
const { getDb } = await import('../../src/server/db/index.js');
const { auditLogs } = await import('../../src/server/db/schema.js');
const { eq, and } = await import('drizzle-orm');

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string) {
  const email = `worker-audit-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Worker Audit Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  return res.body.data?.project?.id as string;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Worker CRUD audit logging', () => {
  it('worker.created audit log: POST worker produces audit row with correct fields', async () => {
    const cookie = await registerAndLogin('created');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Alice Carpenter', tradeUnion: 'IBEW Local 47' });

    expect(res.status).toBe(201);
    const workerId = res.body.data?.worker?.id as string;
    expect(workerId).toBeTruthy();

    const db = getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, 'worker'),
        eq(auditLogs.entityId, workerId),
        eq(auditLogs.action, 'worker.created'),
      ));

    expect(rows.length).toBe(1);
    expect(rows[0].userEmail).toBeTruthy();
    const snapshot = JSON.parse(rows[0].snapshot!);
    expect(snapshot.name).toBe('Alice Carpenter');
    expect(snapshot.id).toBe(workerId);
  });

  it('worker.updated audit log: PUT worker produces audit row with diff payload', async () => {
    const cookie = await registerAndLogin('updated');
    const projectId = await createProject(cookie);

    // Create worker
    const createRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Bob Builder' });
    const workerId = createRes.body.data?.worker?.id as string;

    // Update worker
    const updateRes = await supertest(app)
      .put(`/api/projects/${projectId}/workers/${workerId}`)
      .set('Cookie', cookie)
      .send({ name: 'Bob Updated' });

    expect(updateRes.status).toBe(200);

    const db = getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, 'worker'),
        eq(auditLogs.entityId, workerId),
        eq(auditLogs.action, 'worker.updated'),
      ));

    expect(rows.length).toBe(1);
    const diff = JSON.parse(rows[0].diff!);
    expect(diff.before.name).toBe('Bob Builder');
    expect(diff.after.name).toBe('Bob Updated');
  });

  it('worker.deleted audit log: DELETE worker produces audit row with snapshot', async () => {
    const cookie = await registerAndLogin('deleted');
    const projectId = await createProject(cookie);

    // Create worker
    const createRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Carol DeletedWorker' });
    const workerId = createRes.body.data?.worker?.id as string;

    // Delete worker
    const deleteRes = await supertest(app)
      .delete(`/api/projects/${projectId}/workers/${workerId}`)
      .set('Cookie', cookie);

    expect(deleteRes.status).toBe(200);

    const db = getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, 'worker'),
        eq(auditLogs.entityId, workerId),
        eq(auditLogs.action, 'worker.deleted'),
      ));

    expect(rows.length).toBe(1);
    const snapshot = JSON.parse(rows[0].snapshot!);
    expect(snapshot.name).toBe('Carol DeletedWorker');
  });

  it('ssnEncrypted is redacted in audit snapshot when SSN provided', async () => {
    const cookie = await registerAndLogin('ssn-redact');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Dave SSNWorker', ssn: '123456789' });

    expect(res.status).toBe(201);
    const workerId = res.body.data?.worker?.id as string;

    const db = getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, 'worker'),
        eq(auditLogs.entityId, workerId),
        eq(auditLogs.action, 'worker.created'),
      ));

    expect(rows.length).toBe(1);
    const snapshot = JSON.parse(rows[0].snapshot!);
    expect(snapshot.ssnEncrypted).toBe('[REDACTED]');
  });
});
