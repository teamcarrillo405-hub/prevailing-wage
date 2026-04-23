import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/index.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

type Role = 'owner' | 'member' | 'auditor';
const RANK: Record<Role, number> = { owner: 3, member: 2, auditor: 1 };

/**
 * Middleware factory that enforces a minimum role on project-scoped routes.
 * Reads projectId from req.params.id or req.params.projectId.
 */
export function requireRole(minimumRole: Role) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const projectId = (req.params.id ?? req.params.projectId) as string | undefined;
    const userId = req.user?.userId;
    if (!projectId || !userId) {
      res.status(400).json({ error: 'Missing project or user context' });
      return;
    }
    try {
      const { role } = await assertProjectAccess(getDb(), projectId, userId);
      if (RANK[role as Role] < RANK[minimumRole]) {
        res.status(403).json({ error: `Requires ${minimumRole} role or higher` });
        return;
      }
      (req as any).projectRole = role;
      next();
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    }
  };
}
