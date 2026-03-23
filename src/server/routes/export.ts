// src/server/routes/export.ts
// GET /api/export/wh347/:weekId — generate and download a completed WH-347 PDF
//
// Maps payroll week + entries from the DB to Wh347Data, calls fillWh347(),
// and streams the result as a PDF download.
//
// Contractor name/address: sourced from the project record (name + state/county).
// In v1 the project name IS the contractor name for the GC workflow.
// Multi-sub support (separate contractor identity) is a v2 scope item.

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import path from 'path';
import { readFileSync } from 'fs';
import { getDb } from '../db/index.js';
import { projects } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getPayrollWeek,
  getPayrollEntries,
} from '../services/payrollService.js';
import {
  fillWh347,
  type Wh347Data,
  type Wh347WorkerRow,
} from '../services/wh347Generator.js';
import {
  generateLcpTrackerCsv,
  generateEmarsCsv,
  mapEntriesToExportRows,
} from '../services/csvExporter.js';
import { computeCompliance } from '../services/complianceService.js';

const router = Router();
router.use(requireAuth);

// ── Exported helpers (testable) ────────────────────────────────────────────

/**
 * Derive the certApprentices boolean for WH-347 Statement of Compliance.
 *
 * Returns true when:
 *   - There are no apprentice entries (no concern — all workers are JW/foreman), OR
 *   - Every apprentice entry has a non-empty programName (all are registered).
 *
 * Returns false when any apprentice entry is missing a programName, because the
 * WH-347 checkbox (4) certifies that all apprentices are registered in an approved
 * DOL apprenticeship program — we cannot certify that if a programName is unknown.
 *
 */
export function deriveAllApprenticesRegistered(
  entries: Array<{ laborType: string; programName: string | null | undefined }>,
): boolean {
  const apprenticeEntries = entries.filter(r => r.laborType === 'apprentice');
  return (
    apprenticeEntries.length === 0 ||
    apprenticeEntries.every(r => r.programName != null && r.programName.trim() !== '')
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  // Convert YYYY-MM-DD to MM/DD/YYYY for display on WH-347
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${month}/${day}/${year}`;
}

// ── GET /api/export/wh347/:weekId ─────────────────────────────────────────

router.get('/wh347/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project ownership
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, week.projectId))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  if (project.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // 3. Load payroll entries
  const entries = await getPayrollEntries(weekId);

  // certApprentices: derived from apprentice registration status (see deriveAllApprenticesRegistered)
  // certProperPayment + certAccuratePayroll: derived from compliance engine (see complianceResult below)
  const allApprenticesRegistered = deriveAllApprenticesRegistered(entries);

  // Derive compliance flags for Statement of Compliance
  const complianceResult = await computeCompliance(db, weekId);

  // 4. Map entries to Wh347WorkerRow[]
  type EntryRow = (typeof entries)[number];
  const workerRows: Wh347WorkerRow[] = entries.map((row: EntryRow, index: number) => {
    const e = row.entry;
    const totalSt = e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
    const totalOt = e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;

    const grossWagesProject = e.grossWages ?? 0;
    const netPay = e.netPay ?? 0;
    const deductions = e.deductions;

    return {
      entryNo: index + 1,
      workerName: row.workerName,
      laborType: (row.laborType === 'foreman' ? 'journeyworker' : row.laborType) as 'journeyworker' | 'apprentice',
      identifyingNo: '', // ssnLast4 not joined — privacy-safe default
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
      grossWagesAll: grossWagesProject, // single project in v1
      deductions,
      netPay,
    };
  });

  // 5. Build Wh347Data
  const wageDeterminationNo = project.wdIdentifier
    ? `${project.wdIdentifier}${project.wdModNumber != null ? ` Mod ${project.wdModNumber}` : ''}`
    : 'N/A';

  const wh347Data: Wh347Data = {
    contractorName: project.name,
    contractorAddress: `${project.county}, ${project.state}`,
    payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
      ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
      : String(week.payrollNumber),
    weekEndingDate: formatDate(week.weekEndingDate),
    projectName: project.name,
    projectLocation: `${project.county}, ${project.state}`,
    projectContractNo: project.wdIdentifier ?? '',
    wageDeterminationNo,
    isFinal: week.isFinal,
    isPrime: true,
    workers: workerRows,
    compliance: {
      certProperPayment: complianceResult?.certProperPayment ?? true,
      certAccuratePayroll: complianceResult?.certAccuratePayroll ?? true,
      certWorkPerformed: true,      // manual certification — always true
      certApprentices: allApprenticesRegistered,
      certFringeBenefits: workerRows.some(w => w.fringeCredit > 0),
      certDeductions: false,
      officialName: 'Certifying Official',
      officialTitle: 'Project Manager',
      signatureDate: formatDate(week.weekEndingDate),
      phoneNumber: '',
    },
  };

  // 6. Load template PDF and fill
  const templatePath = path.join(process.cwd(), 'assets', 'wh347-official-2025.pdf');
  const templateBytes = readFileSync(templatePath);
  const filledPdf = await fillWh347(wh347Data, templateBytes);

  // 7. Stream as PDF download
  const filename = week.amendmentNumber != null
    ? `wh347-${week.payrollNumber}-amended-${week.amendmentNumber}.pdf`
    : `wh347-${week.payrollNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', filledPdf.length);
  res.end(Buffer.from(filledPdf));
});

// ── GET /api/export/csv/lcptracker/:weekId ────────────────────────────────

router.get('/csv/lcptracker/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, week.projectId))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  if (project.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const entries = await getPayrollEntries(weekId);
  const rows = mapEntriesToExportRows(entries, week, project.name, project.name);

  const csv = generateLcpTrackerCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="lcptracker-payroll-${week.payrollNumber}.csv"`,
  );
  res.send(csv);
});

// ── GET /api/export/csv/emars/:weekId ─────────────────────────────────────

router.get('/csv/emars/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, week.projectId))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  if (project.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const entries = await getPayrollEntries(weekId);
  const rows = mapEntriesToExportRows(entries, week, project.name, project.name);

  const csv = generateEmarsCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="emars-payroll-${week.payrollNumber}.csv"`,
  );
  res.send(csv);
});

export { router as exportRouter };
