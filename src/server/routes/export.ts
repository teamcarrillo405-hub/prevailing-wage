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
import path from 'path';
import { readFileSync } from 'fs';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import type { Project } from '../utils/assertProjectAccess.js';
import {
  getPayrollWeek,
  getPayrollEntries,
  getPayrollEntriesWithWorkerDetails,
} from '../services/payrollService.js';
import {
  generateEcprXml,
  type EcprData,
  type EcprEmployee,
} from '../services/ecprXmlGenerator.js';
import {
  generateMpwrXml,
  type MpwrXmlInput,
} from '../services/mpwrXmlGenerator.js';
import { fillPw12, type Pw12Input } from '../services/pw12Generator.js';
import {
  generateWaCprXml,
  type WaCprData,
  type WaCprEmployee,
  type WaCprTradeEntry,
} from '../services/waCprXmlGenerator.js';
import {
  fillWh347,
  type Wh347Data,
  type Wh347WorkerRow,
} from '../services/wh347Generator.js';
import {
  fillA1131,
  type A1131Data,
  type A1131WorkerRow,
} from '../services/a1131Generator.js';
import {
  fillF700,
  type F700Data,
  type F700WorkerRow,
  WA_TRADE_CODES,
} from '../services/f700Generator.js';
import {
  generateLcpTrackerCsv,
  generateEmarsCsv,
  mapEntriesToExportRows,
} from '../services/csvExporter.js';
import { computeCompliance } from '../services/complianceService.js';
import { decryptSsn } from '../services/cryptoService.js';

const router = Router();
router.use(requireAuth);

// ── Exported helpers (testable) ────────────────────────────────────────────

/**
 * Resolve the SSN for the CA eCPR XML field.
 *
 * Returns the 9-digit SSN when the worker has a full SSN encrypted (len=9).
 * Falls back to the placeholder format '000000' + last4 otherwise.
 *
 * CA eCPR: The ssn field accepts 9 digits for a real SSN or '000000' + last4
 * as the v2.5 placeholder.
 */
export function resolveEcprSsn(
  ssnEncrypted: string | null,
  ssnLast4: string | null,
): string {
  if (ssnEncrypted) {
    try {
      const plain = decryptSsn(ssnEncrypted);
      if (plain.length === 9) return plain;
    } catch { /* fall through to placeholder */ }
  }
  const last4 = ssnLast4 || '0000';
  return '000000' + last4;
}

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

  // 2. Verify project access
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
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

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'wh347.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }
});

// ── GET /api/export/a1131/:weekId ─────────────────────────────────────────
// California DIR A-1-131 — state-gated to CA projects only

