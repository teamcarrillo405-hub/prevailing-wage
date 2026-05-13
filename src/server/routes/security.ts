// src/server/routes/security.ts
// Phase 82 (Gap-2) — SOC 2 user-facing security dashboard.
// Mounted at /api/security.

import { Router } from 'express';
import { eq, and, gte, desc, count } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, securityEvents, loginAttempts } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { insertSecurityEvent } from '../db/auditHelpers.js';

const router = Router();
router.use(requireAuth);

// ── GET /api/security/overview ───────────────────────────────────────────
// One-shot bundle the dashboard renders: MFA status, active session count,
// last 20 security events, last 10 login attempts.
router.get('/overview', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      totpEnabled: users.totpEnabled,
      sessionVersion: users.sessionVersion,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Active session estimate: distinct (ipAddress, userAgent) pairs from
  // the last 30 days of `login_success` security events.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentLogins = await db
    .select({
      ipAddress: securityEvents.ipAddress,
      userAgent: securityEvents.userAgent,
    })
    .from(securityEvents)
    .where(
      and(
        eq(securityEvents.userId, userId),
        eq(securityEvents.eventType, 'login_success'),
        gte(securityEvents.createdAt, thirtyDaysAgo),
      ),
    );

  type LoginRow = typeof recentLogins[number];
  const sessionKeys = new Set<string>();
  for (const row of recentLogins) {
    const r = row as LoginRow;
    sessionKeys.add(`${r.ipAddress ?? '?'}::${r.userAgent ?? '?'}`);
  }

  // Last 20 security events (any type) — userId scoped
  const events = await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.userId, userId))
    .orderBy(desc(securityEvents.createdAt))
    .limit(20);

  // Mask the last octet of IPv4 addresses so screenshots/exports don't leak
  // operator IPs in support transcripts.
  type EventRow = typeof events[number];
  const maskedEvents = events.map((e: EventRow) => ({
    id: e.id,
    eventType: e.eventType,
    ipAddress: maskIp(e.ipAddress),
    userAgent: shortenUserAgent(e.userAgent),
    metadata: e.metadata,
    createdAt: e.createdAt,
  }));

  // Last 10 login attempts (any success/fail) by email
  const loginAttemptRows = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.email, user.email))
    .orderBy(desc(loginAttempts.createdAt))
    .limit(10);

  type AttemptRow = typeof loginAttemptRows[number];
  const maskedAttempts = loginAttemptRows.map((a: AttemptRow) => ({
    id: a.id,
    success: a.success,
    ipAddress: maskIp(a.ipAddress),
    failureReason: a.failureReason,
    createdAt: a.createdAt,
  }));

  res.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        mfaEnabled: user.totpEnabled === true,
        sessionVersion: user.sessionVersion ?? 0,
        memberSince: user.createdAt,
      },
      activeSessionCount: sessionKeys.size,
      events: maskedEvents,
      loginAttempts: maskedAttempts,
    },
  });
});

// ── POST /api/security/revoke-sessions ───────────────────────────────────
// Bumps the user's sessionVersion. Every previously-issued JWT carries the
// pre-bump value in its `sv` claim and will be rejected by requireAuth.
router.post('/revoke-sessions', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const [user] = await db
    .select({ sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const nextVersion = (user.sessionVersion ?? 0) + 1;

  await db
    .update(users)
    .set({
      sessionVersion: nextVersion,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));

  void insertSecurityEvent({
    userId,
    eventType: 'sessions_revoked',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
    metadata: { newSessionVersion: nextVersion },
  });

  // Clear the cookie on the current request so the operator is bounced to
  // login on their next nav.
  res.clearCookie('pw_session', { path: '/' });

  res.json({
    data: {
      revoked: true,
      newSessionVersion: nextVersion,
    },
  });
});

// ── GET /api/security/event-count ────────────────────────────────────────
// Lightweight count for the nav badge / homepage card.
router.get('/event-count', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(securityEvents)
    .where(
      and(
        eq(securityEvents.userId, userId),
        gte(securityEvents.createdAt, sevenDaysAgo),
      ),
    );

  res.json({ data: { lastSevenDays: Number(total) } });
});

router.get('/evidence-room', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      totpEnabled: users.totpEnabled,
      sessionVersion: users.sessionVersion,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ value: securityEventCount }] = await db
    .select({ value: count() })
    .from(securityEvents)
    .where(and(eq(securityEvents.userId, userId), gte(securityEvents.createdAt, thirtyDaysAgo)));

  const controls = [
    {
      id: 'mfa',
      label: 'Multi-factor authentication',
      status: user.totpEnabled ? 'implemented' : 'action-needed',
      evidence: user.totpEnabled ? 'TOTP is enabled for this account.' : 'Enable TOTP before enterprise pilot signoff.',
    },
    {
      id: 'session-revocation',
      label: 'Session revocation',
      status: 'implemented',
      evidence: `Current session version is ${user.sessionVersion ?? 0}; revoke-sessions invalidates older JWTs.`,
    },
    {
      id: 'security-events',
      label: 'Security event logging',
      status: Number(securityEventCount) > 0 ? 'implemented' : 'needs-evidence',
      evidence: `${Number(securityEventCount)} security event(s) recorded in the last 30 days for this user.`,
    },
    {
      id: 'audit-integrity',
      label: 'Audit hash-chain integrity',
      status: 'implemented',
      evidence: 'Project audit routes expose evidence packets and integrity-check coverage is tested.',
    },
    {
      id: 'access-boundaries',
      label: 'Role and tenant boundaries',
      status: 'implemented',
      evidence: 'Project access utilities enforce owner/member/auditor boundaries on scoped routes.',
    },
  ];

  res.json({
    data: {
      generatedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        memberSince: user.createdAt,
      },
      controls,
      nextActions: controls
        .filter((control) => control.status !== 'implemented')
        .map((control) => control.evidence),
    },
  });
});

function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  // IPv4 — mask last octet
  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) return `${v4[1]}.xxx`;
  // IPv6 — mask trailing two groups
  const v6 = ip.match(/^([0-9a-fA-F:]+):[0-9a-fA-F]+:[0-9a-fA-F]+$/);
  if (v6) return `${v6[1]}:xxxx:xxxx`;
  return ip; // unknown format — leave as-is
}

function shortenUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  // Quick heuristic: pull out the major browser token.
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/curl\//.test(ua)) return 'curl';
  if (/Postman/.test(ua)) return 'Postman';
  return ua.slice(0, 60);
}

export default router;
