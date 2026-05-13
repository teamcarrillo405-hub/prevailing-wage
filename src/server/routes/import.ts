import { logger } from '../logger.js';
// src/server/routes/import.ts
// Express router for payroll CSV import: preview (multipart) + commit (JSON).
// Phase 35 Plan 02 — Payroll Import Server Pipeline.

import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { and, desc, eq, lt } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { getPayrollWeek, upsertPayrollEntry } from '../services/payrollService.js';
import { parseImportFile } from '../services/importService.js';
import { calculateCertifiedPayrollPay } from '../services/calculations.js';
import { getDb } from '../db/index.js';
import { payrollEntries, payrollImports, payrollProviderMappings, payrollWeeks, subcontractors, submitReadyAcknowledgements } from '../db/schema.js';
import type { ImportedRow, ImportProvider } from '../services/importTypes.js';
import { reconcilePayrollSourceDetails } from '../services/payrollSourceReconciliation.js';
import { buildPayrollAutomationSummary } from '../services/payrollAutomation.js';

export const importRouter = Router();
importRouter.use(requireAuth);

type ReconciliationSeverity = 'blocker' | 'warning' | 'pass';

const PROVIDER_GUIDANCE: Record<string, { label: string; requiredColumns: string[]; notes: string[] }> = {
  quickbooks: {
    label: 'QuickBooks',
    requiredColumns: ['Employee', 'Project/Customer', 'Class/Trade', 'Regular Hours', 'Overtime Hours'],
    notes: ['Export payroll or time activity by employee and project.', 'Confirm project/customer names match the project before preview.'],
  },
  adp: {
    label: 'ADP',
    requiredColumns: ['Employee ID', 'Employee Name', 'Job', 'Earnings Code', 'Hours'],
    notes: ['ADP weekly total exports may require daily split review before commit.', 'Save employee ID mappings after the first import.'],
  },
  gusto: {
    label: 'Gusto',
    requiredColumns: ['Employee', 'Work Location/Project', 'Regular Hours', 'Overtime Hours'],
    notes: ['Confirm weekly totals are split by work day when certified payroll requires daily detail.'],
  },
  paychex: {
    label: 'Paychex',
    requiredColumns: ['Employee ID', 'Employee Name', 'Labor Assignment', 'Hours', 'Pay Type'],
    notes: ['Use provider worker IDs for stable matching.', 'Review unmatched workers before committing.'],
  },
  sage_300: {
    label: 'Sage 300 CRE',
    requiredColumns: ['Employee', 'Job', 'Cost Code', 'Pay ID', 'Hours'],
    notes: ['Export job-costed payroll detail, not summarized payroll registers.'],
  },
  sage_100: {
    label: 'Sage 100 Contractor',
    requiredColumns: ['Employee', 'Job', 'Cost Code', 'Pay Type', 'Hours'],
    notes: ['Confirm cost code maps to the worker classification used for certified payroll.'],
  },
};

