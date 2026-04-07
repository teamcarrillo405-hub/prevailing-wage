// tests/services/dueSoonService.test.ts
// Unit tests for dueSoonService.ts (NOTIF-02).
// All external dependencies mocked: db/index.js, payrollService.js, emailService.js.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── Mocks — vi.mock factories are hoisted; no outer variable references allowed ──

vi.mock('../../src/server/services/emailService.js', () => ({
  sendDueSoonEmail: vi.fn().mockResolvedValue(undefined),
  getNotifSettings: vi.fn((raw: string | null | undefined) => {
    const defaults = {
      notifyViolations: true,
      notifyDueSoon: true,
      dueSoonDays: 3,
      notifyActivity: true,
      notifySubmission: true,
    };
    if (!raw) return defaults;
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }),
}));

vi.mock('../../src/server/services/payrollService.js', () => ({
  listPayrollWeeks: vi.fn(),
}));

vi.mock('../../src/server/db/index.js', () => ({
  getDb: vi.fn(),
}));

// Imports AFTER mocks
import { dateDiffDays, runDueSoonScan } from '../../src/server/services/dueSoonService.js';
import { sendDueSoonEmail } from '../../src/server/services/emailService.js';
import { listPayrollWeeks } from '../../src/server/services/payrollService.js';
import { getDb } from '../../src/server/db/index.js';

// ── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns an ISO date string N days from today's UTC date. */
function daysFromToday(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Active project fixture with optional projectSettings override. */
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

/** Owner member row fixture. */
function makeOwnerRow(email = 'owner@example.com') {
  return { userId: 'user-1', role: 'owner', email };
}

/** Build the update chain mock that db.update().set().where() uses. */
function makeUpdateChain() {
  const whereChain = { where: vi.fn().mockResolvedValue(undefined) };
  const setChain = { set: vi.fn().mockReturnValue(whereChain) };
  return { update: vi.fn().mockReturnValue(setChain), whereChain, setChain };
}

/**
 * Configure getDb() for a two-select-call pattern:
 *   Call 1: projects query  → .select().from().where()  → resolves projectRows
 *   Call 2: member join     → .select().from().innerJoin().where() → resolves memberRows
 * Plus optional update chain.
 */
function setupDb(projectRows: object[], memberRows: object[]) {
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
      // Member join query
      return {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(memberRows),
          }),
        }),
      };
    }),
    update,
  } as any);

  return { update, setChain, whereChain };
}

/**
 * Configure getDb() for a projects-only select (no member query expected).
 */
function setupDbProjectsOnly(projectRows: object[]) {
  vi.mocked(getDb).mockReturnValue({
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(projectRows),
      }),
    })),
    update: vi.fn(),
  } as any);
}

// ── dateDiffDays unit tests ──────────────────────────────────────────────────

describe('dateDiffDays', () => {
  it('returns positive when target is in the future', () => {
    expect(dateDiffDays('2025-01-08', '2025-01-10')).toBe(2);
  });

  it('returns negative when target is in the past', () => {
    expect(dateDiffDays('2025-01-10', '2025-01-08')).toBe(-2);
  });

  it('returns 0 when dates are equal', () => {
    expect(dateDiffDays('2025-01-08', '2025-01-08')).toBe(0);
  });
});

// ── runDueSoonScan tests ─────────────────────────────────────────────────────

