import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import supertest from 'supertest';

/**
 * Phase 123-02 SEC-03: Audit hash chain integrity-check integration tests.
 *
 * Tests:
 *   1. Happy path — 3 chained rows → valid:true, scanned:3
 *   2. Tamper detection — corrupted entry_hash → valid:false, brokenAt set
 *   3. Auth guard — unauthenticated GET → 401
 *   4. computeAuditEntryHash determinism — SHA-256 formula cross-check
 *   5. (Task 4) Backfill — pre-chain (null entry_hash) rows → after runBackfill valid:true
 *   6. (Task 4) Backfill idempotency — second runBackfill reports backfilled:0
 *
 * Bootstrap pattern mirrors tests/routes/audit.test.ts:
 *   - Shared app import + in-memory DB via getDb()
 *   - registerAndLogin → cookie string for auth
 *   - createProject → projectId for scoped audit log inserts
 *   - beforeEach: delete all audit_logs rows
 */

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// Dynamic imports AFTER env setup
const { app } = await import('../../src/server/index.js');
const { getDb } = await import('../../src/server/db/index.js');
const { auditLogs } = await import('../../src/server/db/schema.js');
const { users } = await import('../../src/server/db/schema.js');
const { randomUUID } = await import('crypto');
const { insertAuditLog, computeAuditEntryHash } = await import('../../src/server/services/auditService.js');
const { eq } = await import('drizzle-orm');

