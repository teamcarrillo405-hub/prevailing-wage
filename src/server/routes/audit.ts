import { Router } from 'express';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  auditLogs,
  payrollImports,
  payrollEntries,
  payrollWeeks,
  projectPhotos,
  securityEvents,
  subcontractorCprWeeks,
  subcontractors,
  timePunches,
  weekPhotos,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { verifyAuditChain } from '../services/auditService.js';
import { computeSubmitReady } from '../services/submitReadyService.js';
import { buildWeekComplianceEvidence, getComplianceMethodology } from '../services/complianceMethodology.js';
import { reconcilePayrollSourceDetails } from '../services/payrollSourceReconciliation.js';

const router = Router();
router.use(requireAuth);

type EvidenceRequirement = {
  key: 'payroll_submissions' | 'audit_trail' | 'photo_evidence' | 'gps_time_punches';
  label: string;
  requiredCount: number;
  collectedCount: number;
  missingCount: number;
  status: 'complete' | 'missing' | 'not_applicable';
};

type EvidenceSummaryData = {
  auditEventCount: number;
  payrollWeekCount: number;
  submittedWeekCount: number;
  unsubmittedWeekCount: number;
  photoCount: number;
  projectPhotoCount: number;
  weekPhotoCount: number;
  timePunchCount: number;
  latestAuditAt: string | null;
  readyForPacket: boolean;
  missingEvidence: string[];
  requirements: EvidenceRequirement[];
  weeks: Array<{
    weekId: string;
    payrollNumber: number;
    weekEndingDate: string;
    submitted: boolean;
    weekPhotoCount: number;
    timePunchCount: number;
    readyForPacket: boolean;
    missingEvidence: string[];
  }>;
};

function buildRequirement(
  key: EvidenceRequirement['key'],
  label: string,
  requiredCount: number,
  collectedCount: number,
): EvidenceRequirement {
  const missingCount = Math.max(0, requiredCount - collectedCount);
  return {
    key,
    label,
    requiredCount,
    collectedCount,
    missingCount,
    status: requiredCount === 0 ? 'not_applicable' : missingCount === 0 ? 'complete' : 'missing',
  };
}

