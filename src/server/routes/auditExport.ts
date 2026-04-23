// src/server/routes/auditExport.ts
//
// GET /api/audit-export/:projectId
//
// Returns a ZIP file containing:
//   - wh347-week-{weekEndingDate}.pdf  (one per payroll week)
//   - compliance-week-{weekEndingDate}.json  (one per payroll week)
//
// Auth: requireAuth + project membership check via assertProjectAccess.

import { Router } from 'express';
import archiver from 'archiver';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { listPayrollWeeks, getPayrollEntries } from '../services/payrollService.js';
import { fillWh347, getWh347TemplateBytes } from '../services/wh347Generator.js';
import type { Wh347Data, Wh347WorkerRow } from '../services/wh347Generator.js';
import { computeCompliance } from '../services/complianceService.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

export const auditExportRouter = Router();

// All routes require authentication
auditExportRouter.use(requireAuth);

// ── Helper: convert YYYY-MM-DD to MM/DD/YYYY for form display ─────────────
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${month}/${day}/${year}`;
}

// ── GET /api/audit-export/:projectId ──────────────────────────────────────

auditExportRouter.get('/:projectId', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  // 1. Verify the authenticated user has access to the project
  let project: Awaited<ReturnType<typeof assertProjectAccess>>['project'];
  try {
    ({ project } = await assertProjectAccess(db, projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 2. Load all payroll weeks for the project
  const weeks = await listPayrollWeeks(projectId);

  // 3. Set response headers and stream ZIP
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="audit-export-${projectId}.zip"`,
  );

  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.on('error', (err) => {
    // If headers already sent, we can only destroy the response socket
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create ZIP archive' });
    } else {
      res.destroy(err);
    }
  });

  archive.pipe(res);

  // 4. Load the WH-347 PDF template once — reused for every week
  let templateBytes: Uint8Array;
  try {
    templateBytes = getWh347TemplateBytes();
  } catch (err) {
    archive.abort();
    // Headers not sent yet — we can still respond with JSON error
    res.status(500).json({ error: 'WH-347 template not found' });
    return;
  }

  // 5. Derive static project-level fields used in every week's WH-347
  const wageDeterminationNo = project.wdIdentifier
    ? `${project.wdIdentifier}${project.wdModNumber != null ? ` Mod ${project.wdModNumber}` : ''}`
    : 'N/A';

  const contractorAddress = `${project.county}, ${project.state}`;
  const projectLocation = `${project.county}, ${project.state}`;
  const projectContractNo = project.contractNumber ?? project.wdIdentifier ?? '';

  // 6. For each payroll week: generate PDF and compliance report
  for (const week of weeks) {
    // 6a. Load entries joined with worker + classification data
    const entries = await getPayrollEntries(week.id);

    // 6b. Map entries to Wh347WorkerRow[]
    type EntryRow = (typeof entries)[number];
    const workerRows: Wh347WorkerRow[] = entries.map((row: EntryRow, index: number) => {
      const e = row.entry;
      const totalSt =
        e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
      const totalOt =
        e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;

      const grossWagesProject = e.grossWages ?? 0;
      const netPay = e.netPay ?? 0;
      const deductions = e.deductions ?? 0;

      // Deduction breakdown: only populate when at least one itemized field was entered
      const ficaAmt = e.ficaTax ?? 0;
      const fedTaxAmt = e.federalIncomeTax ?? 0;
      const hasBreakdown = e.ficaTax != null || e.federalIncomeTax != null;
      const otherDeductions = hasBreakdown
        ? Math.max(0, deductions - ficaAmt - fedTaxAmt)
        : undefined;

      return {
        entryNo: index + 1,
        workerName: row.workerName,
        laborType: (row.laborType === 'foreman'
          ? 'journeyworker'
          : row.laborType) as 'journeyworker' | 'apprentice',
        identifyingNo: '', // SSN last-4 — privacy-safe default
        classification: row.tradeDescription,
        monSt: e.monSt, monOt: e.monOt,
        tueSt: e.tueSt, tueOt: e.tueOt,
        wedSt: e.wedSt, wedOt: e.wedOt,
        thuSt: e.thuSt, thuOt: e.thuOt,
        friSt: e.friSt, friOt: e.friOt,
        satSt: e.satSt, satOt: e.satOt,
        totalSt,
        totalOt,
        baseRate: e.baseRateSnapshot,
        fringeCredit: e.fringeRateSnapshot,
        grossWagesProject,
        grossWagesAll: grossWagesProject, // single-project scope in v1
        fica: e.ficaTax ?? undefined,
        taxWithheld: e.federalIncomeTax ?? undefined,
        otherDeductions,
        deductions,
        netPay,
      };
    });

    // 6c. Build Wh347Data
    const payrollNumberLabel =
      week.amendmentNumber != null && week.originalWeekId != null
        ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
        : String(week.payrollNumber);

    const wh347Data: Wh347Data = {
      contractorName: project.name,
      contractorAddress,
      payrollNumber: payrollNumberLabel,
      weekEndingDate: formatDate(week.weekEndingDate),
      projectName: project.name,
      projectLocation,
      projectContractNo,
      wageDeterminationNo,
      isFinal: week.isFinal ?? false,
      isPrime: true,
      workers: workerRows,
      compliance: {
        certProperPayment: true,
        certAccuratePayroll: true,
        certWorkPerformed: true,
        certApprentices: true,
        certFringeBenefits: workerRows.some(w => w.fringeCredit > 0),
        certDeductions: false,
        officialName: 'Certifying Official',
        officialTitle: 'Project Manager',
        signatureDate: formatDate(week.weekEndingDate),
        phoneNumber: '',
      },
    };

    // 6d. Generate WH-347 PDF — skip week on error, continue archive
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await fillWh347(wh347Data, templateBytes);
    } catch (err) {
      console.error(`[audit-export] WH-347 generation failed for week ${week.id}:`, err);
      // Add a placeholder text file so the week is still represented
      archive.append(
        `WH-347 generation failed for week ending ${week.weekEndingDate}`,
        { name: `wh347-week-${week.weekEndingDate}.error.txt` },
      );
      continue;
    }

    // 6e. Run compliance check
    const compliance = await computeCompliance(db, week.id);

    // 6f. Append both files to the archive
    archive.append(Buffer.from(pdfBytes), {
      name: `wh347-week-${week.weekEndingDate}.pdf`,
    });
    archive.append(
      JSON.stringify(
        compliance ?? { weekId: week.id, projectId, error: 'No compliance data' },
        null,
        2,
      ),
      { name: `compliance-week-${week.weekEndingDate}.json` },
    );
  }

  // 7. Finalize — flushes all appended entries and ends the response stream
  await archive.finalize();
});