router.get('/a1131/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — A-1-131 is CA-only
  if (project.state !== 'CA') {
    res.status(400).json({ error: 'A-1-131 is only available for California projects' });
    return;
  }

  // 4. Load payroll entries
  const entries = await getPayrollEntries(weekId);

  // 5. Map entries to A1131WorkerRow[]
  type EntryRow = (typeof entries)[number];
  const workerRows: A1131WorkerRow[] = entries.map((row: EntryRow, index: number) => {
    const e = row.entry;
    const totalSt = e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
    const totalOt = e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
    const totalDt = (e.monDt || 0) + (e.tueDt || 0) + (e.wedDt || 0) + (e.thuDt || 0) + (e.friDt || 0) + (e.satDt || 0) + (e.sunDt || 0);
    const totalHours = totalSt + totalOt + totalDt;
    const baseRate = e.baseRateSnapshot;

    return {
      entryNo: index + 1,
      workerName: row.workerName,
      identifyingNo: '',  // SSN last-4 — privacy default
      laborType: (row.laborType === 'foreman' ? 'journeyworker' : row.laborType) as 'journeyworker' | 'apprentice',
      classification: row.tradeDescription,
      sunSt: e.sunSt, sunOt: e.sunOt, sunDt: (e.sunDt || 0),
      monSt: e.monSt, monOt: e.monOt, monDt: (e.monDt || 0),
      tueSt: e.tueSt, tueOt: e.tueOt, tueDt: (e.tueDt || 0),
      wedSt: e.wedSt, wedOt: e.wedOt, wedDt: (e.wedDt || 0),
      thuSt: e.thuSt, thuOt: e.thuOt, thuDt: (e.thuDt || 0),
      friSt: e.friSt, friOt: e.friOt, friDt: (e.friDt || 0),
      satSt: e.satSt, satOt: e.satOt, satDt: (e.satDt || 0),
      totalSt,
      totalOt,
      totalDt,
      stRate: baseRate,
      otRate: baseRate * 1.5,
      dtRate: baseRate * 2.0,
      grossWages: e.grossWages ?? 0,
      federalTax: 0,    // user doesn't enter breakdown — zero for now
      stateTax: 0,
      sdi: 0,
      otherDeductions: 0,
      totalDeductions: e.deductions,
      netPay: e.netPay ?? 0,
      fringeCredit: e.fringeRateSnapshot * totalHours,
    };
  });

  // 6. Build A1131Data
  const wageDeterminationNo = project.wdIdentifier
    ? `${project.wdIdentifier}${project.wdModNumber != null ? ` Mod ${project.wdModNumber}` : ''}`
    : 'N/A';

  const a1131Data: A1131Data = {
    contractorName: project.name,
    contractorAddress: `${project.county}, ${project.state}`,
    cslbLicense: project.cslbLicense || '',
    wcPolicyNumber: project.wcPolicyNumber || '',
    projectName: project.name,
    projectLocation: `${project.county}, ${project.state}`,
    contractNo: project.wdIdentifier ?? '',
    wageDeterminationNo,
    weekEndingDate: formatDate(week.weekEndingDate),
    payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
      ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
      : String(week.payrollNumber),
    workers: workerRows,
  };

  // 7. Load template + fill
  const templatePath = path.join(process.cwd(), 'assets', 'a1131-official.pdf');
  const templateBytes = readFileSync(templatePath);
  const filledPdf = await fillA1131(a1131Data, templateBytes);

  // 8. Stream as PDF download
  const filename = week.amendmentNumber != null
    ? `a1131-${week.payrollNumber}-amended-${week.amendmentNumber}.pdf`
    : `a1131-${week.payrollNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', filledPdf.length);
  res.end(Buffer.from(filledPdf));
});

// ── GET /api/export/f700/:weekId ─────────────────────────────────────────
// Washington L&I F700-065-000 — state-gated to WA projects only
// PWIA disclosure is shown in the UI modal before calling this endpoint.

router.get('/f700/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — F700-065-000 is WA-only
  if (project.state !== 'WA') {
    res.status(400).json({ error: 'F700-065-000 is only available for Washington projects' });
    return;
  }

  // 4. Load payroll entries
  const entries = await getPayrollEntries(weekId);

  // 5. Map entries to F700WorkerRow[]
  type EntryRow = (typeof entries)[number];
  const workerRows: F700WorkerRow[] = entries.map((row: EntryRow, index: number) => {
    const e = row.entry;
    const totalSt = e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
    const totalOt = e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
    const totalHours = totalSt + totalOt;
    const baseRate = e.baseRateSnapshot;

    // WA trade code: use waTradeCode override if set; otherwise try tradeCode as-is;
    // fallback to the tradeCode even if not in WA_TRADE_CODES (advisory in PWIA modal)
    const waTradeCode = (row as any).waTradeCode
      ?? (WA_TRADE_CODES[row.tradeCode] ? row.tradeCode : row.tradeCode);

    return {
      entryNo: index + 1,
      workerName: row.workerName,
      identifyingNo: '',   // SSN last-4 — privacy default
      laborType: (row.laborType === 'foreman' ? 'journeyworker' : row.laborType) as 'journeyworker' | 'apprentice',
      waTradeCode,
      classification: row.tradeDescription,
      monSt: e.monSt, tueSt: e.tueSt, wedSt: e.wedSt, thuSt: e.thuSt,
      friSt: e.friSt, satSt: e.satSt, sunSt: e.sunSt,
      monOt: e.monOt, tueOt: e.tueOt, wedOt: e.wedOt, thuOt: e.thuOt,
      friOt: e.friOt, satOt: e.satOt, sunOt: e.sunOt,
      totalSt,
      totalOt,
      baseRate,
      otRate: baseRate * 1.5,
      grossWages: e.grossWages ?? 0,
      deductions: e.deductions,
      netPay: e.netPay ?? 0,
      fringeCredit: e.fringeRateSnapshot * totalHours,
    };
  });

  // 6. Build F700Data
  const f700Data: F700Data = {
    contractorName: project.name,
    contractorAddress: `${project.county}, ${project.state}`,
    ubiNumber: project.ubiNumber ?? '',
    lniCertificate: project.lniCertificate ?? '',
    wcAccount: project.wcAccount ?? '',
    projectName: project.name,
    projectLocation: `${project.county}, ${project.state}`,
    contractNo: project.wdIdentifier ?? '',
    weekEndingDate: formatDate(week.weekEndingDate),
    payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
      ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
      : String(week.payrollNumber),
    workers: workerRows,
  };

  // 7. Load template + fill
  const templatePath = path.join(process.cwd(), 'assets', 'f700-official.pdf');
  const templateBytes = readFileSync(templatePath);
  const filledPdf = await fillF700(f700Data, templateBytes);

  // 8. Stream as PDF download
  const filename = week.amendmentNumber != null
    ? `f700-${week.payrollNumber}-amended-${week.amendmentNumber}.pdf`
    : `f700-${week.payrollNumber}.pdf`;
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
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
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
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
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

// ── GET /api/export/ecpr-xml/:weekId ─────────────────────────────────────────
// CA DIR eCPR XML export — CPR.xsd v1.3 compliant
// Requires query params: checkNum, contractorFein, dirProjectId, awardingAgency, contractNumber, contractorEmail

router.get('/ecpr-xml/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — eCPR XML is CA-only
  if (project.state !== 'CA') {
    res.status(400).json({ error: 'CA eCPR XML export is only available for California projects' });
    return;
  }

  // 4. Read required query params (collected by pre-generation modal)
  const checkNum = (req.query.checkNum as string) || 'DIRECT DEPOSIT';
  const contractorFein = (req.query.contractorFein as string) || project.contractorFein || '';
  const dirProjectId = (req.query.dirProjectId as string) || project.dirProjectId || '';
  const awardingAgency = (req.query.awardingAgency as string) || project.awardingAgency || '';
  const contractNumber = (req.query.contractNumber as string) || project.contractNumber || '';
  const contractorEmail = (req.query.contractorEmail as string) || '';

  // Validate required fields
  if (!contractorFein || !dirProjectId) {
    res.status(400).json({ error: 'contractorFein and dirProjectId are required for eCPR XML export' });
    return;
  }

  // 5. Load payroll entries with worker details
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  // 6. Compute week start date (Sun) from weekEndingDate (Sat)
  const weekEnd = new Date(week.weekEndingDate + 'T00:00:00');
  const weekStartDate = new Date(weekEnd);
  weekStartDate.setDate(weekEnd.getDate() - 6);

  // Map entries to EcprEmployee[]
  type EcprEntryRow = (typeof entries)[number];
  const employees: EcprEmployee[] = entries.map((row: EcprEntryRow) => {
    const e = row.entry;
    const ssn10 = resolveEcprSsn(row.workerSsnEncrypted ?? null, row.workerSsnLast4 ?? null);

    // Parse address: "street, city, state zip" format
    const addrParts = (row.workerAddress || '').split(',').map((s: string) => s.trim());
    const street = addrParts[0] || '';
    const city = addrParts[1] || '';
    const stateZip = (addrParts[2] || '').split(' ').filter(Boolean);
    const addrState = stateZip[0] || 'CA';
    const zip = stateZip[1] || '00000';

    // Build 7-day array (id=1=Sun through id=7=Sat)
    const dayOrder = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const days = dayOrder.map((d, i) => {
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(weekStartDate.getDate() + i);
      const dateStr = dayDate.toISOString().split('T')[0];
      return {
        date: dateStr,
        straightTime: (e as any)[`${d}St`] || 0,
        overtime: (e as any)[`${d}Ot`] || 0,
        doubletime: (e as any)[`${d}Dt`] || 0,
      };
    });

    const totalSt = days.reduce((s, d) => s + d.straightTime, 0);
    const totalOt = days.reduce((s, d) => s + d.overtime, 0);
    const totalDt = days.reduce((s, d) => s + d.doubletime, 0);
    const baseRate = e.baseRateSnapshot;
    const grossThisProject = e.grossWages ?? 0;

    // Fringe sub-fields for deductions/contributions
    const hw = e.fringeHealthWelfare ?? 0;
    const pen = e.fringePension ?? 0;
    const vac = e.fringeVacation ?? 0;
    const trn = e.fringeTraining ?? 0;
    const totalHours = totalSt + totalOt + totalDt;

    return {
      name: row.workerName,
      ssn: ssn10,
      address: { street, city, state: addrState, zip },
      numWithholdingExemp: '0',
      workClass: row.tradeDescription,
      days,
      totHrsStraightTime: totalSt,
      totHrsOvertime: totalOt,
      totHrsDoubletime: totalDt,
      hrlyPayRateStraightTime: baseRate,
      hrlyPayRateOvertime: baseRate * 1.5,
      hrlyPayRateDoubletime: baseRate * 2.0,
      grossThisProject,
      grossAllWork: grossThisProject,  // single-project limitation
      deductions: {
        fedTax: 0,
        FICA: 0,
        stateTax: 0,
        SDI: 0,
        vacationHoliday: vac * totalHours,
        healthWelfare: hw * totalHours,
        pension: pen * totalHours,
        training: trn * totalHours,
        fundAdmin: 0,
        dues: 0,
        travelSubs: 0,
        savings: 0,
        other: 0,
      },
      netWagePaidWeek: e.netPay ?? 0,
      checkNum,
    };
  });

  // 7. Build EcprData and generate XML
  const feinClean = contractorFein.replace(/-/g, '');
  const ecprData: EcprData = {
    contractor: {
      name: project.name,
      licenseType: 'CSLB',
      licenseNum: project.cslbLicense || '',
      pwcr: 'NA',
      fein: feinClean,
      address: { street: '', city: '', state: 'CA', zip: '00000' },
      insuranceNum: project.wcPolicyNumber || '',
      email: contractorEmail,
    },
    project: {
      contractAgency: awardingAgency,
      projectID: dirProjectId,
      contractID: contractNumber,
    },
    payroll: {
      statementOfNP: entries.length === 0,
      forWeekEnding: week.weekEndingDate,
      amendmentNum: (week.originalWeekId && week.amendmentNumber) ? week.amendmentNumber : null,
    },
    employees,
  };

  const xml = generateEcprXml(ecprData);

  // 8. Set headers and send response
  const last4Fein = feinClean.slice(-4);
  const filename = `${last4Fein}_${dirProjectId}_${week.weekEndingDate}.xml`;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'ecpr_xml.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'xml' },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }
});

// ── GET /api/export/wa-cpr-xml/:weekId ───────────────────────────────────────
// WA L&I PWIA CPR XML export — WaPWCPR schema compliant
// Requires: project.state === 'WA', project.pwiaIntentId set (positive integer),
//           all worker classifications must have waTradeCode set

router.get('/wa-cpr-xml/:weekId', async (req, res) => {
  // 1. Load payroll week
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — WA CPR XML is WA-only (D-07)
  if (project.state !== 'WA') {
    res.status(400).json({ error: 'WA CPR XML is only available for Washington projects' });
    return;
  }

  // 4. Validate intentId — must be on project record and must be a positive integer (D-07)
  const intentIdStr = project.pwiaIntentId;
  if (!intentIdStr) {
    res.status(400).json({ error: 'PWIA Intent ID is required. Enter your Intent ID from the L&I PWIA portal.' });
    return;
  }
  const intentIdNum = parseInt(intentIdStr, 10);
  if (!Number.isInteger(intentIdNum) || intentIdNum <= 0) {
    res.status(400).json({ error: 'PWIA Intent ID must be a positive integer as shown in the L&I PWIA portal.' });
    return;
  }

  // 5. Load payroll entries with worker details (D-09)
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  // 5b. Trade code gate — 422 if any worker has null waTradeCode (D-03, D-04, D-05)
  type EntryRow = (typeof entries)[number];
  const nullTradeEntries = entries.filter((row: EntryRow) => !row.waTradeCode);
  if (nullTradeEntries.length > 0) {
    res.status(422).json({
      error: 'WA trade code required for all workers',
      workers: nullTradeEntries.map((row: EntryRow) => ({
        name: row.workerName,
        workerId: row.entry.workerId,
      })),
    });
    return;
  }

  // 6. Map entries to WaCprEmployee[]
  // Group by workerId so multiple trade entries per worker are collected
  const workerMap = new Map<string, { empData: WaCprEmployee; trades: WaCprTradeEntry[] }>();

  for (const row of entries) {
    const wId = row.entry.workerId;

    if (!workerMap.has(wId)) {
      // Parse name: "First Last" → firstName = everything before last token, lastName = last token
      const parts = row.workerName.trim().split(/\s+/);
      const lastName = parts.length > 1 ? parts[parts.length - 1]! : '';
      const firstName = parts.slice(0, Math.max(1, parts.length - 1)).join(' ');

      // 9-digit SSN: use real SSN if available (len=9), else placeholder
      let ssn9: string;
      if (row.workerSsnEncrypted) {
        try {
          const plain = decryptSsn(row.workerSsnEncrypted);
          ssn9 = plain.length === 9 ? plain : ('00000' + (row.workerSsnLast4 || '0000'));
        } catch {
          ssn9 = '00000' + (row.workerSsnLast4 || '0000');
        }
      } else {
        ssn9 = '00000' + (row.workerSsnLast4 || '0000');
      }

      // Address parsing: "street, city, state zip" format
      const addrParts = (row.workerAddress || '').split(',').map((s: string) => s.trim());
      const address1 = addrParts[0] || '';
      const city = addrParts[1] || '';
      const stateZip = (addrParts[2] || '').split(' ').filter(Boolean);
      const addrState = stateZip[0] || 'WA';
      const zip = stateZip[1] || '00000';

      workerMap.set(wId, {
        empData: {
          firstName,
          lastName,
          ssn: ssn9,
          address1,
          city,
          state: addrState,
          zip,
          grossPay: row.entry.grossWages ?? 0,
          tradeHoursWages: [],
        },
        trades: [],
      });
    }

    // Build WaCprTradeEntry for this classification row
    const e = row.entry;
    const days = [
      { regularHours: e.monSt ?? 0, overtimeHours: e.monOt ?? 0 },  // Day1 = Mon
      { regularHours: e.tueSt ?? 0, overtimeHours: e.tueOt ?? 0 },  // Day2 = Tue
      { regularHours: e.wedSt ?? 0, overtimeHours: e.wedOt ?? 0 },  // Day3 = Wed
      { regularHours: e.thuSt ?? 0, overtimeHours: e.thuOt ?? 0 },  // Day4 = Thu
      { regularHours: e.friSt ?? 0, overtimeHours: e.friOt ?? 0 },  // Day5 = Fri
      { regularHours: e.satSt ?? 0, overtimeHours: e.satOt ?? 0 },  // Day6 = Sat
      { regularHours: e.sunSt ?? 0, overtimeHours: e.sunOt ?? 0 },  // Day7 = Sun
    ];

    const tradeEntry: WaCprTradeEntry = {
      trade: row.waTradeCode!,
      jobClass: row.tradeDescription || '',
      county: project.county,
      regularHourRateAmt: e.baseRateSnapshot,
      overtimeHourRateAmt: e.baseRateSnapshot * 1.5,
      fringeRateAmt: e.fringeRateSnapshot ?? undefined,
      days,
      apprenticeFlg: row.laborType === 'apprentice',
    };

    workerMap.get(wId)!.empData.tradeHoursWages.push(tradeEntry);
  }

  const mappedEmployees: WaCprEmployee[] = Array.from(workerMap.values()).map(w => w.empData);

  // 7. Build WaCprData and generate XML
  const isAmendment = week.originalWeekId != null && week.amendmentNumber != null;
  const cprData: WaCprData = {
    intentId: intentIdNum,
    payrollWeek: {
      endOfWeekDate: week.weekEndingDate,
      noWorkPerformFlag: entries.length === 0,
      amendedFlag: isAmendment,
      amendReason: isAmendment ? `Amendment ${week.amendmentNumber}` : undefined,
    },
    employees: mappedEmployees,
  };

  const xml = generateWaCprXml(cprData);

  // 8. Send XML response as attachment download
  const filename = `wa-cpr-${project.pwiaIntentId}_${week.weekEndingDate}.xml`;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'wa_pwia_xml.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'xml' },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }
});

// ── GET /api/export/pw12/:weekId ──────────────────────────────────────────
// NY PW-12 Weekly Payroll PDF — state-gated to NY projects only

router.get('/pw12/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access (NFR-03)
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — PW-12 is NY-only
  if (project.state?.toUpperCase() !== 'NY') {
    res.status(400).json({ error: 'PW-12 is only available for New York projects' });
    return;
  }

  // 4. Load payroll entries with worker details
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  // 5. Map entries to Pw12Input
  type Pw12EntryRow = (typeof entries)[number];
  const pw12Entries: Pw12Input['entries'] = entries.map((row: Pw12EntryRow) => {
    const e = row.entry;
    const totalStHours = e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
    const totalOtHours = e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
    return {
      workerName: row.workerName,
      workerSsnLast4: row.workerSsnLast4 ?? null,
      tradeDescription: row.tradeDescription,
      laborType: row.laborType,
      monSt: e.monSt, monOt: e.monOt,
      tueSt: e.tueSt, tueOt: e.tueOt,
      wedSt: e.wedSt, wedOt: e.wedOt,
      thuSt: e.thuSt, thuOt: e.thuOt,
      friSt: e.friSt, friOt: e.friOt,
      satSt: e.satSt, satOt: e.satOt,
      sunSt: e.sunSt, sunOt: e.sunOt,
      totalStHours,
      totalOtHours,
      baseRateSnapshot: e.baseRateSnapshot,
      grossWages: e.grossWages ?? null,
      deductions: e.deductions,
      netPay: e.netPay ?? null,
      fringeHealthWelfare: e.fringeHealthWelfare ?? null,
      fringePension: e.fringePension ?? null,
      fringeVacation: e.fringeVacation ?? null,
      fringeTraining: e.fringeTraining ?? null,
    };
  });

  const pw12Data: Pw12Input = {
    contractor: {
      name: project.name,
      fein: project.contractorFein ?? '',
      address: `${project.county ?? ''}, ${project.state ?? ''}`,
    },
    week: {
      weekEndingDate: week.weekEndingDate,
      payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
        ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
        : String(week.payrollNumber),
    },
    project: {
      name: project.name,
      nyprcNumber: project.nyprcNumber ?? '',
      county: project.county ?? '',
    },
    entries: pw12Entries,
  };

  // 6. Generate PDF
  const filledPdf = await fillPw12(pw12Data);

  // 7. Send as PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="pw12-${weekId}.pdf"`);
  res.end(Buffer.from(filledPdf));

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'ny_pw12.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }
});

