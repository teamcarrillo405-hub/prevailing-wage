import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';
import { computeCompliance } from '../../src/server/services/complianceService.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers to seed DB fixtures via API ───────────────────────────────────

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
});
