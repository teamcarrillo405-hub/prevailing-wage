// src/client/lib/payrollQueue.test.ts
// Vitest unit tests for the IndexedDB-backed payroll entry queue.
// Uses fake-indexeddb to polyfill IDB in the Node/Vitest environment.
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach } from 'vitest';
import {
  enqueuePayrollEntry,
  getPayrollQueue,
  clearPayrollEntry,
  markSyncedElsewhere,
  getPendingCount,
  PAYROLL_QUEUE_DB,
  PAYROLL_STORE,
  _resetDb,
  type EntryPayload,
} from './payrollQueue';

function makePayload(workerId: string, classificationId: string): EntryPayload {
  return {
    workerId,
    classificationId,
    values: {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
      monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
      monDt: 0, tueDt: 0, wedDt: 0, thuDt: 0, friDt: 0, satDt: 0, sunDt: 0,
      fringeHealthWelfare: null, fringePension: null, fringeVacation: null, fringeTraining: null,
      nonPwHours: null, checkNumber: null, allOtherHours: null, totalWeekGrossWages: null,
      ficaTax: null, federalIncomeTax: null, stateIncomeTax: null, sdiTax: null,
      deductionVacationHoliday: null,
      deductionHealthWelfare: null,
      deductionPension: null,
      deductionTraining: null,
      deductionFundAdmin: null,
      deductionDues: null,
      deductionTravelSubsistence: null,
      deductionSavings: null,
      deductionOther: null,
      deductionOtherDescription: null,
    },
    baseRateSnapshot: 42.50,
    fringeRateSnapshot: 15.00,
    deductions: 0,
  };
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe('payrollQueue', () => {
  beforeEach(async () => {
    await _resetDb();
  });

  it('enqueuePayrollEntry adds a new entry with status=pending', async () => {
    const weekId = `week-${uid()}`;
    const projectId = `proj-${uid()}`;
    const payload = makePayload('w1', 'c1');

    await enqueuePayrollEntry(weekId, projectId, payload);

    const queue = await getPayrollQueue(weekId);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('pending');
    expect(queue[0].weekId).toBe(weekId);
    expect(queue[0].workerId).toBe('w1');
    expect(queue[0].classificationId).toBe('c1');
  });

  it('enqueuePayrollEntry with same composite key overwrites — only one entry exists after two calls', async () => {
    const weekId = `week-${uid()}`;
    const projectId = `proj-${uid()}`;
    const payload1 = makePayload('w1', 'c1');
    const payload2 = { ...makePayload('w1', 'c1'), baseRateSnapshot: 99.00 };

    await enqueuePayrollEntry(weekId, projectId, payload1);
    await enqueuePayrollEntry(weekId, projectId, payload2);

    const queue = await getPayrollQueue(weekId);
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.baseRateSnapshot).toBe(99.00);
  });

  it('getPayrollQueue() returns all entries sorted by queuedAt ascending', async () => {
    const weekId = `week-${uid()}`;
    const projectId = `proj-${uid()}`;

    await enqueuePayrollEntry(weekId, projectId, makePayload('w1', 'c1'));
    // Small delay to ensure distinct queuedAt values
    await new Promise((r) => setTimeout(r, 5));
    await enqueuePayrollEntry(weekId, projectId, makePayload('w2', 'c1'));
    await new Promise((r) => setTimeout(r, 5));
    await enqueuePayrollEntry(weekId, projectId, makePayload('w3', 'c1'));

    const queue = await getPayrollQueue(weekId);
    expect(queue).toHaveLength(3);
    expect(queue[0].workerId).toBe('w1');
    expect(queue[1].workerId).toBe('w2');
    expect(queue[2].workerId).toBe('w3');
    // Verify ascending order
    expect(queue[0].queuedAt).toBeLessThanOrEqual(queue[1].queuedAt);
    expect(queue[1].queuedAt).toBeLessThanOrEqual(queue[2].queuedAt);
  });

  it('getPayrollQueue(weekId) returns only entries for that weekId', async () => {
    const weekA = `week-A-${uid()}`;
    const weekB = `week-B-${uid()}`;
    const projectId = `proj-${uid()}`;

    await enqueuePayrollEntry(weekA, projectId, makePayload('w1', 'c1'));
    await enqueuePayrollEntry(weekB, projectId, makePayload('w2', 'c1'));

    const queueA = await getPayrollQueue(weekA);
    expect(queueA).toHaveLength(1);
    expect(queueA[0].weekId).toBe(weekA);

    const queueB = await getPayrollQueue(weekB);
    expect(queueB).toHaveLength(1);
    expect(queueB[0].weekId).toBe(weekB);
  });

  it('clearPayrollEntry removes the matching entry and leaves others intact', async () => {
    const weekId = `week-${uid()}`;
    const projectId = `proj-${uid()}`;

    await enqueuePayrollEntry(weekId, projectId, makePayload('w1', 'c1'));
    await enqueuePayrollEntry(weekId, projectId, makePayload('w2', 'c1'));

    await clearPayrollEntry(weekId, 'w1', 'c1');

    const queue = await getPayrollQueue(weekId);
    expect(queue).toHaveLength(1);
    expect(queue[0].workerId).toBe('w2');
  });

  it('clearPayrollEntry on non-existent key is a no-op (no throw)', async () => {
    const weekId = `week-${uid()}`;
    // Should not throw
    await expect(clearPayrollEntry(weekId, 'w-nonexistent', 'c-nonexistent')).resolves.toBeUndefined();
  });

  it('markSyncedElsewhere sets status=synced-elsewhere, does not delete', async () => {
    const weekId = `week-${uid()}`;
    const projectId = `proj-${uid()}`;

    await enqueuePayrollEntry(weekId, projectId, makePayload('w1', 'c1'));
    await markSyncedElsewhere(weekId, 'w1', 'c1');

    const queue = await getPayrollQueue(weekId);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('synced-elsewhere');
  });

  it('getPendingCount counts only status=pending entries', async () => {
    const weekId = `week-${uid()}`;
    const projectId = `proj-${uid()}`;

    await enqueuePayrollEntry(weekId, projectId, makePayload('w1', 'c1'));
    await enqueuePayrollEntry(weekId, projectId, makePayload('w2', 'c1'));
    await enqueuePayrollEntry(weekId, projectId, makePayload('w3', 'c1'));
    // Mark one as synced-elsewhere
    await markSyncedElsewhere(weekId, 'w3', 'c1');

    const count = await getPendingCount();
    expect(count).toBe(2);
  });

  it('PAYROLL_QUEUE_DB and PAYROLL_STORE constants are exported strings', () => {
    expect(typeof PAYROLL_QUEUE_DB).toBe('string');
    expect(PAYROLL_QUEUE_DB).toBe('payroll-queue');
    expect(typeof PAYROLL_STORE).toBe('string');
    expect(PAYROLL_STORE).toBe('entries');
  });
});
