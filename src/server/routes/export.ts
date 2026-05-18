import { logger } from '../logger.js';
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
import { fillIlCertifiedTranscript } from '../services/ilPdfGenerator.js';
import { fillMaCertifiedPayroll } from '../services/maPdfGenerator.js';
import { fillNjCertifiedPayroll, type NjPdfInput } from '../services/njPdfGenerator.js';
import { fillMnCertifiedPayroll, type MnPdfInput } from '../services/mnPdfGenerator.js';
import { fillVaCertifiedPayroll, type VaPdfInput } from '../services/vaPdfGenerator.js';
import {
  generateWaCprXml,
  type WaCprData,
  type WaCprEmployee,
  type WaCprTradeEntry,
} from '../services/waCprXmlGenerator.js';
import {
  fillWh347,
  getWh347TemplateBytes,
  type Wh347Data,
  type Wh347WorkerRow,
} from '../services/wh347Generator.js';
import {
  fillA1131,
  getA1131TemplateBytes,
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
import {
  computeExportPreflight,
  isExportPreflightFormat,
  type ExportPreflightOverrides,
} from '../services/exportPreflightService.js';
import { decryptSsn } from '../services/cryptoService.js';
import {
  generateComplianceSummaryPdf,
  type ComplianceSummaryInput,
  type ComplianceSummaryProjectRow,
} from '../services/complianceSummaryPdfGenerator.js';
import {
  generateTxCprPdf,
  type TxCprInput,
} from '../services/txCprPdfGenerator.js';
import { getStateSupport, validateStateProjectField } from '../../shared/stateSupport.js';
import { fillPaCpr, type PaCprInput } from '../services/paCprGenerator.js';
import { fillOhPwc28, type OhPwc28Input } from '../services/ohPwc28Generator.js';
import { fillCoCpr, type CoCprInput } from '../services/coCprGenerator.js';
import { fillMdDllr, type MdDllrInput } from '../services/mdDllrGenerator.js';
import { fillOrBoli, type OrBoliInput } from '../services/orBoliGenerator.js';
import { fillCtDol, type CtDolInput } from '../services/ctDolGenerator.js';
import { fillHiDli, type HiDliInput } from '../services/hiDliGenerator.js';
import { fillKyCpr, type KyCprInput } from '../services/kyCprGenerator.js';
import { fillNmCpr, type NmCprInput } from '../services/nmCprGenerator.js';
import { fillNvDir, type NvDirInput } from '../services/nvDirGenerator.js';
import { fillRiDol, type RiDolInput } from '../services/riDolGenerator.js';
import { fillWvDol, type WvDolInput } from '../services/wvDolGenerator.js';
import { fillMeDol, type MeDolInput } from '../services/meDolGenerator.js';
import { fillVtDfr, type VtDfrInput } from '../services/vtDfrGenerator.js';
import { fillMtDli, type MtDliInput } from '../services/mtDliGenerator.js';
import { fillNdDlt, type NdDltInput } from '../services/ndDltGenerator.js';
import { fillDeDol, type DeDolInput } from '../services/deDolGenerator.js';
import { fillNhDot, type NhDotInput } from '../services/nhDotGenerator.js';
import { fillAkDol, type AkDolInput } from '../services/akDolGenerator.js';
import { fillNycCpr, type NycCprInput } from '../services/nycCprGenerator.js';
import { fillCookCpr, type CookCprInput } from '../services/cookCprGenerator.js';
import { fillDcOcp, type DcOcpInput } from '../services/dcOcpGenerator.js';
import { fillLaCountyCpr, type LaCountyCprInput } from '../services/laCountyCprGenerator.js';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';

const router = Router();
router.use(requireAuth);

router.get('/preflight/:format/:weekId', async (req, res) => {
  try {
    const { format, weekId } = req.params;
    if (!isExportPreflightFormat(format)) {
      return res.status(400).json({ error: 'Unsupported export preflight format' });
    }

    const week = await getPayrollWeek(weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });

    await assertProjectAccess(getDb(), week.projectId, req.user!.userId);

    const overrides: ExportPreflightOverrides = {
      contractorFein: typeof req.query.contractorFein === 'string' ? req.query.contractorFein : undefined,
      dirProjectId: typeof req.query.dirProjectId === 'string' ? req.query.dirProjectId : undefined,
      awardingAgency: typeof req.query.awardingAgency === 'string' ? req.query.awardingAgency : undefined,
      contractNumber: typeof req.query.contractNumber === 'string' ? req.query.contractNumber : undefined,
    };
    const preflight = await computeExportPreflight(getDb(), weekId, format, overrides);
    if (!preflight) return res.status(404).json({ error: 'Payroll week not found' });

    return res.json({ data: preflight });
  } catch (err) {
    if ((err as Error).message === 'Project access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    logger.error({ err }, 'Export preflight failed');
    return res.status(500).json({ error: 'Export preflight failed' });
  }
});

router.get('/state-readiness/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });

    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const projectRecord = project as unknown as Record<string, unknown>;
    const state = String(project.state ?? '').toUpperCase();
    const config = getStateSupport(state);

    const requiredFields = config.requiredProjectFields.map((field) => {
      const value = projectRecord[field.key];
      const present = typeof value === 'string'
        ? String(value).trim().length > 0
        : value != null;
      const error = validateStateProjectField(state, field.key, value);
      return {
        ...field,
        present,
        valid: !error,
        error,
      };
    });

    return res.json({
      data: {
        weekId: week.id,
        projectId: week.projectId,
        state: state || 'FED',
        label: `${config.name} certified payroll`,
        status: config.status,
        statusLabel: config.statusLabel,
        launchDecision: config.launchDecision,
        nextGate: config.nextGate,
        supportedExports: config.supportedExports,
        requiredFields,
        missingFields: requiredFields
          .filter((field) => !field.present)
          .map(({ key, label }) => ({ key, label })),
        invalidFields: requiredFields
          .filter((field) => field.present && !field.valid)
          .map(({ key, label, error }) => ({ key, label, error })),
        ready: requiredFields.every((field) => field.present && field.valid),
      },
    });
  } catch (err) {
    if ((err as Error).message === 'Project access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    logger.error({ err }, 'State export readiness failed');
    return res.status(500).json({ error: 'State export readiness failed' });
  }
});

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