const PROVIDER_TEMPLATE_ROWS: Record<string, string[][]> = {
  quickbooks: [
    ['Employee', 'Project/Customer', 'Class/Trade', 'Mon Regular Hours', 'Tue Regular Hours', 'Wed Regular Hours', 'Thu Regular Hours', 'Fri Regular Hours', 'Sat Regular Hours', 'Sun Regular Hours', 'Overtime Hours', 'Gross Wages', 'Total Deductions', 'Net Pay', 'Check Number', 'Health Welfare Fringe', 'Pension Fringe', 'Vacation Fringe', 'Training Fringe'],
    ['Maria Santos', 'Sample Federal Civic Center', 'Carpenter', '8', '8', '8', '8', '8', '0', '0', '0', '2400.00', '318.45', '2081.55', '1024', '4.50', '6.25', '1.10', '0.75'],
  ],
  adp: [
    ['Employee ID', 'Employee Name', 'Job', 'Earnings Code', 'Mon Hours', 'Tue Hours', 'Wed Hours', 'Thu Hours', 'Fri Hours', 'Sat Hours', 'Sun Hours', 'Gross Wages', 'Total Deductions', 'Net Pay', 'Check Number', 'Federal Income Tax', 'State Income Tax', 'FICA Tax'],
    ['1001', 'Maria Santos', 'Sample Federal Civic Center', 'REG', '8', '8', '8', '8', '8', '0', '0', '2400.00', '318.45', '2081.55', '1024', '190.00', '72.00', '56.45'],
  ],
  gusto: [
    ['Employee', 'Work Location/Project', 'Regular Hours', 'Overtime Hours', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Gross Pay', 'Deductions', 'Net Pay', 'Check Number', 'Health Welfare Fringe', 'Pension Fringe'],
    ['Maria Santos', 'Sample Federal Civic Center', '40', '0', '8', '8', '8', '8', '8', '0', '0', '2400.00', '318.45', '2081.55', '1024', '4.50', '6.25'],
  ],
  paychex: [
    ['Worker ID', 'Employee Name', 'Labor Assignment', 'Pay Component', 'Hours', 'Line Date', 'Gross Wages', 'Total Deductions', 'Net Pay', 'Check Number', 'Union Dues'],
    ['1001', 'Maria Santos', 'Sample Federal Civic Center / Carpenter', 'Regular', '8', '02/01/2026', '480.00', '63.69', '416.31', '1024', '12.00'],
  ],
  sage_300: [
    ['Employee', 'Date', 'Job', 'Extra', 'Cost Code', 'Category', 'Certified', 'PayID', 'Units', 'Gross Wages', 'Total Deductions', 'Net Pay', 'Check Number', 'Pension Deduction'],
    ['1001', '02/01/2026', 'Sample Federal Civic Center', '', 'CARP', 'LAB', 'Y', 'REG', '8', '480.00', '63.69', '416.31', '1024', '18.00'],
  ],
  sage_100: [
    ['Employee Name', 'Job', 'Cost Code', 'Pay Type', 'Hours', 'Date', 'Gross Wages', 'Total Deductions', 'Net Pay', 'Check Number', 'Other Deduction', 'Other Deduction Description'],
    ['Maria Santos', 'Sample Federal Civic Center', 'CARP', 'Regular', '8', '02/01/2026', '480.00', '63.69', '416.31', '1024', '5.00', 'Tool repayment'],
  ],
};

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildProviderTemplate(provider: string) {
  const rows = PROVIDER_TEMPLATE_ROWS[provider];
  if (!rows) return null;
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n';
}

function entryHours(entry: typeof payrollEntries.$inferSelect): number {
  return (
    entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt + entry.friSt + entry.satSt + entry.sunSt
    + entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt + entry.friOt + entry.satOt + entry.sunOt
    + entry.monDt + entry.tueDt + entry.wedDt + entry.thuDt + entry.friDt + entry.satDt + entry.sunDt
  );
}

function entryPayDelta(entry: typeof payrollEntries.$inferSelect) {
  const straightTimeHours = entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt + entry.friSt + entry.satSt + entry.sunSt;
  const overtimeHours = entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt + entry.friOt + entry.satOt + entry.sunOt;
  const doubleTimeHours = entry.monDt + entry.tueDt + entry.wedDt + entry.thuDt + entry.friDt + entry.satDt + entry.sunDt;
  const calculated = calculateCertifiedPayrollPay({
    baseRate: entry.baseRateSnapshot,
    fringeRate: entry.fringeRateSnapshot,
    straightTimeHours,
    overtimeHours,
    doubleTimeHours,
  });
  const calculatedGross = Math.round(calculated.totalWeeklyCost * 100) / 100;
  const calculatedNet = Math.round((calculatedGross - (entry.deductions ?? 0)) * 100) / 100;
  const grossDelta = entry.grossWages == null ? null : Math.round((entry.grossWages - calculatedGross) * 100) / 100;
  const netDelta = entry.netPay == null ? null : Math.round((entry.netPay - calculatedNet) * 100) / 100;
  return { calculatedGross, calculatedNet, grossDelta, netDelta };
}

function providerWorkerIdFor(row: ImportedRow) {
  const providerWorkerId = (row as ImportedRow & { providerWorkerId?: unknown }).providerWorkerId;
  if (typeof providerWorkerId === 'string' && providerWorkerId.trim()) return providerWorkerId.trim();
  return row.csvName?.trim() || null;
}

// ── multer setup: memory storage, 5 MB limit, CSV MIME types only (D-14) ──

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per D-14
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ── POST /preview ─────────────────────────────────────────────────────────
// Accepts multipart/form-data with a CSV file field "file" and a form field "weekId".
// Returns ImportPreviewResult JSON on success.

importRouter.post('/preview', (req, res) => {
  // Wrap multer in manual invocation to catch MulterError as 400 (not 500)
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Maximum 5 MB.' : err.message,
      });
      return;
    }
    if (err) {
      res.status(400).json({ error: (err as Error).message ?? 'Upload error' });
      return;
    }

    const weekId = (req.body as { weekId?: string }).weekId;
    if (!weekId) {
      res.status(400).json({ error: 'weekId is required' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const week = await getPayrollWeek(weekId);
    if (!week) {
      res.status(404).json({ error: 'Payroll week not found' });
      return;
    }

    const db = getDb();
    const userId = req.user!.userId;

    try {
      await assertProjectAccess(db, week.projectId, userId);
    } catch (accessErr: any) {
      res.status(accessErr.status ?? 500).json({ error: accessErr.message ?? 'Internal server error' });
      return;
    }

    // Submitted-week guard (D-10) — non-negotiable
    if (week.submittedAt) {
      res.status(423).json({ error: 'This payroll week is submitted and cannot be modified.' });
      return;
    }

    try {
      const previewResult = await parseImportFile(req.file.buffer, weekId, week.projectId, db);
      res.json(previewResult);
    } catch (parseErr: any) {
      res.status(400).json({ error: parseErr.message ?? 'Failed to parse import file' });
    }
  });
});

