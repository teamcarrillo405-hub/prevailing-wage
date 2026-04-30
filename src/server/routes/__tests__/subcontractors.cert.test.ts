/**
 * Integration tests for DBE certification routes:
 * - DBE-02: GET/POST/PATCH/DELETE /certifications
 * - DBE-04: POST /cpr-weeks gate (CERT_EXPIRED_OR_SUSPENDED)
 * - DBE-05: GET /subcontractors certSummary correctness
 * - DBE-06: Auto-pending when issueDate < '2025-10-03'
 * Plus auth/IDOR guards.
 *
 * Infrastructure: vitest.config.ts setupFile (tests/helpers/db.ts) creates an
 * in-memory SQLite DB and exposes it on globalThis.__testDb. supertest + app
 * from index.js. Rate-limit isolation via unique X-Forwarded-For per describe block.
 */

// Env vars must be set BEFORE any server module is imported.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-okay';
if (!process.env.CORS_ORIGIN) process.env.CORS_ORIGIN = 'http://localhost:4200';
delete process.env.INVITE_CODE;

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq, and } from 'drizzle-orm';

import { app } from '../../index.js';
import {
  users,
  projects,
  projectMembers,
  subcontractors,
  subcontractorCertifications,
  subcontractorCprWeeks,
} from '../../db/schema.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
const TEST_PASSWORD = 'securePassword1';

/**
 * Build a supertest helper that pins a fake IP for rate-limit isolation.
 * express-rate-limit reads X-Forwarded-For via trust proxy=1.
 */
function makeRequester(fakeIp: string) {
  return {
    get(path: string) {
      return request(app).get(path).set('Origin', ORIGIN).set('X-Forwarded-For', fakeIp);
    },
    post(path: string) {
      return request(app).post(path).set('Origin', ORIGIN).set('X-Forwarded-For', fakeIp);
    },
    patch(path: string) {
      return request(app).patch(path).set('Origin', ORIGIN).set('X-Forwarded-For', fakeIp);
    },
    delete(path: string) {
      return request(app).delete(path).set('Origin', ORIGIN).set('X-Forwarded-For', fakeIp);
    },
  };
}

/** Register a user and return the session cookie. */
async function registerAndLogin(
  req: ReturnType<typeof makeRequester>,
  email: string,
): Promise<{ cookie: string; userId: string }> {
  const regRes = await req.post('/api/auth/register').send({ email, password: TEST_PASSWORD });
  if (regRes.status !== 201) {
    throw new Error(`registerAndLogin: register failed ${regRes.status} ${JSON.stringify(regRes.body)}`);
  }
  const setCookie = regRes.headers['set-cookie'] as string[] | string;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookie = cookies.find((c: string) => c.startsWith('pw_session=')) ?? '';
  return { cookie, userId: regRes.body.data.user.id as string };
}

