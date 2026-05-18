import { Router } from 'express';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  auditLogs,
  contractorSignatures,
  payrollImports,
  payrollEntries,
  payrollWeeks,
  projectWageDeterminations,
  projectPhotos,
  securityEvents,
  subcontractorCertifications,
  subcontractorCprWeeks,
  subcontractors,
  timePunches,
  weekPhotos,
  wageDeterminations,
  workerClassifications,
  workers,
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

type EvidenceManifestSection = {
  id: string;
  label: string;
  included: boolean;
  count: number;
  missingReason: string | null;
};

function manifestSection(id: string, label: string, count: number, missingReason: string): EvidenceManifestSection {
  return {
    id,
    label,
    included: count > 0,
    count,
    missingReason: count > 0 ? null : missingReason,
  };
}

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
  const [auditRows, payrollRows, payrollEntryRows, workerRows, wageDeterminationRows, projectPhotoRows, weekPhotoRows, punchRows, importRows, subRows, subCertRows, subCprRows, signatureRows] = await Promise.all([
    db.select().from(auditLogs).where(eq(auditLogs.projectId, projectId)).orderBy(desc(auditLogs.createdAt)),
    db.select().from(payrollWeeks).where(eq(payrollWeeks.projectId, projectId)).orderBy(desc(payrollWeeks.weekEndingDate)),
    db
      .select({
        id: payrollEntries.id,
        payrollWeekId: payrollEntries.payrollWeekId,
        payrollNumber: payrollWeeks.payrollNumber,
        weekEndingDate: payrollWeeks.weekEndingDate,
        workerId: payrollEntries.workerId,
        workerName: workers.name,
        classificationId: payrollEntries.classificationId,
        tradeCode: workerClassifications.tradeCode,
        tradeDescription: workerClassifications.tradeDescription,
        subcontractorId: payrollEntries.subcontractorId,
        monSt: payrollEntries.monSt,
        tueSt: payrollEntries.tueSt,
        wedSt: payrollEntries.wedSt,
        thuSt: payrollEntries.thuSt,
        friSt: payrollEntries.friSt,
        satSt: payrollEntries.satSt,
        sunSt: payrollEntries.sunSt,
        monOt: payrollEntries.monOt,
        tueOt: payrollEntries.tueOt,
        wedOt: payrollEntries.wedOt,
        thuOt: payrollEntries.thuOt,
        friOt: payrollEntries.friOt,
        satOt: payrollEntries.satOt,
        sunOt: payrollEntries.sunOt,
        monDt: payrollEntries.monDt,
        tueDt: payrollEntries.tueDt,
        wedDt: payrollEntries.wedDt,
        thuDt: payrollEntries.thuDt,
        friDt: payrollEntries.friDt,
        satDt: payrollEntries.satDt,
        sunDt: payrollEntries.sunDt,
        baseRateSnapshot: payrollEntries.baseRateSnapshot,
        fringeRateSnapshot: payrollEntries.fringeRateSnapshot,
        grossWages: payrollEntries.grossWages,
        deductions: payrollEntries.deductions,
        netPay: payrollEntries.netPay,
        checkNumber: payrollEntries.checkNumber,
        createdAt: payrollEntries.createdAt,
        updatedAt: payrollEntries.updatedAt,
      })
      .from(payrollEntries)
      .innerJoin(payrollWeeks, eq(payrollWeeks.id, payrollEntries.payrollWeekId))
      .innerJoin(workers, eq(workers.id, payrollEntries.workerId))
      .innerJoin(workerClassifications, eq(workerClassifications.id, payrollEntries.classificationId))
      .where(eq(payrollWeeks.projectId, projectId))
      .orderBy(desc(payrollWeeks.weekEndingDate)),
    db
      .select({
        id: workers.id,
        name: workers.name,
        ssnLast4: workers.ssnLast4,
        classificationId: workerClassifications.id,
        tradeCode: workerClassifications.tradeCode,
        tradeDescription: workerClassifications.tradeDescription,
        laborType: workerClassifications.laborType,
        apprenticePercent: workerClassifications.apprenticePercent,
        programName: workerClassifications.programName,
        isActive: workerClassifications.isActive,
        createdAt: workers.createdAt,
      })
      .from(workers)
      .leftJoin(workerClassifications, eq(workerClassifications.workerId, workers.id))
      .where(eq(workers.projectId, projectId)),
    db
      .select({
        wageDeterminationId: projectWageDeterminations.wageDeterminationId,
        constructionType: projectWageDeterminations.constructionType,
        isPrimary: projectWageDeterminations.isPrimary,
        pinnedAt: projectWageDeterminations.pinnedAt,
        wdNumber: wageDeterminations.wdNumber,
        revisionNumber: wageDeterminations.revisionNumber,
        source: wageDeterminations.source,
        state: wageDeterminations.state,
        county: wageDeterminations.county,
        publishDate: wageDeterminations.publishDate,
        cachedAt: wageDeterminations.cachedAt,
        cacheExpiresAt: wageDeterminations.cacheExpiresAt,
      })
      .from(projectWageDeterminations)
      .innerJoin(wageDeterminations, eq(projectWageDeterminations.wageDeterminationId, wageDeterminations.id))
      .where(eq(projectWageDeterminations.projectId, projectId)),
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
    db.select().from(subcontractors).where(eq(subcontractors.projectId, projectId)),
    db
      .select({
        id: subcontractorCertifications.id,
        subcontractorId: subcontractorCertifications.subcontractorId,
        subcontractorName: subcontractors.name,
        certTypes: subcontractorCertifications.certTypes,
        certifyingAgency: subcontractorCertifications.certifyingAgency,
        certNumber: subcontractorCertifications.certNumber,
        expiresDate: subcontractorCertifications.expiresDate,
        reevaluationStatus: subcontractorCertifications.reevaluationStatus,
        selfCertified: subcontractorCertifications.selfCertified,
        documentPath: subcontractorCertifications.documentPath,
        samRegistrationStatus: subcontractorCertifications.samRegistrationStatus,
        samLastVerifiedAt: subcontractorCertifications.samLastVerifiedAt,
      })
      .from(subcontractorCertifications)
      .innerJoin(subcontractors, eq(subcontractors.id, subcontractorCertifications.subcontractorId))
      .where(eq(subcontractors.projectId, projectId)),
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
    db.select().from(contractorSignatures).where(eq(contractorSignatures.projectId, projectId)),
  ]);
  const typedAuditRows = auditRows as (typeof auditLogs.$inferSelect)[];
  const typedPayrollRows = payrollRows as (typeof payrollWeeks.$inferSelect)[];
  type PayrollEntryEvidenceRow = typeof payrollEntries.$inferSelect & {
    payrollNumber: number;
    weekEndingDate: string;
    workerName: string;
    tradeCode: string;
    tradeDescription: string;
  };
  const typedPayrollEntryRows = payrollEntryRows as PayrollEntryEvidenceRow[];
  const sumHours = (row: typeof typedPayrollEntryRows[number], suffix: 'St' | 'Ot' | 'Dt') =>
    (row[`mon${suffix}`] ?? 0) +
    (row[`tue${suffix}`] ?? 0) +
    (row[`wed${suffix}`] ?? 0) +
    (row[`thu${suffix}`] ?? 0) +
    (row[`fri${suffix}`] ?? 0) +
    (row[`sat${suffix}`] ?? 0) +
    (row[`sun${suffix}`] ?? 0);
  const typedWorkerRows = workerRows as Array<{
    id: string;
    name: string;
    ssnLast4: string | null;
    classificationId: string | null;
    tradeCode: string | null;
    tradeDescription: string | null;
    laborType: string | null;
    apprenticePercent: number | null;
    programName: string | null;
    isActive: boolean | null;
    createdAt: string;
  }>;
  const typedWageDeterminationRows = wageDeterminationRows as Array<{
    wageDeterminationId: string;
    constructionType: string | null;
    isPrimary: boolean;
    pinnedAt: string;
    wdNumber: string;
    revisionNumber: number;
    source: string;
    state: string;
    county: string | null;
    publishDate: string | null;
    cachedAt: string;
    cacheExpiresAt: string;
  }>;
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
  const typedSubRows = subRows as (typeof subcontractors.$inferSelect)[];
  const typedSubCertRows = subCertRows as Array<{
    id: string;
    subcontractorId: string;
    subcontractorName: string;
    certTypes: string;
    certifyingAgency: string | null;
    certNumber: string | null;
    expiresDate: string | null;
    reevaluationStatus: string | null;
    selfCertified: boolean | null;
    documentPath: string | null;
    samRegistrationStatus: string | null;
    samLastVerifiedAt: string | null;
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
  const typedSignatureRows = signatureRows as (typeof contractorSignatures.$inferSelect)[];
  const signatureEvidence = typedSignatureRows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    uploadedBy: row.uploadedBy,
    filePath: row.filePath,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
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
  const manifest = {
    generatedAt: new Date().toISOString(),
    projectId,
    readyForPacket: summary.readyForPacket,
    missingEvidence: summary.missingEvidence,
    sections: [
      manifestSection('wage-determinations', 'Wage determinations', typedWageDeterminationRows.length, 'No wage determination is pinned to this project.'),
      manifestSection('workers', 'Worker records and classifications', typedWorkerRows.length, 'No worker records exist for this project.'),
      manifestSection('payroll-entries', 'Payroll entries and rate snapshots', typedPayrollEntryRows.length, 'No payroll entries have been entered or imported.'),
      manifestSection('correction-history', 'Correction and audit history', typedAuditRows.length, 'No audit events have been recorded for this project.'),
      manifestSection('forms', 'Form readiness and compliance evidence', submitReadyWeeks.length + complianceEvidenceWeeks.length, 'No payroll weeks exist to produce form readiness evidence.'),
      manifestSection('photos', 'Project and week photos', typedProjectPhotoRows.length + typedWeekPhotoRows.length, 'No project or week photos are attached.'),
      manifestSection('field-evidence', 'GPS/time field evidence', typedPunchRows.length, 'No GPS/time punches are attached.'),
      manifestSection('signatures', 'Contractor signatures', typedSignatureRows.length, 'No contractor signature is saved for this project.'),
      manifestSection('subcontractors', 'Subcontractor records and CPR evidence', typedSubRows.length + typedSubCprRows.length + typedSubCertRows.length, 'No subcontractor records or CPR evidence are attached.'),
      manifestSection('submission-history', 'Submission history', typedPayrollRows.filter((row) => row.submittedAt).length, 'No payroll weeks have submission metadata.'),
    ],
  };

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
      csvRow(['Manifest']),
      csvRow(['Section ID', 'Section', 'Included', 'Count', 'Missing Reason']),
      ...manifest.sections.map((section) => csvRow([
        section.id,
        section.label,
        section.included ? 'yes' : 'no',
        section.count,
        section.missingReason,
      ])),
      '',
      csvRow(['Wage Determinations']),
      csvRow(['Wage Determination ID', 'WD Number', 'Revision', 'Source', 'State', 'County', 'Construction Type', 'Primary', 'Pinned At', 'Published At']),
      ...typedWageDeterminationRows.map((row) => csvRow([
        row.wageDeterminationId,
        row.wdNumber,
        row.revisionNumber,
        row.source,
        row.state,
        row.county,
        row.constructionType,
        row.isPrimary ? 'yes' : 'no',
        row.pinnedAt,
        row.publishDate,
      ])),
      '',
      csvRow(['Workers']),
      csvRow(['Worker ID', 'Name', 'SSN Last 4', 'Classification ID', 'Trade Code', 'Trade Description', 'Labor Type', 'Apprentice Percent', 'Program Name', 'Active', 'Created At']),
      ...typedWorkerRows.map((row) => csvRow([
        row.id,
        row.name,
        row.ssnLast4,
        row.classificationId,
        row.tradeCode,
        row.tradeDescription,
        row.laborType,
        row.apprenticePercent,
        row.programName,
        row.isActive === null ? null : row.isActive ? 'yes' : 'no',
        row.createdAt,
      ])),
      '',
      csvRow(['Payroll Entries']),
      csvRow(['Entry ID', 'Week ID', 'Payroll Number', 'Week Ending', 'Worker ID', 'Worker', 'Classification ID', 'Trade Code', 'Trade Description', 'Regular Hours', 'Overtime Hours', 'Double Time Hours', 'Base Rate Snapshot', 'Fringe Rate Snapshot', 'Gross Wages', 'Deductions', 'Net Pay', 'Check Number']),
      ...typedPayrollEntryRows.map((row) => csvRow([
        row.id,
        row.payrollWeekId,
        row.payrollNumber,
        row.weekEndingDate,
        row.workerId,
        row.workerName,
        row.classificationId,
        row.tradeCode,
        row.tradeDescription,
        sumHours(row, 'St'),
        sumHours(row, 'Ot'),
        sumHours(row, 'Dt'),
        row.baseRateSnapshot,
        row.fringeRateSnapshot,
        row.grossWages,
        row.deductions,
        row.netPay,
        row.checkNumber,
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
      csvRow(['Subcontractors']),
      csvRow(['Subcontractor ID', 'Name', 'License Number', 'Contact Name', 'Contact Email', 'DBE Classification', 'Created At']),
      ...typedSubRows.map((row) => csvRow([
        row.id,
        row.name,
        row.licenseNumber,
        row.contactName,
        row.contactEmail,
        row.dbeClassification,
        row.createdAt,
      ])),
      '',
      csvRow(['Subcontractor Certifications']),
      csvRow(['Certification ID', 'Subcontractor', 'Cert Types', 'Agency', 'Cert Number', 'Expires', 'Reevaluation Status', 'Self Certified', 'Document Path', 'SAM Status', 'SAM Verified At']),
      ...typedSubCertRows.map((row) => csvRow([
        row.id,
        row.subcontractorName,
        row.certTypes,
        row.certifyingAgency,
        row.certNumber,
        row.expiresDate,
        row.reevaluationStatus,
        row.selfCertified ? 'yes' : 'no',
        row.documentPath,
        row.samRegistrationStatus,
        row.samLastVerifiedAt,
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
      csvRow(['Contractor Signatures']),
      csvRow(['Signature ID', 'Uploaded By', 'File Path', 'Created At', 'Updated At']),
      ...signatureEvidence.map((row) => csvRow([
        row.id,
        row.uploadedBy,
        row.filePath,
        row.createdAt,
        row.updatedAt,
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
    manifest,
    methodology,
    wageDeterminations: typedWageDeterminationRows,
    workers: typedWorkerRows,
    payrollWeeks: typedPayrollRows,
    payrollEntries: typedPayrollEntryRows,
    submitReadyWeeks,
    complianceEvidenceWeeks,
    payrollImports: typedImportRows,
    subcontractors: typedSubRows,
    subcontractorCertifications: typedSubCertRows,
    subcontractorCprWeeks: typedSubCprRows,
    contractorSignatures: signatureEvidence,
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
  const entityType = req.query.entityType as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(auditLogs.projectId, projectId)];
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to + 'T23:59:59.999Z'));
  if (entityType) conditions.push(eq(auditLogs.entityType, entityType));

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