// ── POST /commit ──────────────────────────────────────────────────────────
// Accepts JSON body with resolved rows. Creates payrollEntries + audit row.
// Does NOT re-parse the file (D-09) — client sends the resolved rows back.

interface CommitBody {
  weekId: string;
  provider: ImportProvider;
  matched: ImportedRow[];
  unmatchedCount?: number;
  sourceFilename?: string;
}

importRouter.post('/commit', async (req, res) => {
  const body = req.body as CommitBody;
  const userId = req.user!.userId;

  if (!body.weekId || !body.provider || !Array.isArray(body.matched)) {
    res.status(400).json({ error: 'weekId, provider, and matched array are required' });
    return;
  }

  const week = await getPayrollWeek(body.weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();

  try {
    await assertProjectAccess(db, week.projectId, userId);
  } catch (accessErr: any) {
    res.status(accessErr.status ?? 500).json({ error: accessErr.message ?? 'Internal server error' });
    return;
  }

  // Submitted-week guard (D-10) — non-negotiable
  if (week.submittedAt) {
    res.status(423).json({ error: 'This payroll week is submitted and cannot be modified.' });
    return;
  }

  // Re-validate: conflict check before any inserts (D-06, per context pitfalls)
  const existingEntries = await db
    .select({
      workerId: payrollEntries.workerId,
      classificationId: payrollEntries.classificationId,
    })
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollWeekId, body.weekId));

  const conflictSet = new Set(
    existingEntries.map((e: { workerId: string; classificationId: string }) => `${e.workerId}::${e.classificationId}`),
  );

  const conflicts = body.matched.filter(
    (row) => conflictSet.has(`${row.workerId}::${row.classificationId}`),
  );

  if (conflicts.length > 0) {
    res.status(409).json({
      error: 'Some workers already have entries for this week. Delete existing entries before importing.',
      conflicts: conflicts.map((c) => ({ workerId: c.workerId, workerName: c.workerName })),
    });
    return;
  }

  const now = new Date().toISOString();

  // Insert payrollEntries for each matched row
  for (const row of body.matched) {
    // DBE-08: validate subcontractorId if provided — silently null if not found on this project
    let resolvedSubId: string | null = null;
    if (row.subcontractorId) {
      const [sub] = await db
        .select({ id: subcontractors.id })
        .from(subcontractors)
        .where(and(eq(subcontractors.id, row.subcontractorId), eq(subcontractors.projectId, week.projectId)))
        .limit(1);
      resolvedSubId = sub?.id ?? null;
    }

    await upsertPayrollEntry({
      payrollWeekId: body.weekId,
      workerId: row.workerId,
      classificationId: row.classificationId,
      monSt: row.monSt,
      tueSt: row.tueSt,
      wedSt: row.wedSt,
      thuSt: row.thuSt,
      friSt: row.friSt,
      satSt: row.satSt,
      sunSt: row.sunSt,
      monOt: row.monOt,
      tueOt: row.tueOt,
      wedOt: row.wedOt,
      thuOt: row.thuOt,
      friOt: row.friOt,
      satOt: row.satOt,
      sunOt: row.sunOt,
      monDt: 0,
      tueDt: 0,
      wedDt: 0,
      thuDt: 0,
      friDt: 0,
      satDt: 0,
      sunDt: 0,
      baseRateSnapshot: row.baseRateSnapshot,
      fringeRateSnapshot: row.fringeRateSnapshot,
      grossWages: row.grossWages ?? null,
      deductions: row.deductions ?? 0,
      netPay: row.netPay ?? null,
      checkNumber: row.checkNumber ?? null,
      fringeHealthWelfare: row.fringeHealthWelfare ?? null,
      fringePension: row.fringePension ?? null,
      fringeVacation: row.fringeVacation ?? null,
      fringeTraining: row.fringeTraining ?? null,
      ficaTax: row.ficaTax ?? null,
      federalIncomeTax: row.federalIncomeTax ?? null,
      stateIncomeTax: row.stateIncomeTax ?? null,
      sdiTax: row.sdiTax ?? null,
      deductionVacationHoliday: row.deductionVacationHoliday ?? null,
      deductionHealthWelfare: row.deductionHealthWelfare ?? null,
      deductionPension: row.deductionPension ?? null,
      deductionTraining: row.deductionTraining ?? null,
      deductionFundAdmin: row.deductionFundAdmin ?? null,
      deductionDues: row.deductionDues ?? null,
      deductionTravelSubsistence: row.deductionTravelSubsistence ?? null,
      deductionSavings: row.deductionSavings ?? null,
      deductionOther: row.deductionOther ?? null,
      deductionOtherDescription: row.deductionOtherDescription ?? null,
      subcontractorId: resolvedSubId,
      userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      workerName: row.workerName,
      payrollNumber: week.payrollNumber,
    });

    const providerWorkerId = providerWorkerIdFor(row);
    if (providerWorkerId) {
      await db
        .insert(payrollProviderMappings)
        .values({
          id: randomUUID(),
          projectId: week.projectId,
          provider: body.provider,
          providerWorkerId,
          workerId: row.workerId,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [
            payrollProviderMappings.projectId,
            payrollProviderMappings.provider,
            payrollProviderMappings.providerWorkerId,
          ],
          set: { workerId: row.workerId },
        });
    }
  }

  // Insert payrollImports audit row (D-11)
  const importId = randomUUID();
  await db.insert(payrollImports).values({
    id: importId,
    payrollWeekId: body.weekId,
    importedByUserId: userId,
    provider: body.provider,
    sourceFilename: body.sourceFilename ?? null,
    committedCount: body.matched.length,
    unmatchedCount: body.unmatchedCount ?? 0,
    createdAt: now,
  });

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_import',
      entityId: importId,
      action: 'payroll_import.committed',
      meta: {
        provider: body.provider,
        committedCount: body.matched.length,
        sourceFilename: body.sourceFilename ?? null,
        weekEnding: week.weekEndingDate,
      },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }

  res.json({ committed: body.matched.length });
});

