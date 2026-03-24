// src/server/routes/compliance.ts
// GET /api/compliance/project/:projectId — aggregates compliance for all weeks in a project.
// GET /api/compliance/:weekId — returns ComplianceResult for a payroll week.
// Ownership check: verify the week's project belongs to the authenticated user.
// Note: This router is registered in index.ts (Plan 04).

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { computeCompliance, getWorkerComplianceHistory } from '../services/complianceService.js';
import { listPayrollWeeks } from '../services/payrollService.js';

export const complianceRouter = Router();

// GET /api/compliance/project/:projectId — MUST come before /:weekId
// Express matches routes in declaration order; /:weekId is a wildcard that would
// capture the literal string "project" if registered first.
complianceRouter.get('/project/:projectId', requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  // Ownership check first
  const [project] = await db.select().from(schema.projects)
    .where(eq(schema.projects.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }

  // Aggregate compliance across all weeks
  const weeks = await listPayrollWeeks(projectId);
  const weekCount = weeks.length;
  const lastWeekNumber = weeks[0]?.payrollNumber ?? null;

  let hasViolations = false;
  for (const week of weeks) {
    const result = await computeCompliance(db, week.id);
    if (result?.hasViolations) { hasViolations = true; break; }
  }

  // TODO v2.1: yellow badge when soft-warning violation type added to compliance engine
  const badge = hasViolations ? 'violations' : 'clean';
  res.json({ badge, weekCount, lastWeekNumber });
});

// GET /api/compliance/worker/:workerId/history — MUST come before /:weekId
// Express matches routes in declaration order; /:weekId is a wildcard that would
// capture the literal string "worker" if registered after it.
complianceRouter.get('/worker/:workerId/history', requireAuth, async (req, res) => {
  const workerId = req.params.workerId as string;
  const userId = req.user!.userId;
  const db = getDb();

  const result = await getWorkerComplianceHistory(db, userId, workerId);

  if ('error' in result) {
    if (result.error === 'forbidden') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  res.json(result);
});

complianceRouter.get('/:weekId', requireAuth, async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;
  const db = getDb();

  const result = await computeCompliance(db, weekId);
  if (!result) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // Ownership check: load project and verify userId matches
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, result.projectId))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  if (project.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(result);
});