/** Create a project for the authenticated user. */
async function createProject(
  req: ReturnType<typeof makeRequester>,
  cookie: string,
  name: string,
): Promise<{ id: string }> {
  const res = await req.post('/api/projects').set('Cookie', cookie).send({
    name,
    state: 'TX',
    county: 'travis',
    contractType: 'federal-davis-bacon',
    awardDate: '2025-01-01',
    fundingType: 'federal',
  });
  if (res.status !== 201) {
    throw new Error(`createProject failed ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.data.project.id as string };
}

/** Create a subcontractor for the given project. */
async function createSub(
  req: ReturnType<typeof makeRequester>,
  cookie: string,
  projectId: string,
  name: string,
): Promise<{ id: string }> {
  const res = await req
    .post(`/api/projects/${projectId}/subcontractors`)
    .set('Cookie', cookie)
    .send({ name });
  if (res.status !== 201) {
    throw new Error(`createSub failed ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.data.subcontractor.id as string };
}

/** Create a certification for the given sub. */
async function createCert(
  req: ReturnType<typeof makeRequester>,
  cookie: string,
  projectId: string,
  subId: string,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const res = await req
    .post(`/api/projects/${projectId}/subcontractors/${subId}/certifications`)
    .set('Cookie', cookie)
    .send(body);
  if (res.status !== 201) {
    throw new Error(`createCert failed ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.data.certification.id as string };
}

/** Truncate certifications + cpr-weeks (keep users/projects/subs intact for speed). */
async function clearCerts() {
  const db = (globalThis as any).__testDb;
  if (db) {
    await db.delete(subcontractorCprWeeks);
    await db.delete(subcontractorCertifications);
  }
}

// ── A: Auth + IDOR ────────────────────────────────────────────────────────────

describe('certifications — auth + IDOR', () => {
  const req = makeRequester('10.10.0.1');
  let cookieA = '';
  let projectIdA = '';
  let subIdA = '';
  let cookieB = '';
  let projectIdB = '';

  beforeAll(async () => {
    // Register user A + setup
    const a = await registerAndLogin(req, 'cert-idor-a@test.local');
    cookieA = a.cookie;
    const projA = await createProject(req, cookieA, 'IDOR Project A');
    projectIdA = projA.id;
    const subA = await createSub(req, cookieA, projectIdA, 'IDOR Sub A');
    subIdA = subA.id;

    // Register user B + separate project
    const b = await registerAndLogin(req, 'cert-idor-b@test.local');
    cookieB = b.cookie;
    const projB = await createProject(req, cookieB, 'IDOR Project B');
    projectIdB = projB.id;
  });

  afterEach(clearCerts);

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectIdA}/subcontractors/${subIdA}/certifications`)
      .set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });

  it('cross-tenant user B cannot read user A certifications — 403 or 404', async () => {
    const res = await req
      .get(`/api/projects/${projectIdA}/subcontractors/${subIdA}/certifications`)
      .set('Cookie', cookieB);
    expect([403, 404]).toContain(res.status);
  });

  it('PATCH cert whose subcontractorId does not match URL subId returns 404', async () => {
    // Create a cert on subA
    const certId = (await createCert(req, cookieA, projectIdA, subIdA, { certTypes: 'DBE' })).id;
    // Try to access it through a different (non-existent) subId
    const fakeSubId = 'fake-sub-id-does-not-exist';
    const res = await req
      .patch(`/api/projects/${projectIdA}/subcontractors/${fakeSubId}/certifications/${certId}`)
      .set('Cookie', cookieA)
      .send({ certTypes: 'MBE' });
    expect(res.status).toBe(404);
  });
});

// ── B: DBE-02 CRUD ────────────────────────────────────────────────────────────

describe('certifications — DBE-02 CRUD', () => {
  const req = makeRequester('10.10.0.2');
  let cookie = '';
  let projectId = '';
  let subId = '';

  beforeAll(async () => {
    const u = await registerAndLogin(req, 'cert-crud@test.local');
    cookie = u.cookie;
    const proj = await createProject(req, cookie, 'CRUD Project');
    projectId = proj.id;
    const sub = await createSub(req, cookie, projectId, 'CRUD Sub');
    subId = sub.id;
  });

  afterEach(clearCerts);

  it('POST with minimal body returns 201 + reevaluationStatus defaults to not_required', async () => {
    const res = await req
      .post(`/api/projects/${projectId}/subcontractors/${subId}/certifications`)
      .set('Cookie', cookie)
      .send({ certTypes: 'DBE' });
    expect(res.status).toBe(201);
    expect(res.body.data.certification.certTypes).toBe('DBE');
    expect(res.body.data.certification.reevaluationStatus).toBe('not_required');
  });

  it('GET after POST returns the new cert in the list', async () => {
    await createCert(req, cookie, projectId, subId, { certTypes: 'MBE' });
    const res = await req
      .get(`/api/projects/${projectId}/subcontractors/${subId}/certifications`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.certifications.length).toBeGreaterThanOrEqual(1);
    const found = res.body.data.certifications.find((c: any) => c.certTypes === 'MBE');
    expect(found).toBeTruthy();
  });

  it('PATCH expiresDate persists and is reflected by GET', async () => {
    const { id: certId } = await createCert(req, cookie, projectId, subId, { certTypes: 'DBE' });
    const patchRes = await req
      .patch(`/api/projects/${projectId}/subcontractors/${subId}/certifications/${certId}`)
      .set('Cookie', cookie)
      .send({ expiresDate: '2026-01-15' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.certification.expiresDate).toBe('2026-01-15');

    // Verify via GET
    const getRes = await req
      .get(`/api/projects/${projectId}/subcontractors/${subId}/certifications`)
      .set('Cookie', cookie);
    const updated = getRes.body.data.certifications.find((c: any) => c.id === certId);
    expect(updated?.expiresDate).toBe('2026-01-15');
  });

  it('PATCH certifyingAgency: null clears the field (not_undefined guard proves correct)', async () => {
    const { id: certId } = await createCert(req, cookie, projectId, subId, {
      certTypes: 'DBE',
      certifyingAgency: 'Original Agency',
    });
    const patchRes = await req
      .patch(`/api/projects/${projectId}/subcontractors/${subId}/certifications/${certId}`)
      .set('Cookie', cookie)
      .send({ certifyingAgency: null });
    expect(patchRes.status).toBe(200);
    // null is a valid clearing value — must be applied, not coerced back to original
    expect(patchRes.body.data.certification.certifyingAgency).toBeNull();
  });

  it('DELETE removes the cert — GET returns empty list', async () => {
    const { id: certId } = await createCert(req, cookie, projectId, subId, { certTypes: 'WBE' });
    const delRes = await req
      .delete(`/api/projects/${projectId}/subcontractors/${subId}/certifications/${certId}`)
      .set('Cookie', cookie);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.deleted).toBe(true);

    const getRes = await req
      .get(`/api/projects/${projectId}/subcontractors/${subId}/certifications`)
      .set('Cookie', cookie);
    const still = getRes.body.data.certifications.find((c: any) => c.id === certId);
    expect(still).toBeUndefined();
  });
});

