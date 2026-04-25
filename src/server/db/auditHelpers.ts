import { randomUUID } from 'crypto';
import { getDb } from './index.js';
import { securityEvents, loginAttempts } from './schema.js';

interface SecurityEventParams {
  userId?: string | null;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface LoginAttemptParams {
  email: string;
  success: boolean;
  ipAddress?: string | null;
  failureReason?: string | null;
}

/**
 * Best-effort security event insert. Never throws, never rejects.
 * A failure here must never block or affect the calling auth handler.
 */
export async function insertSecurityEvent(params: SecurityEventParams): Promise<void> {
  try {
    const db = getDb();
    await db.insert(securityEvents).values({
      id:        randomUUID(),
      userId:    params.userId ?? null,
      eventType: params.eventType,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      metadata:  params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[auditHelpers] insertSecurityEvent failed:', err);
  }
}

/**
 * Best-effort login attempt insert. Never throws, never rejects.
 * Must be called for BOTH successful and failed logins.
 */
export async function insertLoginAttempt(params: LoginAttemptParams): Promise<void> {
  try {
    const db = getDb();
    await db.insert(loginAttempts).values({
      id:            randomUUID(),
      email:         params.email,
      success:       params.success,
      ipAddress:     params.ipAddress ?? null,
      createdAt:     new Date().toISOString(),
      failureReason: params.failureReason ?? null,
    });
  } catch (err) {
    console.error('[auditHelpers] insertLoginAttempt failed:', err);
  }
}
