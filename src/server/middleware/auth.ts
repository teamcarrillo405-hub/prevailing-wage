import { jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';

export interface UserPayload {
  userId: string;
  email: string;
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

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    req.user = payload as unknown as UserPayload;
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
    req.user = payload as unknown as UserPayload;
  } catch {
    // ignore invalid optional auth
  }
  next();
}
