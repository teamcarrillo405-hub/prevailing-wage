import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';
import { computeCompliance } from '../../src/server/services/complianceService.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers to seed DB fixtures via API ───────────────────────────────────

async function seedApprenticeWorker(
  cookie: string,
  projectId: string,
): Promise<{ workerId: string; classificationId: string }> {
  const wRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers`)
    .set('Cookie', cookie)
    .send({ name: 'App Rentice' });
  const workerId = wRes.body.data?.worker?.id as string;

  const cRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'ELEC',
      tradeDescription: 'Electrician Apprentice',
      laborType: 'apprentice',
      apprenticePercent: 80,
    });
  const classificationId = cRes.body.data?.classification?.id as string;

  return { workerId, classificationId };
}

async function seedProjectAndWorker() {
  const email = `compliance-svc-${Date.now()}@test.com`;
  const regRes = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = regRes.headers['set-cookie'] as string[] | string;
  const cookie = Array.isArray(cookies) ? cookies.join('; ') : cookies;

  const pRes = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Compliance Test Project',
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
    .send({ name: 'Jane Smith' });
  const workerId = wRes.body.data?.worker?.id as string;

  const cRes = await supertest(app)
    .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
    .set('Cookie', cookie)
    .send({
      tradeCode: 'ELEC',
      tradeDescription: 'Electrician',
      laborType: 'journeyworker',
    });
  const classificationId = cRes.body.data?.classification?.id as string;

  return { projectId, workerId, classificationId, cookie };
}

async function seedPayrollWeek(
  cookie: string,
  projectId: string,
  weekEndingDate = '2025-04-06',
  payrollNumber = 1,
): Promise<string> {
  const res = await supertest(app)
    .post('/api/payroll/weeks')
    .set('Cookie', cookie)
    .send({ projectId, weekEndingDate, payrollNumber });
  return res.body.id as string;
}

async function seedEntry(
  cookie: string,
  payrollWeekId: string,
  workerId: string,
  classificationId: string,
  opts: {
    monSt?: number;
    tueSt?: number;
    wedSt?: number;
    thuSt?: number;
    friSt?: number;
    monOt?: number;
    tueOt?: number;
    wedOt?: number;
    thuOt?: number;
    friOt?: number;
    satSt?: number;
    satOt?: number;
    sunSt?: number;
    sunOt?: number;
    baseRateSnapshot: number;
    fringeRateSnapshot: number;
    grossWages?: number;
  },
) {
  const res = await supertest(app)
    .post('/api/payroll/entries')
    .set('Cookie', cookie)
    .send({
      payrollWeekId,
      workerId,
      classificationId,
      monSt: opts.monSt ?? 0,
      tueSt: opts.tueSt ?? 0,
      wedSt: opts.wedSt ?? 0,
      thuSt: opts.thuSt ?? 0,
      friSt: opts.friSt ?? 0,
      monOt: opts.monOt ?? 0,
      tueOt: opts.tueOt ?? 0,
      wedOt: opts.wedOt ?? 0,
      thuOt: opts.thuOt ?? 0,
      friOt: opts.friOt ?? 0,
      satSt: opts.satSt ?? 0,
      satOt: opts.satOt ?? 0,
      sunSt: opts.sunSt ?? 0,
      sunOt: opts.sunOt ?? 0,
      baseRateSnapshot: opts.baseRateSnapshot,
      fringeRateSnapshot: opts.fringeRateSnapshot,
      grossWages: opts.grossWages ?? null,
    });
  return res.body.data?.entry?.id ?? res.body.id;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('computeCompliance', () => {
  const db = (globalThis as any).__testDb;

  it('COMP-01: under-wage entry produces 1 under-wage violation', async () => {
    // Worker paid below expected straight-time wages
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-04-06', 1);
    // 40 ST hours at $30 base + $10 fringe = $1600 expected; grossWages=$1400 (under)
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1400,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.violations).toHaveLength(1);
    expect(result!.violations[0].violationType).toBe('under-wage');
  });

  it('COMP-01: entry with null grossWages produces no violation', async () => {
    // null grossWages = not yet entered; engine should not flag as violation
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-04-07', 2);
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: undefined, // null in payload
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.violations).toHaveLength(0);
  });

  it('COMP-01: correct straight-time grossWages produces no violation', async () => {
    // 40 ST hours at $30 base + $10 fringe = $1600 expected; grossWages=$1600 (compliant)
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-04-08', 3);
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1600,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.violations).toHaveLength(0);
    expect(result!.hasViolations).toBe(false);
  });

  it('COMP-02: OT entry with incorrect grossWages produces 1 cwhssa-ot violation', async () => {
    // 40 ST + 8 OT at $30 base + $10 fringe
    // Expected: 48*30 + 8*0.5*30 + 48*10 = 1440 + 120 + 480 = 2040
    // Actual grossWages = 1800 (under)
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-04-09', 4);
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      monOt: 2, tueOt: 2, wedOt: 2, thuOt: 2,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1800,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.violations).toHaveLength(1);
    expect(result!.violations[0].violationType).toBe('cwhssa-ot');
  });

  it('COMP-02: CWHSSA fringe is NOT multiplied for OT — compliant wages at 40 ST + 4 OT', async () => {
    // 40 ST + 4 OT at $30 base + $10 fringe
    // Expected (CWHSSA fringe NOT multiplied): 44*30 + 4*0.5*30 + 44*10 = 1320 + 60 + 440 = 1820
    // If fringe were multiplied (wrong): 44*40*1.5 = 2640 — this must NOT be the expected value
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-04-10', 5);

    // Compliant: grossWages = 1820
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      friOt: 4,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1820,
    });

    const compliantResult = await computeCompliance(db, weekId);
    expect(compliantResult).not.toBeNull();
    expect(compliantResult!.violations).toHaveLength(0);

    // Now test under-wage detection (grossWages = 1760, $60 short)
    const { projectId: projectId2, workerId: workerId2, classificationId: classId2, cookie: cookie2 } =
      await seedProjectAndWorker();
    const weekId2 = await seedPayrollWeek(cookie2, projectId2, '2025-04-10', 5);
    await seedEntry(cookie2, weekId2, workerId2, classId2, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      friOt: 4,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1760,
    });

    const underResult = await computeCompliance(db, weekId2);
    expect(underResult).not.toBeNull();
    expect(underResult!.violations).toHaveLength(1);
    expect(underResult!.violations[0].expected).toBe(1820);
    expect(underResult!.violations[0].actual).toBe(1760);
    expect(underResult!.violations[0].delta).toBe(-60);
  });

  it('COMP-01/COMP-02: certProperPayment is false when an under-wage violation exists', async () => {
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-04-11', 6);
    // Under-wage: expected $1600, paid $1000
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1000,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.hasViolations).toBe(true);
    expect(result!.certProperPayment).toBe(false);
  });

  // ── COMP-03: Apprentice Ratio ────────────────────────────────────────────

  it('COMP-03: violation fires when apprentice hours exceed 1:3 ratio', async () => {
    // 30 JW hours, 20 apprentice hours — max allowed is 10 (30/3), so 20 > 10 triggers violation
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-05-01', 10);
    // JW: 30 ST hours
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 6,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1200,
    });
    // Apprentice: 20 ST hours
    const { workerId: appId, classificationId: appClassId } = await seedApprenticeWorker(cookie, projectId);
    await seedEntry(cookie, weekId, appId, appClassId, {
      monSt: 8, tueSt: 8, wedSt: 4,
      baseRateSnapshot: 20,
      fringeRateSnapshot: 5,
      grossWages: 500,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.weekViolations).toHaveLength(1);
    expect(result!.weekViolations[0].violationType).toBe('apprentice-ratio');
    expect(result!.weekViolations[0].apprenticeHours).toBe(20);
    expect(result!.weekViolations[0].journeyworkerHours).toBe(30);
    expect(result!.hasViolations).toBe(true);
  });

  it('COMP-03: no violation when apprentice hours equal max allowed (exactly at ratio)', async () => {
    // 30 JW hours, 10 apprentice hours — max allowed is 10 (30/3), exactly at limit = OK
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-05-02', 11);
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 6,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1200,
    });
    const { workerId: appId, classificationId: appClassId } = await seedApprenticeWorker(cookie, projectId);
    await seedEntry(cookie, weekId, appId, appClassId, {
      monSt: 8, tueSt: 2,
      baseRateSnapshot: 20,
      fringeRateSnapshot: 5,
      grossWages: 250,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.weekViolations).toHaveLength(0);
    expect(result!.hasViolations).toBe(false);
  });

  it('COMP-03: no violation when apprentice hours are below the 1:3 threshold', async () => {
    // 30 JW hours, 8 apprentice hours — 8 < 10 (30/3) = compliant
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-05-03', 12);
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 6,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1200,
    });
    const { workerId: appId, classificationId: appClassId } = await seedApprenticeWorker(cookie, projectId);
    await seedEntry(cookie, weekId, appId, appClassId, {
      monSt: 8,
      baseRateSnapshot: 20,
      fringeRateSnapshot: 5,
      grossWages: 200,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.weekViolations).toHaveLength(0);
  });

  it('COMP-03: no violation when journeyworkerHours is 0 and apprenticeHours > 0 (edge case guard)', async () => {
    // Pure-apprentice crew — 0 JW hours, 20 apprentice hours — must NOT fire
    const { projectId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-05-04', 13);
    const { workerId: appId, classificationId: appClassId } = await seedApprenticeWorker(cookie, projectId);
    await seedEntry(cookie, weekId, appId, appClassId, {
      monSt: 8, tueSt: 8, wedSt: 4,
      baseRateSnapshot: 20,
      fringeRateSnapshot: 5,
      grossWages: 400,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.weekViolations).toHaveLength(0);
  });

  it('COMP-03: no violation when there are zero apprentice hours', async () => {
    // JW-only week — no apprentice entries at all
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-05-05', 14);
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: 1600,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.weekViolations).toHaveLength(0);
    expect(result!.hasViolations).toBe(false);
  });

  it('COMP-03: foreman hours count toward journeyworker total', async () => {
    // 30 foreman ST hours + 5 apprentice ST hours — foreman counts as JW, max allowed 10, no violation
    const { projectId, cookie } = await seedProjectAndWorker();
    // Override: seed a foreman worker instead of JW
    const fRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers`)
      .set('Cookie', cookie)
      .send({ name: 'Frank Foreman' });
    const foremanId = fRes.body.data?.worker?.id as string;
    const fcRes = await supertest(app)
      .post(`/api/projects/${projectId}/workers/${foremanId}/classifications`)
      .set('Cookie', cookie)
      .send({
        tradeCode: 'ELEC',
        tradeDescription: 'Foreman Electrician',
        laborType: 'foreman',
      });
    const foremanClassId = fcRes.body.data?.classification?.id as string;

    const weekId = await seedPayrollWeek(cookie, projectId, '2025-05-06', 15);
    // Foreman: 30 ST hours
    await seedEntry(cookie, weekId, foremanId, foremanClassId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 6,
      baseRateSnapshot: 35,
      fringeRateSnapshot: 12,
      grossWages: 1410,
    });
    // Apprentice: 5 ST hours — 5 < 10 (30/3), OK
    const { workerId: appId, classificationId: appClassId } = await seedApprenticeWorker(cookie, projectId);
    await seedEntry(cookie, weekId, appId, appClassId, {
      friSt: 5,
      baseRateSnapshot: 20,
      fringeRateSnapshot: 5,
      grossWages: 125,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.weekViolations).toHaveLength(0);
  });

  // ── NY Daily OT Rule ─────────────────────────────────────────────────────

  describe('NY daily OT rule', () => {
    async function seedNyProjectAndWorker() {
      const email = `ny-ot-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      const regRes = await supertest(app)
        .post('/api/auth/register')
        .send({ email, password: 'password123' });
      const cookies = regRes.headers['set-cookie'] as string[] | string;
      const cookie = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      const pRes = await supertest(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({
          name: 'NY OT Test Project',
          state: 'NY',
          county: 'New York',
          contractType: 'federal-davis-bacon',
          awardDate: '2025-06-01',
          fundingType: 'federal',
        });
      const projectId = pRes.body.data?.project?.id as string;

      const wRes = await supertest(app)
        .post(`/api/projects/${projectId}/workers`)
        .set('Cookie', cookie)
        .send({ name: 'NY Worker' });
      const workerId = wRes.body.data?.worker?.id as string;

      const cRes = await supertest(app)
        .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
        .set('Cookie', cookie)
        .send({
          tradeCode: 'ELEC',
          tradeDescription: 'Electrician',
          laborType: 'journeyworker',
        });
      const classificationId = cRes.body.data?.classification?.id as string;

      return { projectId, workerId, classificationId, cookie };
    }

    async function seedCaProjectAndWorker() {
      const email = `ca-ot-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      const regRes = await supertest(app)
        .post('/api/auth/register')
        .send({ email, password: 'password123' });
      const cookies = regRes.headers['set-cookie'] as string[] | string;
      const cookie = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      const pRes = await supertest(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({
          name: 'CA OT Test Project',
          state: 'CA',
          county: 'Los Angeles',
          contractType: 'federal-davis-bacon',
          awardDate: '2025-06-01',
          fundingType: 'federal',
        });
      const projectId = pRes.body.data?.project?.id as string;

      const wRes = await supertest(app)
        .post(`/api/projects/${projectId}/workers`)
        .set('Cookie', cookie)
        .send({ name: 'CA Worker' });
      const workerId = wRes.body.data?.worker?.id as string;

      const cRes = await supertest(app)
        .post(`/api/projects/${projectId}/workers/${workerId}/classifications`)
        .set('Cookie', cookie)
        .send({
          tradeCode: 'ELEC',
          tradeDescription: 'Electrician',
          laborType: 'journeyworker',
        });
      const classificationId = cRes.body.data?.classification?.id as string;

      return { projectId, workerId, classificationId, cookie };
    }

    it('Test A: NY project with 9 ST hours on Monday flags cwhssa-ot violation', async () => {
      // NY daily OT rule: any day exceeding 8 total hours (ST + OT) triggers cwhssa-ot
      // Monday = 9 ST hours (> 8) → should produce a cwhssa-ot violation
      const { projectId, workerId, classificationId, cookie } = await seedNyProjectAndWorker();
      const weekId = await seedPayrollWeek(cookie, projectId, '2025-06-08', 101);

      // 9 ST on Monday, 8 each other day — Monday exceeds 8h daily threshold
      await seedEntry(cookie, weekId, workerId, classificationId, {
        monSt: 9, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
        baseRateSnapshot: 30,
        fringeRateSnapshot: 10,
        grossWages: 1660, // some value — compliance fires on daily hours not grossWages
      });

      const result = await computeCompliance(db, weekId);
      expect(result).not.toBeNull();
      const otViolations = result!.violations.filter(v => v.violationType === 'cwhssa-ot');
      expect(otViolations.length).toBeGreaterThan(0);
      // Violation should reference the daily threshold
      expect(otViolations[0].expected).toBe(8);
      expect(otViolations[0].actual).toBe(9);
    });

    it('Test B: NY project with exactly 8 hours/day has NO daily OT violation', async () => {
      // Exactly 8 hours is NOT a violation — threshold is strictly > 8
      const { projectId, workerId, classificationId, cookie } = await seedNyProjectAndWorker();
      const weekId = await seedPayrollWeek(cookie, projectId, '2025-06-15', 102);

      // 8 ST on each day — exactly at threshold, no violation
      await seedEntry(cookie, weekId, workerId, classificationId, {
        monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
        baseRateSnapshot: 30,
        fringeRateSnapshot: 10,
        grossWages: 1600,
      });

      const result = await computeCompliance(db, weekId);
      expect(result).not.toBeNull();
      const otViolations = result!.violations.filter(v => v.violationType === 'cwhssa-ot');
      expect(otViolations).toHaveLength(0);
    });

    it('Test C: Non-NY project (CA) with 9 ST hours on Monday does NOT flag daily OT', async () => {
      // CA uses weekly 40h rule only — daily 9h on one day should not trigger cwhssa-ot
      // Total week = 9+8+8+8+7 = 40h (no weekly CWHSSA violation either)
      const { projectId, workerId, classificationId, cookie } = await seedCaProjectAndWorker();
      const weekId = await seedPayrollWeek(cookie, projectId, '2025-06-22', 103);

      // 9 ST on Monday, total 40h/week — CA weekly rule not triggered, daily OT should not fire
      await seedEntry(cookie, weekId, workerId, classificationId, {
        monSt: 9, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 7,
        baseRateSnapshot: 30,
        fringeRateSnapshot: 10,
        grossWages: 1600, // 40h * $30 base + 40h * $10 fringe = 1600
      });

      const result = await computeCompliance(db, weekId);
      expect(result).not.toBeNull();
      const otViolations = result!.violations.filter(v => v.violationType === 'cwhssa-ot');
      expect(otViolations).toHaveLength(0);
    });
  });

  it('COMP-03: hasViolations is true when weekViolations is non-empty even if violations[] is empty', async () => {
    // 30 JW hours, 20 apprentice hours — only ratio violation, no wage violations
    const { projectId, workerId, classificationId, cookie } = await seedProjectAndWorker();
    const weekId = await seedPayrollWeek(cookie, projectId, '2025-05-07', 16);
    // JW correct wages — no under-wage violation
    const jwExpected = 30 * 30 + 30 * 10; // 900 + 300 = 1200
    await seedEntry(cookie, weekId, workerId, classificationId, {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 6,
      baseRateSnapshot: 30,
      fringeRateSnapshot: 10,
      grossWages: jwExpected,
    });
    // Apprentice: 20 hours with correct wages — no under-wage violation
    const { workerId: appId, classificationId: appClassId } = await seedApprenticeWorker(cookie, projectId);
    const appExpected = 20 * 20 + 20 * 5; // 400 + 100 = 500
    await seedEntry(cookie, weekId, appId, appClassId, {
      monSt: 8, tueSt: 8, wedSt: 4,
      baseRateSnapshot: 20,
      fringeRateSnapshot: 5,
      grossWages: appExpected,
    });

    const result = await computeCompliance(db, weekId);
    expect(result).not.toBeNull();
    expect(result!.violations).toHaveLength(0);        // no per-entry violations
    expect(result!.weekViolations).toHaveLength(1);    // 1 ratio violation
    expect(result!.hasViolations).toBe(true);          // true because weekViolations non-empty
  });
});