// ── C: DBE-06 Auto-pending ────────────────────────────────────────────────────

describe('certifications — DBE-06 auto-pending', () => {
  const req = makeRequester('10.10.0.3');
  let cookie = '';
  let projectId = '';
  let subId = '';

  beforeAll(async () => {
    const u = await registerAndLogin(req, 'cert-dbe06@test.local');
    cookie = u.cookie;
    const proj = await createProject(req, cookie, 'DBE-06 Project');
    projectId = proj.id;
    const sub = await createSub(req, cookie, projectId, 'DBE-06 Sub');
    subId = sub.id;
  });

  afterEach(clearCerts);

  it('issueDate before 2025-10-03 with reevaluationStatus omitted → pending', async () => {
    const res = await req
      .post(`/api/projects/${projectId}/subcontractors/${subId}/certifications`)
      .set('Cookie', cookie)
      .send({ certTypes: 'DBE', issueDate: '2024-05-01' });
    expect(res.status).toBe(201);
    expect(res.body.data.certification.reevaluationStatus).toBe('pending');
  });

  it('issueDate on 2025-10-03 (boundary — on-or-after) keeps not_required', async () => {
    // The rule fires only for issueDate < '2025-10-03' — the boundary itself must NOT fire
    const res = await req
      .post(`/api/projects/${projectId}/subcontractors/${subId}/certifications`)
      .set('Cookie', cookie)
      .send({ certTypes: 'DBE', issueDate: '2025-10-03' });
    expect(res.status).toBe(201);
    expect(res.body.data.certification.reevaluationStatus).toBe('not_required');
  });

  it('explicit reevaluationStatus overrides auto-pending', async () => {
    const res = await req
      .post(`/api/projects/${projectId}/subcontractors/${subId}/certifications`)
      .set('Cookie', cookie)
      .send({ certTypes: 'DBE', issueDate: '2024-05-01', reevaluationStatus: 'cleared' });
    expect(res.status).toBe(201);
    expect(res.body.data.certification.reevaluationStatus).toBe('cleared');
  });
});

// ── D: DBE-05 certSummary correctness ────────────────────────────────────────

