// src/server/routes/reports.ts
// GET /api/reports/:projectId/fringe-summary       — RPT-01
// GET /api/reports/:projectId/worker/:workerId/pay-history — RPT-02
// Ownership check: verify the project belongs to the authenticated user.
// Note: This router is registered in index.ts (Plan 04).

import { Router } from 'express';
import type { Response } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { projects } from '../db/schema.js';
import { getFringeSummary, getWorkerPayHistory } from '../services/reportsService.js';

export const reportsRouter = Router();

// ── Ownership helper ──────────────────────────────────────────────────────

async function assertProjectOwner(
  projectId: string,
  userId: string,
  res: Response,
): Promise<boolean> {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return false;
  }
  if (project.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return false;
  }
  return true;
}

// ── RPT-01: Fringe benefit summary ───────────────────────────────────────

reportsRouter.get('/:projectId/fringe-summary', requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;

  try {
    const ok = await assertProjectOwner(projectId, userId, res);
    if (!ok) return;

    const rows = await getFringeSummary(projectId);
    res.json({ rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── RPT-02: Worker pay history ────────────────────────────────────────────

reportsRouter.get('/:projectId/worker/:workerId/pay-history', requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const workerId = req.params.workerId as string;
  const userId = req.user!.userId;

  try {
    const ok = await assertProjectOwner(projectId, userId, res);
    if (!ok) return;

    const rows = await getWorkerPayHistory(projectId, workerId);
    res.json({ rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
