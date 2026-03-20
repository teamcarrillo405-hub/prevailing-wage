// src/server/routes/compliance.ts
// GET /api/compliance/:weekId — returns ComplianceResult for a payroll week.
// Ownership check: verify the week's project belongs to the authenticated user.
// Note: This router is registered in index.ts (Plan 04).

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { computeCompliance } from '../services/complianceService.js';

export const complianceRouter = Router();

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