function deriveCertApprentices(
  entries: Array<{ laborType: string; programName: string | null | undefined }>,
  complianceResult: Awaited<ReturnType<typeof computeCompliance>>,
): boolean {
  const registrationComplete = deriveAllApprenticesRegistered(entries);
  const apprenticeRuleClear = !(complianceResult?.weekViolations.some(v =>
    ['apprentice-ratio', 'apprentice-trade-ratio', 'apprentice-registration'].includes(v.violationType),
  ) ?? false);
  return registrationComplete && apprenticeRuleClear;
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. Load payroll entries
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);
  type EntryRow = (typeof entries)[number];
  const incompletePayRows = entries.filter((row: EntryRow) => row.entry.grossWages == null || row.entry.netPay == null);
  if (incompletePayRows.length > 0) {
    res.status(409).json({ error: 'Cannot generate WH-347 until gross wages and net pay are calculated for every entry.' });
    return;
  }

  // certApprentices: derived from apprentice registration and ratio review status.
  // certProperPayment + certAccuratePayroll: derived from compliance engine (see complianceResult below)

  // Derive compliance flags for Statement of Compliance
  const complianceResult = await computeCompliance(db, weekId);
  const certApprentices = deriveCertApprentices(entries, complianceResult);

  // 4. Map entries to Wh347WorkerRow[]
  const workerRows: Wh347WorkerRow[] = entries.map((row: EntryRow, index: number) => {
    const e = row.entry;
    const totalSt = e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
    // BUG-01: CA double-time hours are counted in the OT column per WH-347 Column 5 spec
    const totalDtHours = (e.monDt ?? 0) + (e.tueDt ?? 0) + (e.wedDt ?? 0) + (e.thuDt ?? 0) + (e.friDt ?? 0) + (e.satDt ?? 0) + (e.sunDt ?? 0);
    const totalOt = e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt + totalDtHours;

    const grossWagesProject = e.grossWages ?? 0;
    const netPay = e.netPay ?? 0;
    const deductions = e.deductions ?? 0;

    // Deduction breakdown for WH-347 columns 9-12.
    // Only populate sub-columns when the user entered at least one itemized field;
    // otherwise leave them undefined so fmtDollar renders blank instead of "0.00".
    const ficaAmt = e.ficaTax ?? 0;
    const fedTaxAmt = e.federalIncomeTax ?? 0;
    const hasBreakdown = e.ficaTax != null || e.federalIncomeTax != null;
    // "Other" = everything not in the explicit FICA / Fed-tax columns
    // (state income tax + SDI + union dues + etc. all land here).
    const otherDeductions = hasBreakdown
      ? Math.max(0, deductions - ficaAmt - fedTaxAmt)
      : undefined;

    return {
      entryNo: index + 1,
      workerName: row.workerName,
      laborType: (row.laborType === 'foreman' ? 'journeyworker' : row.laborType) as 'journeyworker' | 'apprentice',
      identifyingNo: row.workerSsnLast4 ?? '',
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
      fica: e.ficaTax ?? undefined,
      taxWithheld: e.federalIncomeTax ?? undefined,
      otherDeductions,
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
    // TX-specific: use txdotProjectId as contract number if set
    projectContractNo: project.txdotProjectId || project.wdIdentifier || '',
    projectLocation: project.txAwardingAgency
      ? `${project.county}, ${project.state} — ${project.txAwardingAgency}`
      : `${project.county}, ${project.state}`,
    wageDeterminationNo,
    isFinal: week.isFinal,
    isPrime: true,
    workers: workerRows,
    compliance: {
      certProperPayment: complianceResult?.certProperPayment ?? true,
      certAccuratePayroll: complianceResult?.certAccuratePayroll ?? true,
      certWorkPerformed: true,      // manual certification — always true
      certApprentices,
      certFringeBenefits: workerRows.some(w => w.fringeCredit > 0),
      certDeductions: false,
      officialName: 'Certifying Official',
      officialTitle: 'Project Manager',
      signatureDate: formatDate(week.weekEndingDate),
      phoneNumber: '',
    },
  };

  // 6. Load template PDF and fill
  const templateBytes = getWh347TemplateBytes();
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
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — A-1-131 is CA-only
  if (project.state?.toUpperCase() !== 'CA') {
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
      ficaTax: e.ficaTax ?? 0,
      federalTax: e.federalIncomeTax ?? 0,
      stateTax: e.stateIncomeTax ?? 0,
      sdi: e.sdiTax ?? 0,
      vacationHoliday: e.deductionVacationHoliday ?? 0,
      healthWelfare: e.deductionHealthWelfare ?? 0,
      pension: e.deductionPension ?? 0,
      training: e.deductionTraining ?? 0,
      fundAdmin: e.deductionFundAdmin ?? 0,
      dues: e.deductionDues ?? 0,
      travelSubsistence: e.deductionTravelSubsistence ?? 0,
      savings: e.deductionSavings ?? 0,
      otherDeductions: e.deductionOther ?? 0,
      otherDeductionDescription: e.deductionOtherDescription ?? undefined,
      totalDeductions: e.deductions,
      netPay: e.netPay ?? 0,
      fringeCredit: e.fringeRateSnapshot * totalHours,
      checkNumber: e.checkNumber,
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
  const templateBytes = getA1131TemplateBytes();
  const filledPdf = await fillA1131(a1131Data, templateBytes);

  // 8. Stream as PDF download
  const filename = week.amendmentNumber != null
    ? `a1131-${week.payrollNumber}-amended-${week.amendmentNumber}.pdf`
    : `a1131-${week.payrollNumber}.pdf`;
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
      action: 'ca_pdf.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — F700-065-000 is WA-only
  if (project.state?.toUpperCase() !== 'WA') {
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — eCPR XML is CA-only
  if (project.state?.toUpperCase() !== 'CA') {
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
        fedTax: e.federalIncomeTax ?? 0,
        FICA: e.ficaTax ?? 0,
        stateTax: e.stateIncomeTax ?? 0,
        SDI: e.sdiTax ?? 0,
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
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — WA CPR XML is WA-only (D-07)
  if (project.state?.toUpperCase() !== 'WA') {
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
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
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
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
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
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
});

// ── GET /api/export/il-pdf/:weekId ────────────────────────────────────────
// IL Certified Transcript of Payroll PDF — state-gated to IL projects only

router.get('/il-pdf/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access (NFR-03) — BEFORE state gate
  const db = getDb();
  let project: Project;
  try {
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — IL Certified Transcript is IL-only
  if (project.state?.toUpperCase() !== 'IL') {
    res.status(400).json({ error: 'IL Certified Transcript is only available for Illinois projects' });
    return;
  }

  // 4. Load payroll entries with worker details
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  // 5. Map entries to IlPdfInput
  const ilData = {
    contractor: {
      name: project.name,
      address: (project.county || '') + ', ' + (project.state || ''),
      fein: project.contractorFein ?? '',
    },
    project: {
      name: project.name,
      number: project.wdIdentifier ?? '',
      location: (project.county || '') + ', ' + (project.state || ''),
      contractingAgency: (project as any).contractingAgency ?? '',
    },
    week: {
      weekEndingDate: week.weekEndingDate,
      payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
        ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
        : String(week.payrollNumber),
    },
    entries: entries.map((e: any) => ({
      workerName: e.workerName,
      workerSsnLast4: e.workerSsnLast4 ?? null,
      workerAddress: e.workerAddress ?? '',
      classification: e.tradeDescription ?? '',
      monPw: e.entry?.monSt ?? 0, tuePw: e.entry?.tueSt ?? 0, wedPw: e.entry?.wedSt ?? 0,
      thuPw: e.entry?.thuSt ?? 0, friPw: e.entry?.friSt ?? 0, satPw: e.entry?.satSt ?? 0, sunPw: e.entry?.sunSt ?? 0,
      monNonPw: 0, tueNonPw: 0, wedNonPw: 0,
      thuNonPw: 0, friNonPw: 0, satNonPw: 0, sunNonPw: 0,
      totalPwHours: (e.entry?.monSt ?? 0) + (e.entry?.tueSt ?? 0) + (e.entry?.wedSt ?? 0) +
        (e.entry?.thuSt ?? 0) + (e.entry?.friSt ?? 0) + (e.entry?.satSt ?? 0) + (e.entry?.sunSt ?? 0),
      totalNonPwHours: e.nonPwHours ?? 0,
      baseRate: e.entry?.baseRateSnapshot ?? 0,
      fringePension: e.entry?.fringePension ?? null,
      fringePensionIsF: false,
      fringeHealthWelfare: e.entry?.fringeHealthWelfare ?? null,
      fringeHealthWelfareIsF: false,
      fringeVacation: e.entry?.fringeVacation ?? null,
      fringeVacationIsF: false,
      fringeTraining: e.entry?.fringeTraining ?? null,
      fringeTrainingIsF: false,
      grossPay: e.entry?.grossWages ?? null,
      deductions: e.entry?.deductions ?? null,
      netPay: e.entry?.netPay ?? null,
    })),
    affidavit: { subcontractors: [], fundDetails: [] },
  };

  // 6. Generate PDF
  const filledPdf = await fillIlCertifiedTranscript(ilData);

  // 7. Send as PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="il-transcript-${weekId}.pdf"`);
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
      action: 'il_pdf.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
});

// ── GET /api/export/ma-cpr/:weekId ─────────────────────────────────────────
// Massachusetts DLS Weekly Certified Payroll Report — state-gated to MA projects only
// Phase 49: stub returning 501; Phase 50 fills in the PDF generator

router.get('/ma-cpr/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access (NFR-03) — BEFORE state gate
  const db = getDb();
  let project: Project;
  try {
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — MA DLS Payroll is MA-only
  if (project.state?.toUpperCase() !== 'MA') {
    res.status(400).json({ error: 'MA DLS Payroll is only available for Massachusetts projects' });
    return;
  }

  // 4. Load payroll entries with worker details
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  // 5. Map to MaPdfInput
  const maData = {
    contractor: {
      name: project.name,
      fein: (project as any).contractorFein ?? '',
      address: (project.county || '') + ', ' + (project.state || ''),
    },
    project: {
      name: project.name,
      dlsProjectId: (project as any).maDlsProjectId ?? '',
      location: (project.county || '') + ', ' + (project.state || ''),
      awardingAuthority: (project as any).contractingAgency ?? '',
    },
    week: {
      weekEndingDate: week.weekEndingDate,
      payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
        ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
        : String(week.payrollNumber),
    },
    entries: entries.map((e: any) => ({
      workerName: e.workerName,
      workerSsnLast4: e.workerSsnLast4 ?? null,
      workerAddress: e.workerAddress ?? '',
      classification: e.tradeDescription ?? '',
      oshaTraining: e.oshaTraining ?? null,
      isWoman: e.isWoman ?? null,
      isMinority: e.isMinority ?? null,
      sunSt: e.entry?.sunSt ?? 0,
      monSt: e.entry?.monSt ?? 0,
      tueSt: e.entry?.tueSt ?? 0,
      wedSt: e.entry?.wedSt ?? 0,
      thuSt: e.entry?.thuSt ?? 0,
      friSt: e.entry?.friSt ?? 0,
      satSt: e.entry?.satSt ?? 0,
      baseRate: e.entry?.baseRateSnapshot ?? 0,
      fringeHealthWelfare: e.entry?.fringeHealthWelfare ?? null,
      fringePension: e.entry?.fringePension ?? null,
      fringeVacation: e.entry?.fringeVacation ?? null,
      fringeTraining: e.entry?.fringeTraining ?? null,
      projectGross: e.entry?.grossWages ?? null,
      totalWeekGross: e.entry?.totalWeekGrossWages ?? null,
      allOtherHours: e.entry?.allOtherHours ?? null,
      checkNumber: e.entry?.checkNumber ?? null,
      // BUG-02: MA DLS requires deductions and net pay
      deductions: e.entry?.deductions ?? null,
      netPay: e.entry?.netPay ?? null,
    })),
  };

  // 6. Generate PDF
  const filledPdf = await fillMaCertifiedPayroll(maData);

  // 7. Send as PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ma-cpr-${weekId}.pdf"`);
  res.end(Buffer.from(filledPdf));

  // 8. Best-effort audit log
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'ma_pdf.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
});

// ── GET /api/export/nj-mw562/:weekId ────────────────────────────────────────
// New Jersey DOL MW-562 Weekly Certified Payroll — state-gated to NJ projects only
// Phase 51: stub returning 501; Phase 52 fills in the PDF generator

router.get('/nj-mw562/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access (NFR-03) — BEFORE state gate
  const db = getDb();
  let project: Project;
  try {
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — NJ MW-562 is NJ-only
  if (project.state?.toUpperCase() !== 'NJ') {
    res.status(400).json({ error: 'NJ MW-562 is only available for New Jersey projects' });
    return;
  }

  // 4. Load payroll entries with worker details
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  // 5. Map to NjPdfInput
  const njData: NjPdfInput = {
    contractor: {
      name: project.name,
      fein: (project as any).contractorFein ?? '',
      address: (project.county || '') + ', ' + (project.state || ''),
      njPwcNumber: (project as any).njPwcNumber ?? null,
    },
    project: {
      name: project.name,
      njContractId: (project as any).njContractId ?? null,
      location: (project.county || '') + ', ' + (project.state || ''),
      awardingAuthority: (project as any).contractingAgency ?? '',
    },
    week: {
      weekEndingDate: week.weekEndingDate,
      payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
        ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
        : String(week.payrollNumber),
    },
    entries: entries.map((e: any) => ({
      workerName: e.workerName,
      workerSsnLast4: e.workerSsnLast4 ?? null,
      workerAddress: e.workerAddress ?? '',
      classification: e.tradeDescription ?? '',
      workerSex: e.workerSex ?? null,
      race: e.race ?? null,
      ethnicity: e.ethnicity ?? null,
      monSt: e.entry?.monSt ?? 0,
      tueSt: e.entry?.tueSt ?? 0,
      wedSt: e.entry?.wedSt ?? 0,
      thuSt: e.entry?.thuSt ?? 0,
      friSt: e.entry?.friSt ?? 0,
      satSt: e.entry?.satSt ?? 0,
      sunSt: e.entry?.sunSt ?? 0,
      baseRate: e.entry?.baseRateSnapshot ?? 0,
      fringeHealthWelfare: e.entry?.fringeHealthWelfare ?? null,
      fringePension: e.entry?.fringePension ?? null,
      fringeVacation: e.entry?.fringeVacation ?? null,
      fringeTraining: e.entry?.fringeTraining ?? null,
      grossWages: e.entry?.grossWages ?? null,
      ficaTax: e.entry?.ficaTax ?? null,
      federalIncomeTax: e.entry?.federalIncomeTax ?? null,
      stateIncomeTax: e.entry?.stateIncomeTax ?? null,
      netPay: e.entry?.netPay ?? null,
    })),
  };

  // 6. Generate PDF
  const filledPdf = await fillNjCertifiedPayroll(njData);

  // 7. Send as PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="nj-mw562-${weekId}.pdf"`);
  res.end(Buffer.from(filledPdf));

  // 8. Best-effort audit log
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'nj_pdf.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
});

// ── GET /api/export/mn-dli/:weekId ────────────────────────────────────────────
// Minnesota DLI Weekly Certified Payroll — state-gated to MN projects only
// Phase 91: STATE-14

router.get('/mn-dli/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) { res.status(404).json({ error: 'Payroll week not found' }); return; }

  const db = getDb();
  let project: Project;
  try {
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  if (project.state?.toUpperCase() !== 'MN') {
    res.status(400).json({ error: 'MN DLI Payroll is only available for Minnesota projects' });
    return;
  }

  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  const mnData: MnPdfInput = {
    contractor: {
      name: project.name,
      fein: (project as any).contractorFein ?? '',
      address: (project.county || '') + ', ' + (project.state || ''),
    },
    project: {
      name: project.name,
      mnContractId: (project as any).mnContractId ?? null,
      location: (project.county || '') + ', ' + (project.state || ''),
      awardingAuthority: (project as any).contractingAgency ?? '',
    },
    week: {
      weekEndingDate: week.weekEndingDate,
      payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
        ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
        : String(week.payrollNumber),
    },
    entries: entries.map((e: any) => ({
      workerName: e.workerName,
      workerSsnLast4: e.workerSsnLast4 ?? null,
      workerAddress: e.workerAddress ?? '',
      classification: e.tradeDescription ?? '',
      monSt: e.entry?.monSt ?? 0,
      tueSt: e.entry?.tueSt ?? 0,
      wedSt: e.entry?.wedSt ?? 0,
      thuSt: e.entry?.thuSt ?? 0,
      friSt: e.entry?.friSt ?? 0,
      satSt: e.entry?.satSt ?? 0,
      sunSt: e.entry?.sunSt ?? 0,
      baseRate: e.entry?.baseRateSnapshot ?? 0,
      fringeHealthWelfare: e.entry?.fringeHealthWelfare ?? null,
      fringePension: e.entry?.fringePension ?? null,
      fringeVacation: e.entry?.fringeVacation ?? null,
      fringeTraining: e.entry?.fringeTraining ?? null,
      grossWages: e.entry?.grossWages ?? null,
      checkNumber: e.entry?.checkNumber ?? null,
      // BUG-03: MN DLI requires deductions and net pay
      deductions: e.entry?.deductions ?? null,
      netPay: e.entry?.netPay ?? null,
    })),
  };

  const filledPdf = await fillMnCertifiedPayroll(mnData);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="mn-dli-${weekId}.pdf"`);
  res.end(Buffer.from(filledPdf));

  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'mn_pdf.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
});

// ── GET /api/export/va-doli/:weekId ────────────────────────────────────────────
// Virginia DOLI Certified Payroll — state-gated to VA projects only
// Phase 92: STATE-15

router.get('/va-doli/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) { res.status(404).json({ error: 'Payroll week not found' }); return; }

  const db = getDb();
  let project: Project;
  try {
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  if (project.state?.toUpperCase() !== 'VA') {
    res.status(400).json({ error: 'VA DOLI Payroll is only available for Virginia projects' });
    return;
  }

  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  const vaData: VaPdfInput = {
    contractor: {
      name: project.name,
      fein: (project as any).contractorFein ?? '',
      address: (project.county || '') + ', ' + (project.state || ''),
    },
    project: {
      name: project.name,
      vaContractId: (project as any).vaContractId ?? null,
      location: (project.county || '') + ', ' + (project.state || ''),
      awardingAuthority: (project as any).contractingAgency ?? '',
    },
    week: {
      weekEndingDate: week.weekEndingDate,
      payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
        ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
        : String(week.payrollNumber),
    },
    entries: entries.map((e: any) => ({
      workerName: e.workerName,
      workerSsnLast4: e.workerSsnLast4 ?? null,
      workerAddress: e.workerAddress ?? '',
      classification: e.tradeDescription ?? '',
      monSt: e.entry?.monSt ?? 0,
      tueSt: e.entry?.tueSt ?? 0,
      wedSt: e.entry?.wedSt ?? 0,
      thuSt: e.entry?.thuSt ?? 0,
      friSt: e.entry?.friSt ?? 0,
      satSt: e.entry?.satSt ?? 0,
      sunSt: e.entry?.sunSt ?? 0,
      baseRate: e.entry?.baseRateSnapshot ?? 0,
      fringeHealthWelfare: e.entry?.fringeHealthWelfare ?? null,
      fringePension: e.entry?.fringePension ?? null,
      fringeVacation: e.entry?.fringeVacation ?? null,
      fringeTraining: e.entry?.fringeTraining ?? null,
      grossWages: e.entry?.grossWages ?? null,
      checkNumber: e.entry?.checkNumber ?? null,
      // BUG-04: VA DOLI requires deductions and net pay
      deductions: e.entry?.deductions ?? null,
      netPay: e.entry?.netPay ?? null,
    })),
  };

  const filledPdf = await fillVaCertifiedPayroll(vaData);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="va-doli-${weekId}.pdf"`);
  res.end(Buffer.from(filledPdf));

  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'va_pdf.downloaded',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
});

// ── GET /api/export/compliance-summary ────────────────────────────────────
// Returns a single PDF covering all active projects for the authenticated user.
// No assertProjectAccess — scoped to req.user.userId across all their projects.

router.get('/compliance-summary', async (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;

  // 1. Fetch all active projects belonging to this user
  const userProjects = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.userId, userId), eq(schema.projects.status, 'active')));

  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

  // 2. For each project, gather summary stats
  type ProjectRow = typeof schema.projects.$inferSelect;
  type WeekRow = { id: string; weekEndingDate: string; submittedAt: string | null };

  const rows: ComplianceSummaryProjectRow[] = await Promise.all(
    userProjects.map(async (proj: ProjectRow) => {
      // Worker count (active workers only)
      const workerRows = await db
        .select({ id: schema.workers.id })
        .from(schema.workers)
        .where(and(eq(schema.workers.projectId, proj.id), eq(schema.workers.isActive, true)));

      // Payroll weeks
      const weeks: WeekRow[] = await db
        .select({
          id: schema.payrollWeeks.id,
          weekEndingDate: schema.payrollWeeks.weekEndingDate,
          submittedAt: schema.payrollWeeks.submittedAt,
        })
        .from(schema.payrollWeeks)
        .where(eq(schema.payrollWeeks.projectId, proj.id));

      const weeksSubmitted = weeks.filter((w: WeekRow) => w.submittedAt !== null).length;
      const weeksPending = weeks.filter((w: WeekRow) => w.submittedAt === null).length;
      const cprOverdueCount = weeks.filter(
        (w: WeekRow) => w.submittedAt === null && w.weekEndingDate < sevenDaysAgoIso
      ).length;

      // Subcontractor CPR weeks — join via subcontractors -> subcontractorCprWeeks
      const subs = await db
        .select({ id: schema.subcontractors.id })
        .from(schema.subcontractors)
        .where(eq(schema.subcontractors.projectId, proj.id));

      let subCprTotal = 0, subCprCompliant = 0, subCprViolation = 0, subCprPending = 0;
      for (const sub of subs) {
        const cprWeeks = await db
          .select({
            isCompliant: schema.subcontractorCprWeeks.isCompliant,
            receivedDate: schema.subcontractorCprWeeks.receivedDate,
          })
          .from(schema.subcontractorCprWeeks)
          .where(eq(schema.subcontractorCprWeeks.subcontractorId, sub.id));
        subCprTotal += cprWeeks.length;
        for (const cw of cprWeeks) {
          if (cw.isCompliant === 1) subCprCompliant++;
          else if (cw.isCompliant === 0) subCprViolation++;
          else subCprPending++;
        }
      }

      return {
        name: proj.name,
        state: proj.state,
        awardDate: proj.awardDate,
        workerCount: workerRows.length,
        weeksTotal: weeks.length,
        weeksSubmitted,
        weeksPending,
        cprOverdueCount,
        subCprTotal,
        subCprCompliant,
        subCprViolation,
        subCprPending,
      };
    })
  );

  const input: ComplianceSummaryInput = {
    generatedAt: today,
    contractorEmail: req.user!.email,
    projects: rows,
  };

  const pdfBytes = await generateComplianceSummaryPdf(input);

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'attachment; filename="compliance-summary.pdf"');
  res.send(Buffer.from(pdfBytes));
});