// ── Auth helpers ────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string): Promise<{ cookie: string; userId: string; userEmail: string }> {
  const userEmail = `integrity-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email: userEmail, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  const cookie = Array.isArray(cookies) ? cookies.join('; ') : cookies;

  // Get userId from DB
  const db = getDb();
  const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.email, userEmail)).limit(1);
  return { cookie, userId: userRow?.id ?? '', userEmail };
}

async function createProject(cookie: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Integrity Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  return res.body.data?.project?.id as string;
}

// ── Shared state ────────────────────────────────────────────────────────────

let cookie: string;
let userId: string;
let userEmail: string;
let projectId: string;

beforeAll(async () => {
  ({ cookie, userId, userEmail } = await registerAndLogin('chain'));
  projectId = await createProject(cookie);
});

beforeEach(async () => {
  // Clear audit_logs between tests for isolation
  const db = getDb();
  await db.delete(auditLogs);
});

// ── Helper: build a minimal InsertAuditLogInput ─────────────────────────────

function auditInput(action: string) {
  return {
    userId,
    userEmail,
    ipAddress: null,
    projectId,
    entityType: 'project',
    entityId: projectId,
    action,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/audit/integrity-check', () => {
  it('Test 1 — happy path: 3 sequential inserts produce valid:true, scanned:3', async () => {
    await insertAuditLog(auditInput('project.created'));
    await new Promise(r => setTimeout(r, 5));
    await insertAuditLog(auditInput('project.updated'));
    await new Promise(r => setTimeout(r, 5));
    await insertAuditLog(auditInput('project.deleted'));

    const res = await supertest(app)
      .get('/api/audit/integrity-check')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.scanned).toBe(3);
  });

  it('Test 2 — tamper detection: corrupted entry_hash returns valid:false and brokenAt', async () => {
    const db = getDb();

    await insertAuditLog(auditInput('project.created'));
    await new Promise(r => setTimeout(r, 5));
    await insertAuditLog(auditInput('project.updated'));
    await new Promise(r => setTimeout(r, 5));
    await insertAuditLog(auditInput('project.deleted'));

    // Get middle row
    const rows = await db.select().from(auditLogs).orderBy(auditLogs.createdAt);
    expect(rows).toHaveLength(3);
    const targetId = rows[1].id;

    // Corrupt the middle row's entry_hash
    await db
      .update(auditLogs)
      .set({ entryHash: 'deadbeef' + '0'.repeat(56) })
      .where(eq(auditLogs.id, targetId));

    const res = await supertest(app)
      .get('/api/audit/integrity-check')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.brokenAt).toBeDefined();
    // brokenAt is { id, createdAt, reason } per verifyAuditChain return type
    expect(res.body.data.brokenAt.id).toBe(targetId);
  });

  it('Test 3 — auth guard: unauthenticated GET returns 401', async () => {
    const res = await supertest(app).get('/api/audit/integrity-check');
    expect([401, 403]).toContain(res.status);
  });

  it('Test 4 — computeAuditEntryHash determinism and SHA-256 formula cross-check', async () => {
    const { createHash } = await import('node:crypto');

    const id = '00000000-0000-4000-8000-000000000001';
    const action = 'project.created';
    const prevHash = 'abcd1234';
    const createdAt = '2026-04-29T00:00:00.000Z';

    // Must be deterministic
    const h1 = computeAuditEntryHash(id, action, prevHash, createdAt);
    const h2 = computeAuditEntryHash(id, action, prevHash, createdAt);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);

    // Must match explicit SHA-256 of `id|action|prevHash|createdAt`
    const expected = createHash('sha256')
      .update(`${id}|${action}|${prevHash}|${createdAt}`, 'utf8')
      .digest('hex');
    expect(h1).toBe(expected);

    // null prevHash is treated as empty string
    const hNull = computeAuditEntryHash(id, action, null, createdAt);
    const expectedNull = createHash('sha256')
      .update(`${id}|${action}||${createdAt}`, 'utf8')
      .digest('hex');
    expect(hNull).toBe(expectedNull);
    expect(hNull).not.toBe(h1); // null vs non-null prevHash must differ
  });
});

// ── Task 4: Backfill tests ──────────────────────────────────────────────────

describe('backfill — pre-chain rows', () => {
  // Import the backfill function (lazily, after env setup)
  let runBackfill: (db?: ReturnType<typeof getDb>) => Promise<{
    scanned: number;
    alreadyHashed: number;
    backfilled: number;
  }>;

  beforeAll(async () => {
    const mod = await import('../../scripts/backfill-audit-hash-chain.js');
    runBackfill = mod.runBackfill;
  });

  beforeEach(async () => {
    const db = getDb();
    await db.delete(auditLogs);
  });

  it('Test 5 — runBackfill computes entry_hash + previous_hash for null-hash rows; integrity-check returns valid:true', async () => {
    const db = getDb();

    // 1. Seed 3 pre-chain rows directly (bypass insertAuditLog to keep entry_hash NULL)
    const baseTs = new Date('2026-04-25T12:00:00.000Z').getTime();
    const seeds = [
      { id: randomUUID(), action: 'project.created',  createdAt: new Date(baseTs).toISOString() },
      { id: randomUUID(), action: 'project.updated',  createdAt: new Date(baseTs + 1000).toISOString() },
      { id: randomUUID(), action: 'project.deleted',  createdAt: new Date(baseTs + 2000).toISOString() },
    ];

    for (const s of seeds) {
      await db.insert(auditLogs).values({
        id: s.id,
        userId,
        userEmail,
        ipAddress: null,
        projectId,
        entityType: 'project',
        entityId: projectId,
        action: s.action,
        createdAt: s.createdAt,
        previousHash: null,
        entryHash: null,
        diff: null,
        snapshot: null,
        meta: null,
      });
    }

    // 2. Run the backfill against the same in-memory DB handle
    const report = await runBackfill(db);
    expect(report.backfilled).toBe(3);
    expect(report.alreadyHashed).toBe(0);
    expect(report.scanned).toBe(3);

    // 3. Read rows back and assert chain linkage
    const rows = await db.select().from(auditLogs).orderBy(auditLogs.createdAt, auditLogs.id);
    expect(rows).toHaveLength(3);

    expect(rows[0].previousHash).toBeNull();
    expect(rows[0].entryHash).toMatch(/^[a-f0-9]{64}$/);

    expect(rows[1].previousHash).toBe(rows[0].entryHash);
    expect(rows[1].entryHash).toMatch(/^[a-f0-9]{64}$/);

    expect(rows[2].previousHash).toBe(rows[1].entryHash);
    expect(rows[2].entryHash).toMatch(/^[a-f0-9]{64}$/);

    // 4. Cross-check: every entry_hash equals computeAuditEntryHash(...) — proves no formula drift
    for (const r of rows) {
      const expected = computeAuditEntryHash(r.id, r.action, r.previousHash, r.createdAt);
      expect(r.entryHash).toBe(expected);
    }

    // 5. integrity-check now returns valid:true, scanned:3
    const res = await supertest(app)
      .get('/api/audit/integrity-check')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.scanned).toBe(3);
  });

  it('Test 6 — runBackfill is idempotent (re-running on fully-hashed table reports backfilled:0)', async () => {
    const db = getDb();

    // Seed 3 pre-chain rows
    const baseTs = new Date('2026-04-25T14:00:00.000Z').getTime();
    for (let i = 0; i < 3; i++) {
      await db.insert(auditLogs).values({
        id: randomUUID(),
        userId,
        userEmail,
        ipAddress: null,
        projectId,
        entityType: 'project',
        entityId: projectId,
        action: `project.action${i}`,
        createdAt: new Date(baseTs + i * 1000).toISOString(),
        previousHash: null,
        entryHash: null,
        diff: null,
        snapshot: null,
        meta: null,
      });
    }

    // First run: backfills all 3
    const first = await runBackfill(db);
    expect(first.backfilled).toBe(3);

    // Second run: all rows already hashed → backfilled:0
    const second = await runBackfill(db);
    expect(second.backfilled).toBe(0);
    expect(second.alreadyHashed).toBe(3);
    expect(second.scanned).toBe(3);
  });
});
