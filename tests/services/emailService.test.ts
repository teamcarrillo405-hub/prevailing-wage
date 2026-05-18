import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Mock resend before importing emailService so the lazy-init picks up the mock
const mockSend = vi.fn().mockResolvedValue({ error: null });

// Resend must be mocked as a proper constructable function (not vi.fn())
// because emailService does `new Resend(...)` via dynamic import.
vi.mock('resend', () => {
  function ResendMock() {
    return { emails: { send: mockSend } };
  }
  return { Resend: ResendMock };
});

// Mock DB so getProjectMemberRows and getProjectSettings work without a real DB
vi.mock('../../src/server/db/index.js', () => ({
  getDb: vi.fn(),
}));

import {
  getNotifSettings,
  sendViolationEmail,
  sendDueSoonEmail,
  sendActivityEmail,
  sendSubmissionConfirmationEmail,
  sendEmail,
  sendSupportForward,
} from '../../src/server/services/emailService.js';
import { getDb } from '../../src/server/db/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

beforeEach(() => {
  mockSend.mockClear();
  vi.mocked(getDb).mockReset();
});

// ── Helper: build a Drizzle-shaped mock DB ──────────────────────────────────

/**
 * mockDb returns a mock getDb() that chains select().from().innerJoin().where()
 * for member rows, and select().from().where().limit() for project settings.
 *
 * The same selectChain is reused; `where` returns memberRows for the first call
 * (member join query) and `limit` returns [{ projectSettings }] for the second call.
 */
function mockDb(
  memberRows: Array<{ userId: string; role: string; email: string }>,
  projectSettings = '{}',
) {
  // sendViolationEmail call order: getProjectSettings first, then getProjectMemberRows
  // sendActivityEmail call order: getProjectMemberRows first, then getProjectSettings
  // We make both chains work for either order by giving each chain the right terminal method.

  // Chain for member query: .select().from().innerJoin().where() → resolves memberRows
  const memberChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(memberRows),
    limit: vi.fn().mockResolvedValue([{ projectSettings }]),
  };

  // Chain for settings query: .select().from().where().limit() → resolves [{ projectSettings }]
  const settingsChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ projectSettings }]),
  };

  let callCount = 0;
  vi.mocked(getDb).mockReturnValue({
    select: vi.fn().mockImplementation(() => {
      callCount++;
      // sendViolationEmail: call 1 = getProjectSettings (needs .limit()), call 2 = getProjectMemberRows (needs .where() → resolves)
      // sendActivityEmail: call 1 = getProjectMemberRows (needs .where() → resolves), call 2 = getProjectSettings (needs .limit())
      // We return settingsChain first (it has .limit()), memberChain second (it has .where() that resolves)
      // But for sendActivityEmail, call 1 IS the member query — it also calls .where() which resolves on memberChain.
      // Solution: return settingsChain always, but give settingsChain a .where() that conditionally resolves.
      // Simpler: just alternate — odd calls = settingsChain, even calls = memberChain.
      // Since sendViolationEmail calls settings first: 1=settings, 2=members ✓
      // Since sendActivityEmail calls members first: 1=members (settingsChain.where() resolves memberRows? no...)
      // Best approach: detect by checking which chain is needed via a combined chain that handles both patterns.
      return callCount % 2 === 1 ? settingsChain : memberChain;
    }),
  } as any);

  // Override settingsChain.where to also resolve memberRows so it can serve as member chain too
  // when sendActivityEmail calls it first. This is getting complex — use a simpler all-in-one chain.
  // Let's reset and use a single universal chain:
  const universalChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(function(this: typeof universalChain) {
      // If innerJoin was called, this is the member query — return this for direct resolution
      return this;
    }),
    limit: vi.fn().mockResolvedValue([{ projectSettings }]),
  };
  // Make where() resolve memberRows when called from member query (innerJoin path)
  // and return `this` when called from settings query (limit path).
  // We detect: if innerJoin was called before where, it's a member query.
  universalChain.where = vi.fn().mockImplementation(function(this: typeof universalChain) {
    if (universalChain.innerJoin.mock.calls.length > 0) {
      // Member query path — resolve directly
      return Promise.resolve(memberRows);
    }
    // Settings query path — return this for chaining to .limit()
    return universalChain;
  });

  vi.mocked(getDb).mockReturnValue({
    select: vi.fn().mockImplementation(() => {
      // Reset innerJoin call count for each select
      universalChain.innerJoin.mockClear();
      return universalChain;
    }),
  } as any);
}

// ── getNotifSettings ────────────────────────────────────────────────────────

