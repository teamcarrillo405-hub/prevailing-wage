import { Request, Response, NextFunction } from 'express';

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 10;

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const record = attempts.get(key);

  if (record && now < record.resetAt) {
    if (record.count >= MAX_ATTEMPTS) {
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: `Too many login attempts. Try again in ${Math.ceil((record.resetAt - now) / 60000)} minutes.`,
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      });
    }
    record.count++;
  } else {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  }
  next();
}

export function resetAuthRateLimit(ip: string) {
  attempts.delete(ip);
}
