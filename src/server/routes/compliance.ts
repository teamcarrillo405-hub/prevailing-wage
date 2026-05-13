import { logger } from '../logger.js';
// src/server/routes/compliance.ts
// GET /api/compliance/project/:projectId — aggregates compliance for all weeks in a project.
// GET /api/compliance/:weekId — returns ComplianceResult for a payroll week.
// Ownership check: verify the week's project belongs to the authenticated user.
// Note: This router is registered in index.ts (Plan 04).

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { stringify } from 'csv-stringify/sync';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { computeCompliance, getWorkerComplianceHistory, getBatchProjectCompliance } from '../services/complianceService.js';
import { countComplianceViolations } from '../services/complianceRules.js';
import { computeSubmitReady } from '../services/submitReadyService.js';
import { listPayrollWeeks } from '../services/payrollService.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { sendViolationAlertEmail } from '../services/emailService.js';
import { buildWeekComplianceEvidence, getComplianceMethodology } from '../services/complianceMethodology.js';

export const complianceRouter = Router();

complianceRouter.get('/methodology', (_req, res) => {
  res.json({ data: getComplianceMethodology() });
});

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
  const summaryMap = await getBatchProjectCompliance(db, userId);
  const projects = Array.from(summaryMap.entries()).map(([id, summary]) => ({
    id,
    status: summary.status,
    violationCount: summary.violationCount,
    unsubmittedWeekEndingDates: summary.unsubmittedWeekEndingDates,
  }));
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

// GET /api/compliance/:weekId/submit-ready - contractor-facing pre-submission score.
complianceRouter.get('/:weekId/submit-ready', requireAuth, async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;
  const db = getDb();

  const result = await computeSubmitReady(db, weekId);
  if (!result) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  try {
    await assertProjectAccess(db, result.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  res.json(result);
});

complianceRouter.post('/:weekId/submit-ready/acknowledgements', requireAuth, async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;
  const issueId = typeof req.body?.issueId === 'string' ? req.body.issueId : '';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;
  const db = getDb();

  const supportedAcknowledgements = new Set([
    'human-certification-review',
    'payroll-automation-exceptions',
    'payroll-changed-row-review',
  ]);

  if (!supportedAcknowledgements.has(issueId)) {
    res.status(400).json({ error: 'Unsupported acknowledgement issue' });
    return;
  }

  const [week] = await db
    .select({ projectId: schema.payrollWeeks.projectId })
    .from(schema.payrollWeeks)
    .where(eq(schema.payrollWeeks.id, weekId))
    .limit(1);

  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  try {
    await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const createdAt = new Date().toISOString();
  await db
    .insert(schema.submitReadyAcknowledgements)
    .values({
      id: randomUUID(),
      payrollWeekId: weekId,
      issueId,
      acknowledgedByUserId: userId,
      note,
      createdAt,
    })
    .onConflictDoUpdate({
      target: [
        schema.submitReadyAcknowledgements.payrollWeekId,
        schema.submitReadyAcknowledgements.issueId,
      ],
      set: {
        acknowledgedByUserId: userId,
        note,
        createdAt,
      },
    });

  res.status(201).json({ data: { issueId, acknowledged: true, createdAt } });
});

complianceRouter.get('/:weekId/evidence', requireAuth, async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;
  const db = getDb();

  const evidence = await buildWeekComplianceEvidence(db, weekId);
  if (!evidence) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  try {
    await assertProjectAccess(db, evidence.project.id, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  res.json({ data: evidence });
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

  // Send violation alert emails to project owners when violations are detected.
  // Non-fatal: failures must not block the compliance response.
  if (result.hasViolations) {
    try {
      const [projectRow] = await db
        .select({ name: schema.projects.name })
        .from(schema.projects)
        .where(eq(schema.projects.id, result.projectId))
        .limit(1);

      const [weekRow] = await db
        .select({ weekEndingDate: schema.payrollWeeks.weekEndingDate })
        .from(schema.payrollWeeks)
        .where(eq(schema.payrollWeeks.id, weekId))
        .limit(1);

      if (projectRow && weekRow) {
        const projectName = projectRow.name;
        const weekEndingDate = weekRow.weekEndingDate;

        const totalCount = countComplianceViolations(result);
        const violationSummary = `${totalCount} violation(s) detected: ${[
          ...result.violations.map(v => `${v.workerName} (${v.violationType})`),
          ...result.weekViolations.map(wv => wv.detail),
          ...result.deductionViolations.map(v => `${v.workerName} (${v.violationType}: ${v.deductionPct}% deductions)`),
        ].join('; ')}`;

        const ownerRows = await db
          .select({ email: schema.users.email })
          .from(schema.projectMembers)
          .innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
          .where(
            and(
              eq(schema.projectMembers.projectId, result.projectId),
              eq(schema.projectMembers.role, 'owner'),
              isNull(schema.projectMembers.removedAt),
            ),
          );

        for (const owner of ownerRows) {
          if (!owner.email) continue;
          // Non-fatal per NFR-02: individual send failures must not block others
          sendViolationAlertEmail({
            toEmail: owner.email,
            projectName,
            weekEndingDate,
            violationSummary,
          }).catch(err => logger.error({ err: err }, '[compliance] violation alert email failed:'));
        }
      }
    } catch (err) {
      logger.error({ err: err }, '[compliance] failed to send violation alert emails:');
    }

    // Best-effort webhook delivery for violation.detected — API-02
    try {
      const { deliverWebhook } = await import('../services/webhookService.js');
      await deliverWebhook(userId, 'violation.detected', {
        projectId: result.projectId,
        weekId,
        violationCount: countComplianceViolations(result),
        violationBreakdown: result.violationBreakdown,
        violations: {
          entry: result.violations,
          week: result.weekViolations,
          deductions: result.deductionViolations,
        },
        hasViolations: result.hasViolations,
      });
    } catch (whErr) {
      logger.error({ err: whErr }, '[webhook] violation.detected');
    }
  }

  res.json(result);
});
