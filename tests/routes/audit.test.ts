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

  it('returns evidence summary counts for audit and payroll evidence', async () => {
    const cookie = await registerAndLogin('evidence-summary');
    const projectId = await createProject(cookie);
    await seedAuditLogs(projectId, 2);

    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-04-10', payrollNumber: 1 });
    expect(weekRes.status).toBe(201);

    const submitRes = await supertest(app)
      .patch(`/api/payroll/weeks/${weekRes.body.id}/submit`)
      .set('Cookie', cookie)
      .send({ submittedAt: '2026-04-11', submittedTo: 'DOL' });
    expect(submitRes.status).toBe(200);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}/evidence-summary`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.auditEventCount).toBeGreaterThanOrEqual(3);
    expect(res.body.data.payrollWeekCount).toBe(1);
    expect(res.body.data.submittedWeekCount).toBe(1);
    expect(res.body.data.unsubmittedWeekCount).toBe(0);
    expect(res.body.data.photoCount).toBe(0);
    expect(res.body.data.timePunchCount).toBe(0);
    expect(res.body.data.readyForPacket).toBe(true);
    expect(res.body.data.missingEvidence).toEqual([]);
    expect(res.body.data.weeks).toEqual([
      expect.objectContaining({
        weekId: weekRes.body.id,
        payrollNumber: 1,
        weekEndingDate: '2026-04-10',
        submitted: true,
        weekPhotoCount: 0,
        timePunchCount: 0,
        readyForPacket: true,
        missingEvidence: [],
      }),
    ]);
    expect(res.body.data.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'payroll_submissions',
          requiredCount: 1,
          collectedCount: 1,
          status: 'complete',
        }),
        expect.objectContaining({
          key: 'photo_evidence',
          requiredCount: 0,
          collectedCount: 0,
          status: 'not_applicable',
        }),
      ]),
    );
    expect(typeof res.body.data.latestAuditAt).toBe('string');
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

describe('GET /api/audit/:projectId/evidence-packet', () => {
  it('returns 403 for unauthorized user', async () => {
    const ownerCookie = await registerAndLogin('packet-owner');
    const otherCookie = await registerAndLogin('packet-other');
    const projectId = await createProject(ownerCookie);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}/evidence-packet`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('exports JSON packet with summary and evidence rows', async () => {
    const cookie = await registerAndLogin('packet-json');
    const projectId = await createProject(cookie);
    await seedAuditLogs(projectId, 2);

    const weekRes = await supertest(app)
      .post('/api/payroll/weeks')
      .set('Cookie', cookie)
      .send({ projectId, weekEndingDate: '2026-04-17', payrollNumber: 2 });
    expect(weekRes.status).toBe(201);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}/evidence-packet`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toContain('evidence-packet');
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.summary.payrollWeekCount).toBe(1);
    expect(res.body.manifest.readyForPacket).toBe(false);
    expect(res.body.manifest.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'workers', included: false }),
        expect.objectContaining({ id: 'payroll-entries', included: false }),
        expect.objectContaining({ id: 'forms', included: true }),
      ]),
    );
    expect(res.body.methodology.version).toMatch(/prevailing-wage/);
    expect(res.body.summary.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'payroll_submissions', status: 'missing' }),
      ]),
    );
    expect(Array.isArray(res.body.wageDeterminations)).toBe(true);
    expect(Array.isArray(res.body.workers)).toBe(true);
    expect(res.body.payrollWeeks).toHaveLength(1);
    expect(Array.isArray(res.body.payrollEntries)).toBe(true);
    expect(res.body.submitReadyWeeks).toHaveLength(1);
    expect(res.body.complianceEvidenceWeeks).toEqual([
      expect.objectContaining({
        week: expect.objectContaining({ id: weekRes.body.id }),
        methodologyVersion: expect.stringMatching(/prevailing-wage/),
      }),
    ]);
    expect(Array.isArray(res.body.payrollImports)).toBe(true);
    expect(Array.isArray(res.body.subcontractors)).toBe(true);
    expect(Array.isArray(res.body.subcontractorCertifications)).toBe(true);
    expect(Array.isArray(res.body.subcontractorCprWeeks)).toBe(true);
    expect(Array.isArray(res.body.contractorSignatures)).toBe(true);
    expect(res.body.auditEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('exports CSV packet with requirements and audit sections', async () => {
    const cookie = await registerAndLogin('packet-csv');
    const projectId = await createProject(cookie);
    await seedAuditLogs(projectId, 1);

    const res = await supertest(app)
      .get(`/api/audit/${projectId}/evidence-packet?format=csv`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Requirements');
    expect(res.text).toContain('Manifest');
    expect(res.text).toContain('Wage Determinations');
    expect(res.text).toContain('Workers');
    expect(res.text).toContain('Payroll Entries');
    expect(res.text).toContain('Submit-Ready Reviews');
    expect(res.text).toContain('Compliance Evidence');
    expect(res.text).toContain('Payroll Imports');
    expect(res.text).toContain('Subcontractors');
    expect(res.text).toContain('Subcontractor Certifications');
    expect(res.text).toContain('Subcontractor CPR');
    expect(res.text).toContain('Contractor Signatures');
    expect(res.text).toContain('Audit Events');
    expect(res.text).toContain('Project audit trail');
  });
});