// ── GET /api/export/tx-cpr/:weekId ───────────────────────────────────────────
// Texas DOT Certified Payroll Report (PWC-1) — state-gated to TX projects only
// Phase 83: programmatic PDF using pdf-lib (no fillable template required)

router.get('/tx-cpr/:weekId', async (req, res) => {
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
    ({ project } = await assertProjectAccess(db, week.projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — TX CPR is TX-only
  if (project.state?.toUpperCase() !== 'TX') {
    res.status(400).json({ error: 'TX CPR is only available for Texas projects' });
    return;
  }

  // 4. Load payroll entries with worker details
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  // 5. Build TxCprInput
  const txData: TxCprInput = {
    contractor: {
      name: project.name,
      fein: (project as any).contractorFein ?? '',
      address: `${project.county || ''}, ${project.state || ''}`,
      txContractorLicense: (project as any).txContractorLicense ?? null,
    },
    project: {
      name: project.name,
      txdotProjectId: (project as any).txdotProjectId ?? null,
      txAwardingAgency: (project as any).txAwardingAgency ?? null,
      location: `${project.county || ''}, TX`,
    },
    week: {
      weekEndingDate: week.weekEndingDate,
      payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
        ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
        : String(week.payrollNumber),
    },
    entries: entries.map((e: any) => ({
      workerName: e.workerName ?? '',
      workerSsnLast4: e.workerSsnLast4 ?? null,
      classification: e.tradeDescription ?? '',
      monSt: e.entry?.monSt ?? 0,
      tueSt: e.entry?.tueSt ?? 0,
      wedSt: e.entry?.wedSt ?? 0,
      thuSt: e.entry?.thuSt ?? 0,
      friSt: e.entry?.friSt ?? 0,
      satSt: e.entry?.satSt ?? 0,
      sunSt: e.entry?.sunSt ?? 0,
      monOt: e.entry?.monOt ?? 0,
      tueOt: e.entry?.tueOt ?? 0,
      wedOt: e.entry?.wedOt ?? 0,
      thuOt: e.entry?.thuOt ?? 0,
      friOt: e.entry?.friOt ?? 0,
      satOt: e.entry?.satOt ?? 0,
      sunOt: e.entry?.sunOt ?? 0,
      baseRate: e.entry?.baseRateSnapshot ?? 0,
      grossWages: e.entry?.grossWages ?? null,
      deductions: e.entry?.deductions ?? 0,
      netPay: e.entry?.netPay ?? null,
    })),
  };

  // 6. Generate PDF
  const pdfBytes = await generateTxCprPdf(txData);

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="tx-cpr-${weekId}.pdf"`);
  res.send(Buffer.from(pdfBytes));
});

// ── PA CPR ─────────────────────────────────────────────────────────────────
router.get('/pa-cpr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: PaCprInput = {
      contractor: {
        name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''),
        address: `${p.state ?? ''}, ${p.county ?? ''}`,
        paContractorLicense: p.paContractorLicense != null ? String(p.paContractorLicense) : null,
      },
      project: {
        name: String(p.name ?? ''), paContractId: p.paContractId != null ? String(p.paContractId) : null,
        county: String(p.county ?? ''), awardingAuthority: String(p.awardingAgency ?? ''),
      },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: entries.map((e) => ({
        workerName: e.workerName ?? '', workerSsnLast4: e.ssnLast4 ?? null,
        workerAddress: e.workerAddress ?? '', classification: e.tradeDescription ?? '',
        isApprentice: e.laborType === 'apprentice',
        monSt: e.monSt ?? 0, monOt: e.monOt ?? 0, tueSt: e.tueSt ?? 0, tueOt: e.tueOt ?? 0,
        wedSt: e.wedSt ?? 0, wedOt: e.wedOt ?? 0, thuSt: e.thuSt ?? 0, thuOt: e.thuOt ?? 0,
        friSt: e.friSt ?? 0, friOt: e.friOt ?? 0, satSt: e.satSt ?? 0, satOt: e.satOt ?? 0,
        sunSt: e.sunSt ?? 0, sunOt: e.sunOt ?? 0,
        baseRate: e.baseRate ?? 0, fringeRate: e.fringeRate ?? 0, grossWages: e.grossWages ?? 0,
        ficaTax: e.ficaTax ?? 0, fitWithheld: e.fitWithheld ?? 0, stateWithheld: e.stateWithheld ?? 0,
        otherDeductions: e.otherDeductions ?? 0, netPay: e.netPay ?? 0,
      })),
      compliance: { certifierName: String(p.certifierName ?? ''), certifierTitle: String(p.certifierTitle ?? ''), signatureDate: week.weekEndingDate },
    };
    const bytes = await fillPaCpr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="pa-cpr-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'PA CPR export failed');
    return res.status(500).json({ error: 'PA CPR export failed' });
  }
});

// ── OH PWC-28 ────────────────────────────────────────────────────────────────
router.get('/oh-pwc28/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: OhPwc28Input = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), ohContractId: p.ohContractId != null ? String(p.ohContractId) : null, ohAwardingAuthority: String(p.awardingAgency ?? ''), county: String(p.county ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: entries.map((e) => ({
        workerName: e.workerName ?? '', workerSsnLast4: e.ssnLast4 ?? null, workerAddress: e.workerAddress ?? '',
        classification: e.tradeDescription ?? '', isApprentice: e.laborType === 'apprentice',
        monSt: e.monSt ?? 0, monOt: e.monOt ?? 0, tueSt: e.tueSt ?? 0, tueOt: e.tueOt ?? 0,
        wedSt: e.wedSt ?? 0, wedOt: e.wedOt ?? 0, thuSt: e.thuSt ?? 0, thuOt: e.thuOt ?? 0,
        friSt: e.friSt ?? 0, friOt: e.friOt ?? 0, satSt: e.satSt ?? 0, satOt: e.satOt ?? 0,
        sunSt: e.sunSt ?? 0, sunOt: e.sunOt ?? 0,
        baseRate: e.baseRate ?? 0, fringeRate: e.fringeRate ?? 0, grossWages: e.grossWages ?? 0,
        ficaTax: e.ficaTax ?? 0, fitWithheld: e.fitWithheld ?? 0, stateWithheld: e.stateWithheld ?? 0,
        otherDeductions: e.otherDeductions ?? 0, netPay: e.netPay ?? 0,
      })),
      compliance: { certifierName: String(p.certifierName ?? ''), certifierTitle: String(p.certifierTitle ?? ''), signatureDate: week.weekEndingDate },
    };
    const bytes = await fillOhPwc28(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="oh-pwc28-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'OH PWC-28 export failed');
    return res.status(500).json({ error: 'OH PWC-28 export failed' });
  }
});

// ── CO CPR ────────────────────────────────────────────────────────────────────
router.get('/co-cpr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: CoCprInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), coContractId: p.coContractId != null ? String(p.coContractId) : null, coAwardingAgency: String(p.awardingAgency ?? ''), projectCounty: String(p.county ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: entries.map((e) => ({
        workerName: e.workerName ?? '', workerSsnLast4: e.ssnLast4 ?? null, workerAddress: e.workerAddress ?? '',
        classification: e.tradeDescription ?? '', isApprentice: e.laborType === 'apprentice',
        monSt: e.monSt ?? 0, monOt: e.monOt ?? 0, tueSt: e.tueSt ?? 0, tueOt: e.tueOt ?? 0,
        wedSt: e.wedSt ?? 0, wedOt: e.wedOt ?? 0, thuSt: e.thuSt ?? 0, thuOt: e.thuOt ?? 0,
        friSt: e.friSt ?? 0, friOt: e.friOt ?? 0, satSt: e.satSt ?? 0, satOt: e.satOt ?? 0,
        sunSt: e.sunSt ?? 0, sunOt: e.sunOt ?? 0,
        baseRate: e.baseRate ?? 0, fringeRate: e.fringeRate ?? 0, grossWages: e.grossWages ?? 0,
        ficaTax: e.ficaTax ?? 0, fitWithheld: e.fitWithheld ?? 0, stateWithheld: e.stateWithheld ?? 0,
        otherDeductions: e.otherDeductions ?? 0, netPay: e.netPay ?? 0,
      })),
      compliance: { certifierName: String(p.certifierName ?? ''), certifierTitle: String(p.certifierTitle ?? ''), signatureDate: week.weekEndingDate },
    };
    const bytes = await fillCoCpr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="co-cpr-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'CO CPR export failed');
    return res.status(500).json({ error: 'CO CPR export failed' });
  }
});

// Helper for building standard GenericCprEntry entries from payroll data
function buildGenericEntries(entries: Awaited<ReturnType<typeof getPayrollEntriesWithWorkerDetails>>) {
  return entries.map((e) => ({
    workerName: e.workerName ?? '', workerSsnLast4: e.ssnLast4 ?? null,
    // BUG-08: include worker address in generic CPR entries
    workerAddress: e.workerAddress ?? '',
    classification: e.tradeDescription ?? '', isApprentice: e.laborType === 'apprentice',
    monSt: e.monSt ?? 0, monOt: e.monOt ?? 0, tueSt: e.tueSt ?? 0, tueOt: e.tueOt ?? 0,
    wedSt: e.wedSt ?? 0, wedOt: e.wedOt ?? 0, thuSt: e.thuSt ?? 0, thuOt: e.thuOt ?? 0,
    friSt: e.friSt ?? 0, friOt: e.friOt ?? 0, satSt: e.satSt ?? 0, satOt: e.satOt ?? 0,
    sunSt: e.sunSt ?? 0, sunOt: e.sunOt ?? 0,
    baseRate: e.baseRate ?? 0, grossWages: e.grossWages ?? 0,
    ficaTax: e.ficaTax ?? 0, fitWithheld: e.fitWithheld ?? 0, stateWithheld: e.stateWithheld ?? 0,
    otherDeductions: e.otherDeductions ?? 0, netPay: e.netPay ?? 0,
  }));
}

function buildGenericCompliance(p: Record<string, unknown>, week: { weekEndingDate: string }, statuteCitation: string) {
  return { certifierName: String(p.certifierName ?? ''), certifierTitle: String(p.certifierTitle ?? ''), signatureDate: week.weekEndingDate, statuteCitation };
}

// ── MD DLLR ──────────────────────────────────────────────────────────────────
router.get('/md-dllr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: MdDllrInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), mdContractId: p.mdContractId != null ? String(p.mdContractId) : null, mdAwardingAgency: String(p.awardingAgency ?? ''), county: String(p.county ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'MD Code, Lab. & Emp. \u00a7 17-201 et seq.'),
    };
    const bytes = await fillMdDllr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="md-dllr-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'MD DLLR export failed');
    return res.status(500).json({ error: 'MD DLLR export failed' });
  }
});

// ── OR BOLI ──────────────────────────────────────────────────────────────────
router.get('/or-boli/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: OrBoliInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}`, orCcbLicense: p.orContractorCcb != null ? String(p.orContractorCcb) : null },
      project: { name: String(p.name ?? ''), orBoliProjectId: p.orBoliProjectId != null ? String(p.orBoliProjectId) : null, county: String(p.county ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: entries.map((e) => ({ ...buildGenericEntries([e])[0], isWoman: null, isMinority: null })),
      compliance: buildGenericCompliance(p, week, 'ORS 279C.800 et seq.'),
    };
    const bytes = await fillOrBoli(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="or-boli-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'OR BOLI export failed');
    return res.status(500).json({ error: 'OR BOLI export failed' });
  }
});

// ── CT DOL ───────────────────────────────────────────────────────────────────
router.get('/ct-dol/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: CtDolInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), ctContractId: p.ctContractId != null ? String(p.ctContractId) : null, ctAwardingMunicipality: String(p.awardingAgency ?? p.county ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'CGS \u00a7 31-53 (Connecticut Prevailing Wage Law)'),
    };
    const bytes = await fillCtDol(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="ct-dol-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'CT DOL export failed');
    return res.status(500).json({ error: 'CT DOL export failed' });
  }
});

