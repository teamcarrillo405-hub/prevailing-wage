/**
 * Unit/integration tests for the certificationExpiryAlerts job (DBE-03).
 *
 * Uses:
 * - vi.mock('resend') with inline factory using class syntax (Phase 46 pattern)
 * - In-memory SQLite DB from tests/helpers/db.ts setupFile via globalThis.__testDb
 * - Direct DB inserts to seed test data without going through HTTP routes
 *
 * Lazy-init note: the job module caches `resendInstance` at module scope. Since
 * Vitest re-uses the same module instance across tests in a file (no resetModules),
 * we work around the singleton by clearing the mock state via vi.clearAllMocks()
 * and relying on the fact that the mock constructor returns the SAME mock object
 * per Resend instance — so we can always read `mockSend` from our shared reference.
 *
 * Key: The mock must use `class Resend` syntax (not arrow function) so that
 * `new Resend(...)` in the job's dynamic import path works correctly.
 */

// Env vars must be set BEFORE any server module is imported.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-okay';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock Resend with inline class factory (Phase 46 pattern — locked in STATE.md) ──
// Must use `class` or `function` so `new Resend()` works as a constructor.
// The mock is declared here and hoisted by Vitest before any imports below.
const mockSend = vi.fn().mockResolvedValue({ data: { id: 'test-email-id' }, error: null });

vi.mock('resend', () => {
  // Use a function (not arrow) so `new ResendMock()` works as a constructor
  function ResendMock(_apiKey: string) {
    return {
      emails: {
        send: mockSend,
      },
    };
  }
  return { Resend: ResendMock };
});

// Import the job AFTER the mock is registered
import { runCertificationExpiryAlerts } from '../certificationExpiryAlerts.js';

// Schema imports for direct DB seeding
import {
  users,
  projects,
  projectMembers,
  subcontractors,
  subcontractorCertifications,
} from '../../db/schema.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute a YYYY-MM-DD date string offset by `days` from today (UTC). */
function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function randomId() {
  return Math.random().toString(36).slice(2, 18);
}

/**
 * Insert a minimal user + project + project owner membership.
 * Returns { userId, projectId, ownerEmail }.
 */
async function seedProjectWithOwner(
  email: string,
): Promise<{ userId: string; projectId: string; ownerEmail: string }> {
  const db = (globalThis as any).__testDb;
  const userId = `u-${randomId()}`;
  const projectId = `p-${randomId()}`;
  const memberId = `m-${randomId()}`;
  const now = new Date().toISOString();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash: 'hashed',
    planTier: 'free',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(projects).values({
    id: projectId,
    userId,
    name: `Test Project ${randomId()}`,
    state: 'TX',
    county: 'travis',
    contractType: 'federal-davis-bacon',
    awardDate: '2025-01-01',
    fundingType: 'federal',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(projectMembers).values({
    id: memberId,
    projectId,
    userId,
    role: 'owner',
    joinedAt: now,
  });

  return { userId, projectId, ownerEmail: email };
}

/**
 * Insert a subcontractor + certification for a project.
 */
async function seedSubWithCert(
  projectId: string,
  expiresDate: string,
  reevaluationStatus = 'cleared',
): Promise<{ subId: string; certId: string }> {
  const db = (globalThis as any).__testDb;
  const subId = `s-${randomId()}`;
  const certId = `c-${randomId()}`;
  const now = new Date().toISOString();

  await db.insert(subcontractors).values({
    id: subId,
    projectId,
    name: `Test Sub ${randomId()}`,
    dbeClassification: 'dbe',
    createdAt: now,
  });

  await db.insert(subcontractorCertifications).values({
    id: certId,
    subcontractorId: subId,
    certTypes: 'DBE',
    expiresDate,
    reevaluationStatus,
    selfCertified: false,
    createdAt: now,
    updatedAt: now,
  });

  return { subId, certId };
}

/** Clean up all cert-related tables. */
async function clearAll() {
  const db = (globalThis as any).__testDb;
  if (db) {
    await db.delete(subcontractorCertifications);
    await db.delete(subcontractors);
    await db.delete(projectMembers);
    await db.delete(projects);
    await db.delete(users);
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('runCertificationExpiryAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockSend call history between tests
    mockSend.mockClear();
  });

  afterEach(async () => {
    // Restore env var state
    delete process.env.RESEND_API_KEY;
    await clearAll();
  });

  it('skips without throwing when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(runCertificationExpiryAlerts()).resolves.not.toThrow();
    // Resend constructor never used — getResend() returned null immediately
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends exactly one email at 90 days before expiry', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key-90';
    const { projectId, ownerEmail } = await seedProjectWithOwner('owner-90@test.local');
    await seedSubWithCert(projectId, isoDateOffset(90));

    await runCertificationExpiryAlerts();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArg = mockSend.mock.calls[0][0];
    const recipients: string[] = Array.isArray(callArg.to) ? callArg.to : [callArg.to];
    expect(recipients).toContain(ownerEmail);
    expect(callArg.subject).toContain('90');
  });

  it('sends exactly one email at 60 days before expiry', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key-60';
    const { projectId, ownerEmail } = await seedProjectWithOwner('owner-60@test.local');
    await seedSubWithCert(projectId, isoDateOffset(60));

    await runCertificationExpiryAlerts();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArg = mockSend.mock.calls[0][0];
    const recipients: string[] = Array.isArray(callArg.to) ? callArg.to : [callArg.to];
    expect(recipients).toContain(ownerEmail);
    expect(callArg.subject).toContain('60');
  });

  it('sends exactly one email at 30 days before expiry', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key-30';
    const { projectId, ownerEmail } = await seedProjectWithOwner('owner-30@test.local');
    await seedSubWithCert(projectId, isoDateOffset(30));

    await runCertificationExpiryAlerts();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArg = mockSend.mock.calls[0][0];
    const recipients: string[] = Array.isArray(callArg.to) ? callArg.to : [callArg.to];
    expect(recipients).toContain(ownerEmail);
    expect(callArg.subject).toContain('30');
  });

  it('does NOT send at off-by-one days (89, 61, 31) — exact-day-match contract', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key-offday';
    const { projectId } = await seedProjectWithOwner('owner-offday@test.local');

    // Certs at 89, 61, 31 should NOT match the job's 90/60/30 exact-day thresholds
    await seedSubWithCert(projectId, isoDateOffset(89));
    await seedSubWithCert(projectId, isoDateOffset(61));
    await seedSubWithCert(projectId, isoDateOffset(31));

    await runCertificationExpiryAlerts();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends email to the project owner — projectMembers JOIN works correctly', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key-owner-join';
    const { projectId, ownerEmail } = await seedProjectWithOwner('owner-join@test.local');
    await seedSubWithCert(projectId, isoDateOffset(90));

    await runCertificationExpiryAlerts();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArg = mockSend.mock.calls[0][0];

    // Must send to the project owner email, not sub contact or other address
    const recipients: string[] = Array.isArray(callArg.to) ? callArg.to : [callArg.to];
    expect(recipients).toContain(ownerEmail);

    // Email body should reference the cert type
    expect(callArg.html).toContain('DBE');
    // Email body should reference the expiry date
    expect(callArg.html).toContain(isoDateOffset(90));
  });
});