async function getEvidenceSummaryData(projectId: string): Promise<EvidenceSummaryData> {
  const db = getDb();
  const [
    auditCountRows,
    payrollRows,
    submittedRows,
    projectPhotoRows,
    weekPhotoRows,
    punchRows,
    latestRows,
    weekDetailRows,
    weekPhotoDetailRows,
    punchDetailRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(auditLogs).where(eq(auditLogs.projectId, projectId)),
    db.select({ value: count() }).from(payrollWeeks).where(eq(payrollWeeks.projectId, projectId)),
    db.select({ value: count() }).from(payrollWeeks).where(and(eq(payrollWeeks.projectId, projectId), gte(payrollWeeks.submittedAt, ''))),
    db.select({ value: count() }).from(projectPhotos).where(eq(projectPhotos.projectId, projectId)),
    db.select({ value: count() }).from(weekPhotos).where(eq(weekPhotos.projectId, projectId)),
    db.select({ value: count() }).from(timePunches).where(eq(timePunches.projectId, projectId)),
    db.select({ createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(eq(auditLogs.projectId, projectId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1),
    db.select({
      id: payrollWeeks.id,
      payrollNumber: payrollWeeks.payrollNumber,
      weekEndingDate: payrollWeeks.weekEndingDate,
      submittedAt: payrollWeeks.submittedAt,
    }).from(payrollWeeks).where(eq(payrollWeeks.projectId, projectId)).orderBy(desc(payrollWeeks.weekEndingDate)),
    db.select({
      payrollWeekId: weekPhotos.payrollWeekId,
    }).from(weekPhotos).where(eq(weekPhotos.projectId, projectId)),
    db.select({
      punchedAt: timePunches.punchedAt,
    }).from(timePunches).where(eq(timePunches.projectId, projectId)),
  ]);

  const auditEventCount = Number(auditCountRows[0]?.value ?? 0);
  const payrollWeekCount = Number(payrollRows[0]?.value ?? 0);
  const submittedWeekCount = Number(submittedRows[0]?.value ?? 0);
  const projectPhotoCount = Number(projectPhotoRows[0]?.value ?? 0);
  const weekPhotoCount = Number(weekPhotoRows[0]?.value ?? 0);
  const photoCount = projectPhotoCount + weekPhotoCount;
  const timePunchCount = Number(punchRows[0]?.value ?? 0);

  const requirements = [
    buildRequirement('payroll_submissions', 'Certified payroll submissions', payrollWeekCount, submittedWeekCount),
    buildRequirement('audit_trail', 'Project audit trail', 1, auditEventCount),
    buildRequirement('photo_evidence', 'Field photo evidence', 0, photoCount),
    buildRequirement('gps_time_punches', 'GPS time punch evidence', 0, timePunchCount),
  ];

  const missingEvidence = requirements
    .filter((item) => item.status === 'missing')
    .map((item) => item.label);

  const weekPhotoCounts = new Map<string, number>();
  for (const photo of weekPhotoDetailRows) {
    weekPhotoCounts.set(photo.payrollWeekId, (weekPhotoCounts.get(photo.payrollWeekId) ?? 0) + 1);
  }
  type EvidenceWeekRow = {
    id: string;
    payrollNumber: number;
    weekEndingDate: string;
    submittedAt: string | null;
  };
  const typedWeekDetailRows = weekDetailRows as EvidenceWeekRow[];
  const typedPunchDetailRows = punchDetailRows as Array<{ punchedAt: string }>;
  const weeks = typedWeekDetailRows.map((week: EvidenceWeekRow) => {
    const weekEnd = new Date(`${week.weekEndingDate}T23:59:59.999Z`);
    const weekStart = new Date(weekEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
    const timePunchCountForWeek = typedPunchDetailRows.filter((punch: { punchedAt: string }) => {
      const punchedAt = new Date(punch.punchedAt).getTime();
      return punchedAt >= weekStart.getTime() && punchedAt <= weekEnd.getTime();
    }).length;
    const weekMissingEvidence = [
      week.submittedAt ? null : 'Certified payroll submission',
    ].filter(Boolean) as string[];
    return {
      weekId: week.id,
      payrollNumber: week.payrollNumber,
      weekEndingDate: week.weekEndingDate,
      submitted: Boolean(week.submittedAt),
      weekPhotoCount: weekPhotoCounts.get(week.id) ?? 0,
      timePunchCount: timePunchCountForWeek,
      readyForPacket: weekMissingEvidence.length === 0,
      missingEvidence: weekMissingEvidence,
    };
  });

  return {
    auditEventCount,
    payrollWeekCount,
    submittedWeekCount,
    unsubmittedWeekCount: Math.max(0, payrollWeekCount - submittedWeekCount),
    photoCount,
    projectPhotoCount,
    weekPhotoCount,
    timePunchCount,
    latestAuditAt: latestRows[0]?.createdAt ?? null,
    readyForPacket: missingEvidence.length === 0,
    missingEvidence,
    requirements,
    weeks,
  };
}

function sanitizeCsv(value: string): string {
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map((cell) => `"${sanitizeCsv(String(cell ?? '')).replace(/"/g, '""')}"`)
    .join(',');
}

// ── Phase 79: GET /api/audit/integrity-check ──────────────────────────────
// Walks the audit_logs hash chain and reports the first row that fails to
// match its recomputed entryHash (or to reference the prior row's hash).
// Optional ?projectId scopes the walk; ?limit caps rows scanned (default 100).
router.get('/integrity-check', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  const projectId = (req.query.projectId as string | undefined) ?? null;
  const rawLimit = parseInt(String(req.query.limit ?? '100'), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 5000) : 100;

  // Project-scoped checks require project access. Cross-project walks are
  // only intended for ops/admins — for now we restrict callers without a
  // project filter to authenticated users only (any logged-in user can audit
  // their own data; the walk only returns metadata, not row contents).
  if (projectId) {
    try {
      await assertProjectAccess(db, projectId, userId);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
      return;
    }
  }

  const result = await verifyAuditChain(projectId, limit);
  res.json({ data: result });
});

// ── Phase 82 (Gap-2): GET /api/audit/export-security-events ──────────────
// SOC 2 SEC-04: lets users self-serve evidence by exporting their access log.
// Query: ?format=csv|json (default csv) &days=N (default 30, max 365).
router.get('/export-security-events', async (req, res) => {
  const userId = req.user!.userId;
  const userEmail = req.user!.email;
  const db = getDb();

  const format = (req.query.format as string | undefined)?.toLowerCase() === 'json' ? 'json' : 'csv';
  const rawDays = parseInt(String(req.query.days ?? '30'), 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select()
    .from(securityEvents)
    .where(and(eq(securityEvents.userId, userId), gte(securityEvents.createdAt, cutoff)))
    .orderBy(desc(securityEvents.createdAt));

  type EventRow = typeof rows[number];

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="security-events-${userId}-${days}d.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      userId,
      userEmail,
      windowDays: days,
      count: rows.length,
      events: rows,
    });
    return;
  }

  // CSV — Excel-friendly with formula-injection guard
  function sanitize(value: string): string {
    if (/^[=+\-@]/.test(value)) return `'${value}`;
    return value;
  }

  function csvRow(cells: (string | number | null | undefined)[]): string {
    return cells
      .map(cell => `"${sanitize(String(cell ?? '')).replace(/"/g, '""')}"`)
      .join(',');
  }

  const header = csvRow(['Timestamp', 'Event Type', 'IP Address', 'User Agent', 'Metadata']);
  const lines = rows.map((r: EventRow) => csvRow([
    r.createdAt,
    r.eventType,
    r.ipAddress,
    r.userAgent,
    r.metadata,
  ]));

  const csvText = [header, ...lines].join('\r\n');
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const csvBuffer = Buffer.concat([bom, Buffer.from(csvText, 'utf8')]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="security-events-${userId}-${days}d.csv"`);
  res.send(csvBuffer);
});

// GET /api/audit/:projectId/csv — full audit log as CSV download (AUDIT-05)
// GET /api/audit/:projectId/evidence-summary - project evidence dashboard counts.
router.get('/:projectId/evidence-summary', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  res.json({ data: await getEvidenceSummaryData(projectId) });
});

router.get('/:projectId/pilot-summary', async (req, res) => {
  const projectId = req.params.projectId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, req.user!.userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [evidence, weeks, imports, entries, cprRows] = await Promise.all([
    getEvidenceSummaryData(projectId),
    db.select().from(payrollWeeks).where(eq(payrollWeeks.projectId, projectId)).orderBy(desc(payrollWeeks.weekEndingDate)),
    db
      .select({
        id: payrollImports.id,
        payrollWeekId: payrollImports.payrollWeekId,
        provider: payrollImports.provider,
        sourceFilename: payrollImports.sourceFilename,
        committedCount: payrollImports.committedCount,
        unmatchedCount: payrollImports.unmatchedCount,
        createdAt: payrollImports.createdAt,
      })
      .from(payrollImports)
      .innerJoin(payrollWeeks, eq(payrollWeeks.id, payrollImports.payrollWeekId))
      .where(eq(payrollWeeks.projectId, projectId)),
    db
      .select({ entry: payrollEntries })
      .from(payrollEntries)
      .innerJoin(payrollWeeks, eq(payrollWeeks.id, payrollEntries.payrollWeekId))
      .where(eq(payrollWeeks.projectId, projectId)),
    db
      .select({
        id: subcontractorCprWeeks.id,
        receivedDate: subcontractorCprWeeks.receivedDate,
        isCompliant: subcontractorCprWeeks.isCompliant,
      })
      .from(subcontractorCprWeeks)
      .innerJoin(subcontractors, eq(subcontractors.id, subcontractorCprWeeks.subcontractorId))
      .where(eq(subcontractors.projectId, projectId)),
  ]);

  const payrollEntryRows = entries.map((row: { entry: typeof payrollEntries.$inferSelect }) => row.entry);
  const source = reconcilePayrollSourceDetails(payrollEntryRows);
  const typedWeeks = weeks as Array<typeof payrollWeeks.$inferSelect>;
  const submittedWeeks = typedWeeks.filter((week) => week.submittedAt).length;
  const latestTwoWeeks = typedWeeks.slice(0, 2);
  const submitReadyWeeks = await Promise.all(latestTwoWeeks.map((week) => computeSubmitReady(db, week.id)));
  const submitReadyBlockers = submitReadyWeeks.reduce((sum, week) => sum + (week?.blockers ?? 0), 0);
  const openCprCount = cprRows.filter((row: { receivedDate: string | null; isCompliant: number | null }) => !row.receivedDate || row.isCompliant !== 1).length;
  const unmatchedImports = imports.reduce((sum: number, row: { unmatchedCount: number }) => sum + row.unmatchedCount, 0);

  const gates = [
    {
      id: 'two-payroll-weeks',
      label: 'Two real payroll weeks',
      status: typedWeeks.length >= 2 ? 'pass' : 'blocker',
      detail: `${typedWeeks.length} payroll week(s) exist for the pilot project.`,
    },
    {
      id: 'submitted-weeks',
      label: 'Submitted payroll proof',
      status: submittedWeeks >= Math.min(2, typedWeeks.length || 2) ? 'pass' : 'blocker',
      detail: `${submittedWeeks} payroll week(s) have submission metadata.`,
    },
    {
      id: 'source-reconciliation',
      label: 'Payroll source reconciliation',
      status: source.entryCount > 0 && source.missingSourceDetailCount === 0 && source.netPayMismatchCount === 0 && source.itemizedDeductionMismatchCount === 0 ? 'pass' : 'warning',
      detail: `${source.completeSourceRows}/${source.entryCount} payroll row(s) include complete source detail.`,
    },
    {
      id: 'import-exceptions',
      label: 'Import exceptions closed',
      status: unmatchedImports === 0 && imports.length > 0 ? 'pass' : 'warning',
      detail: `${imports.length} import audit row(s), ${unmatchedImports} unmatched provider worker(s).`,
    },
    {
      id: 'submit-ready',
      label: 'Submit-ready blockers closed',
      status: submitReadyBlockers === 0 && submitReadyWeeks.length > 0 ? 'pass' : 'blocker',
      detail: `${submitReadyBlockers} blocker(s) across latest pilot week checks.`,
    },
    {
      id: 'subcontractor-cpr',
      label: 'Subcontractor CPR evidence',
      status: openCprCount === 0 ? 'pass' : 'warning',
      detail: `${openCprCount} subcontractor CPR item(s) still open.`,
    },
    {
      id: 'evidence-packet',
      label: 'Evidence packet readiness',
      status: evidence.readyForPacket ? 'pass' : 'warning',
      detail: evidence.readyForPacket ? 'Evidence packet requirements are complete.' : `Missing: ${evidence.missingEvidence.join(', ') || 'review evidence requirements'}.`,
    },
  ];

  const blockers = gates.filter((gate) => gate.status === 'blocker').length;
  const warnings = gates.filter((gate) => gate.status === 'warning').length;

  res.json({
    data: {
      projectId,
      generatedAt: new Date().toISOString(),
      status: blockers > 0 ? 'blocked' : warnings > 0 ? 'needs_review' : 'pilot_ready',
      blockers,
      warnings,
      gates,
      sourceReconciliation: source,
      imports,
      latestSubmitReady: submitReadyWeeks.filter(Boolean),
      evidence,
    },
  });
});

router.get('/:projectId/reviewer-workbench', async (req, res) => {
  const projectId = req.params.projectId;
  const db = getDb();
  let role: 'owner' | 'member' | 'auditor';

  try {
    const access = await assertProjectAccess(db, projectId, req.user!.userId);
    role = access.role;
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [evidence, weekRows, cprRows] = await Promise.all([
    getEvidenceSummaryData(projectId),
    db
      .select({
        id: payrollWeeks.id,
        payrollNumber: payrollWeeks.payrollNumber,
        weekEndingDate: payrollWeeks.weekEndingDate,
        submittedAt: payrollWeeks.submittedAt,
        submittedTo: payrollWeeks.submittedTo,
      })
      .from(payrollWeeks)
      .where(eq(payrollWeeks.projectId, projectId))
      .orderBy(desc(payrollWeeks.weekEndingDate)),
    db
      .select({
        id: subcontractorCprWeeks.id,
        subcontractorName: subcontractors.name,
        weekEndingDate: subcontractorCprWeeks.weekEndingDate,
        receivedDate: subcontractorCprWeeks.receivedDate,
        isCompliant: subcontractorCprWeeks.isCompliant,
        notes: subcontractorCprWeeks.notes,
      })
      .from(subcontractorCprWeeks)
      .innerJoin(subcontractors, eq(subcontractors.id, subcontractorCprWeeks.subcontractorId))
      .where(eq(subcontractors.projectId, projectId)),
  ]);

  type ReviewerWeekRow = typeof weekRows[number];
  type ReviewerCprRow = typeof cprRows[number];
  const submitReady = await Promise.all(weekRows.map((week: ReviewerWeekRow) => computeSubmitReady(db, week.id)));
  const blockerCount = submitReady.reduce((sum, week) => sum + (week?.blockers ?? 0), 0);
  const warningCount = submitReady.reduce((sum, week) => sum + (week?.warnings ?? 0), 0);
  const openCpr = cprRows.filter((row: ReviewerCprRow) => !row.receivedDate || row.isCompliant !== 1);
  const reviewActions = [
    blockerCount > 0
      ? {
          id: 'submit-ready-blockers',
          severity: 'blocker',
          label: 'Payroll blockers remain',
          detail: `${blockerCount} submit-ready blocker(s) must be cleared before approval.`,
        }
      : null,
    warningCount > 0
      ? {
          id: 'submit-ready-warnings',
          severity: 'warning',
          label: 'Warnings need reviewer acknowledgement',
          detail: `${warningCount} warning(s) need documented review before filing.`,
        }
      : null,
    openCpr.length > 0
      ? {
          id: 'subcontractor-cpr-open',
          severity: 'warning',
          label: 'Subcontractor CPR follow-up',
          detail: `${openCpr.length} subcontractor CPR item(s) are missing, pending, or non-compliant.`,
        }
      : null,
    !evidence.readyForPacket
      ? {
          id: 'evidence-missing',
          severity: 'warning',
          label: 'Evidence packet incomplete',
          detail: evidence.missingEvidence.length > 0 ? `Missing: ${evidence.missingEvidence.join(', ')}.` : 'Review evidence packet requirements.',
        }
      : null,
  ].filter(Boolean);

  res.json({
    data: {
      projectId,
      role,
      permissions: {
        canReview: true,
        canEditPayroll: role !== 'auditor',
        canApproveEvidence: role !== 'auditor',
      },
      status: blockerCount > 0 ? 'blocked' : reviewActions.length > 0 ? 'needs_review' : 'review_ready',
      summary: {
        payrollWeekCount: weekRows.length,
        submittedWeekCount: weekRows.filter((week: ReviewerWeekRow) => week.submittedAt).length,
        submitReadyBlockers: blockerCount,
        submitReadyWarnings: warningCount,
        openSubcontractorCpr: openCpr.length,
        evidenceReady: evidence.readyForPacket,
      },
      reviewActions,
      payrollWeeks: weekRows,
      subcontractorCpr: cprRows,
      evidence,
    },
  });
});

router.get('/:projectId/evidence-packet', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();
  const format = (req.query.format as string | undefined)?.toLowerCase() === 'csv' ? 'csv' : 'json';

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const summary = await getEvidenceSummaryData(projectId);
  const [auditRows, payrollRows, projectPhotoRows, weekPhotoRows, punchRows, importRows, subCprRows] = await Promise.all([
    db.select().from(auditLogs).where(eq(auditLogs.projectId, projectId)).orderBy(desc(auditLogs.createdAt)),
    db.select().from(payrollWeeks).where(eq(payrollWeeks.projectId, projectId)).orderBy(desc(payrollWeeks.weekEndingDate)),
    db.select().from(projectPhotos).where(eq(projectPhotos.projectId, projectId)).orderBy(desc(projectPhotos.createdAt)),
    db.select().from(weekPhotos).where(eq(weekPhotos.projectId, projectId)).orderBy(desc(weekPhotos.createdAt)),
    db.select().from(timePunches).where(eq(timePunches.projectId, projectId)).orderBy(desc(timePunches.punchedAt)),
    db
      .select({
        id: payrollImports.id,
        payrollWeekId: payrollImports.payrollWeekId,
        provider: payrollImports.provider,
        sourceFilename: payrollImports.sourceFilename,
        committedCount: payrollImports.committedCount,
        unmatchedCount: payrollImports.unmatchedCount,
        createdAt: payrollImports.createdAt,
      })
      .from(payrollImports)
      .innerJoin(payrollWeeks, eq(payrollWeeks.id, payrollImports.payrollWeekId))
      .where(eq(payrollWeeks.projectId, projectId))
      .orderBy(desc(payrollImports.createdAt)),
    db
      .select({
        id: subcontractorCprWeeks.id,
        subcontractorId: subcontractorCprWeeks.subcontractorId,
        subcontractorName: subcontractors.name,
        weekEndingDate: subcontractorCprWeeks.weekEndingDate,
        receivedDate: subcontractorCprWeeks.receivedDate,
        isCompliant: subcontractorCprWeeks.isCompliant,
        notes: subcontractorCprWeeks.notes,
        uploadedAt: subcontractorCprWeeks.uploadedAt,
        createdAt: subcontractorCprWeeks.createdAt,
      })
      .from(subcontractorCprWeeks)
      .innerJoin(subcontractors, eq(subcontractors.id, subcontractorCprWeeks.subcontractorId))
      .where(eq(subcontractors.projectId, projectId))
      .orderBy(desc(subcontractorCprWeeks.weekEndingDate)),
  ]);
  const typedAuditRows = auditRows as (typeof auditLogs.$inferSelect)[];
  const typedPayrollRows = payrollRows as (typeof payrollWeeks.$inferSelect)[];
  const typedProjectPhotoRows = projectPhotoRows as (typeof projectPhotos.$inferSelect)[];
  const typedWeekPhotoRows = weekPhotoRows as (typeof weekPhotos.$inferSelect)[];
  const typedPunchRows = punchRows as (typeof timePunches.$inferSelect)[];
  const typedImportRows = importRows as Array<{
    id: string;
    payrollWeekId: string;
    provider: string;
    sourceFilename: string | null;
    committedCount: number;
    unmatchedCount: number;
    createdAt: string;
  }>;
  const typedSubCprRows = subCprRows as Array<{
    id: string;
    subcontractorId: string;
    subcontractorName: string;
    weekEndingDate: string;
    receivedDate: string | null;
    isCompliant: number | null;
    notes: string | null;
    uploadedAt: string | null;
    createdAt: string;
  }>;
  const submitReadyResults = await Promise.all(
    typedPayrollRows.map(async (row) => computeSubmitReady(db, row.id)),
  );
  const submitReadyWeeks = submitReadyResults.filter(
    (row): row is NonNullable<(typeof submitReadyResults)[number]> => row !== null,
  );
  const complianceEvidenceResults = await Promise.all(
    typedPayrollRows.map(async (row) => buildWeekComplianceEvidence(db, row.id)),
  );
  const complianceEvidenceWeeks = complianceEvidenceResults.filter(
    (row): row is NonNullable<(typeof complianceEvidenceResults)[number]> => row !== null,
  );
  const methodology = getComplianceMethodology();

  if (format === 'csv') {
    const sections: string[] = [
      csvRow(['Evidence Packet']),
      csvRow(['Exported At', new Date().toISOString()]),
      csvRow(['Project ID', projectId]),
      '',
      csvRow(['Requirements']),
      csvRow(['Requirement', 'Required', 'Collected', 'Missing', 'Status']),
      ...summary.requirements.map((item) => csvRow([
        item.label,
        item.requiredCount,
        item.collectedCount,
        item.missingCount,
        item.status,
      ])),
      '',
      csvRow(['Payroll Weeks']),
      csvRow(['Week ID', 'Payroll Number', 'Week Ending', 'Submitted At', 'Submitted To']),
      ...typedPayrollRows.map((row) => csvRow([
        row.id,
        row.payrollNumber,
        row.weekEndingDate,
        row.submittedAt,
        row.submittedTo,
      ])),
      '',
      csvRow(['Submit-Ready Reviews']),
      csvRow(['Week ID', 'Week Ending', 'Score', 'Status', 'Blockers', 'Warnings', 'Headline']),
      ...submitReadyWeeks.map((row) => csvRow([
        row.weekId,
        typedPayrollRows.find((week) => week.id === row.weekId)?.weekEndingDate,
        row.score,
        row.status,
        row.blockers,
        row.warnings,
        row.headline,
      ])),
      '',
      csvRow(['Compliance Evidence']),
      csvRow(['Week ID', 'Methodology Version', 'Profile', 'Payroll Rows', 'Entry Violations', 'Week Violations', 'Deduction Reviews', 'Human Review Required']),
      ...complianceEvidenceWeeks.map((row) => csvRow([
        row.week.id,
        row.methodologyVersion,
        row.profile.label,
        row.payrollRows.length,
        row.compliance?.violations.length ?? 0,
        row.compliance?.weekViolations.length ?? 0,
        row.compliance?.deductionViolations.length ?? 0,
        row.humanReviewChecklist.join('; '),
      ])),
      '',
      csvRow(['Payroll Imports']),
      csvRow(['Import ID', 'Week ID', 'Provider', 'Source Filename', 'Committed Count', 'Unmatched Count', 'Created At']),
      ...typedImportRows.map((row) => csvRow([
        row.id,
        row.payrollWeekId,
        row.provider,
        row.sourceFilename,
        row.committedCount,
        row.unmatchedCount,
        row.createdAt,
      ])),
      '',
      csvRow(['Subcontractor CPR']),
      csvRow(['CPR ID', 'Subcontractor', 'Week Ending', 'Received Date', 'Compliant', 'Uploaded At', 'Notes']),
      ...typedSubCprRows.map((row) => csvRow([
        row.id,
        row.subcontractorName,
        row.weekEndingDate,
        row.receivedDate,
        row.isCompliant === 1 ? 'yes' : row.isCompliant === 0 ? 'no' : 'unknown',
        row.uploadedAt,
        row.notes,
      ])),
      '',
      csvRow(['Photos']),
      csvRow(['Photo Type', 'Photo ID', 'Week ID', 'Caption', 'Taken At', 'Latitude', 'Longitude']),
      ...typedProjectPhotoRows.map((row) => csvRow(['project', row.id, '', row.caption, row.takenAt, row.latitude, row.longitude])),
      ...typedWeekPhotoRows.map((row) => csvRow(['week', row.id, row.payrollWeekId, row.caption, row.takenAt, row.latitude, row.longitude])),
      '',
      csvRow(['Time Punches']),
      csvRow(['Punch ID', 'Worker ID', 'Type', 'Punched At', 'Latitude', 'Longitude', 'Accuracy Meters']),
      ...typedPunchRows.map((row) => csvRow([
        row.id,
        row.workerId,
        row.punchType,
        row.punchedAt,
        row.latitude,
        row.longitude,
        row.accuracyMeters,
      ])),
      '',
      csvRow(['Audit Events']),
      csvRow(['Date', 'User', 'Entity Type', 'Entity ID', 'Action', 'Metadata']),
      ...typedAuditRows.map((row) => csvRow([
        row.createdAt,
        row.userEmail,
        row.entityType,
        row.entityId,
        row.action,
        row.meta,
      ])),
    ];

    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const csvBuffer = Buffer.concat([bom, Buffer.from(sections.join('\r\n'), 'utf8')]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="evidence-packet-${projectId}.csv"`);
    res.send(csvBuffer);
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="evidence-packet-${projectId}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    projectId,
    summary,
    methodology,
    payrollWeeks: typedPayrollRows,
    submitReadyWeeks,
    complianceEvidenceWeeks,
    payrollImports: typedImportRows,
    subcontractorCprWeeks: typedSubCprRows,
    photos: {
      project: typedProjectPhotoRows,
      week: typedWeekPhotoRows,
    },
    timePunches: typedPunchRows,
    auditEvents: typedAuditRows,
  });
});