// ── HI DLI ───────────────────────────────────────────────────────────────────
router.get('/hi-dli/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: HiDliInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), hiContractId: p.hiContractId != null ? String(p.hiContractId) : null, hiAwardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: entries.map((e) => ({
        workerName: e.workerName ?? '', workerSsnLast4: e.ssnLast4 ?? null, classification: e.tradeDescription ?? '',
        isApprentice: e.laborType === 'apprentice',
        monSt: e.monSt ?? 0, monOt: e.monOt ?? 0, monDt: 0, tueSt: e.tueSt ?? 0, tueOt: e.tueOt ?? 0, tueDt: 0,
        wedSt: e.wedSt ?? 0, wedOt: e.wedOt ?? 0, wedDt: 0, thuSt: e.thuSt ?? 0, thuOt: e.thuOt ?? 0, thuDt: 0,
        friSt: e.friSt ?? 0, friOt: e.friOt ?? 0, friDt: 0, satSt: e.satSt ?? 0, satOt: e.satOt ?? 0, satDt: 0,
        sunSt: e.sunSt ?? 0, sunOt: e.sunOt ?? 0, sunDt: 0,
        baseRate: e.baseRate ?? 0, dtRate: (e.baseRate ?? 0) * 2, grossWages: e.grossWages ?? 0,
        ficaTax: e.ficaTax ?? 0, fitWithheld: e.fitWithheld ?? 0, stateWithheld: e.stateWithheld ?? 0,
        otherDeductions: e.otherDeductions ?? 0, netPay: e.netPay ?? 0,
      })),
      compliance: buildGenericCompliance(p, week, 'HRS Chapter 104'),
    };
    const bytes = await fillHiDli(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="hi-dli-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'HI DLI export failed');
    return res.status(500).json({ error: 'HI DLI export failed' });
  }
});

