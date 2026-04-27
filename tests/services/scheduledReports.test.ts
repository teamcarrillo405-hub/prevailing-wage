// tests/services/scheduledReports.test.ts
// Unit tests for src/server/jobs/scheduledReports.ts (NOTIF-06).
// All external dependencies mocked — no real DB, no real Resend.
// Mirrors tests/services/dueSoonService.test.ts mocking patterns exactly.
// Uses vi.hoisted() for the shared send mock to avoid Vitest hoisting ReferenceErrors.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// ── Shared mock for Resend.emails.send — must be defined via vi.hoisted() ──
// vi.mock factories are hoisted ABOVE all imports; a top-level `const mockSend`
// defined after imports would be in the temporal dead zone when the factory runs.

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ error: null }),
}));

// ── Mocks — vi.mock factories are hoisted; inline vi.fn() to avoid hoisting errors ──

vi.mock('../../src/server/db/index.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../src/server/services/payrollService.js', () => ({
  listPayrollWeeks: vi.fn(),
}));

vi.mock('../../src/server/services/complianceService.js', () => ({
  computeCompliance: vi.fn(),
}));

vi.mock('../../src/server/services/dueSoonService.js', () => ({
  dateDiffDays: vi.fn((today: string, target: string) => {
    const t = new Date(today + 'T00:00:00.000Z').getTime();
    const d = new Date(target + 'T00:00:00.000Z').getTime();
    return Math.round((d - t) / (1000 * 60 * 60 * 24));
  }),
}));

// resend mock — uses the hoisted mockSend so all Resend instances share one spy
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

// Imports AFTER mocks
import { runScheduledReports } from '../../src/server/jobs/scheduledReports.js';
import { getDb } from '../../src/server/db/index.js';
import { listPayrollWeeks } from '../../src/server/services/payrollService.js';
import { computeCompliance } from '../../src/server/services/complianceService.js';

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: RESEND_API_KEY is set (override in Test 1)
  process.env.RESEND_API_KEY = 'test-key-xxx';
  // Restore mockSend default behavior after clearAllMocks resets it
  mockSend.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    name: 'Test Project',
    status: 'active',
    projectSettings: null as string | null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Build the update chain mock: db.update().set().where() */
function makeUpdateChain() {
  const whereChain = { where: vi.fn().mockResolvedValue(undefined) };
  const setChain   = { set: vi.fn().mockReturnValue(whereChain) };
  return { update: vi.fn().mockReturnValue(setChain), setChain, whereChain };
}

/**
 * Setup getDb() with:
 *   Call 1: select().from().where() → activeProjects
 *   Call 2: select().from().innerJoin().where() → ownerRows (for fallback email)
 * Plus an update chain.
 */
function setupDb(projectRows: object[], ownerRows: object[] = []) {
  const { update, setChain, whereChain } = makeUpdateChain();
  let selectCallCount = 0;

  vi.mocked(getDb).mockReturnValue({
    select: vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(projectRows),
          }),
        };
      }
      // Owner member join query
      return {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(ownerRows),
          }),
        }),
      };
    }),
    update,
  } as any);

  return { update, setChain, whereChain };
}

/** Setup getDb() that only needs a simple projects select (no owner lookup) */
function setupDbProjectsOnly(projectRows: object[]) {
  const { update } = makeUpdateChain();
  vi.mocked(getDb).mockReturnValue({
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(projectRows),
      }),
    })),
    update,
  } as any);
}

/** Fixture compliance result — no violations */
function makeCompliantResult(weekId = 'wk-1') {
  return {
    weekId,
    projectId: 'proj-1',
    violations: [],
    weekViolations: [],
    hasViolations: false,
    certProperPayment: true,
    certAccuratePayroll: true,
  };
}

