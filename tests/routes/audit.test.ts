import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// Dynamic imports AFTER env setup to avoid cryptoService process.exit
const { app } = await import('../../src/server/index.js');
const { getDb } = await import('../../src/server/db/index.js');
const { auditLogs } = await import('../../src/server/db/schema.js');
const { randomUUID } = await import('crypto');

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string) {
  const email = `audit-route-${suffix}-${Date.now()}@test.com`;
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
      name: 'Audit Route Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  return res.body.data?.project?.id as string;
}

async function seedAuditLogs(
  projectId: string,
  rowCount: number,
  entityType?: string,
  baseDate?: string,
) {
  const db = getDb();
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const ts = new Date(`${baseDate ?? '2026-04-01'}T00:00:${String(i).padStart(2, '0')}.000Z`).toISOString();
    rows.push({
      id: randomUUID(),
      createdAt: ts,
      userId: null,
      userEmail: null,
      ipAddress: null,
      projectId,
      entityType: entityType ?? (i % 2 === 0 ? 'worker' : 'payroll_entry'),
      entityId: randomUUID(),
      action: 'update',
      diff: null,
      snapshot: null,
      meta: null,
    });
  }
  for (const row of rows) {
    await db.insert(auditLogs).values(row);
  }
  return rows;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/audit/:projectId', () => {
  it('returns 403 for non-member', async () => {
    const cookieA = await registerAndLogin('non-member-a');
    const cookieB = await registerAndLogin('non-member-b');
    const projectId = await createProject(cookieA);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(403);
  });

  it('returns 404 for invalid projectId', async () => {
    const cookie = await registerAndLogin('404-test');
    const res = await supertest(app)
      .get('/api/audit/nonexistent-project-id')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('returns correct envelope for empty project', async () => {
    const cookie = await registerAndLogin('empty-proj');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 0,
    });
  });

  it('returns 25 items on page 1 when 30 rows exist', async () => {
    const cookie = await registerAndLogin('page1-test');
    const projectId = await createProject(cookie);
    await seedAuditLogs(projectId, 30);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}?page=1`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(25);
    expect(res.body.total).toBe(30);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(25);
  });

  it('returns 5 items on page 2 when 30 rows exist', async () => {
    const cookie = await registerAndLogin('page2-test');
    const projectId = await createProject(cookie);
    await seedAuditLogs(projectId, 30);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}?page=2`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(5);
  });

  it('returns items in reverse-chronological order', async () => {
    const cookie = await registerAndLogin('order-test');
    const projectId = await createProject(cookie);
    await seedAuditLogs(projectId, 5);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}?page=1`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const items = res.body.items as Array<{ createdAt: string }>;
    expect(items.length).toBeGreaterThan(1);
    for (let i = 0; i < items.length - 1; i++) {
      expect(items[i].createdAt >= items[i + 1].createdAt).toBe(true);
    }
  });

  it('filters by date range (from/to)', async () => {
    const cookie = await registerAndLogin('date-filter');
    const projectId = await createProject(cookie);
    // Seed 3 rows on 2026-04-01 and 3 rows on 2026-04-02
    await seedAuditLogs(projectId, 3, 'worker', '2026-04-01');
    await seedAuditLogs(projectId, 3, 'worker', '2026-04-02');

    const res = await supertest(app)
      .get(`/api/audit/${projectId}?from=2026-04-02&to=2026-04-02`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const items = res.body.items as Array<{ createdAt: string }>;
    for (const item of items) {
      expect(item.createdAt.startsWith('2026-04-02')).toBe(true);
    }
  });

  it('filters by entityType', async () => {
    const cookie = await registerAndLogin('entity-filter');
    const projectId = await createProject(cookie);
    // Seed mixed: 3 workers, 4 payroll_entry
    await seedAuditLogs(projectId, 3, 'worker');
    await seedAuditLogs(projectId, 4, 'payroll_entry');

    const res = await supertest(app)
      .get(`/api/audit/${projectId}?entityType=worker`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const items = res.body.items as Array<{ entityType: string }>;
    for (const item of items) {
      expect(item.entityType).toBe('worker');
    }
  });

  it('parses JSON columns (meta) into objects', async () => {
    const cookie = await registerAndLogin('json-parse');
    const projectId = await createProject(cookie);
    const db = getDb();
    await db.insert(auditLogs).values({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      userId: null,
      userEmail: null,
      ipAddress: null,
      projectId,
      entityType: 'worker',
      entityId: randomUUID(),
      action: 'create',
      diff: null,
      snapshot: null,
      meta: JSON.stringify({ key: 'val' }),
    });

    const res = await supertest(app)
      .get(`/api/audit/${projectId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].meta).toEqual({ key: 'val' });
    expect(typeof res.body.items[0].meta).toBe('object');
  });
});

// ── AUDIT-05: CSV Export ───────────────────────────────────────────────────

describe('GET /api/audit/:projectId/csv', () => {
  it('returns 403 for unauthorized user (non-owner)', async () => {
    const ownerCookie = await registerAndLogin('csv-owner');
    const otherCookie = await registerAndLogin('csv-other');
    const projectId = await createProject(ownerCookie);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}/csv`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('returns 200 with CSV content-type for authorized user', async () => {
    const cookie = await registerAndLogin('csv-200');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}/csv`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  it('CSV starts with UTF-8 BOM (EF BB BF)', async () => {
    const cookie = await registerAndLogin('csv-bom');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}/csv`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.body[0]).toBe(0xef);
    expect(res.body[1]).toBe(0xbb);
    expect(res.body[2]).toBe(0xbf);
  });

  it('formula injection: action starting with = is prefixed with single quote', async () => {
    const cookie = await registerAndLogin('csv-inject');
    const projectId = await createProject(cookie);
    const db = getDb();

    await db.insert(auditLogs).values({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      userId: null,
      userEmail: 'csv-inject@test.com',
      ipAddress: null,
      projectId,
      entityType: 'worker',
      entityId: randomUUID(),
      action: '=HYPERLINK("http://evil.com","Click")',
      diff: null,
      snapshot: null,
      meta: JSON.stringify({ workerName: 'Test Worker' }),
    });

    const res = await supertest(app)
      .get(`/api/audit/${projectId}/csv`)
      .set('Cookie', cookie);

    expect(res.text).toContain("'=HYPERLINK");
  });
});