describe('certifications — DBE-05 certSummary', () => {
  const req = makeRequester('10.10.0.4');
  let cookie = '';
  let projectId = '';

  beforeAll(async () => {
    const u = await registerAndLogin(req, 'cert-summary@test.local');
    cookie = u.cookie;
    const proj = await createProject(req, cookie, 'CertSummary Project');
    projectId = proj.id;
  });

  afterEach(clearCerts);

  it('sub with no certs → certSummary all-false + certCount 0', async () => {
    const sub = await createSub(req, cookie, projectId, 'Summary Sub No Certs');
    const res = await req
      .get(`/api/projects/${projectId}/subcontractors`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const found = res.body.data.subcontractors.find((s: any) => s.id === sub.id);
    expect(found).toBeTruthy();
    expect(found.certSummary).toMatchObject({
      certCount: 0,
      isCertified: false,
      hasExpiredCert: false,
      hasSuspendedCert: false,
      hasPendingCert: false,
    });
  });

  it('sub with one current DBE cert (expiresDate future, cleared) → isCertified true, not expired, not pending', async () => {
    const sub = await createSub(req, cookie, projectId, 'Summary Sub Current Cert');
    await createCert(req, cookie, projectId, sub.id, {
      certTypes: 'DBE',
      expiresDate: '2030-01-01',
      reevaluationStatus: 'cleared',
    });
    const res = await req.get(`/api/projects/${projectId}/subcontractors`).set('Cookie', cookie);
    const found = res.body.data.subcontractors.find((s: any) => s.id === sub.id);
    expect(found.certSummary).toMatchObject({
      isCertified: true,
      hasExpiredCert: false,
      hasPendingCert: false,
    });
  });

  it('sub with one expired cert (expiresDate in the past) → hasExpiredCert true', async () => {
    const sub = await createSub(req, cookie, projectId, 'Summary Sub Expired Cert');
    // Use a date far in the past so the test is stable regardless of execution date
    await createCert(req, cookie, projectId, sub.id, {
      certTypes: 'DBE',
      expiresDate: '2020-01-01',
    });
    const res = await req.get(`/api/projects/${projectId}/subcontractors`).set('Cookie', cookie);
    const found = res.body.data.subcontractors.find((s: any) => s.id === sub.id);
    expect(found.certSummary.hasExpiredCert).toBe(true);
  });
});

// ── E: DBE-04 internal upload gate (POST /cpr-weeks) ─────────────────────────

describe('certifications — DBE-04 internal upload gate', () => {
  const req = makeRequester('10.10.0.5');
  let cookie = '';
  let projectId = '';

  beforeAll(async () => {
    const u = await registerAndLogin(req, 'cert-gate@test.local');
    cookie = u.cookie;
    const proj = await createProject(req, cookie, 'Gate Project');
    projectId = proj.id;
  });

  afterEach(clearCerts);

  it('POST /cpr-weeks for sub with suspended cert returns 422 + CERT_EXPIRED_OR_SUSPENDED', async () => {
    const sub = await createSub(req, cookie, projectId, 'Gate Sub Suspended');
    await createCert(req, cookie, projectId, sub.id, {
      certTypes: 'DBE',
      reevaluationStatus: 'suspended',
    });

    const res = await req
      .post(`/api/projects/${projectId}/subcontractors/${sub.id}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2026-01-10' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CERT_EXPIRED_OR_SUSPENDED');
  });

  it('POST /cpr-weeks for sub with expired cert returns 422 + CERT_EXPIRED_OR_SUSPENDED', async () => {
    const sub = await createSub(req, cookie, projectId, 'Gate Sub Expired');
    // expiresDate far in the past ensures test is date-of-execution stable
    await createCert(req, cookie, projectId, sub.id, {
      certTypes: 'DBE',
      expiresDate: '2020-01-01',
    });

    const res = await req
      .post(`/api/projects/${projectId}/subcontractors/${sub.id}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2026-01-17' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CERT_EXPIRED_OR_SUSPENDED');
  });

  it('POST /cpr-weeks for sub with all-current certs succeeds', async () => {
    const sub = await createSub(req, cookie, projectId, 'Gate Sub Current');
    // Cert with expiresDate far in the future — definitely not expired
    await createCert(req, cookie, projectId, sub.id, {
      certTypes: 'DBE',
      expiresDate: '2030-12-31',
      reevaluationStatus: 'cleared',
    });

    const res = await req
      .post(`/api/projects/${projectId}/subcontractors/${sub.id}/cpr-weeks`)
      .set('Cookie', cookie)
      .send({ weekEndingDate: '2026-01-24' });
    // 201 = successfully created; 409 = duplicate week (also not a gate failure)
    expect([201, 409]).toContain(res.status);
    // Must NOT be 422
    expect(res.status).not.toBe(422);
  });
});