describe('runDueSoonScan', () => {
  it('skips project where notifyDueSoon is false', async () => {
    const project = makeProject({
      projectSettings: JSON.stringify({ notifyDueSoon: false }),
    });
    setupDbProjectsOnly([project]);

    await runDueSoonScan();

    expect(vi.mocked(sendDueSoonEmail)).not.toHaveBeenCalled();
    expect(vi.mocked(listPayrollWeeks)).not.toHaveBeenCalled();
  });

  it('skips project when no unsubmitted weeks exist', async () => {
    const project = makeProject();
    setupDb([project], [makeOwnerRow()]);
    vi.mocked(listPayrollWeeks).mockResolvedValue([
      { id: 'wk-1', weekEndingDate: daysFromToday(2), submittedAt: '2026-04-01T00:00:00Z' } as any,
    ]);

    await runDueSoonScan();

    expect(vi.mocked(sendDueSoonEmail)).not.toHaveBeenCalled();
  });

  it('skips project when unsubmitted week is outside threshold (10 days, threshold 3)', async () => {
    const project = makeProject();
    setupDb([project], [makeOwnerRow()]);
    vi.mocked(listPayrollWeeks).mockResolvedValue([
      { id: 'wk-1', weekEndingDate: daysFromToday(10), submittedAt: null } as any,
    ]);

    await runDueSoonScan();

    expect(vi.mocked(sendDueSoonEmail)).not.toHaveBeenCalled();
  });

  it('sends email when most recent unsubmitted week is within threshold', async () => {
    const project = makeProject();
    const weekEndingDate = daysFromToday(2); // 2 days from now; threshold = 3
    setupDb([project], [makeOwnerRow()]);
    vi.mocked(listPayrollWeeks).mockResolvedValue([
      { id: 'wk-1', weekEndingDate, submittedAt: null } as any,
    ]);

    await runDueSoonScan();

    expect(vi.mocked(sendDueSoonEmail)).toHaveBeenCalledOnce();
    expect(vi.mocked(sendDueSoonEmail)).toHaveBeenCalledWith(
      'proj-1',
      'Test Project',
      'owner@example.com',
      weekEndingDate,
      2,
      3,
    );
  });

  it('dedup: skips when lastDueSoonNotifiedAt equals today', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const project = makeProject({
      projectSettings: JSON.stringify({ lastDueSoonNotifiedAt: today }),
    });
    setupDbProjectsOnly([project]);

    await runDueSoonScan();

    expect(vi.mocked(sendDueSoonEmail)).not.toHaveBeenCalled();
    expect(vi.mocked(listPayrollWeeks)).not.toHaveBeenCalled();
  });

  it('dedup: sends when lastDueSoonNotifiedAt is yesterday', async () => {
    const yesterday = daysFromToday(-1);
    const weekEndingDate = daysFromToday(2);
    const project = makeProject({
      projectSettings: JSON.stringify({ lastDueSoonNotifiedAt: yesterday }),
    });
    setupDb([project], [makeOwnerRow()]);
    vi.mocked(listPayrollWeeks).mockResolvedValue([
      { id: 'wk-1', weekEndingDate, submittedAt: null } as any,
    ]);

    await runDueSoonScan();

    expect(vi.mocked(sendDueSoonEmail)).toHaveBeenCalledOnce();
  });

  it('updates projectSettings.lastDueSoonNotifiedAt after send (read-modify-write)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const existingSettings = { someOtherKey: 'preserved' };
    const project = makeProject({
      projectSettings: JSON.stringify(existingSettings),
    });
    const weekEndingDate = daysFromToday(1);
    const { update, setChain } = setupDb([project], [makeOwnerRow()]);
    vi.mocked(listPayrollWeeks).mockResolvedValue([
      { id: 'wk-1', weekEndingDate, submittedAt: null } as any,
    ]);

    await runDueSoonScan();

    expect(update).toHaveBeenCalledOnce();
    const setArg = setChain.set.mock.calls[0][0] as { projectSettings: string; updatedAt: string };
    const parsed = JSON.parse(setArg.projectSettings);
    // lastDueSoonNotifiedAt must be today
    expect(parsed.lastDueSoonNotifiedAt).toBe(today);
    // Sibling keys must be preserved (read-modify-write, not overwrite)
    expect(parsed.someOtherKey).toBe('preserved');
  });

  it('skips project with no owner in projectMembers', async () => {
    const project = makeProject();
    const weekEndingDate = daysFromToday(2);
    // Only a plain member, no owner
    setupDb([project], [{ userId: 'u-2', role: 'member', email: 'member@test.com' }]);
    vi.mocked(listPayrollWeeks).mockResolvedValue([
      { id: 'wk-1', weekEndingDate, submittedAt: null } as any,
    ]);

    await runDueSoonScan();

    expect(vi.mocked(sendDueSoonEmail)).not.toHaveBeenCalled();
  });

  it('continues scanning other projects when one throws an error', async () => {
    const project1 = makeProject({ id: 'proj-1', name: 'Project One' });
    const project2 = makeProject({ id: 'proj-2', name: 'Project Two' });
    const weekEndingDate = daysFromToday(2);

    // update chain for project2 (project1 will throw before hitting update)
    const { update: update2, setChain: setChain2 } = makeUpdateChain();

    let selectCallCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // All projects
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([project1, project2]),
            }),
          };
        }
        // Member queries: alternate project1 (throws) then project2 (succeeds)
        const isMemberQueryForProject1 = selectCallCount === 2;
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: isMemberQueryForProject1
                ? vi.fn().mockRejectedValue(new Error('DB failure'))
                : vi.fn().mockResolvedValue([{ userId: 'u-2', role: 'owner', email: 'owner2@example.com' }]),
            }),
          }),
        };
      }),
      update: update2,
    } as any);

    vi.mocked(listPayrollWeeks)
      .mockResolvedValueOnce([{ id: 'wk-1', weekEndingDate, submittedAt: null } as any])  // proj-1
      .mockResolvedValueOnce([{ id: 'wk-2', weekEndingDate, submittedAt: null } as any]); // proj-2

    await runDueSoonScan();

    // Only project2 should send email — project1 threw during member query
    expect(vi.mocked(sendDueSoonEmail)).toHaveBeenCalledOnce();
    expect(vi.mocked(sendDueSoonEmail)).toHaveBeenCalledWith(
      'proj-2',
      'Project Two',
      'owner2@example.com',
      weekEndingDate,
      2,
      3,
    );
  });
});