// ── KY CPR ───────────────────────────────────────────────────────────────────
router.get('/ky-cpr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: KyCprInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), kyContractId: p.kyContractId != null ? String(p.kyContractId) : null, kyAwardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'KRS 337.505\u2013337.550 (Kentucky Prevailing Wage Act)'),
    };
    const bytes = await fillKyCpr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="ky-cpr-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'KY CPR export failed');
    return res.status(500).json({ error: 'KY CPR export failed' });
  }
});

// ── NM CPR ───────────────────────────────────────────────────────────────────
router.get('/nm-cpr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: NmCprInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), nmContractId: p.nmContractId != null ? String(p.nmContractId) : null, nmAwardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'NMSA \u00a7 13-4-11 et seq.'),
    };
    const bytes = await fillNmCpr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="nm-cpr-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'NM CPR export failed');
    return res.status(500).json({ error: 'NM CPR export failed' });
  }
});

// ── NV DIR ───────────────────────────────────────────────────────────────────
router.get('/nv-dir/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: NvDirInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}`, nvContractorLicense: p.nvContractorLicense != null ? String(p.nvContractorLicense) : null },
      project: { name: String(p.name ?? ''), nvContractId: p.nvContractId != null ? String(p.nvContractId) : null, county: String(p.county ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'NRS 338.010 et seq.'),
    };
    const bytes = await fillNvDir(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="nv-dir-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'NV DIR export failed');
    return res.status(500).json({ error: 'NV DIR export failed' });
  }
});

