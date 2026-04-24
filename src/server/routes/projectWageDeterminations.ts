import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { getDb } from '../db/index.js';
import {
  getPinnedWdsForProject,
  pinWdToProject,
  unpinWdFromProject,
  setPrimaryWd,
} from '../services/wageCache.js';

export const projectWdRouter = Router({ mergeParams: true });

projectWdRouter.use(requireAuth);

const PinBodySchema = z.object({
  wageDeterminationId: z.string().min(1),
  constructionType: z.enum(['Building', 'Heavy', 'Highway', 'Residential']).nullable().optional(),
});

// GET /api/projects/:projectId/wage-determinations
projectWdRouter.get('/', async (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const { projectId } = req.params as { projectId: string };
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 403).json({ error: err.message ?? 'Access denied' });
    return;
  }
  const pins = getPinnedWdsForProject(projectId);
  res.json({ pins });
});

// POST /api/projects/:projectId/wage-determinations
projectWdRouter.post('/', async (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const { projectId } = req.params as { projectId: string };
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 403).json({ error: err.message ?? 'Access denied' });
    return;
  }
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
projectWdRouter.delete('/:wdId', async (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const { projectId, wdId } = req.params as { projectId: string; wdId: string };
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 403).json({ error: err.message ?? 'Access denied' });
    return;
  }
  unpinWdFromProject(projectId, wdId);
  res.json({ ok: true });
});

// PATCH /api/projects/:projectId/wage-determinations/:wdId
projectWdRouter.patch('/:wdId', async (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const { projectId, wdId } = req.params as { projectId: string; wdId: string };
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 403).json({ error: err.message ?? 'Access denied' });
    return;
  }
  if (req.body?.isPrimary !== true) {
    res.status(400).json({ error: 'Only { isPrimary: true } is supported' });
    return;
  }
  setPrimaryWd(projectId, wdId);
  res.json({ ok: true });
});