// GET /reconciliation/:weekId
// Returns an actionable import health summary for the payroll week.
importRouter.get('/reconciliation/:weekId', async (req, res) => {
  const { weekId } = req.params;
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  try {
    await assertProjectAccess(db, week.projectId, req.user!.userId);
  } catch (accessErr: any) {
    res.status(accessErr.status ?? 500).json({ error: accessErr.message ?? 'Internal server error' });
    return;
  }

  const [entries, imports, previousWeeks, acknowledgements] = await Promise.all([
    db.select().from(payrollEntries).where(eq(payrollEntries.payrollWeekId, weekId)),
    db
      .select()
      .from(payrollImports)
      .where(eq(payrollImports.payrollWeekId, weekId))
      .orderBy(desc(payrollImports.createdAt))
      .limit(1),
    db
      .select({ id: payrollWeeks.id })
      .from(payrollWeeks)
      .where(and(eq(payrollWeeks.projectId, week.projectId), lt(payrollWeeks.weekEndingDate, week.weekEndingDate)))
      .orderBy(desc(payrollWeeks.weekEndingDate))
      .limit(1),
    db
      .select({ issueId: submitReadyAcknowledgements.issueId })
      .from(submitReadyAcknowledgements)
      .where(eq(submitReadyAcknowledgements.payrollWeekId, weekId)),
  ]);

  const latestImport = imports[0] as typeof payrollImports.$inferSelect | undefined;
  const typedEntries = entries as (typeof payrollEntries.$inferSelect)[];
  const acknowledgedIssueIds = acknowledgements.map((row: { issueId: string }) => row.issueId);
  const payDeltaReviewed = acknowledgedIssueIds.includes('payroll-automation-exceptions');
  const previousWeekId = previousWeeks[0]?.id;
  const previousEntries = previousWeekId
    ? await db.select().from(payrollEntries).where(eq(payrollEntries.payrollWeekId, previousWeekId)) as (typeof payrollEntries.$inferSelect)[]
    : [];
  const providerMappings = latestImport
    ? await db
        .select({ id: payrollProviderMappings.id })
        .from(payrollProviderMappings)
        .where(and(
          eq(payrollProviderMappings.projectId, week.projectId),
          eq(payrollProviderMappings.provider, latestImport.provider),
        ))
    : [];

  const zeroRateCount = typedEntries.filter((entry) => entryHours(entry) > 0 && entry.baseRateSnapshot <= 0).length;
  const missingPayCount = typedEntries.filter((entry) => entry.grossWages == null || entry.netPay == null).length;
  const totalHours = typedEntries.reduce((sum, entry) => sum + entryHours(entry), 0);
  const grossWages = typedEntries.reduce((sum, entry) => sum + (entry.grossWages ?? 0), 0);
  const payDeltas = typedEntries.map((entry) => ({ entryId: entry.id, workerId: entry.workerId, ...entryPayDelta(entry) }));
  const grossDeltaTotal = Math.round(payDeltas.reduce((sum, item) => sum + (item.grossDelta ?? 0), 0) * 100) / 100;
  const netDeltaTotal = Math.round(payDeltas.reduce((sum, item) => sum + (item.netDelta ?? 0), 0) * 100) / 100;
  const payDeltaReviewCount = payDeltas.filter(
    (item) => Math.abs(item.grossDelta ?? 0) > 0.01 || Math.abs(item.netDelta ?? 0) > 0.01,
  ).length;
  const payDeltaEntryIds = payDeltas
    .filter((item) => Math.abs(item.grossDelta ?? 0) > 0.01 || Math.abs(item.netDelta ?? 0) > 0.01)
    .map((item) => item.entryId);
  const sourceReconciliation = reconcilePayrollSourceDetails(typedEntries);
  const automation = buildPayrollAutomationSummary({
    entries: typedEntries,
    previousEntries,
    latestImport,
    providerMappingCount: providerMappings.length,
    sourceReconciliation,
    payDeltaReviewCount,
    payDeltaEntryIds,
    acknowledgedIssueIds,
    zeroRateCount,
    missingPayCount,
    unmatchedCount: latestImport?.unmatchedCount ?? 0,
  });
  const issues: Array<{
    id: string;
    severity: ReconciliationSeverity;
    title: string;
    detail: string;
    nextAction: string;
  }> = [];

  if (!latestImport && typedEntries.length === 0) {
    issues.push({
      id: 'no-import',
      severity: 'warning',
      title: 'No payroll import committed',
      detail: 'This week has no provider import audit row and no payroll entries.',
      nextAction: 'Import from QuickBooks, ADP, Gusto, Paychex, Sage, or enter payroll manually.',
    });
  }

  if (latestImport && latestImport.unmatchedCount > 0) {
    issues.push({
      id: 'unmatched-workers',
      severity: 'warning',
      title: `${latestImport.unmatchedCount} provider worker${latestImport.unmatchedCount === 1 ? '' : 's'} still unmatched`,
      detail: 'Unmatched workers were not committed into certified payroll entries.',
      nextAction: 'Map provider worker IDs to project workers and rerun the import.',
    });
  }

  if (zeroRateCount > 0) {
    issues.push({
      id: 'zero-rate',
      severity: 'blocker',
      title: `${zeroRateCount} entr${zeroRateCount === 1 ? 'y has' : 'ies have'} a zero base rate`,
      detail: 'A zero base rate can create an incorrect certified payroll outcome.',
      nextAction: 'Open the affected workers and attach the correct wage determination classification.',
    });
  }

  if (missingPayCount > 0) {
    issues.push({
      id: 'missing-pay',
      severity: 'blocker',
      title: `${missingPayCount} entr${missingPayCount === 1 ? 'y is' : 'ies are'} missing gross or net pay`,
      detail: 'Certified payroll exports need wage and net pay totals for each row.',
      nextAction: 'Recalculate or edit the payroll entries before submission.',
    });
  }

  if (payDeltaReviewCount > 0) {
    issues.push({
      id: 'pay-delta-review',
      severity: payDeltaReviewed ? 'pass' : 'warning',
      title: payDeltaReviewed
        ? `${payDeltaReviewCount} imported pay delta${payDeltaReviewCount === 1 ? '' : 's'} reviewed`
        : `${payDeltaReviewCount} entr${payDeltaReviewCount === 1 ? 'y has' : 'ies have'} imported pay deltas`,
      detail: payDeltaReviewed
        ? 'A reviewer acknowledged the imported payroll register totals for this week.'
        : 'Imported gross or net pay differs from the calculated certified payroll amount.',
      nextAction: payDeltaReviewed
        ? 'Continue to compliance review and export readiness.'
        : 'Review imported payroll register totals against certified payroll calculations before signing.',
    });
  }

  if (sourceReconciliation.missingSourceDetailCount > 0 && typedEntries.length > 0) {
    issues.push({
      id: 'source-detail-coverage',
      severity: 'warning',
      title: `${sourceReconciliation.missingSourceDetailCount} entr${sourceReconciliation.missingSourceDetailCount === 1 ? 'y needs' : 'ies need'} deeper payroll-source detail`,
      detail: 'Production proof should include gross pay, net pay, taxes, itemized deductions, check number, and fringe/contribution detail from payroll.',
      nextAction: 'Import a payroll register with itemized deduction, tax, contribution, and check columns instead of retyping summary totals.',
    });
  }

  if (sourceReconciliation.itemizedDeductionMismatchCount > 0) {
    issues.push({
      id: 'deduction-breakdown-mismatch',
      severity: 'blocker',
      title: `${sourceReconciliation.itemizedDeductionMismatchCount} entr${sourceReconciliation.itemizedDeductionMismatchCount === 1 ? 'y has' : 'ies have'} deduction breakdown mismatch`,
      detail: 'The sum of imported taxes and itemized deductions does not equal total deductions.',
      nextAction: 'Correct the payroll register mapping or edit the itemized deduction fields before signing.',
    });
  }

  if (sourceReconciliation.netPayMismatchCount > 0) {
    issues.push({
      id: 'net-pay-mismatch',
      severity: 'blocker',
      title: `${sourceReconciliation.netPayMismatchCount} entr${sourceReconciliation.netPayMismatchCount === 1 ? 'y has' : 'ies have'} net pay mismatch`,
      detail: 'Gross pay minus total deductions does not equal imported net pay.',
      nextAction: 'Reconcile gross, deductions, and net pay to the payroll register before export.',
    });
  }

  if (latestImport && typedEntries.length === 0) {
    issues.push({
      id: 'empty-commit',
      severity: 'blocker',
      title: 'Import audit exists but no payroll entries were committed',
      detail: 'The import was recorded, but this week has no payroll entry rows.',
      nextAction: 'Run the import again and confirm selected rows before committing.',
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: 'reconciled',
      severity: 'pass',
      title: latestImport ? 'Import reconciled' : 'Manual payroll entries reconciled',
      detail: 'The current payroll entries have rates, pay totals, and no unresolved import exceptions.',
      nextAction: 'Continue to compliance review and submit-ready checks.',
    });
  }

  const blockers = issues.filter((issue) => issue.severity === 'blocker').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const status =
    blockers > 0
      ? 'blocked'
      : warnings > 0
      ? 'needs_review'
      : typedEntries.length === 0
      ? 'not_started'
      : 'reconciled';

  res.json({
    data: {
      weekId,
      projectId: week.projectId,
      status,
      latestImport: latestImport
        ? {
            id: latestImport.id,
            provider: latestImport.provider,
            sourceFilename: latestImport.sourceFilename,
            committedCount: latestImport.committedCount,
            unmatchedCount: latestImport.unmatchedCount,
            createdAt: latestImport.createdAt,
          }
        : null,
      summary: {
        entryCount: typedEntries.length,
        totalHours,
        grossWages,
        grossDeltaTotal,
        netDeltaTotal,
        payDeltaReviewCount,
        payDeltaReviewed,
        zeroRateCount,
        missingPayCount,
        providerMappingCount: providerMappings.length,
        sourceDetailCompleteCount: sourceReconciliation.completeSourceRows,
        sourceDetailMissingCount: sourceReconciliation.missingSourceDetailCount,
        sourceCoverage: sourceReconciliation.coverage,
        itemizedDeductionMismatchCount: sourceReconciliation.itemizedDeductionMismatchCount,
        netPayMismatchCount: sourceReconciliation.netPayMismatchCount,
        fringeMismatchCount: sourceReconciliation.fringeMismatchCount,
        automationConfidenceScore: automation.confidenceScore,
        automationExceptionCount: automation.exceptionCount,
      },
      automation,
      providerGuide: latestImport
        ? PROVIDER_GUIDANCE[latestImport.provider]
        : {
            label: 'Payroll import',
            requiredColumns: ['Worker name or ID', 'Project/job', 'Classification/trade', 'Daily hours', 'Base rate', 'Fringe rate'],
            notes: ['Use provider exports with one row per worker, project, and classification when possible.', 'Preview before commit to catch unmatched workers and missing rates.'],
          },
      issues,
    },
  });
});