// ── RI DOL ───────────────────────────────────────────────────────────────────
router.get('/ri-dol/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: RiDolInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), riContractId: p.riContractId != null ? String(p.riContractId) : null, awardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'RIGL \u00a7 37-13-1 et seq.'),
    };
    const bytes = await fillRiDol(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="ri-dol-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'RI DOL export failed');
    return res.status(500).json({ error: 'RI DOL export failed' });
  }
});

// ── WV DOL ───────────────────────────────────────────────────────────────────
router.get('/wv-dol/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: WvDolInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), wvContractId: p.wvContractId != null ? String(p.wvContractId) : null, awardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'WV Code \u00a7 21-5A-1 et seq.'),
    };
    const bytes = await fillWvDol(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="wv-dol-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'WV DOL export failed');
    return res.status(500).json({ error: 'WV DOL export failed' });
  }
});

// ── ME DOL ───────────────────────────────────────────────────────────────────
router.get('/me-dol/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: MeDolInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), meContractId: p.meContractId != null ? String(p.meContractId) : null, awardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, '26 MRS \u00a7 1311 et seq.'),
    };
    const bytes = await fillMeDol(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="me-dol-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'ME DOL export failed');
    return res.status(500).json({ error: 'ME DOL export failed' });
  }
});

// ── VT DFR ───────────────────────────────────────────────────────────────────
router.get('/vt-dfr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: VtDfrInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), vtContractId: p.vtContractId != null ? String(p.vtContractId) : null, awardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, '21 VSA \u00a7 391 et seq.'),
    };
    const bytes = await fillVtDfr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="vt-dfr-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'VT DFR export failed');
    return res.status(500).json({ error: 'VT DFR export failed' });
  }
});