// ── GET /api/export/ny-mpwr-xml/:weekId ───────────────────────────────────
// NY MPWR XML export — NYSDOL MPWR portal compliant — state-gated to NY only

router.get('/ny-mpwr-xml/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access (NFR-03)
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — MPWR XML is NY-only
  if (project.state?.toUpperCase() !== 'NY') {
    res.status(400).json({ error: 'NY MPWR XML is only available for New York projects' });
    return;
  }

  // 4. Load payroll entries with worker details
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  // 5. Map entries to MpwrXmlInput
  type MpwrEntryRow = (typeof entries)[number];
  const mpwrEntries: MpwrXmlInput['entries'] = entries.map((row: MpwrEntryRow) => {
    const e = row.entry;
    const totalStHours = e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
    const totalOtHours = e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
    return {
      workerId: e.workerId,
      workerName: row.workerName,
      workerSsnLast4: row.workerSsnLast4 ?? null,
      nysRegisteredApprentice: row.nysRegisteredApprentice ?? false,
      tradeDescription: row.tradeDescription,
      laborType: row.laborType,
      workerAddress: row.workerAddress ?? undefined,
      monSt: e.monSt, monOt: e.monOt,
      tueSt: e.tueSt, tueOt: e.tueOt,
      wedSt: e.wedSt, wedOt: e.wedOt,
      thuSt: e.thuSt, thuOt: e.thuOt,
      friSt: e.friSt, friOt: e.friOt,
      satSt: e.satSt, satOt: e.satOt,
      sunSt: e.sunSt, sunOt: e.sunOt,
      totalStHours,
      totalOtHours,
      baseRateSnapshot: e.baseRateSnapshot,
      grossWages: e.grossWages ?? null,
      deductions: e.deductions,
      netPay: e.netPay ?? null,
      fringeHealthWelfare: e.fringeHealthWelfare ?? null,
      fringePension: e.fringePension ?? null,
      fringeVacation: e.fringeVacation ?? null,
      fringeTraining: e.fringeTraining ?? null,
    };
  });

  const mpwrData: MpwrXmlInput = {
    project: {
      nyprcNumber: project.nyprcNumber ?? '',
      nysContractorRegNumber: project.nysContractorRegNumber ?? '',
      name: project.name,
      contractorFein: project.contractorFein ?? '',
    },
    week: {
      weekEndingDate: week.weekEndingDate,
    },
    entries: mpwrEntries,
  };

  // 6. Generate XML
  const xml = generateMpwrXml(mpwrData);

  // 7. Send as XML download
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="mpwr-${weekId}.xml"`);
  res.send(xml);

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'ny_mpwr_xml.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'xml' },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }
});

export { router as exportRouter };
