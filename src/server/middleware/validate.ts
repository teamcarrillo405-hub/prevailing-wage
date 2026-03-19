import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues ?? (err as any).errors ?? [];
        res.status(400).json({ error: issues.map((e: { message: string }) => e.message).join(', ') });
        return;
      }
      next(err);
    }
  };
}