router.get('/:projectId/csv', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(auditLogs.projectId, projectId)];
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to + 'T23:59:59.999Z'));

  const rows = await db.select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt));

  function sanitize(value: string): string {
    if (/^[=+\-@]/.test(value)) return `'${value}`;
    return value;
  }

  function toDetails(meta: string | null): string {
    if (!meta) return '';
    try {
      const obj = JSON.parse(meta) as Record<string, unknown>;
      return Object.entries(obj)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join('; ');
    } catch {
      return meta;
    }
  }

  function csvRow(cells: string[]): string {
    return cells.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
  }

  const header = csvRow(['Date', 'User', 'Entity Type', 'Entity ID', 'Action', 'Details']);
  const lines = rows.map((row: typeof auditLogs.$inferSelect) => csvRow([
    sanitize(row.createdAt),
    sanitize(row.userEmail ?? ''),
    sanitize(row.entityType),
    sanitize(row.entityId),
    sanitize(row.action),
    sanitize(toDetails(row.meta)),
  ]));

  const csvText = [header, ...lines].join('\r\n');
  // Prepend UTF-8 BOM (EF BB BF) as raw bytes so Excel auto-detects UTF-8
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const csvBuffer = Buffer.concat([bom, Buffer.from(csvText, 'utf8')]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="project-audit-${projectId}.csv"`);
  res.send(csvBuffer);
});

// GET /api/audit/:projectId — paginated audit log (AUDIT-04)
// NFR-03: assertProjectAccess called before any data access
router.get('/:projectId', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  // NFR-03: assertProjectAccess before any data access
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Parse query params
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const entityType = req.query.entityType as string | undefined;

  // Build WHERE conditions
  const conditions: ReturnType<typeof eq>[] = [eq(auditLogs.projectId, projectId)];
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to + 'T23:59:59.999Z'));
  if (entityType) conditions.push(eq(auditLogs.entityType, entityType));

  const whereClause = and(...conditions);

  // Fetch items + total count in parallel
  const [items, [{ value: total }]] = await Promise.all([
    db.select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() })
      .from(auditLogs)
      .where(whereClause),
  ]);

  // Parse JSON text columns for client consumption
  const parsed = items.map((row: typeof auditLogs.$inferSelect) => ({
    ...row,
    diff: row.diff ? JSON.parse(row.diff) : null,
    snapshot: row.snapshot ? JSON.parse(row.snapshot) : null,
    meta: row.meta ? JSON.parse(row.meta) : null,
  }));

  res.json({
    items: parsed,
    total: Number(total),
    page,
    limit,
    totalPages: Math.ceil(Number(total) / limit),
  });
});

export { router as auditRouter };