/** Fixture compliance result — has violations */
function makeViolationResult(weekId = 'wk-1') {
  return {
    weekId,
    projectId: 'proj-1',
    violations: [{ entryId: 'e1', workerId: 'w1', workerName: 'Jane', violationType: 'under-wage', expected: 50, actual: 40, delta: 10 }],
    weekViolations: [{ violationType: 'apprentice-ratio', detail: 'Over ratio' }],
    hasViolations: true,
    certProperPayment: false,
    certAccuratePayroll: false,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runScheduledReports', () => {

  it('Test 1: returns without throwing when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY;
    setupDbProjectsOnly([]);
    await expect(runScheduledReports()).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Test 2: skips project with reportSchedule="off"', async () => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z')); // Monday
    const project = makeProject({
      projectSettings: JSON.stringify({ reportSchedule: 'off', reportEmail: 'a@b.com' }),
    });
    setupDbProjectsOnly([project]);

    await runScheduledReports();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Test 3: sends email for project with reportSchedule="daily"', async () => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z'));
    const project = makeProject({
      projectSettings: JSON.stringify({ reportSchedule: 'daily', reportEmail: 'daily@example.com' }),
    });
    setupDb([project], []);
    vi.mocked(listPayrollWeeks).mockResolvedValue([]);
    vi.mocked(computeCompliance).mockResolvedValue(null);

    await runScheduledReports();

    expect(mockSend).toHaveBeenCalledOnce();
    const callArg = mockSend.mock.calls[0][0] as { subject: string; to: string[] };
    expect(callArg.subject).toContain('Test Project');
    expect(callArg.to).toEqual(['daily@example.com']);
  });

  it('Test 4a: weekly schedule sends on Monday (getUTCDay=1)', async () => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z')); // Monday
    const project = makeProject({
      projectSettings: JSON.stringify({ reportSchedule: 'weekly', reportEmail: 'w@example.com' }),
    });
    setupDb([project], []);
    vi.mocked(listPayrollWeeks).mockResolvedValue([]);
    vi.mocked(computeCompliance).mockResolvedValue(null);

    await runScheduledReports();

    expect(mockSend).toHaveBeenCalledOnce();
  });

  it('Test 4b: weekly schedule does NOT send on Tuesday (getUTCDay=2)', async () => {
    vi.setSystemTime(new Date('2026-04-28T08:00:00Z')); // Tuesday
    const project = makeProject({
      projectSettings: JSON.stringify({ reportSchedule: 'weekly', reportEmail: 'w@example.com' }),
    });
    setupDbProjectsOnly([project]);

    await runScheduledReports();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Test 5a: monthly schedule sends on the 1st of the month', async () => {
    vi.setSystemTime(new Date('2026-05-01T08:00:00Z')); // 1st
    const project = makeProject({
      projectSettings: JSON.stringify({ reportSchedule: 'monthly', reportEmail: 'm@example.com' }),
    });
    setupDb([project], []);
    vi.mocked(listPayrollWeeks).mockResolvedValue([]);
    vi.mocked(computeCompliance).mockResolvedValue(null);

    await runScheduledReports();

    expect(mockSend).toHaveBeenCalledOnce();
  });

  it('Test 5b: monthly schedule does NOT send on day 15', async () => {
    vi.setSystemTime(new Date('2026-05-15T08:00:00Z')); // 15th
    const project = makeProject({
      projectSettings: JSON.stringify({ reportSchedule: 'monthly', reportEmail: 'm@example.com' }),
    });
    setupDbProjectsOnly([project]);

    await runScheduledReports();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Test 6: dedup — skips send when lastReportSentAt === today', async () => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z')); // Monday
    const project = makeProject({
      projectSettings: JSON.stringify({
        reportSchedule: 'daily',
        reportEmail: 'x@example.com',
        lastReportSentAt: '2026-04-27', // today
      }),
    });
    setupDbProjectsOnly([project]);

    await runScheduledReports();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Test 7: falls back to project owner email when reportEmail is empty', async () => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z'));
    const project = makeProject({
      projectSettings: JSON.stringify({ reportSchedule: 'daily', reportEmail: '' }),
    });
    const ownerRow = { email: 'owner@example.com' };
    setupDb([project], [ownerRow]);
    vi.mocked(listPayrollWeeks).mockResolvedValue([]);
    vi.mocked(computeCompliance).mockResolvedValue(null);

    await runScheduledReports();

    expect(mockSend).toHaveBeenCalledOnce();
    const callArg = mockSend.mock.calls[0][0] as { to: string[] };
    expect(callArg.to).toEqual(['owner@example.com']);
  });

  it('Test 8: updates lastReportSentAt after send — sibling keys preserved', async () => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z'));
    const existingSettings = {
      reportSchedule: 'daily',
      reportEmail: 'r@test.com',
      notifyViolations: true,
      lastDueSoonNotifiedAt: '2026-04-25',
      someOtherKey: 'preserved',
    };
    const project = makeProject({
      projectSettings: JSON.stringify(existingSettings),
    });
    const { update, setChain } = setupDb([project], []);
    vi.mocked(listPayrollWeeks).mockResolvedValue([]);
    vi.mocked(computeCompliance).mockResolvedValue(null);

    await runScheduledReports();

    expect(update).toHaveBeenCalledOnce();
    const setArg = setChain.set.mock.calls[0][0] as { projectSettings: string; updatedAt: string };
    const parsed = JSON.parse(setArg.projectSettings);

    expect(parsed.lastReportSentAt).toBe('2026-04-27');
    // Sibling keys must survive read-modify-write
    expect(parsed.notifyViolations).toBe(true);
    expect(parsed.lastDueSoonNotifiedAt).toBe('2026-04-25');
    expect(parsed.someOtherKey).toBe('preserved');
  });

  it('Test 9: error in one project does not stop processing the next', async () => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z'));
    const project1 = makeProject({ id: 'proj-1', name: 'Project One',
      projectSettings: JSON.stringify({ reportSchedule: 'daily', reportEmail: 'a@test.com' }),
    });
    const project2 = makeProject({ id: 'proj-2', name: 'Project Two',
      projectSettings: JSON.stringify({ reportSchedule: 'daily', reportEmail: 'b@test.com' }),
    });

    const { update } = makeUpdateChain();
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([project1, project2]),
        }),
      })),
      update,
    } as any);

    vi.mocked(listPayrollWeeks)
      .mockRejectedValueOnce(new Error('DB timeout for project1')) // project1 throws
      .mockResolvedValueOnce([]); // project2 succeeds

    vi.mocked(computeCompliance).mockResolvedValue(null);

    await runScheduledReports();

    // Only project2 should send — project1 threw during listPayrollWeeks
    expect(mockSend).toHaveBeenCalledOnce();
    const callArg = mockSend.mock.calls[0][0] as { to: string[] };
    expect(callArg.to).toEqual(['b@test.com']);
  });

  it('Test 10: email html includes the unsubscribe link with token', async () => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z'));
    const project = makeProject({
      projectSettings: JSON.stringify({
        reportSchedule: 'daily',
        reportEmail: 'tok@example.com',
        reportUnsubscribeToken: 'my-token-abc',
      }),
    });
    setupDb([project], []);
    vi.mocked(listPayrollWeeks).mockResolvedValue([]);
    vi.mocked(computeCompliance).mockResolvedValue(null);

    await runScheduledReports();

    expect(mockSend).toHaveBeenCalledOnce();
    const callArg = mockSend.mock.calls[0][0] as { html: string; text: string };
    expect(callArg.html).toContain('/api/notifications/unsubscribe?token=my-token-abc');
    expect(callArg.text).toContain('Unsubscribe:');
  });

  it('Test 11: compliance stats included in email — rate and violations count', async () => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z'));
    const project = makeProject({
      projectSettings: JSON.stringify({ reportSchedule: 'daily', reportEmail: 'stats@example.com' }),
    });
    setupDb([project], []);

    const week1 = { id: 'wk-1', weekEndingDate: '2026-04-20', submittedAt: '2026-04-21T00:00:00Z' };
    const week2 = { id: 'wk-2', weekEndingDate: '2026-04-27', submittedAt: null };
    vi.mocked(listPayrollWeeks).mockResolvedValue([week1, week2] as any);
    vi.mocked(computeCompliance)
      .mockResolvedValueOnce(makeCompliantResult('wk-1'))   // week1 compliant
      .mockResolvedValueOnce(makeViolationResult('wk-2'));  // week2 has 2 violations (1 + 1)

    await runScheduledReports();

    expect(mockSend).toHaveBeenCalledOnce();
    const callArg = mockSend.mock.calls[0][0] as { html: string };
    // 1 of 2 weeks compliant = 50%
    expect(callArg.html).toContain('50%');
    expect(callArg.html).toContain('1/2 weeks');
    // 2 open violations (1 entry + 1 week violation)
    expect(callArg.html).toContain('<strong>2</strong>');
  });
});