// ── MT DLI ───────────────────────────────────────────────────────────────────
router.get('/mt-dli/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: MtDliInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), mtContractId: p.mtContractId != null ? String(p.mtContractId) : null, awardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'MCA \u00a7 18-2-401 et seq.'),
    };
    const bytes = await fillMtDli(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="mt-dli-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'MT DLI export failed');
    return res.status(500).json({ error: 'MT DLI export failed' });
  }
});

// ── ND DLT ───────────────────────────────────────────────────────────────────
router.get('/nd-dlt/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: NdDltInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), ndContractId: p.ndContractId != null ? String(p.ndContractId) : null, awardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'NDCC 34-14-01 et seq.'),
    };
    const bytes = await fillNdDlt(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="nd-dlt-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'ND DLT export failed');
    return res.status(500).json({ error: 'ND DLT export failed' });
  }
});

// ── DE DOL ───────────────────────────────────────────────────────────────────
router.get('/de-dol/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: DeDolInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), deContractId: p.deContractId != null ? String(p.deContractId) : null, awardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, '29 Del. C. \u00a7 6960 et seq.'),
    };
    const bytes = await fillDeDol(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="de-dol-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'DE DOL export failed');
    return res.status(500).json({ error: 'DE DOL export failed' });
  }
});

// ── NH DOT ───────────────────────────────────────────────────────────────────
router.get('/nh-dot/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: NhDotInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), nhContractId: p.nhContractId != null ? String(p.nhContractId) : null, nhDotProjectNumber: null },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'RSA 228:22'),
    };
    const bytes = await fillNhDot(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="nh-dot-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'NH DOT export failed');
    return res.status(500).json({ error: 'NH DOT export failed' });
  }
});