importRouter.get('/providers', (_req, res) => {
  res.json({ data: PROVIDER_GUIDANCE });
});

importRouter.get('/templates/:provider.csv', (req, res) => {
  const provider = req.params.provider;
  const csv = buildProviderTemplate(provider);
  if (!csv || !PROVIDER_GUIDANCE[provider]) {
    res.status(404).json({ error: 'Unknown payroll import provider' });
    return;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${provider}-payroll-import-template.csv"`);
  res.send(csv);
});

// ── GET /mappings/:projectId ───────────────────────────────────────────────
// Returns existing provider-to-worker ID mappings for a project.
// Optional ?provider= query param filters by provider.

importRouter.get('/mappings/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const provider = typeof req.query.provider === 'string' ? req.query.provider : undefined;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, req.user!.userId);
  } catch (accessErr: any) {
    res.status(accessErr.status ?? 500).json({ error: accessErr.message ?? 'Internal server error' });
    return;
  }

  const whereClause = provider
    ? and(eq(payrollProviderMappings.projectId, projectId), eq(payrollProviderMappings.provider, provider))
    : eq(payrollProviderMappings.projectId, projectId);

  const mappings = await db
    .select({
      id: payrollProviderMappings.id,
      projectId: payrollProviderMappings.projectId,
      provider: payrollProviderMappings.provider,
      providerWorkerId: payrollProviderMappings.providerWorkerId,
      workerId: payrollProviderMappings.workerId,
      createdAt: payrollProviderMappings.createdAt,
    })
    .from(payrollProviderMappings)
    .where(whereClause);

  res.json({ mappings });
});

