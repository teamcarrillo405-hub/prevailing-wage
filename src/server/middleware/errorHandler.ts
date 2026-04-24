import type { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  Sentry.captureException(err, { extra: { path: req.path, method: req.method } });
  console.error(err);
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}