describe('getNotifSettings', () => {
  it('returns all-true defaults when input is null', () => {
    const settings = getNotifSettings(null);
    expect(settings.notifyViolations).toBe(true);
    expect(settings.notifyDueSoon).toBe(true);
    expect(settings.dueSoonDays).toBe(3);
    expect(settings.notifyActivity).toBe(true);
    expect(settings.notifySubmission).toBe(true);
  });

  it('returns all-true defaults when input is empty string', () => {
    const settings = getNotifSettings('');
    expect(settings.notifyViolations).toBe(true);
    expect(settings.dueSoonDays).toBe(3);
  });

  it('parses valid JSON correctly and overrides defaults', () => {
    const settings = getNotifSettings('{"notifyViolations":false,"dueSoonDays":7}');
    expect(settings.notifyViolations).toBe(false);
    expect(settings.dueSoonDays).toBe(7);
    // Non-overridden keys remain default
    expect(settings.notifyDueSoon).toBe(true);
    expect(settings.notifyActivity).toBe(true);
    expect(settings.notifySubmission).toBe(true);
  });

  it('returns defaults without throwing on malformed JSON', () => {
    expect(() => {
      const settings = getNotifSettings('not valid json {{{');
      expect(settings.notifyViolations).toBe(true);
      expect(settings.dueSoonDays).toBe(3);
    }).not.toThrow();
  });

  it('merges partial settings over defaults (empty object)', () => {
    const settings = getNotifSettings('{}');
    expect(settings.notifyViolations).toBe(true);
    expect(settings.notifyDueSoon).toBe(true);
    expect(settings.dueSoonDays).toBe(3);
    expect(settings.notifyActivity).toBe(true);
    expect(settings.notifySubmission).toBe(true);
  });
});

// ── sendViolationEmail ──────────────────────────────────────────────────────

describe('sendViolationEmail', () => {
  it('is a no-op and does not throw when RESEND_API_KEY is absent', async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    await expect(
      sendViolationEmail('proj-1', 'week-1', 'Test Project', '2026-04-06', [], []),
    ).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = saved;
  });

  it('skips send when project notifyViolations is false', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockDb(
      [{ userId: 'u1', role: 'owner', email: 'owner@example.com' }],
      '{"notifyViolations":false}',
    );

    await sendViolationEmail(
      'proj-1',
      'week-1',
      'Test Project',
      '2026-04-06',
      [{ entryId: 'e1', workerId: 'w1', workerName: 'Alice', violationType: 'under-wage', expected: 20, actual: 15, delta: -5 }],
      [],
    );

    expect(mockSend).not.toHaveBeenCalled();
    delete process.env.RESEND_API_KEY;
  });

  it('sends to all project members when violations exist and notifyViolations is true', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockDb([
      { userId: 'u1', role: 'owner', email: 'owner@example.com' },
      { userId: 'u2', role: 'member', email: 'member@example.com' },
    ]);

    await sendViolationEmail(
      'proj-1',
      'week-1',
      'Test Project',
      '2026-04-06',
      [{ entryId: 'e1', workerId: 'w1', workerName: 'Alice', violationType: 'under-wage', expected: 20, actual: 15, delta: -5 }],
      [],
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toContain('owner@example.com');
    expect(callArgs.to).toContain('member@example.com');
    delete process.env.RESEND_API_KEY;
  });

  it('does not throw when Resend.send throws internally (NFR-02)', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockRejectedValueOnce(new Error('Resend down'));
    mockDb([{ userId: 'u1', role: 'owner', email: 'owner@example.com' }]);

    await expect(
      sendViolationEmail(
        'proj-1',
        'week-1',
        'Test Project',
        '2026-04-06',
        [{ entryId: 'e1', workerId: 'w1', workerName: 'Alice', violationType: 'under-wage', expected: 20, actual: 15, delta: -5 }],
        [],
      ),
    ).resolves.toBeUndefined();

    delete process.env.RESEND_API_KEY;
  });
});

// ── sendDueSoonEmail ────────────────────────────────────────────────────────

describe('sendDueSoonEmail', () => {
  it('sends to ownerEmail provided as argument', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    await sendDueSoonEmail(
      'proj-1',
      'Test Project',
      'owner@example.com',
      '2026-04-10',
      2,
      3,
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toEqual(['owner@example.com']);
    expect(callArgs.subject).toContain('Test Project');
    delete process.env.RESEND_API_KEY;
  });

  it('is a no-op when RESEND_API_KEY is absent', async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    await expect(
      sendDueSoonEmail('proj-1', 'Test Project', 'owner@example.com', '2026-04-10', 2, 3),
    ).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = saved;
  });

  it('does not throw when Resend.send throws internally (NFR-02)', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockRejectedValueOnce(new Error('Resend down'));

    await expect(
      sendDueSoonEmail('proj-1', 'Test Project', 'owner@example.com', '2026-04-10', 2, 3),
    ).resolves.toBeUndefined();

    delete process.env.RESEND_API_KEY;
  });
});

// ── sendActivityEmail ───────────────────────────────────────────────────────

