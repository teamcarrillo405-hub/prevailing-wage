import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { verifyPassword } from '../services/auth.js';
import {
  generateTotpSecret,
  verifyTotpToken,
  generateBackupCodes,
  consumeBackupCode,
} from '../services/mfaService.js';
import { insertSecurityEvent, insertLoginAttempt } from '../db/auditHelpers.js';

/**
 * Phase 78 — TOTP MFA endpoints (SOC 2 SEC-01..03).
 * Mounted at /api/mfa.
 */
const mfaRouter = Router();

// Per-user/IP rate limit on the verify endpoint to slow brute-force of TOTP
// codes. Matches the login limiter window (15min / 5 attempts).
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => (process.env.NODE_ENV === 'test' ? 100_000 : 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Please try again in 15 minutes.' },
});

const TokenSchema = z.object({
  token: z.string().min(6).max(64),
});

const VerifyMfaSchema = z.object({
  userId: z.string().min(1),
  token: z.string().min(6).max(64),
});

const DisableSchema = z.object({
  password: z.string().min(1),
});

const RegenerateSchema = z.object({
  token: z.string().min(6).max(64),
});

// ── POST /api/mfa/setup ──────────────────────────────────────────────────
// Begins enrollment. Generates a fresh TOTP secret + 10 backup codes,
// persists encrypted versions, returns plaintext secret/qrUri/backupCodes
// to the client ONCE for display.
mfaRouter.post('/setup', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const email = req.user!.email;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (user.totpEnabled) {
    res.status(409).json({ error: 'MFA is already enabled. Disable it first to re-enroll.' });
    return;
  }

  const generated = await generateTotpSecret(email);
  const backups = generateBackupCodes(10);

  await db
    .update(users)
    .set({
      totpSecret: generated.encryptedSecret,
      totpBackupCodes: backups.encrypted,
      // totpEnabled stays false until verify-setup confirms the user has
      // their authenticator app in sync.
      totpEnabled: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));

  void insertSecurityEvent({
    userId,
    eventType: 'mfa_setup_started',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  res.status(200).json({
    data: {
      qrUri: generated.qrUri,
      qrDataUrl: generated.qrDataUrl,
      secret: generated.secret,
      backupCodes: backups.plaintext,
    },
  });
});

// ── POST /api/mfa/verify-setup ───────────────────────────────────────────
// User confirms they can produce a valid TOTP from their authenticator,
// flipping totpEnabled = true.
mfaRouter.post('/verify-setup', requireAuth, verifyLimiter, validate(TokenSchema), async (req, res) => {
  const userId = req.user!.userId;
  const { token } = req.body as z.infer<typeof TokenSchema>;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.totpSecret) {
    res.status(400).json({ error: 'MFA setup has not been started' });
    return;
  }

  const valid = verifyTotpToken(user.totpSecret, token);
  if (!valid) {
    void insertSecurityEvent({
      userId,
      eventType: 'mfa_setup_verify_failure',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.status(400).json({ error: 'Invalid verification code' });
    return;
  }

  await db
    .update(users)
    .set({ totpEnabled: true, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));

  void insertSecurityEvent({
    userId,
    eventType: 'mfa_enabled',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  res.status(200).json({ data: { enabled: true } });
});

// ── POST /api/mfa/verify ─────────────────────────────────────────────────
// Stateless TOTP/backup-code verification. Used by the login second-factor
// flow. Does NOT issue a session — see /api/auth/mfa-login for that.
mfaRouter.post('/verify', verifyLimiter, validate(VerifyMfaSchema), async (req, res) => {
  const { userId, token } = req.body as z.infer<typeof VerifyMfaSchema>;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(400).json({ error: 'MFA is not enabled for this user' });
    return;
  }

  // Try TOTP first, then fall back to one-time backup codes.
  if (verifyTotpToken(user.totpSecret, token)) {
    void insertSecurityEvent({
      userId,
      eventType: 'mfa_verify_success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { method: 'totp' },
    });
    res.status(200).json({ data: { valid: true, method: 'totp' } });
    return;
  }

  const backupResult = consumeBackupCode(user.totpBackupCodes ?? null, token);
  if (backupResult.valid) {
    await db
      .update(users)
      .set({ totpBackupCodes: backupResult.remaining, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));

    void insertSecurityEvent({
      userId,
      eventType: 'mfa_verify_success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { method: 'backup_code' },
    });
    res.status(200).json({ data: { valid: true, method: 'backup_code' } });
    return;
  }

  void insertSecurityEvent({
    userId,
    eventType: 'mfa_verify_failure',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  });
  void insertLoginAttempt({
    email: user.email,
    success: false,
    ipAddress: req.ip,
    failureReason: 'mfa_invalid',
  });
  res.status(401).json({ data: { valid: false } });
});

// ── DELETE /api/mfa/disable ──────────────────────────────────────────────
// Requires re-confirmation of the user's password to revoke MFA.
mfaRouter.delete('/disable', requireAuth, validate(DisableSchema), async (req, res) => {
  const userId = req.user!.userId;
  const { password } = req.body as z.infer<typeof DisableSchema>;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const passwordOk = await verifyPassword(user.passwordHash, password);
  if (!passwordOk) {
    void insertSecurityEvent({
      userId,
      eventType: 'mfa_disable_failure',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { reason: 'wrong_password' },
    });
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }

  await db
    .update(users)
    .set({
      totpSecret: null,
      totpEnabled: false,
      totpBackupCodes: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));

  void insertSecurityEvent({
    userId,
    eventType: 'mfa_disabled',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  res.status(200).json({ data: { enabled: false } });
});

// ── POST /api/mfa/regenerate-backup-codes ────────────────────────────────
// Issues a fresh set of backup codes, invalidating the old ones. User must
// prove they still control the TOTP factor before regeneration.
mfaRouter.post('/regenerate-backup-codes', requireAuth, validate(RegenerateSchema), async (req, res) => {
  const userId = req.user!.userId;
  const { token } = req.body as z.infer<typeof RegenerateSchema>;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(400).json({ error: 'MFA is not enabled' });
    return;
  }

  if (!verifyTotpToken(user.totpSecret, token)) {
    void insertSecurityEvent({
      userId,
      eventType: 'mfa_regen_backup_failure',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.status(400).json({ error: 'Invalid verification code' });
    return;
  }

  const backups = generateBackupCodes(10);
  await db
    .update(users)
    .set({ totpBackupCodes: backups.encrypted, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));

  void insertSecurityEvent({
    userId,
    eventType: 'mfa_backup_codes_regenerated',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  res.status(200).json({ data: { backupCodes: backups.plaintext } });
});

// ── GET /api/mfa/status ──────────────────────────────────────────────────
// Lightweight read used by the settings page to render current MFA state.
mfaRouter.get('/status', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  const [user] = await db
    .select({ enabled: users.totpEnabled, backupCodes: users.totpBackupCodes })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  let remaining = 0;
  if (user.backupCodes) {
    try {
      const list = JSON.parse(user.backupCodes) as unknown[];
      if (Array.isArray(list)) remaining = list.length;
    } catch {
      // ignore
    }
  }
  res.status(200).json({ data: { enabled: user.enabled === true, backupCodesRemaining: remaining } });
});

export default mfaRouter;