// ── POST /mappings ─────────────────────────────────────────────────────────
// Batch-upserts provider-to-worker ID mappings for a project.
// Body: { projectId, provider, mappings: [{ providerWorkerId, workerId }] }

interface MappingEntry {
  providerWorkerId: string;
  workerId: string;
}

interface SaveMappingsBody {
  projectId: string;
  provider: string;
  mappings: MappingEntry[];
}

importRouter.post('/mappings', async (req, res) => {
  const body = req.body as SaveMappingsBody;

  if (!body.projectId || !body.provider || !Array.isArray(body.mappings)) {
    res.status(400).json({ error: 'projectId, provider, and mappings array are required' });
    return;
  }

  const db = getDb();

  try {
    await assertProjectAccess(db, body.projectId, req.user!.userId);
  } catch (accessErr: any) {
    res.status(accessErr.status ?? 500).json({ error: accessErr.message ?? 'Internal server error' });
    return;
  }

  const now = new Date().toISOString();

  for (const m of body.mappings) {
    await db
      .insert(payrollProviderMappings)
      .values({
        id: randomUUID(),
        projectId: body.projectId,
        provider: body.provider,
        providerWorkerId: m.providerWorkerId,
        workerId: m.workerId,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [
          payrollProviderMappings.projectId,
          payrollProviderMappings.provider,
          payrollProviderMappings.providerWorkerId,
        ],
        set: { workerId: m.workerId },
      });
  }

  res.json({ saved: body.mappings.length });
});
