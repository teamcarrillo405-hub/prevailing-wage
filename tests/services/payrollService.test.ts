import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';
import { workers, workerClassifications } from '../../src/server/db/schema.js';
import {
  createPayrollWeek,
  upsertPayrollEntry,
  getPayrollEntries,
} from '../../src/server/services/payrollService.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── Helpers to seed DB fixtures via API (uses test DB via getDb()) ─────────

async function seedProjectAndWorker() {
  const email = `svc-${Date.now()}@test.com`;
  const regRes = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = regRes.headers['set-cookie'] as string[] | string;
  const cookie = Array.isArray(cookies) ? cookies.join('; ') : cookies;

  const pRes = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Service Test Project',
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

  return { projectId, workerId, classificationId };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('payrollService', () => {
  it('createPayrollWeek inserts row and returns id', async () => {
    const { projectId } = await seedProjectAndWorker();

    const result = await createPayrollWeek({
      projectId,
      weekEndingDate: '2025-04-05',
      payrollNumber: 10,
    });

    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.payrollNumber).toBe(10);
  });

  it('upsertPayrollEntry saves daily ST/OT hours with rate snapshots', async () => {
    const { projectId, workerId, classificationId } = await seedProjectAndWorker();

    const weekResult = await createPayrollWeek({
      projectId,
      weekEndingDate: '2025-04-12',
      payrollNumber: 11,
    });

    await upsertPayrollEntry({
      payrollWeekId: weekResult.id,
      workerId,
      classificationId,
      monSt: 8,
      tueSt: 8,
      wedSt: 8,
      thuSt: 8,
      friSt: 8,
      monOt: 0,
      tueOt: 0,
      wedOt: 0,
      thuOt: 0,
      friOt: 2,
      baseRateSnapshot: 55.00,
      fringeRateSnapshot: 25.00,
    });

    // Upsert again (update) — should not throw
    await upsertPayrollEntry({
      payrollWeekId: weekResult.id,
      workerId,
      classificationId,
      monSt: 9,
      tueSt: 8,
      wedSt: 8,
      thuSt: 8,
      friSt: 8,
      monOt: 0,
      tueOt: 0,
      wedOt: 0,
      thuOt: 0,
      friOt: 3,
      baseRateSnapshot: 55.00,
      fringeRateSnapshot: 25.00,
    });

    const entries = await getPayrollEntries(weekResult.id);
    expect(entries.length).toBe(1);
    expect(entries[0].entry.monSt).toBe(9);
    expect(entries[0].entry.friOt).toBe(3);
    expect(entries[0].entry.baseRateSnapshot).toBe(55.00);
  });

  it('getPayrollEntries returns all entries for a week with worker names', async () => {
    const { projectId, workerId, classificationId } = await seedProjectAndWorker();

    const weekResult = await createPayrollWeek({
      projectId,
      weekEndingDate: '2025-04-19',
      payrollNumber: 12,
    });

    await upsertPayrollEntry({
      payrollWeekId: weekResult.id,
      workerId,
      classificationId,
      monSt: 8,
      baseRateSnapshot: 45.00,
      fringeRateSnapshot: 20.00,
    });

    const entries = await getPayrollEntries(weekResult.id);
    expect(entries.length).toBe(1);
    expect(typeof entries[0].workerName).toBe('string');
    expect(entries[0].workerName).toBe('Jane Smith');
    expect(typeof entries[0].tradeDescription).toBe('string');
    expect(entries[0].tradeDescription).toBe('Electrician');
  });

  it('upsertPayrollEntry returns the matching worker/classification when a week has multiple entries', async () => {
    const { projectId, workerId, classificationId } = await seedProjectAndWorker();
    const db = (globalThis as any).__testDb;
    const now = new Date().toISOString();
    const secondWorkerId = crypto.randomUUID();
    const secondClassificationId = crypto.randomUUID();

    await db.insert(workers).values({
      id: secondWorkerId,
      projectId,
      name: 'Second Worker',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workerClassifications).values({
      id: secondClassificationId,
      workerId: secondWorkerId,
      projectId,
      tradeCode: 'CARP',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
      isActive: true,
      createdAt: now,
    });

    const weekResult = await createPayrollWeek({
      projectId,
      weekEndingDate: '2025-04-26',
      payrollNumber: 13,
    });

    await upsertPayrollEntry({
      payrollWeekId: weekResult.id,
      workerId,
      classificationId,
      monSt: 8,
      baseRateSnapshot: 45,
      fringeRateSnapshot: 20,
    });

    const returned = await upsertPayrollEntry({
      payrollWeekId: weekResult.id,
      workerId: secondWorkerId,
      classificationId: secondClassificationId,
      tueSt: 8,
      baseRateSnapshot: 45,
      fringeRateSnapshot: 20,
    });

    expect(returned?.workerId).toBe(secondWorkerId);
    expect(returned?.classificationId).toBe(secondClassificationId);
  });
});
