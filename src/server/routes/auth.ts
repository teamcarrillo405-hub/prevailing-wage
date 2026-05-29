import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import { readFileSync } from 'fs';
import path from 'path';
import { getDb } from '../db/index.js';
import { users, projectMembers, teamInvites, onboardingProfiles } from '../db/schema.js';
import { hashPassword, verifyPassword, createSessionToken } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateToken } from '../services/inviteService.js';
import { insertSecurityEvent, insertLoginAttempt } from '../db/auditHelpers.js';
import { verifyTotpToken, consumeBackupCode } from '../services/mfaService.js';
import { sendEmail } from '../services/emailService.js';

// Load welcome email template at module load (fail-safe: empty string if file missing)
let welcomeTemplate = '';
try {
  welcomeTemplate = readFileSync(
    path.join(process.cwd(), 'src/server/email/templates/welcome.html'),
    'utf8',
  );
} catch {
  console.warn('[auth] welcome.html template not found — welcome emails disabled');
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: () => process.env.NODE_ENV === "test" ? 100_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true, // only count failures
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: () => process.env.NODE_ENV === "test" ? 100_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

const authRouter = Router();

const COOKIE_NAME = 'pw_session';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours (SEC-01: shorter session lifetime)
};

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  inviteCode: z.string().optional(),
  hccMembershipNumber: z.string().trim().min(3).max(64).optional(),
  companyName: z.string().trim().min(2).max(160).optional(),
  acceptedTerms: z.boolean().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
authRouter.post('/register', registerLimiter, validate(RegisterSchema), async (req, res) => {
  const { email, password, inviteCode, hccMembershipNumber, companyName } = req.body as z.infer<typeof RegisterSchema>;

  if (process.env.INVITE_CODE && inviteCode !== process.env.INVITE_CODE) {
    res.status(403).json({ error: 'Invalid invitation code' });
    return;
  }

  const db = getDb();

  // Check for duplicate email
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(users).values({
    id,
    email,
    passwordHash,
    hccMembershipNumber: hccMembershipNumber || null,
    companyName: companyName || null,
    createdAt: now,
    updatedAt: now,
    termsAcceptedAt: now,
  });

  // sessionVersion defaults to 0 on insert
  const token = await createSessionToken({ userId: id, email, sv: 0 });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  void insertLoginAttempt({ email, success: true, ipAddress: req.ip });
  void insertSecurityEvent({ userId: id, eventType: 'register', ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });

  // Fire welcome email — non-blocking, never delay registration response
  if (welcomeTemplate) {
    const firstName = (companyName || email.split('@')[0]).split(' ')[0];
    const welcomeHtml = welcomeTemplate
      .replace('{{firstName}}', firstName)
      .replace('{{appUrl}}', process.env.APP_URL ?? 'https://hccprevailingwage.com');
    sendEmail(email, 'Welcome to HCC Prevailing Wage', welcomeHtml)
      .catch((err: unknown) => console.warn('[auth] welcome email failed:', err));
  }

  res.status(201).json({
    data: {
      user: {
        id,
        email,
        hccMembershipNumber: hccMembershipNumber || null,
        companyName: companyName || null,
        onboardingCompletedAt: null,
      },
    },
  });
});

// POST /api/auth/login
authRouter.post('/login', loginLimiter, validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof LoginSchema>;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Always run bcrypt to prevent timing attacks that reveal valid emails
  const DUMMY_HASH = '$2b$12$dummy.hash.for.timing.consistency.padding00000000000';
  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(DUMMY_HASH, password).then(() => false); // always false for dummy

  if (!user || !valid) {
    void insertLoginAttempt({ email, success: false, ipAddress: req.ip, failureReason: !user ? 'email_not_found' : 'wrong_password' });
    void insertSecurityEvent({ userId: user?.id ?? null, eventType: 'login_failure', ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // Phase 78: If MFA is enabled, do NOT issue a JWT yet. Tell the client to
  // collect a TOTP code (or backup code) and call /api/auth/mfa-login.
  if (user.totpEnabled) {
    void insertSecurityEvent({
      userId: user.id,
      eventType: 'login_password_ok_mfa_required',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.status(200).json({ data: { requiresMfa: true, userId: user.id } });
    return;
  }

  const token = await createSessionToken({ userId: user.id, email: user.email, sv: user.sessionVersion ?? 0 });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  void insertLoginAttempt({ email, success: true, ipAddress: req.ip });
  void insertSecurityEvent({ userId: user.id, eventType: 'login_success', ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
  const [profile] = await db
    .select({ completedAt: onboardingProfiles.completedAt })
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, user.id))
    .limit(1);
  res.status(200).json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        hccMembershipNumber: user.hccMembershipNumber ?? null,
        companyName: user.companyName ?? null,
        onboardingCompletedAt: profile?.completedAt ?? null,
      },
    },
  });
});

// ── POST /api/auth/mfa-login ──────────────────────────────────────────────
// Second-factor step. Body: { userId, token } where `token` is either a
// 6-digit TOTP or an 8-char backup code. Issues the session JWT on success.
const MfaLoginSchema = z.object({
  userId: z.string().min(1),
  token:  z.string().min(6).max(64),
});

const mfaLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => process.env.NODE_ENV === 'test' ? 100_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many MFA attempts. Please try again in 15 minutes.' },
});

authRouter.post('/mfa-login', mfaLoginLimiter, validate(MfaLoginSchema), async (req, res) => {
  const { userId, token: mfaToken } = req.body as z.infer<typeof MfaLoginSchema>;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(400).json({ error: 'MFA is not enabled for this user' });
    return;
  }

  // Try TOTP first, then backup code (one-time consume).
  let method: 'totp' | 'backup_code' | null = null;
  if (verifyTotpToken(user.totpSecret, mfaToken)) {
    method = 'totp';
  } else {
    const backupResult = consumeBackupCode(user.totpBackupCodes ?? null, mfaToken);
    if (backupResult.valid) {
      method = 'backup_code';
      await db
        .update(users)
        .set({ totpBackupCodes: backupResult.remaining, updatedAt: new Date().toISOString() })
        .where(eq(users.id, userId));
    }
  }

  if (!method) {
    void insertLoginAttempt({
      email: user.email,
      success: false,
      ipAddress: req.ip,
      failureReason: 'mfa_invalid',
    });
    void insertSecurityEvent({
      userId,
      eventType: 'mfa_login_failure',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.status(401).json({ error: 'Invalid verification code' });
    return;
  }

  const sessionToken = await createSessionToken({ userId: user.id, email: user.email, sv: user.sessionVersion ?? 0 });
  res.cookie(COOKIE_NAME, sessionToken, COOKIE_OPTS);
  void insertLoginAttempt({ email: user.email, success: true, ipAddress: req.ip });
  void insertSecurityEvent({
    userId,
    eventType: 'login_success',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
    metadata: { mfaMethod: method },
  });
  const [profile] = await db
    .select({ completedAt: onboardingProfiles.completedAt })
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, user.id))
    .limit(1);
  res.status(200).json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        hccMembershipNumber: user.hccMembershipNumber ?? null,
        companyName: user.companyName ?? null,
        onboardingCompletedAt: profile?.completedAt ?? null,
      },
    },
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  void insertSecurityEvent({ userId: null, eventType: 'logout', ipAddress: req.ip });
  res.status(200).json({ data: { message: 'Logged out' } });
});

const AcceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// POST /api/auth/accept-invite
authRouter.post('/accept-invite', validate(AcceptInviteSchema), async (req, res) => {
  const { token, password } = req.body as z.infer<typeof AcceptInviteSchema>;
  const result = await validateToken(token);

  if (result.status === 'not_found') {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }
  if (result.status !== 'valid') {
    res.status(410).json({ error: 'Invite link has expired or has already been used' });
    return;
  }

  const invite = result.invite!;
  const db = getDb();

  // Check if email already registered
  const [existingUser] = await db.select().from(users).where(eq(users.email, invite.inviteeEmail)).limit(1);
  if (existingUser) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const newUserId = randomUUID();

  // Create user
  await db.insert(users).values({
    id: newUserId,
    email: invite.inviteeEmail,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  // Insert project_members for ALL inviter's projects (D-10 critical)
  const inviterProjects = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, invite.inviterUserId),
        isNull(projectMembers.removedAt),
      ),
    );

  if (inviterProjects.length > 0) {
    await db.insert(projectMembers).values(
      inviterProjects.map((p: { projectId: string }) => ({
        id: randomUUID(),
        projectId: p.projectId,
        userId: newUserId,
        role: (invite.inviteeRole ?? 'member') as 'member' | 'auditor',
        joinedAt: now,
      }))
    );
  }

  // Mark invite as accepted
  await db
    .update(teamInvites)
    .set({ acceptedAt: now })
    .where(eq(teamInvites.id, invite.id));

  // Create session and log in (sessionVersion defaults to 0 on insert)
  const sessionToken = await createSessionToken({ userId: newUserId, email: invite.inviteeEmail, sv: 0 });
  res.cookie(COOKIE_NAME, sessionToken, COOKIE_OPTS);
  void insertSecurityEvent({ userId: newUserId, eventType: 'invite_accepted', ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined, metadata: { inviteToken: token.slice(0, 8) + '...' } });
  res.status(201).json({ data: { user: { id: newUserId, email: invite.inviteeEmail } } });
});

// GET /api/auth/google — stub until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are configured
authRouter.get('/google', (req, res) => {
  res.status(501).json({ error: 'OAUTH_NOT_CONFIGURED', message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.' });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      hccMembershipNumber: users.hccMembershipNumber,
      companyName: users.companyName,
    })
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const [profile] = await db
    .select({ completedAt: onboardingProfiles.completedAt })
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, user.id))
    .limit(1);

  res.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        hccMembershipNumber: user.hccMembershipNumber ?? null,
        companyName: user.companyName ?? null,
        onboardingCompletedAt: profile?.completedAt ?? null,
      },
    },
  });
});

// GET /api/auth/token — returns the raw session JWT so mobile clients can use
// Bearer auth. Only accessible when a valid session cookie is already present.
authRouter.get('/token', requireAuth, (req, res) => {
  const token = (req as any).cookies?.pw_session;
  if (!token) return res.status(401).json({ error: 'No session' });
  res.json({ token });
});

export { authRouter as router };
export default authRouter;
