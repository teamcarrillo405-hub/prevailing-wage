import { jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';

export interface UserPayload {
  userId: string;
  email: string;
  /** Phase 82 (Gap-2): Session version. Mismatched JWTs are rejected. */
  sv?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

const COOKIE_NAME = 'pw_session';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing required env var: JWT_SECRET');
  return new TextEncoder().encode(secret);
}

/**
 * Phase 82 (Gap-2) — verify the JWT's `sv` claim matches the user's current
 * sessionVersion. Bumping sessionVersion on the user row revokes every JWT
 * issued before the bump. A missing `sv` claim defaults to 0 to keep
 * pre-Phase-82 tokens valid until their first revoke event.
 */
async function checkSessionVersion(payload: UserPayload): Promise<boolean> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ sv: users.sessionVersion })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    if (!row) return false;
    const tokenSv = typeof payload.sv === 'number' ? payload.sv : 0;
    const userSv = typeof row.sv === 'number' ? row.sv : 0;
    return tokenSv === userSv;
  } catch {
    // Fail closed on DB errors — surfacing 401 is safer than silently
    // accepting a token we can't verify.
    return false;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    const userPayload = payload as unknown as UserPayload;

    const versionOk = await checkSessionVersion(userPayload);
    if (!versionOk) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      res.status(401).json({ error: 'Session has been revoked. Please sign in again.' });
      return;
    }

    req.user = userPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    next();
    return;
  }
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    const userPayload = payload as unknown as UserPayload;
    const versionOk = await checkSessionVersion(userPayload);
    if (versionOk) {
      req.user = userPayload;
    }
  } catch {
    // ignore invalid optional auth
  }
  next();
}
