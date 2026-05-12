import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { getDb } from '../db/index.js';
import { projectWageDeterminations, projects, wageDeterminations } from '../db/schema.js';
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

function lockProjectToWd(projectId: string, wageDeterminationId: string): void {
  const db = getDb();
  const wd = db
    .select({
      wdNumber: wageDeterminations.wdNumber,
      revisionNumber: wageDeterminations.revisionNumber,
    })
    .from(wageDeterminations)
    .where(eq(wageDeterminations.id, wageDeterminationId))
    .get();

  if (!wd) {
    throw new Error('Wage determination not found');
  }

  db.update(projects)
    .set({
      wdIdentifier: wd.wdNumber,
      wdModNumber: wd.revisionNumber,
      wdLockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(projects.id, projectId))
    .run();
}

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
      source: wageDeterminations.source,
      wdNumber: wageDeterminations.wdNumber,
      revisionNumber: wageDeterminations.revisionNumber,
      state: wageDeterminations.state,
      county: wageDeterminations.county,
      wdConstructionType: wageDeterminations.constructionType,
      publishDate: wageDeterminations.publishDate,
      cachedAt: wageDeterminations.cachedAt,
      cacheExpiresAt: wageDeterminations.cacheExpiresAt,
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
    const db = getDb();
    const existingPins = db
      .select({ wageDeterminationId: projectWageDeterminations.wageDeterminationId })
      .from(projectWageDeterminations)
      .where(eq(projectWageDeterminations.projectId, projectId))
      .all();
    pinWdToProject(projectId, parsed.data.wageDeterminationId, parsed.data.constructionType ?? null, userId);
    if (existingPins.length === 0) {
      setPrimaryWd(projectId, parsed.data.wageDeterminationId);
      lockProjectToWd(projectId, parsed.data.wageDeterminationId);
    }
    res.status(201).json({ ok: true, isPrimary: existingPins.length === 0 });
  } catch (err) {
    if ((err as Error).message === 'Wage determination not found') {
      res.status(404).json({ error: 'Wage determination not found' });
      return;
    }
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
  try {
    lockProjectToWd(projectId, wdId);
  } catch {
    res.status(404).json({ error: 'Wage determination not found' });
    return;
  }
  res.json({ ok: true });
});