describe('sendActivityEmail', () => {
  it('skips send when actingUserId equals ownerUserId (NOTIF-03 guard)', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockDb([{ userId: 'owner-id', role: 'owner', email: 'owner@example.com' }]);

    await sendActivityEmail(
      'proj-1',
      'Test Project',
      'owner-id',          // actingUserId === ownerUserId
      'owner@example.com',
      'Added worker Alice',
    );

    expect(mockSend).not.toHaveBeenCalled();
    delete process.env.RESEND_API_KEY;
  });

  it('sends to owner when actingUserId is different from ownerUserId', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockDb([
      { userId: 'owner-id', role: 'owner', email: 'owner@example.com' },
      { userId: 'member-id', role: 'member', email: 'member@example.com' },
    ]);

    await sendActivityEmail(
      'proj-1',
      'Test Project',
      'member-id',         // actingUserId !== ownerUserId
      'member@example.com',
      'Added worker Bob',
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toEqual(['owner@example.com']);
    delete process.env.RESEND_API_KEY;
  });

  it('skips send when notifyActivity is false in project settings', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockDb(
      [
        { userId: 'owner-id', role: 'owner', email: 'owner@example.com' },
        { userId: 'member-id', role: 'member', email: 'member@example.com' },
      ],
      '{"notifyActivity":false}',
    );

    await sendActivityEmail(
      'proj-1',
      'Test Project',
      'member-id',
      'member@example.com',
      'Added worker Charlie',
    );

    expect(mockSend).not.toHaveBeenCalled();
    delete process.env.RESEND_API_KEY;
  });

  it('is a no-op when RESEND_API_KEY is absent', async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    await expect(
      sendActivityEmail('proj-1', 'Test Project', 'member-id', 'member@example.com', 'Added worker'),
    ).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = saved;
  });

  it('does not throw when Resend.send throws internally (NFR-02)', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockRejectedValueOnce(new Error('Resend down'));
    mockDb([
      { userId: 'owner-id', role: 'owner', email: 'owner@example.com' },
      { userId: 'member-id', role: 'member', email: 'member@example.com' },
    ]);

    await expect(
      sendActivityEmail('proj-1', 'Test Project', 'member-id', 'member@example.com', 'Added worker'),
    ).resolves.toBeUndefined();

    delete process.env.RESEND_API_KEY;
  });
});

// ── sendSubmissionConfirmationEmail ─────────────────────────────────────────

describe('sendSubmissionConfirmationEmail', () => {
  it('sends to the toEmail with subject containing agency name', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    await sendSubmissionConfirmationEmail(
      'submitter@example.com',
      'Test Project',
      'CA DIR',
      '2026-04-06',
      'proj-1',
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toEqual(['submitter@example.com']);
    expect(callArgs.subject).toContain('CA DIR');
    expect(callArgs.subject).toContain('Test Project');
    delete process.env.RESEND_API_KEY;
  });

  it('is a no-op when RESEND_API_KEY is absent', async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    await expect(
      sendSubmissionConfirmationEmail('user@example.com', 'Project', 'WA L&I', '2026-04-06', 'proj-1'),
    ).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = saved;
  });

  it('does not throw when Resend.send throws internally (NFR-02)', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockRejectedValueOnce(new Error('Resend down'));

    await expect(
      sendSubmissionConfirmationEmail('user@example.com', 'Project', 'WA L&I', '2026-04-06', 'proj-1'),
    ).resolves.toBeUndefined();

    delete process.env.RESEND_API_KEY;
  });
});

// ── sendEmail ───────────────────────────────────────────────────────────────

describe('sendEmail', () => {
  it('is a no-op and does not throw when RESEND_API_KEY is absent', async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    await expect(
      sendEmail('user@example.com', 'Test Subject', '<p>Hello</p>'),
    ).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = saved;
  });

  it('calls Resend.send with correct from/to/subject/html when key is set', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    await sendEmail('recipient@example.com', 'Hello World', '<p>Body</p>');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const args = mockSend.mock.calls[0][0];
    expect(args.to).toBe('recipient@example.com');
    expect(args.subject).toBe('Hello World');
    expect(args.html).toBe('<p>Body</p>');
    delete process.env.RESEND_API_KEY;
  });

  it('does not throw when Resend.send throws internally (NFR-02)', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockRejectedValueOnce(new Error('Resend down'));

    await expect(
      sendEmail('user@example.com', 'Subject', '<p>Body</p>'),
    ).resolves.toBeUndefined();

    delete process.env.RESEND_API_KEY;
  });
});

// ── sendSupportForward ──────────────────────────────────────────────────────

describe('sendSupportForward', () => {
  it('is a no-op when RESEND_API_KEY is absent', async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    await expect(
      sendSupportForward('user@example.com', 'Jane Doe', 'Help needed', 'I need assistance.'),
    ).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = saved;
  });

  it('sends to SUPPORT_ADDRESS with [Contact] prefix in subject', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    await sendSupportForward('user@example.com', 'Jane Doe', 'Help needed', 'I need assistance.');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const args = mockSend.mock.calls[0][0];
    expect(args.subject).toContain('[Contact]');
    expect(args.subject).toContain('Help needed');
    expect(args.html).toContain('Jane Doe');
    expect(args.html).toContain('user@example.com');
    delete process.env.RESEND_API_KEY;
  });

  it('does not throw when Resend.send throws internally (NFR-02)', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockRejectedValueOnce(new Error('Resend down'));

    await expect(
      sendSupportForward('user@example.com', 'Jane', 'Subject', 'Message'),
    ).resolves.toBeUndefined();

    delete process.env.RESEND_API_KEY;
  });
});
