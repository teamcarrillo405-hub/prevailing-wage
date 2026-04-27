import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { getDb } from '../db/index.js';
import { projectWageDeterminations, wageDeterminations } from '../db/schema.js';
import {
  pinWdToProject,
  unpinWdFromProject,
  setPrimaryWd,
} from '../services/wageCache.js';

export const projectWdRouter = Router({ mergeParams: true });

projectWdRouter.use(requireAuth);

// Verify the authenticated user has access to the project (applied to all routes below).
projectWdRouter.use(async (req, res, next) => {
  const db = getDb();
  const { projectId } = req.params as { projectId: string };
  try {
    await assertProjectAccess(db, projectId, req.user!.userId);
    next();
  } catch (err: any) {
    res.status(err.status ?? 403).json({ error: err.message ?? 'Access denied' });
  }
});

const PinBodySchema = z.object({
  wageDeterminationId: z.string().min(1),
  constructionType: z.enum(['Building', 'Heavy', 'Highway', 'Residential']).nullable().optional(),
});

// GET /api/projects/:projectId/wage-determinations
// Returns each pin with lastFetchedAt, wdNumber, revisionNumber (COMP-06 Phase 88)
projectWdRouter.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const db = getDb();
  const pins = db
    .select({
      wageDeterminationId: projectWageDeterminations.wageDeterminationId,
      constructionType: projectWageDeterminations.constructionType,
      isPrimary: projectWageDeterminations.isPrimary,
      pinnedAt: projectWageDeterminations.pinnedAt,
      pinnedByUserId: projectWageDeterminations.pinnedByUserId,
      wdNumber: wageDeterminations.wdNumber,
      revisionNumber: wageDeterminations.revisionNumber,
      lastFetchedAt: wageDeterminations.lastFetchedAt,
    })
    .from(projectWageDeterminations)
    .innerJoin(
      wageDeterminations,
      eq(projectWageDeterminations.wageDeterminationId, wageDeterminations.id),
    )
    .where(eq(projectWageDeterminations.projectId, projectId))
    .all();
  res.json({ pins });
});

// POST /api/projects/:projectId/wage-determinations
projectWdRouter.post('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const userId = req.user!.userId;
  const parsed = PinBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues });
    return;
  }
  try {
    pinWdToProject(projectId, parsed.data.wageDeterminationId, parsed.data.constructionType ?? null, userId);
    res.status(201).json({ ok: true });
  } catch {
    res.status(409).json({ error: 'This WD is already pinned to the project' });
  }
});

// DELETE /api/projects/:projectId/wage-determinations/:wdId
projectWdRouter.delete('/:wdId', (req, res) => {
  const { projectId, wdId } = req.params as { projectId: string; wdId: string };
  unpinWdFromProject(projectId, wdId);
  res.json({ ok: true });
});

// PATCH /api/projects/:projectId/wage-determinations/:wdId
projectWdRouter.patch('/:wdId', (req, res) => {
  const { projectId, wdId } = req.params as { projectId: string; wdId: string };
  if (req.body?.isPrimary !== true) {
    res.status(400).json({ error: 'Only { isPrimary: true } is supported' });
    return;
  }
  setPrimaryWd(projectId, wdId);
  res.json({ ok: true });
});
