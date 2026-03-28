// src/server/routes/reports.ts
// GET /api/reports/:projectId/fringe-summary       — RPT-01
// GET /api/reports/:projectId/worker/:workerId/pay-history — RPT-02
// Access check: verify user is a member of the project via assertProjectAccess.
// Note: This router is registered in index.ts (Plan 04).

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { getFringeSummary, getWorkerPayHistory } from '../services/reportsService.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

export const reportsRouter = Router();

// ── RPT-01: Fringe benefit summary ───────────────────────────────────────

reportsRouter.get('/:projectId/fringe-summary', requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  try {
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
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  try {
    const rows = await getWorkerPayHistory(projectId, workerId);
    res.json({ rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
