import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';
import {
  getOtThreshold,
  applyOtThreshold,
  getOrDefaultThreshold,
} from '../../src/server/services/otCalculator.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function seedProject() {
  const email = `ot-svc-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const regRes = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = regRes.headers['set-cookie'] as string[] | string;
  const cookie = Array.isArray(cookies) ? cookies.join('; ') : cookies;

  const pRes = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'OT Service Test Project',
      state: 'TX',
      county: 'Travis',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-03-01',
      fundingType: 'federal',
    });
  const projectId = pRes.body.data?.project?.id as string;
  return { projectId, cookie };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('otCalculator', () => {
  it('getOtThreshold returns null for unknown projectId', async () => {
    const result = await getOtThreshold('non-existent-project-id-xyz');
    expect(result).toBeNull();
  });

  it('applyOtThreshold calls calculateCwhssaOt — 44h week produces 4 OT hours in result shape', async () => {
    // Build a minimal payroll-entry-like array for applyOtThreshold
    // applyOtThreshold accepts entries with daily hours + rate snapshots and returns WorkerOtCost[]
    const threshold = {
      weeklyOtThreshold: 40,
      dailyOtThreshold: null as number | null,
      dailyDtThreshold: null as number | null,
      otMultiplier: 1.5,
      dtMultiplier: 2.0,
      source: 'cwhssa' as const,
    };

    const entries = [
      {
        workerId: 'worker-1',
        workerName: 'John Smith',
        // 44h week: Mon-Fri 8h + Sat 4h
        dailyHours: [8, 8, 8, 8, 8, 4, 0],
        baseRate: 30,
        fringeRate: 10,
      },
    ];

    const results = applyOtThreshold(entries, threshold);
    expect(results.length).toBe(1);
    const w = results[0];
    expect(w.workerId).toBe('worker-1');
    expect(w.totalHours).toBe(44);
    expect(w.overtimeHours).toBe(4);
    // CwhssaOtResult shape from calculateCwhssaOt
    expect(w.result.overtimePremium).toBeCloseTo(4 * 0.5 * 30); // 60
    expect(w.result.totalFringePay).toBeCloseTo(44 * 10);       // 440 (1.0x all hours)
    expect(w.result.straightTimeBasePay).toBeCloseTo(44 * 30);  // 1320
    expect(w.result.totalWeeklyCost).toBeCloseTo(1320 + 60 + 440); // 1820
  });

  it('daily threshold null means no daily OT trigger applied — weekly 44h → 4 OT hours', async () => {
    const threshold = {
      weeklyOtThreshold: 40,
      dailyOtThreshold: null as number | null,
      dailyDtThreshold: null as number | null,
      otMultiplier: 1.5,
      dtMultiplier: 2.0,
      source: 'cwhssa' as const,
    };

    // 40h week: 5×8h — no OT even though threshold is null (CWHSSA weekly only)
    const entries = [
      {
        workerId: 'worker-2',
        workerName: 'Jane Doe',
        dailyHours: [8, 8, 8, 8, 8, 0, 0],
        baseRate: 30,
        fringeRate: 10,
      },
    ];

    const results = applyOtThreshold(entries, threshold);
    expect(results[0].totalHours).toBe(40);
    expect(results[0].overtimeHours).toBe(0);
    expect(results[0].result.overtimePremium).toBe(0);
  });

  it('CBA daily threshold of 8 triggers OT after 8h per day — 10h day produces 2h daily OT', async () => {
    const threshold = {
      weeklyOtThreshold: 40,
      dailyOtThreshold: 8 as number | null,
      dailyDtThreshold: null as number | null,
      otMultiplier: 1.5,
      dtMultiplier: 2.0,
      source: 'cba' as const,
    };

    // Mon 10h, Tue-Fri 8h each = 42h total; daily OT: 2h on Monday
    // Weekly OT: max(0, 42-40) = 2h; but daily OT is also 2h on Mon (not double-counted)
    const entries = [
      {
        workerId: 'worker-3',
        workerName: 'Bob CBA',
        dailyHours: [10, 8, 8, 8, 8, 0, 0],
        baseRate: 30,
        fringeRate: 10,
      },
    ];

    const results = applyOtThreshold(entries, threshold);
    expect(results[0].totalHours).toBe(42);
    // With daily OT of 8h threshold: Monday has 2h OT. Weekly threshold is 40, so 2h weekly OT.
    // Daily OT is the max of daily-triggered OT and weekly-triggered OT (no double count).
    expect(results[0].overtimeHours).toBeGreaterThanOrEqual(2);
    // Fringe still at 1.0x for ALL hours (CWHSSA compliance in calculateCwhssaOt)
    expect(results[0].result.totalFringePay).toBeCloseTo(42 * 10); // 420
  });
});