// ── AK DOL ───────────────────────────────────────────────────────────────────
router.get('/ak-dol/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: AkDolInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: { name: String(p.name ?? ''), akContractId: p.akContractId != null ? String(p.akContractId) : null, akAwardingAgency: String(p.awardingAgency ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: entries.map((e) => ({
        workerName: e.workerName ?? '', workerSsnLast4: e.ssnLast4 ?? null, classification: e.tradeDescription ?? '',
        isApprentice: e.laborType === 'apprentice',
        sunSt: e.sunSt ?? 0, monSt: e.monSt ?? 0, tueSt: e.tueSt ?? 0, wedSt: e.wedSt ?? 0,
        thuSt: e.thuSt ?? 0, friSt: e.friSt ?? 0, satSt: e.satSt ?? 0,
        sunOt: e.sunOt ?? 0, monOt: e.monOt ?? 0, tueOt: e.tueOt ?? 0, wedOt: e.wedOt ?? 0,
        thuOt: e.thuOt ?? 0, friOt: e.friOt ?? 0, satOt: e.satOt ?? 0,
        baseRate: e.baseRate ?? 0, grossWages: e.grossWages ?? 0,
        ficaTax: e.ficaTax ?? 0, fitWithheld: e.fitWithheld ?? 0, stateWithheld: e.stateWithheld ?? 0,
        otherDeductions: e.otherDeductions ?? 0, netPay: e.netPay ?? 0,
      })),
      compliance: buildGenericCompliance(p, week, 'AS 36.05.010 et seq.'),
    };
    const bytes = await fillAkDol(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="ak-dol-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'AK DOL export failed');
    return res.status(500).json({ error: 'AK DOL export failed' });
  }
});

// ── NYC DCAS CPR ─────────────────────────────────────────────────────────────
router.get('/nyc-cpr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: NycCprInput = {
      contractor: {
        name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''),
        address: String(p.address ?? ''), nycVendorId: p.nycVendorId != null ? String(p.nycVendorId) : null,
      },
      project: {
        name: String(p.name ?? ''), nycContractNumber: p.nycContractNumber != null ? String(p.nycContractNumber) : null,
        borough: String(p.nycBorough ?? ''), dcasProjectManager: p.dcasProjectManager != null ? String(p.dcasProjectManager) : null,
      },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: entries.map((e) => ({
        workerName: e.workerName ?? '', workerSsnLast4: e.ssnLast4 ?? null,
        workerAddress: e.workerAddress ?? '', classification: e.tradeDescription ?? '',
        isApprentice: e.laborType === 'apprentice',
        monSt: e.monSt ?? 0, monOt: e.monOt ?? 0, tueSt: e.tueSt ?? 0, tueOt: e.tueOt ?? 0,
        wedSt: e.wedSt ?? 0, wedOt: e.wedOt ?? 0, thuSt: e.thuSt ?? 0, thuOt: e.thuOt ?? 0,
        friSt: e.friSt ?? 0, friOt: e.friOt ?? 0, satSt: e.satSt ?? 0, satOt: e.satOt ?? 0,
        sunSt: e.sunSt ?? 0, sunOt: e.sunOt ?? 0,
        baseRate: e.baseRate ?? 0, fringeRate: e.fringeRate ?? 0,
        grossWages: e.grossWages ?? 0, deductions: (e.ficaTax ?? 0) + (e.fitWithheld ?? 0) + (e.stateWithheld ?? 0),
        netPay: e.netPay ?? 0,
      })),
      compliance: { certifierName: String(p.certifierName ?? ''), certifierTitle: String(p.certifierTitle ?? ''), signatureDate: week.weekEndingDate },
    };
    const bytes = await fillNycCpr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="nyc-cpr-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'NYC CPR export failed');
    return res.status(500).json({ error: 'NYC CPR export failed' });
  }
});

// ── Cook County CPR ──────────────────────────────────────────────────────────
router.get('/cook-cpr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: CookCprInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}` },
      project: {
        name: String(p.name ?? ''), cookContractId: p.cookContractId != null ? String(p.cookContractId) : null,
        location: String(p.county ?? ''), contractingAgency: String(p.awardingAgency ?? ''),
        cookLivingWageApplies: Boolean(p.cookLivingWageApplies), ccllwoContractYear: p.ccllwoContractYear != null ? String(p.ccllwoContractYear) : null,
      },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, '820 ILCS 130/5'),
    };
    const bytes = await fillCookCpr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="cook-cpr-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'Cook County CPR export failed');
    return res.status(500).json({ error: 'Cook County CPR export failed' });
  }
});

// ── DC OCP CPR ───────────────────────────────────────────────────────────────
router.get('/dc-ocp/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: DcOcpInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}`, dcBusinessLicense: p.dcBusinessLicense != null ? String(p.dcBusinessLicense) : null },
      project: { name: String(p.name ?? ''), dcContractNumber: p.dcContractNumber != null ? String(p.dcContractNumber) : null, dcAgency: String(p.awardingAgency ?? ''), dcProjectManager: null },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'DC Code \u00a7 32-1002 et seq.'),
    };
    const bytes = await fillDcOcp(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="dc-ocp-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'DC OCP export failed');
    return res.status(500).json({ error: 'DC OCP export failed' });
  }
});

// ── LA County DPW CPR ────────────────────────────────────────────────────────
router.get('/la-county-cpr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;
    const input: LaCountyCprInput = {
      contractor: { name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''), address: `${p.state ?? ''}, ${p.county ?? ''}`, cslbLicense: p.cslbLicense != null ? String(p.cslbLicense) : null },
      project: { name: String(p.name ?? ''), laCountyProjectId: p.laCountyProjectId != null ? String(p.laCountyProjectId) : null, laDpwDistrict: p.laDpwDistrict != null ? String(p.laDpwDistrict) : null, dirProjectId: String(p.dirProjectId ?? '') },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: buildGenericEntries(entries),
      compliance: buildGenericCompliance(p, week, 'CA Labor Code \u00a7 1720 et seq.'),
    };
    const bytes = await fillLaCountyCpr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="la-county-cpr-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'LA County CPR export failed');
    return res.status(500).json({ error: 'LA County CPR export failed' });
  }
});

export { router as exportRouter };
