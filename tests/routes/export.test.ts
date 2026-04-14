import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerUser(suffix: string) {
  const email = `export-a1131-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string, state: string, extra?: Record<string, unknown>) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: `Test Project ${state}`,
      state,
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
      ...extra,
    });
  return res.body.data?.project?.id as string;
}

async function createWorkerWithClassification(
  cookie: string,
  projectId: string,
  extra?: { waTradeCode?: string },
) {
  const wRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'Test Worker' });
  const workerId = wRes.body.data?.worker?.id as string;

  const cRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
      ...(extra?.waTradeCode ? { waTradeCode: extra.waTradeCode } : {}),
    });
  const classificationId = cRes.body.data?.classification?.id as string;

  return { workerId, classificationId };
}

async function createPayrollWeek(cookie: string, projectId: string) {
  const res = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate: '2025-01-05', payrollNumber: 1 });
  return res.body.id as string;
}

async function createPayrollEntry(
  cookie: string,
  weekId: string,
  workerId: string,
  classificationId: string,
) {
  await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      payrollWeekId: weekId,
      workerId,
      classificationId,
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
      monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
      baseRateSnapshot: 45.00,
      fringeRateSnapshot: 12.50,
      grossWages: 1800.00,
      deductions: 250.00,
      netPay: 1550.00,
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/export/f700/:weekId - WAL-02', () => {
  it('should return 400 for non-WA project', async () => {
    const cookie = await registerUser('wa-non-wa');
    const projectId = await createProject(cookie, 'TX');
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/f700/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Washington');
  });

  it('should return PDF for WA project', async () => {
    const cookie = await registerUser('wa-pdf');
    const projectId = await createProject(cookie, 'WA', {
      ubiNumber: '123456789',
      lniCertificate: 'HCCCO1234LI',
      wcAccount: '234-56-7',
    });
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/f700/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body).toBeDefined();
  });

  it('should return 403 for unauthorized access', async () => {
    const cookieA = await registerUser('wa-owner');
    const projectId = await createProject(cookieA, 'WA');
    const weekId = await createPayrollWeek(cookieA, projectId);

    const cookieB = await registerUser('wa-intruder');
    const res = await supertest(app)
      .get(`/api/export/f700/${weekId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent week', async () => {
    const cookie = await registerUser('wa-notfound');
    const res = await supertest(app)
      .get('/api/export/f700/non-existent-week-id')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('should return 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/export/f700/some-week-id');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/export/a1131/:weekId - CAL-02', () => {
  it('should return 400 for non-CA project', async () => {
    const cookie = await registerUser('non-ca');
    const projectId = await createProject(cookie, 'TX');
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/a1131/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('California');
  });

  it('should return PDF for CA project', async () => {
    const cookie = await registerUser('ca-pdf');
    const projectId = await createProject(cookie, 'CA', {
      cslbLicense: '123456',
      wcPolicyNumber: 'WC-2026-789',
    });
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/a1131/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body).toBeDefined();
  });

  it('should return 403 for unauthorized access', async () => {
    // Create a week as user A
    const cookieA = await registerUser('owner');
    const projectId = await createProject(cookieA, 'CA');
    const weekId = await createPayrollWeek(cookieA, projectId);

    // Try to download as user B
    const cookieB = await registerUser('intruder');
    const res = await supertest(app)
      .get(`/api/export/a1131/${weekId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent week', async () => {
    const cookie = await registerUser('notfound');
    const res = await supertest(app)
      .get('/api/export/a1131/non-existent-week-id')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('should return 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/export/a1131/some-week-id');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/export/wa-cpr-xml/:weekId', () => {
  it('returns 403 for unauthorized user', async () => {
    // Create user1 project, then request as user2
    const cookie1 = await registerUser('user1-wa');
    const proj1Id = await createProject(cookie1, 'WA', { county: 'King' });
    const week1Id = await createPayrollWeek(cookie1, proj1Id);
    const cookie2 = await registerUser('user2-wa');
    const res = await supertest(app)
      .get(`/api/export/wa-cpr-xml/${week1Id}`)
      .set('Cookie', cookie2);
    expect(res.status).toBe(403);
  });

  it('returns 400 for non-WA project', async () => {
    const cookie = await registerUser('wa-nonwa');
    const projId = await createProject(cookie, 'CA');
    const weekId = await createPayrollWeek(cookie, projId);
    const res = await supertest(app)
      .get(`/api/export/wa-cpr-xml/${weekId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Washington');
  });

  it('returns 400 when intentId missing from project', async () => {
    const cookie = await registerUser('wa-nointent');
    const projId = await createProject(cookie, 'WA', { county: 'King' });
    const weekId = await createPayrollWeek(cookie, projId);
    const res = await supertest(app)
      .get(`/api/export/wa-cpr-xml/${weekId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Intent ID');
  });

  it('returns 422 when worker has null waTradeCode', async () => {
    const cookie = await registerUser('wa-notrade');
    const projId = await createProject(cookie, 'WA', { county: 'King' });
    // Persist intentId on project
    await supertest(app)
      .patch(`/api/projects/${projId}`)
      .set('Cookie', cookie)
      .send({ pwiaIntentId: '99999' });
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projId);
    const weekId = await createPayrollWeek(cookie, projId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);
    const res = await supertest(app)
      .get(`/api/export/wa-cpr-xml/${weekId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain('trade code');
  });

  it('returns XML for valid WA project with intentId and trade codes', async () => {
    const cookie = await registerUser('wa-valid');
    const projId = await createProject(cookie, 'WA', { county: 'King' });
    await supertest(app)
      .patch(`/api/projects/${projId}`)
      .set('Cookie', cookie)
      .send({ pwiaIntentId: '12345' });
    const { workerId, classificationId } = await createWorkerWithClassification(
      cookie,
      projId,
      { waTradeCode: 'CARP' },
    );
    const weekId = await createPayrollWeek(cookie, projId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);
    const res = await supertest(app)
      .get(`/api/export/wa-cpr-xml/${weekId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).toContain('<WaPWCPR>');
    expect(res.text).toContain('<intentId>12345</intentId>');
  });
});

// ── NY PW-12 export tests ──────────────────────────────────────────────────

describe('GET /api/export/pw12/:weekId - STATE-02', () => {
  it('returns 400 for non-NY project', async () => {
    const cookie = await registerUser('pw12-non-ny');
    const projectId = await createProject(cookie, 'CA');
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/pw12/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('New York');
  });

  it('returns PDF for NY project', async () => {
    const cookie = await registerUser('pw12-ny');
    const projectId = await createProject(cookie, 'NY', { county: 'Kings' });
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/pw12/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('returns 403 without project access', async () => {
    const cookieA = await registerUser('pw12-owner');
    const projectId = await createProject(cookieA, 'NY', { county: 'Kings' });
    const weekId = await createPayrollWeek(cookieA, projectId);

    const cookieB = await registerUser('pw12-intruder');
    const res = await supertest(app)
      .get(`/api/export/pw12/${weekId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(403);
  });
});

// ── NY MPWR XML export tests ───────────────────────────────────────────────

describe('GET /api/export/ny-mpwr-xml/:weekId - STATE-03', () => {
  it('returns 400 for non-NY project', async () => {
    const cookie = await registerUser('mpwr-non-ny');
    const projectId = await createProject(cookie, 'CA');
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/ny-mpwr-xml/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('New York');
  });

  it('returns XML for NY project', async () => {
    const cookie = await registerUser('mpwr-ny');
    const projectId = await createProject(cookie, 'NY', { county: 'Kings' });
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/ny-mpwr-xml/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).toContain('<ProjectRollup>');
  });

  it('returns 403 without project access', async () => {
    const cookieA = await registerUser('mpwr-owner');
    const projectId = await createProject(cookieA, 'NY', { county: 'Kings' });
    const weekId = await createPayrollWeek(cookieA, projectId);

    const cookieB = await registerUser('mpwr-intruder');
    const res = await supertest(app)
      .get(`/api/export/ny-mpwr-xml/${weekId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(403);
  });
});

// ── IL PDF export tests ────────────────────────────────────────────────────

describe('GET /api/export/il-pdf/:weekId - STATE-08', () => {
  it('should return 400 for non-IL project', async () => {
    const cookie = await registerUser('il-pdf-non-il');
    const projectId = await createProject(cookie, 'CA');
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);

    const res = await supertest(app)
      .get(`/api/export/il-pdf/${weekId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Illinois');
  });

  it('should return 403 without project access', async () => {
    const cookieA = await registerUser('il-pdf-owner');
    const projectId = await createProject(cookieA, 'IL');
    const weekId = await createPayrollWeek(cookieA, projectId);

    const cookieB = await registerUser('il-pdf-intruder');
    const res = await supertest(app)
      .get(`/api/export/il-pdf/${weekId}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(403);
  });
});

// STATE-13: case normalization on export routes
describe('STATE-13: case normalization on export routes', () => {
  it('should return 400 for non-CA project on a1131 route', async () => {
    // Create a TX project with lowercase state — should be blocked by a1131 CA gate
    const cookie = await registerUser('state13-a1131');
    const projectId = await createProject(cookie, 'tx');
    const weekId = await createPayrollWeek(cookie, projectId);
    const res = await supertest(app).get(`/api/export/a1131/${weekId}`).set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('should return 400 for non-WA project on f700 route', async () => {
    // Create a CA project with lowercase state — should be blocked by f700 WA gate
    const cookie = await registerUser('state13-f700');
    const projectId = await createProject(cookie, 'ca');
    const weekId = await createPayrollWeek(cookie, projectId);
    const res = await supertest(app).get(`/api/export/f700/${weekId}`).set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('should not return state-gate 400 for lowercase ca project on a1131', async () => {
    // lowercase 'ca' must pass the CA gate after .toUpperCase() normalization
    const cookie = await registerUser('state13-ca-lower');
    const projectId = await createProject(cookie, 'ca');  // lowercase
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);
    const res = await supertest(app).get(`/api/export/a1131/${weekId}`).set('Cookie', cookie);
    // Should NOT be 400 (state gate) — lowercase 'ca' must pass after normalization
    expect(res.status).not.toBe(400);
  });
});

describe('GET /api/export/ma-cpr/:weekId - MA-04', () => {
  it('returns 404 for nonexistent weekId', async () => {
    const cookie = await registerUser('ma-cpr-404');
    const res = await supertest(app)
      .get('/api/export/ma-cpr/nonexistent-week-id')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for non-MA project (state gate)', async () => {
    const cookie = await registerUser('ma-cpr-non-ma');
    const projectId = await createProject(cookie, 'CA');
    const weekId = await createPayrollWeek(cookie, projectId);
    const res = await supertest(app)
      .get(`/api/export/ma-cpr/${weekId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Massachusetts|MA/);
  });

  it('returns 200 with PDF for valid MA week', async () => {
    const cookie = await registerUser('ma-cpr-valid');
    const projectId = await createProject(cookie, 'MA', {
      county: 'Suffolk',
      contractorFein: '12-3456789',
      maDlsProjectId: 'MA-001',
      contractingAgency: 'City of Boston',
    });
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);

    // Create a payroll entry with MA-specific fields
    await supertest(app)
      .post('/api/payroll/entries')
      .set('Cookie', cookie)
      .send({
        payrollWeekId: weekId,
        workerId,
        classificationId,
        monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
        monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
        baseRateSnapshot: 55.00,
        fringeRateSnapshot: 15.00,
        grossWages: 2200.00,
        deductions: 100.00,
        netPay: 2100.00,
        checkNumber: '10234',
        allOtherHours: 4.0,
        totalWeekGrossWages: 2100.00,
      });

    const res = await supertest(app)
      .get(`/api/export/ma-cpr/${weekId}`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('ma-cpr-');
    expect((res.body as Buffer).length).toBeGreaterThan(0);
  });
});

describe('GET /api/export/nj-mw562/:weekId - NJ-02', () => {
  it('returns 404 for unknown weekId', async () => {
    const cookie = await registerUser('nj-mw562-404');
    const res = await supertest(app)
      .get('/api/export/nj-mw562/nonexistent-id')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 400 when project state is not NJ (state gate)', async () => {
    const cookie = await registerUser('nj-mw562-non-nj');
    const projectId = await createProject(cookie, 'CA');
    const weekId = await createPayrollWeek(cookie, projectId);
    const res = await supertest(app)
      .get(`/api/export/nj-mw562/${weekId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/NJ|New Jersey/i);
  });

  it('returns 501 for a valid NJ project payroll week (stub)', async () => {
    const cookie = await registerUser('nj-mw562-valid');
    const projectId = await createProject(cookie, 'NJ');
    const weekId = await createPayrollWeek(cookie, projectId);
    const res = await supertest(app)
      .get(`/api/export/nj-mw562/${weekId}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(501);
  });

  it('returns 403 for cross-tenant access (IDOR guard)', async () => {
    const cookieA = await registerUser('nj-mw562-owner');
    const projectId = await createProject(cookieA, 'NJ');
    const weekId = await createPayrollWeek(cookieA, projectId);

    const cookieB = await registerUser('nj-mw562-intruder');
    const res = await supertest(app)
      .get(`/api/export/nj-mw562/${weekId}`)
      .set('Cookie', cookieB);
    expect(res.status).toBe(403);
  });
});
