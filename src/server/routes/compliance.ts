// src/server/routes/compliance.ts
// GET /api/compliance/project/:projectId — aggregates compliance for all weeks in a project.
// GET /api/compliance/:weekId — returns ComplianceResult for a payroll week.
// Ownership check: verify the week's project belongs to the authenticated user.
// Note: This router is registered in index.ts (Plan 04).

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { stringify } from 'csv-stringify/sync';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { computeCompliance, getWorkerComplianceHistory, getBatchProjectCompliance } from '../services/complianceService.js';
import { listPayrollWeeks } from '../services/payrollService.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

export const complianceRouter = Router();

// GET /api/compliance/project/:projectId — MUST come before /:weekId
// Express matches routes in declaration order; /:weekId is a wildcard that would
// capture the literal string "project" if registered first.
complianceRouter.get('/project/:projectId', requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  // Ownership check first
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

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

// GET /api/compliance/projects/summary — MUST come before /:weekId
// Returns batch compliance status for all projects owned by the authenticated user.
// Eliminates N+1 per-card compliance fetches on the dashboard.
complianceRouter.get('/projects/summary', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  const statusMap = await getBatchProjectCompliance(db, userId);
  const projects = Array.from(statusMap.entries()).map(([id, status]) => ({ id, status }));
  res.json({ projects });
});

// GET /api/compliance/worker/:workerId/history/csv — MUST come before /:weekId
// Returns a UTF-8 BOM CSV with 17 columns for audit-ready Excel-compatible download.
complianceRouter.get('/worker/:workerId/history/csv', requireAuth, async (req, res) => {
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

  const rows = result.entries.map(e => ({
    workerName: result.workerName,
    ssnLast4: result.ssnLast4 ?? '',
    projectName: e.projectName,
    projectId: e.projectId,
    weekEndingDate: e.weekEndingDate,
    payrollNumber: e.payrollNumber,
    violationType: e.violationType,
    detail: e.detail ?? '',
    expected: e.expected ?? '',
    actual: e.actual ?? '',
    delta: e.delta ?? '',
    apprenticeHours: e.apprenticeHours ?? '',
    journeyworkerHours: e.journeyworkerHours ?? '',
    maxAllowedApprenticeHours: e.maxAllowedApprenticeHours ?? '',
    weekId: e.weekId,
    projectIdRaw: e.projectId,
    exportedAt: new Date().toISOString(),
  }));

  const CSV_COLUMNS = [
    { key: 'workerName', header: 'Worker Name' },
    { key: 'ssnLast4', header: 'SSN Last 4' },
    { key: 'projectName', header: 'Project Name' },
    { key: 'projectId', header: 'Project ID' },
    { key: 'weekEndingDate', header: 'Week Ending Date' },
    { key: 'payrollNumber', header: 'Payroll Number' },
    { key: 'violationType', header: 'Violation Type' },
    { key: 'detail', header: 'Detail' },
    { key: 'expected', header: 'Expected Wages' },
    { key: 'actual', header: 'Actual Wages' },
    { key: 'delta', header: 'Delta' },
    { key: 'apprenticeHours', header: 'Apprentice Hours' },
    { key: 'journeyworkerHours', header: 'Journeyworker Hours' },
    { key: 'maxAllowedApprenticeHours', header: 'Max Allowed Apprentice Hours' },
    { key: 'weekId', header: 'Week ID' },
    { key: 'projectIdRaw', header: 'Source Project ID' },
    { key: 'exportedAt', header: 'Exported At' },
  ];

  const csvString = stringify(rows, { header: true, columns: CSV_COLUMNS });
  const workerNameSafe = result.workerName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="compliance-history-${workerNameSafe}.csv"`);
  res.send('\uFEFF' + csvString);
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

  // Ownership check: verify user is a member of the project
  try {
    await assertProjectAccess(db, result.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  res.json(result);
});
