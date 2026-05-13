// src/client/pages/PayrollWeekDetailPage.tsx
// Route: /projects/:projectId/payroll/:weekId
import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck, ExternalLink, Info } from 'lucide-react';
import { api } from '../lib/api';
import { enqueueRequest } from '../lib/offlineQueue';
import { Layout } from '../components/shared/Layout';
import { PayrollWeekDetailSkeleton } from '../components/ui/Skeleton';
import { HelpCallout } from '../components/ui/HelpCallout';
import { TermTooltip } from '../components/ui/TermTooltip';
import { Tooltip } from '../components/ui/Tooltip';
import { PageHeader } from '../components/ui/PageHeader';

const WH347_DEF = "The U.S. Department of Labor's official certified payroll form. Required weekly for federal prevailing wage projects. Submit to your contracting officer within 7 days of the week ending date.";
const ECPR_XML_DEF = "Electronic Certified Payroll Report — Washington State's digital submission format. Required for public works projects in WA. Exported as an XML file and uploaded to L&I's online system.";
const PWIA_INTENT_DEF = "Public Works Intent to Pay Prevailing Wages — a Washington State form filed before work begins, declaring the wage rates you intend to pay each trade.";
const CWHSSA_OT_DEF = "Contract Work Hours and Safety Standards Act overtime — requires 1.5x pay for all hours over 40/week on federal contracts, including fringe benefits at straight time for all hours.";
const CPR_DEF = "Certified Payroll Report — the weekly record of all workers, hours, wages, and deductions required under the Davis-Bacon Act.";

const PROVIDER_LABELS: Record<string, string> = {
  quickbooks: 'QuickBooks',
  adp: 'ADP',
  gusto: 'Gusto',
  paychex: 'Paychex Flex',
  sage_300: 'Sage 300 CRE',
  sage_100: 'Sage 100',
};
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { RateProvenance } from '../components/ui/RateProvenance';
import { PhotoCapture } from '../components/field/PhotoCapture';

interface PayrollWeek {
  id: string;
  projectId: string;
  weekEndingDate: string;
  payrollNumber: number;
  isFinal: boolean;
  submittedAt: string | null;
  submittedTo: string | null;
  createdAt: string;
  amendmentNumber: number | null;
  originalWeekId: string | null;
  caEcprSubmittedAt: string | null;
  waLniSubmittedAt: string | null;
  nyMpwrSubmittedAt: string | null;
  ilIdolSubmittedAt: string | null;
}

interface PayrollEntryRow {
  entry: {
    id: string;
    workerId: string;
    payrollWeekId: string;
    monSt: number;
    tueSt: number;
    wedSt: number;
    thuSt: number;
    friSt: number;
    satSt: number;
    sunSt: number;
    monOt: number;
    tueOt: number;
    wedOt: number;
    thuOt: number;
    friOt: number;
    satOt: number;
    sunOt: number;
    baseRateSnapshot: number;
    fringeRateSnapshot: number;
    grossWages: number | null;
    deductions: number | null;
    netPay: number | null;
    // Phase 108 (DBE-08): optional sub attribution
    subcontractorId: string | null;
    classificationId: string;
  };
  workerName: string;
  laborType: string;
  tradeDescription: string;
  overrideClassificationId: string | null;
  overrideId: string | null;
}

interface ComplianceViolation {
  workerId: string;
  workerName: string;
  violationType: 'under-wage' | 'cwhssa-ot' | 'weekly-ot' | 'multi-classification-ot' | 'ca-daily-ot' | 'ca-daily-dt';
  expected: number;
  actual: number;
  delta: number;
  entryId: string;
}

interface WeekViolation {
  violationType: 'apprentice-ratio' | 'apprentice-trade-ratio' | 'apprentice-registration' | 'ira-iija-apprentice-pct';
  detail: string;
  apprenticeHours: number;
  journeyworkerHours: number;
  maxAllowedApprenticeHours: number;
  trade?: string;
  excessHours?: number;
  estimatedLiabilityUsd?: number;
  totalHours?: number;
  actualPct?: number;
}

interface ComplianceResult {
  weekId: string;
  projectId: string;
  violations: ComplianceViolation[];
  weekViolations: WeekViolation[];
  deductionViolations?: Array<{
    entryId: string;
    workerId: string;
    workerName: string;
    deductions: number;
    grossWages: number;
    deductionPct: number;
  }>;
  hasViolations: boolean;
  certProperPayment: boolean;
  certAccuratePayroll: boolean;
}

interface SubmitReadyIssue {
  id: string;
  category: string;
  severity: 'blocker' | 'warning' | 'pass';
  title: string;
  detail: string;
  actionId?: string;
}

interface SubmitReadyResult {
  weekId: string;
  projectId: string;
  score: number;
  status: 'not_ready' | 'needs_review' | 'ready' | 'submitted';
  headline: string;
  blockers: number;
  warnings: number;
  passes: number;
  issues: SubmitReadyIssue[];
  summary: {
    entryCount: number;
    totalHours: number;
    grossWages: number;
    complianceIssueCount: number;
    exportFormat: string;
  };
}

type ExportPreflightFormat = 'wh347' | 'a1131' | 'ecpr-xml';
type PendingExportAction = 'wh347' | 'a1131' | 'ecpr-xml' | null;

interface ExportPreflightIssue {
  id: string;
  category: string;
  severity: 'blocker' | 'warning' | 'pass';
  title: string;
  detail: string;
  workerId?: string;
  entryId?: string;
  fix?: {
    label: string;
    href: string;
  };
}

interface ExportPreflightResult {
  weekId: string;
  projectId: string;
  format: ExportPreflightFormat;
  status: 'blocked' | 'needs_review' | 'ready';
  blockers: number;
  warnings: number;
  passes: number;
  generatedAt: string;
  issues: ExportPreflightIssue[];
  summary: {
    entryCount: number;
    totalHours: number;
    exportLabel: string;
  };
}

// ── Payroll Import types (Phase 36 — mirrors src/server/services/importTypes.ts) ──

interface StateExportReadiness {
  state: string;
  label: string;
  status?: string;
  statusLabel?: string;
  launchDecision?: string;
  nextGate?: string;
  ready: boolean;
  supportedExports: string[];
  requiredFields: Array<{ key: string; label: string; present: boolean }>;
  missingFields: Array<{ key: string; label: string }>;
}

interface ImportReconciliationIssue {
  id: string;
  severity: 'blocker' | 'warning' | 'pass';
  title: string;
  detail: string;
  nextAction: string;
}

interface ImportReconciliationResult {
  weekId: string;
  projectId: string;
  status: 'blocked' | 'needs_review' | 'not_started' | 'reconciled';
  latestImport: {
    id: string;
    provider: string;
    sourceFilename: string | null;
    committedCount: number;
    unmatchedCount: number;
    createdAt: string;
  } | null;
  summary: {
    entryCount: number;
    totalHours: number;
    grossWages: number;
    zeroRateCount: number;
    missingPayCount: number;
    providerMappingCount: number;
  };
  providerGuide?: {
    label: string;
    requiredColumns: string[];
    notes: string[];
  };
  issues: ImportReconciliationIssue[];
}

interface ImportedRow {
  csvName: string;
  workerId: string;
  workerName: string;
  classificationId: string;
  classificationName: string;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  monSt: number;
  tueSt: number;
  wedSt: number;
  thuSt: number;
  friSt: number;
  satSt: number;
  sunSt: number;
  monOt: number;
  tueOt: number;
  wedOt: number;
  thuOt: number;
  friOt: number;
  satOt: number;
  sunOt: number;
}

interface UnmatchedRow {
  csvName: string;
  hours: {
    monSt: number; tueSt: number; wedSt: number; thuSt: number;
    friSt: number; satSt: number; sunSt: number;
    monOt: number; tueOt: number; wedOt: number; thuOt: number;
    friOt: number; satOt: number; sunOt: number;
  };
}

interface ConflictRow {
  csvName: string;
  workerId: string;
  workerName: string;
  reason: string;
}

interface ImportPreviewResult {
  provider: 'quickbooks' | 'adp' | 'gusto' | 'paychex' | 'sage_300' | 'sage_100';
  weekId: string;
  matched: ImportedRow[];
  unmatched: UnmatchedRow[];
  conflicts: ConflictRow[];
  adpWeeklyTotalsOnly?: boolean;
  gustoWeeklyTotalsOnly?: boolean;
  idMappingRequired?: boolean;
  unmappedIds?: string[];
}

interface ImportWorkerClassification {
  id: string;
  workerId: string;
  projectId: string;
  tradeCode: string;
  tradeDescription: string;
  laborType: string;
  baseRate?: number;
  fringeRate?: number;
}

interface ImportWorker {
  id: string;
  name: string;
  classifications: ImportWorkerClassification[];
}

interface ProjectData {
  id: string;
  state: string;
  name: string;
  county?: string | null;
  cslbLicense: string | null;
  wcPolicyNumber: string | null;
  // Phase 25 — WA fields
  ubiNumber: string | null;
  lniCertificate: string | null;
  wcAccount: string | null;
  // Phase 29 — CA eCPR XML fields
  contractorFein?: string | null;
  dirProjectId?: string | null;
  awardingAgency?: string | null;
  contractNumber?: string | null;
  // Phase 30 — WA PWIA
  pwiaIntentId?: string | null;
  // Phase 41 — NY MPWR
  nyprcNumber?: string | null;
  nysContractorRegNumber?: string | null;
}

interface PayrollWeekDetailResponse {
  week: PayrollWeek;
  entries: PayrollEntryRow[];
}

function violationLabel(type: ComplianceViolation['violationType']): string {
  if (type === 'under-wage') return 'Under-Wage';
  if (type === 'weekly-ot') return 'Weekly OT Review';
  if (type === 'multi-classification-ot') return 'Multi-Classification OT';
  if (type === 'ca-daily-ot') return 'CA Daily OT';
  if (type === 'ca-daily-dt') return 'CA Daily DT';
  return 'CWHSSA OT Error';
}

function getViolationFix(v: ComplianceViolation): string {
  if (v.violationType === 'under-wage') {
    return 'Raise the worker pay rate or fringe credit for this classification, then recalculate gross and net pay.';
  }
  if (v.violationType === 'cwhssa-ot' || v.violationType === 'weekly-ot') {
    return 'Move weekly hours over 40 into OT and pay the extra half-time premium on the basic hourly rate; fringe stays credited at straight time for every hour.';
  }
  if (v.violationType === 'multi-classification-ot') {
    return 'Review the worker\'s full workweek across classifications and apply either a documented rate-in-effect method or weighted-average overtime calculation.';
  }
  if (v.violationType === 'ca-daily-ot') {
    return 'Move daily hours over 8 into CA overtime or adjust the pay calculation to include the daily OT premium.';
  }
  return 'Move daily hours over 12 into CA double time or adjust the pay calculation to include the double-time premium.';
}

function getWeekViolationFix(wv: WeekViolation): string {
  if (wv.violationType === 'apprentice-trade-ratio') {
    return 'Reduce apprentice hours for this trade, add journeyworker coverage, or document the approved program ratio before submitting.';
  }
  if (wv.violationType === 'ira-iija-apprentice-pct') {
    return 'Add qualifying apprentice hours or document a good-faith exception before certifying this payroll.';
  }
  if (wv.violationType === 'apprentice-registration') {
    return 'Add the registered apprenticeship program name for the apprentice classification or pay the worker at the full journeyworker rate.';
  }
  return 'Adjust apprentice and journeyworker hours to match the applicable program ratio before submission.';
}

function getDeductionFix(): string {
  return 'Review non-tax deductions for authorization and supporting records before certifying the payroll.';
}

export function PayrollWeekDetailPage() {
  const { projectId, weekId } = useParams<{ projectId: string; weekId: string }>();
  const navigate = useNavigate();

  const [generating, setGenerating] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [exportPreflight, setExportPreflight] = useState<ExportPreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [pendingExportAction, setPendingExportAction] = useState<PendingExportAction>(null);
  const generatingRef = useRef(false);
  const amendingRef = useRef(false);
  const hiddenAnchorRef = useRef<HTMLAnchorElement>(null);
  const entriesSectionRef = useRef<HTMLDivElement>(null);
  const complianceSectionRef = useRef<HTMLDivElement>(null);
  const submitReadySectionRef = useRef<HTMLDivElement>(null);
  const importReconciliationSectionRef = useRef<HTMLDivElement>(null);
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [activeFixIssue, setActiveFixIssue] = useState<SubmitReadyIssue | null>(null);

  // isDirty: true when local changes (classification overrides, or any unsaved state) exist
  // and the user is offline — drives the 30-second auto-save indicator
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);

  // CA-specific state
  const [showCaDisclosure, setShowCaDisclosure] = useState(false);
  const caGeneratingRef = useRef(false);

  // CA eCPR XML export modal
  const [showEcprModal, setShowEcprModal] = useState(false);
  const [ecprStep, setEcprStep] = useState<1 | 2>(1); // Step 1: configure, Step 2: checklist
  const [ecprGenerating, setEcprGenerating] = useState(false);
  const ecprGeneratingRef = useRef(false);

  // Pre-fill from project record
  const [ecprFein, setEcprFein] = useState('');
  const [ecprDirProjectId, setEcprDirProjectId] = useState('');
  const [ecprAwardingAgency, setEcprAwardingAgency] = useState('');
  const [ecprContractNumber, setEcprContractNumber] = useState('');
  const [ecprCheckNum, setEcprCheckNum] = useState('DIRECT DEPOSIT');

  // WA-specific state — mirrors CA pattern; separate from caGeneratingRef
  const [showWaDisclosure, setShowWaDisclosure] = useState(false);
  const waGeneratingRef = useRef(false);  // MUST be new ref — do not reuse generatingRef or caGeneratingRef

  // WA CPR XML download state (separate from F700 PDF flow)
  const [showWaCprGate, setShowWaCprGate] = useState(false);
  const [waCprGateWorkers, setWaCprGateWorkers] = useState<Array<{ name: string; workerId: string }>>([]);
  const [showWaCprModal, setShowWaCprModal] = useState(false);
  const [waCprIntentId, setWaCprIntentId] = useState('');
  const [waCprGenerating, setWaCprGenerating] = useState(false);
  const waCprGeneratingRef = useRef(false);
  const [waCprStep, setWaCprStep] = useState<1 | 2>(1);

  // NY MPWR submission modal state (Phase 41)
  const [showNyMpwrModal, setShowNyMpwrModal] = useState(false);
  const [nyMpwrStep, setNyMpwrStep] = useState<1 | 2 | 3>(1);
  const [nyPrcNumber, setNyPrcNumber] = useState('');
  const [nysContractorRegNumber, setNysContractorRegNumber] = useState('');
  const [nyMpwrSubmitting, setNyMpwrSubmitting] = useState(false);

  // IL IDOL submission modal state (Phase 43)
  const [showIlIdolModal, setShowIlIdolModal] = useState(false);
  const [ilIdolStep, setIlIdolStep] = useState<1 | 2>(1);
  const [ilIdolSubmitting, setIlIdolSubmitting] = useState(false);

  // ── Payroll Import modal state (Phase 36 — mirrors ecprStep/showEcprModal pattern per D-02) ──
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<1 | '2b' | 2 | 3>(1);
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessBanner, setImportSuccessBanner] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitDate, setSubmitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitAgency, setSubmitAgency] = useState('');

  const submitMutation = useMutation({
    mutationFn: () =>
      api.patch(`/payroll/weeks/${weekId}/submit`, {
        submittedAt: submitDate,
        submittedTo: submitAgency,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
      queryClient.invalidateQueries({ queryKey: ['payroll-weeks', projectId] });
      setShowSubmitForm(false);
    },
  });

  const unsubmitMutation = useMutation({
    mutationFn: () => api.delete(`/payroll/weeks/${weekId}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
      queryClient.invalidateQueries({ queryKey: ['payroll-weeks', projectId] });
    },
  });

  const caSubmitMutation = useMutation({
    mutationFn: () => api.patch(`/payroll/weeks/${weekId}/ca-submit`, { submitted: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] }); },
  });

  const caUnsubmitMutation = useMutation({
    mutationFn: () => api.patch(`/payroll/weeks/${weekId}/ca-submit`, { submitted: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] }); },
  });

  const waSubmitMutation = useMutation({
    mutationFn: () => api.patch(`/payroll/weeks/${weekId}/wa-submit`, { submitted: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] }); },
  });

  const waUnsubmitMutation = useMutation({
    mutationFn: () => api.patch(`/payroll/weeks/${weekId}/wa-submit`, { submitted: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] }); },
  });

  // ── Classification override mutations (Phase 39 — WORKER-04) ──────────────

  const overrideMutation = useMutation({
    mutationFn: async ({ payrollWeekId, workerId, classificationId }: {
      payrollWeekId: string;
      workerId: string;
      classificationId: string;
    }) => {
      const res = await fetch(`/api/projects/${projectId}/payroll-week-classifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payrollWeekId, workerId, classificationId }),
      });
      if (!res.ok) throw new Error('Failed to set classification override');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
    },
  });

  const removeOverrideMutation = useMutation({
    mutationFn: async (overrideId: string) => {
      const res = await fetch(`/api/projects/${projectId}/payroll-week-classifications/${overrideId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove classification override');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
    },
  });

  // ── Phase 108 (DBE-08): Subcontractor query + entry attribution ─────────────

  const { data: subsData } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: () => api.get<{ data: { subcontractors: Array<{ id: string; name: string; dbeClassification: string }> } }>(`/projects/${projectId}/subcontractors`),
    enabled: !!projectId,
  });
  const subs = subsData?.data?.subcontractors ?? [];
  const subById = Object.fromEntries(subs.map(s => [s.id, s]));

  type DbeClassVal = 'dbe' | 'mbe' | 'wbe' | 'sdvosb';
  const DBE_BADGE: Record<DbeClassVal, string> = {
    dbe:    'bg-brand-gold text-black',
    mbe:    'bg-emerald-600 text-white',
    wbe:    'bg-blue-600 text-white',
    sdvosb: 'bg-purple-600 text-white',
  };

  const subAttributionMutation = useMutation({
    mutationFn: async ({ entryRow, subcontractorId }: {
      entryRow: PayrollEntryRow;
      subcontractorId: string | null;
    }) => {
      const e = entryRow.entry;
      return api.put(`/payroll/entries/${e.id}`, {
        payrollWeekId: e.payrollWeekId,
        workerId: e.workerId,
        classificationId: e.classificationId,
        monSt: e.monSt, tueSt: e.tueSt, wedSt: e.wedSt, thuSt: e.thuSt,
        friSt: e.friSt, satSt: e.satSt, sunSt: e.sunSt,
        monOt: e.monOt, tueOt: e.tueOt, wedOt: e.wedOt, thuOt: e.thuOt,
        friOt: e.friOt, satOt: e.satOt, sunOt: e.sunOt,
        baseRateSnapshot: e.baseRateSnapshot,
        fringeRateSnapshot: e.fringeRateSnapshot,
        grossWages: e.grossWages,
        deductions: e.deductions,
        netPay: e.netPay,
        subcontractorId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
    },
  });

  const importCommitMutation = useMutation({
    mutationFn: async () => {
      if (!importPreview) throw new Error('No preview data');

      // Build resolved rows: checked matched rows + remapped unmatched rows promoted to ImportedRow (D-11)
      const resolvedRows: ImportedRow[] = [];

      // Add checked matched rows
      importPreview.matched.forEach((row, i) => {
        if (importCheckedRows[i]) {
          resolvedRows.push(row);
        }
      });

      // Promote remapped unmatched rows to ImportedRow (D-11, D-15)
      importPreview.unmatched.forEach((u, i) => {
        const selectedWorkerId = importRemaps[i];
        if (!selectedWorkerId) return; // not remapped — skip
        const worker = projectWorkers.find((w) => w.id === selectedWorkerId);
        if (!worker || worker.classifications.length === 0) return; // no classifications — cannot commit (D-15)
        const cls = worker.classifications[0]; // first active classification per D-15
        resolvedRows.push({
          csvName: u.csvName,
          workerId: worker.id,
          workerName: worker.name,
          classificationId: cls.id,
          classificationName: cls.tradeDescription,
          baseRateSnapshot: cls.baseRate ?? 0,
          fringeRateSnapshot: cls.fringeRate ?? 0,
          monSt: u.hours.monSt,
          tueSt: u.hours.tueSt,
          wedSt: u.hours.wedSt,
          thuSt: u.hours.thuSt,
          friSt: u.hours.friSt,
          satSt: u.hours.satSt,
          sunSt: u.hours.sunSt,
          monOt: u.hours.monOt,
          tueOt: u.hours.tueOt,
          wedOt: u.hours.wedOt,
          thuOt: u.hours.thuOt,
          friOt: u.hours.friOt,
          satOt: u.hours.satOt,
          sunOt: u.hours.sunOt,
        });
      });

      // Count skipped unmatched (for audit)
      const unmatchedSkipped = importPreview.unmatched.length -
        importPreview.unmatched.filter((_, i) => {
          const wid = importRemaps[i];
          if (!wid) return false;
          const w = projectWorkers.find((pw) => pw.id === wid);
          return w && w.classifications.length > 0;
        }).length;

      return api.post<{ committed: number }>('/payroll/import/commit', {
        weekId: importPreview.weekId,
        provider: importPreview.provider,
        matched: resolvedRows,
        unmatchedCount: unmatchedSkipped,
        sourceFilename: importFile?.name,
      });
    },
    onSuccess: (data) => {
      const provider = PROVIDER_LABELS[importPreview?.provider ?? ''] ?? importPreview?.provider ?? 'Unknown';
      const count = (data as { committed: number }).committed;
      queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
      queryClient.invalidateQueries({ queryKey: ['payroll-weeks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['import-reconciliation', weekId] });
      queryClient.invalidateQueries({ queryKey: ['submit-ready', weekId] });
      closeImportModal();
      setImportSuccessBanner(`Imported ${count} entries from ${provider}.`);
    },
    onError: (error: Error) => {
      // Parse specific error codes from the error message
      if (error.message.includes('already have entries') || error.message.includes('conflict')) {
        setImportCommitError('Import conflict detected. Delete existing entries for the conflicting workers and try again.');
      } else if (error.message.includes('submitted') || error.message.includes('423')) {
        setImportCommitError('This payroll week was submitted during your session and can no longer be modified.');
      } else {
        setImportCommitError(error.message || 'Import failed. Please try again.');
      }
    },
  });

  const {
    data: weekData,
    isLoading: weekLoading,
    isError: weekError,
  } = useQuery({
    queryKey: ['payroll-week', weekId],
    queryFn: () => api.get<PayrollWeekDetailResponse>('/payroll/weeks/' + weekId),
    enabled: !!weekId,
  });

  const {
    data: complianceData,
    isLoading: complianceLoading,
    isError: complianceError,
  } = useQuery({
    queryKey: ['compliance', weekId],
    queryFn: () => api.get<ComplianceResult>('/compliance/' + weekId),
    enabled: !!weekId,
  });

  const {
    data: submitReadyData,
    isLoading: submitReadyLoading,
    isError: submitReadyError,
  } = useQuery({
    queryKey: ['submit-ready', weekId],
    queryFn: () => api.get<SubmitReadyResult>('/compliance/' + weekId + '/submit-ready'),
    enabled: !!weekId,
  });

  const { data: importReconciliationData } = useQuery({
    queryKey: ['import-reconciliation', weekId],
    queryFn: () => api.get<{ data: ImportReconciliationResult }>('/payroll/import/reconciliation/' + weekId),
    enabled: !!weekId,
  });

  const { data: stateReadinessData } = useQuery({
    queryKey: ['state-export-readiness', weekId],
    queryFn: () => api.get<{ data: StateExportReadiness }>('/export/state-readiness/' + weekId),
    enabled: !!weekId,
  });

  const { data: projectData } = useQuery({
    queryKey: ['project', weekData?.week.projectId],
    queryFn: () =>
      api.get<{ data: { project: ProjectData } }>(`/projects/${weekData!.week.projectId}`),
    enabled: !!weekData?.week.projectId,
  });
  const isCA = projectData?.data?.project?.state?.toUpperCase() === 'CA';
  const isWA = projectData?.data?.project?.state?.toUpperCase() === 'WA';
  const isNY = projectData?.data?.project?.state?.toUpperCase() === 'NY';
  const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL';
  const isTX = projectData?.data?.project?.state?.toUpperCase() === 'TX';
  const isFL = projectData?.data?.project?.state?.toUpperCase() === 'FL';
  const isMA = projectData?.data?.project?.state?.toUpperCase() === 'MA';

  // STATE_FORMS registry — governs download buttons only (STATE-12, NFR-06)
  // Submission tracking rows remain as individual {isCA && ...} blocks
  const STATE_FORMS: Record<string, {
    downloadLabel: string;
    route: string;
    buttonVariant?: string;
  }> = {
    CA: { downloadLabel: 'Download CA A-1-131', route: 'a1131' },
    WA: { downloadLabel: 'Download WA F700-065-000', route: 'f700' },
    NY: { downloadLabel: 'Download NY PW-12', route: 'pw12' },
    IL: { downloadLabel: 'Download IL Certified Transcript', route: 'il-pdf' },
    TX: { downloadLabel: 'Download WH-347 (TX)', route: 'wh347' },
    FL: { downloadLabel: 'Download WH-347 (FL)', route: 'wh347' },
    MA: { downloadLabel: 'Download MA DLS Payroll', route: 'ma-cpr' },
    NJ: { downloadLabel: 'Download NJ MW-562', route: 'nj-mw562' },
    MN: { downloadLabel: 'Download MN DLI Payroll', route: 'mn-dli' },
    VA: { downloadLabel: 'Download VA DOLI Payroll', route: 'va-doli' },
  };
  const stateFormConfig = STATE_FORMS[projectData?.data?.project?.state?.toUpperCase() ?? ''] ?? null;

  // Workers query — needed for import unmatched worker remap dropdown (Phase 36)
  const { data: workersData } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: () =>
      api.get<{ data: { workers: ImportWorker[] } }>(`/projects/${projectId}/workers`),
    enabled: !!projectId,
  });
  const projectWorkers = workersData?.data?.workers ?? [];

  // QB Online connection status — used to conditionally show "Import from QuickBooks" button
  const { data: qboStatusData } = useQuery({
    queryKey: ['qbo-status'],
    queryFn: () => api.get<{ data: { connected: boolean } }>('/integrations/qbo/status'),
    staleTime: 5 * 60 * 1000, // 5 minutes — token status doesn't change often
  });
  const qboConnected = qboStatusData?.data?.connected === true;
  const [showQboImportModal, setShowQboImportModal] = useState(false);
  const [qboActivities, setQboActivities] = useState<Array<{
    qboId: string;
    employeeRef: string;
    employeeId: string | null;
    date: string;
    hours: number;
    description: string | null;
    customerRef: string | null;
    needsDailySplit: boolean;
  }> | null>(null);
  const [qboImportFetching, setQboImportFetching] = useState(false);
  const [qboImportError, setQboImportError] = useState<string | null>(null);
  const [qboImportNote, setQboImportNote] = useState<string | null>(null);

  // ── QB native sync state (Fix 1) ─────────────────────────────────────────
  interface QboSyncEntry {
    date: string;
    hours: number;
    dayKey: string;
  }
  interface QboSyncMatchedWorker {
    workerId: string;
    workerName: string;
    qboEmployeeRef: string;
    entries: QboSyncEntry[];
  }
  interface QboSyncResult {
    weekId: string;
    startDate: string;
    endDate: string;
    matched: QboSyncMatchedWorker[];
    unmatched: Array<{ employeeRef: string; totalHours: number }>;
  }
  const [showQboSyncModal, setShowQboSyncModal] = useState(false);
  const [qboSyncFetching, setQboSyncFetching] = useState(false);
  const [qboSyncError, setQboSyncError] = useState<string | null>(null);
  const [qboSyncResult, setQboSyncResult] = useState<QboSyncResult | null>(null);
  const [qboSyncChecked, setQboSyncChecked] = useState<Record<number, boolean>>({});
  const [qboSyncPushing, setQboSyncPushing] = useState(false);
  const [qboSyncSuccess, setQboSyncSuccess] = useState<string | null>(null);

  async function handleQboSync() {
    if (!projectId || !weekId) return;
    setQboSyncFetching(true);
    setQboSyncError(null);
    setQboSyncResult(null);
    try {
      const resp = await fetch(
        `/api/integrations/qbo/sync-time?weekId=${weekId}&projectId=${projectId}`,
        { method: 'POST', credentials: 'include' },
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Request failed: ${resp.status}`);
      }
      const body = await resp.json() as { data: QboSyncResult };
      setQboSyncResult(body.data);
      // Pre-check all matched workers
      const initial: Record<number, boolean> = {};
      body.data.matched.forEach((_, i) => { initial[i] = true; });
      setQboSyncChecked(initial);
      setShowQboSyncModal(true);
    } catch (err) {
      setQboSyncError(err instanceof Error ? err.message : 'Failed to sync from QuickBooks.');
    } finally {
      setQboSyncFetching(false);
    }
  }

  async function handleQboSyncPush() {
    if (!qboSyncResult || !projectId || !weekId) return;
    setQboSyncPushing(true);
    setQboSyncError(null);
    try {
      // Collect selected matched workers; look up classificationId from projectWorkers
      const entries: Array<{ workerId: string; classificationId: string; date: string; hours: number }> = [];
      qboSyncResult.matched.forEach((match, i) => {
        if (!qboSyncChecked[i]) return;
        const worker = projectWorkers.find((w) => w.id === match.workerId);
        const cls = worker?.classifications?.[0];
        if (!cls) return;
        match.entries.forEach((e) => {
          entries.push({ workerId: match.workerId, classificationId: cls.id, date: e.date, hours: e.hours });
        });
      });
      if (entries.length === 0) {
        setQboSyncError('No entries selected to push.');
        setQboSyncPushing(false);
        return;
      }
      const resp = await fetch('/api/integrations/qbo/push-approved-hours', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, projectId, entries }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Push failed: ${resp.status}`);
      }
      const body = await resp.json() as { data: { committed: number } };
      setShowQboSyncModal(false);
      setQboSyncResult(null);
      setQboSyncSuccess(`Synced ${body.data.committed} payroll entr${body.data.committed === 1 ? 'y' : 'ies'} from QuickBooks.`);
      queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
    } catch (err) {
      setQboSyncError(err instanceof Error ? err.message : 'Failed to push hours.');
    } finally {
      setQboSyncPushing(false);
    }
  }

  // ── Phase 76: Fill from Field Clock state ─────────────────────────────────
  const [showFillModal, setShowFillModal] = useState(false);
  const [fillFetching, setFillFetching] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);

  interface FillSuggestedEntry {
    date: string;
    dayKey: 'monSt' | 'tueSt' | 'wedSt' | 'thuSt' | 'friSt' | 'satSt' | 'sunSt';
    regularHours: number;
  }

  interface FillWorkerSuggestion {
    workerId: string;
    workerName: string;
    entries: FillSuggestedEntry[];
    totalHours: number;
    punchPairs: number;
  }

  interface FillResult {
    weekId: string;
    weekStart: string;
    weekEnd: string;
    suggestions: FillWorkerSuggestion[];
    workerCount: number;
    totalPunchPairs: number;
  }

  const [fillResult, setFillResult] = useState<FillResult | null>(null);

  async function handleFillFromPunches() {
    if (!projectId || !weekId) return;
    setFillFetching(true);
    setFillError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/weeks/${weekId}/fill-from-punches`,
        { method: 'POST', credentials: 'include' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Request failed: ${res.status}`);
      }
      const body = await res.json() as { data: FillResult };
      setFillResult(body.data);
      setShowFillModal(true);
    } catch (err) {
      setFillError(err instanceof Error ? err.message : 'Failed to load punch data.');
    } finally {
      setFillFetching(false);
    }
  }


  // Step 2b state: ID mapping for providers that use numeric worker IDs (Phase 45)
  const [idMappings, setIdMappings] = useState<Record<string, string>>({});
  const [idMappingsSaving, setIdMappingsSaving] = useState(false);
  const [idMappingsError, setIdMappingsError] = useState<string | null>(null);

  // Step 2 state: row selection + unmatched worker remapping
  const [importCheckedRows, setImportCheckedRows] = useState<Record<number, boolean>>({});
  const [importRemaps, setImportRemaps] = useState<Record<number, string>>({});
  const [importCommitError, setImportCommitError] = useState<string | null>(null);

  function closeImportModal() {
    setShowImportModal(false);
    setImportStep(1);
    setImportPreview(null);
    setImportFile(null);
    setImportParsing(false);
    setImportError(null);
    setImportCheckedRows({});
    setImportRemaps({});
    setImportCommitError(null);
    setIdMappings({});
    setIdMappingsSaving(false);
    setIdMappingsError(null);
  }

  async function handleImportPreview(file: File) {
    setImportParsing(true);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('weekId', weekId!);
      // CRITICAL: Use raw fetch, NOT api.post — api.post does JSON.stringify + sets Content-Type: application/json
      // Do NOT set Content-Type manually — browser must set multipart boundary
      const res = await fetch('/api/payroll/import/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 423) {
          setImportError('This payroll week has been submitted and cannot be modified.');
        } else if (res.status === 400) {
          setImportError((body as { error?: string }).error || 'Could not detect payroll provider. Upload a QuickBooks Time by Employee Detail or ADP payroll export.');
        } else {
          setImportError('Upload failed. Check your connection and try again.');
        }
        setImportParsing(false);
        return;
      }
      const result = (await res.json()) as ImportPreviewResult;
      setImportPreview(result);
      if (result.idMappingRequired) {
        setImportStep('2b');
      } else {
        setImportStep(2);
      }
    } catch {
      setImportError('Upload failed. Check your connection and try again.');
    } finally {
      setImportParsing(false);
    }
  }

  useEffect(() => {
    if (importSuccessBanner) {
      const timer = setTimeout(() => setImportSuccessBanner(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [importSuccessBanner]);

  // Initialize all matched rows as checked when preview loads
  useEffect(() => {
    if (importPreview) {
      const checked: Record<number, boolean> = {};
      importPreview.matched.forEach((_, i) => { checked[i] = true; });
      setImportCheckedRows(checked);
      setImportRemaps({});
    }
  }, [importPreview]);

  function sumSt(h: { monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number }): number {
    return h.monSt + h.tueSt + h.wedSt + h.thuSt + h.friSt + h.satSt + h.sunSt;
  }
  function sumOt(h: { monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number }): number {
    return h.monOt + h.tueOt + h.wedOt + h.thuOt + h.friOt + h.satOt + h.sunOt;
  }

  // Pre-fill eCPR modal fields from project record when data loads
  useEffect(() => {
    if (projectData?.data?.project) {
      const p = projectData.data.project;
      if (p.contractorFein) setEcprFein(p.contractorFein);
      if (p.dirProjectId) setEcprDirProjectId(p.dirProjectId);
      if (p.awardingAgency) setEcprAwardingAgency(p.awardingAgency);
      if (p.contractNumber) setEcprContractNumber(p.contractNumber);
    }
  }, [projectData]);

  // Pre-fill PWIA Intent ID from project record
  useEffect(() => {
    if (projectData?.data?.project?.pwiaIntentId) {
      setWaCprIntentId(projectData.data.project.pwiaIntentId);
    }
  }, [projectData?.data?.project?.pwiaIntentId]);

  // Pre-fill NY PRC Number and Contractor Reg Number from project record (Phase 41)
  useEffect(() => {
    if (projectData?.data?.project) {
      setNyPrcNumber(projectData.data.project.nyprcNumber || '');
      setNysContractorRegNumber(projectData.data.project.nysContractorRegNumber || '');
    }
  }, [projectData?.data?.project]);

  // Mark dirty whenever weekData entries load while offline — ensures the snapshot is preserved
  useEffect(() => {
    if (weekData && weekData.entries.length > 0 && !navigator.onLine) {
      setIsDirty(true);
    }
  }, [weekData]);

  // ── 30-second offline draft auto-save (MOB-01 / MOB-04) ──────────────────
  // Only fires when navigator.onLine === false and isDirty to avoid spamming the server.
  // Uses If-Unmodified-Since to prevent stale overwrites.
  useEffect(() => {
    if (!weekId || !weekData) return;

    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        // Back online — reset dirty flag and auto-saving indicator
        if (autoSaving) setAutoSaving(false);
        return;
      }
      if (!isDirty) return; // nothing to save

      const week = weekData.week;
      const entries = weekData.entries;

      setAutoSaving(true);

      // Build a minimal snapshot of the current payroll state
      const snapshot = {
        weekId: week.id,
        payrollNumber: week.payrollNumber,
        isFinal: week.isFinal,
        entries: entries.map((row) => ({
          id: row.entry.id,
          workerId: row.entry.workerId,
          monSt: row.entry.monSt, tueSt: row.entry.tueSt,
          wedSt: row.entry.wedSt, thuSt: row.entry.thuSt,
          friSt: row.entry.friSt, satSt: row.entry.satSt,
          sunSt: row.entry.sunSt, monOt: row.entry.monOt,
          tueOt: row.entry.tueOt, wedOt: row.entry.wedOt,
          thuOt: row.entry.thuOt, friOt: row.entry.friOt,
          satOt: row.entry.satOt, sunOt: row.entry.sunOt,
          baseRateSnapshot: row.entry.baseRateSnapshot,
          fringeRateSnapshot: row.entry.fringeRateSnapshot,
          grossWages: row.entry.grossWages,
          deductions: row.entry.deductions,
          netPay: row.entry.netPay,
        })),
      };

      enqueueRequest(
        `/api/payroll/weeks/${weekId}/draft`,
        'PUT',
        snapshot,
        {
          'Content-Type': 'application/json',
          // Prevent stale overwrites — server should reject if week was modified after this timestamp
          'If-Unmodified-Since': new Date(week.createdAt).toUTCString(),
        },
      ).then(() => {
        setIsDirty(false);
        setTimeout(() => setAutoSaving(false), 1500);
      }).catch((err) => {
        console.warn('[PayrollWeekDetailPage] auto-save enqueue failed', err);
        setAutoSaving(false);
      });
    }, 30_000);

    return () => clearInterval(intervalId);
  }, [weekId, weekData, isDirty, autoSaving]);

  const isLoading = weekLoading || complianceLoading || submitReadyLoading;
  const isError = weekError || complianceError || submitReadyError;

  const week = weekData?.week;
  const entries = weekData?.entries ?? [];
  const readinessChecks = [
    {
      label: 'Payroll entries',
      complete: entries.length > 0,
      detail: entries.length > 0 ? `${entries.length} worker entr${entries.length === 1 ? 'y' : 'ies'} recorded` : 'Add worker hours for this week.',
    },
    {
      label: 'Gross and net pay',
      complete: entries.length > 0 && entries.every((row) => row.entry.grossWages !== null && row.entry.netPay !== null),
      detail: 'Required for a usable certified payroll report.',
    },
    {
      label: 'Compliance clean',
      complete: !complianceData?.hasViolations && (complianceData?.deductionViolations?.length ?? 0) === 0,
      detail: complianceData?.hasViolations ? 'Resolve listed wage, overtime, or ratio issues.' : 'No blocking violations detected.',
    },
    {
      label: 'CPR submission',
      complete: Boolean(week?.submittedAt),
      detail: week?.submittedAt ? `Submitted to ${week.submittedTo ?? 'agency'}` : 'Record submission after the agency/GC receives it.',
    },
    {
      label: 'State export',
      complete: !stateFormConfig || entries.length > 0,
      detail: stateFormConfig ? `${stateFormConfig.downloadLabel} available after entries are complete.` : 'WH-347 export is available for this contract.',
    },
  ];
  const readinessCompleteCount = readinessChecks.filter((check) => check.complete).length;
  const hasPayrollEntries = entries.length > 0;
  const payRowsComplete = entries.length > 0 && entries.every((row) => row.entry.grossWages !== null && row.entry.netPay !== null);
  const hasBlockingCompliance = Boolean(complianceData?.hasViolations) || (complianceData?.deductionViolations?.length ?? 0) > 0;
  const hasSubmitReadyBlockers = (submitReadyData?.blockers ?? 0) > 0;
  const canGenerateCertifiedPayroll = hasPayrollEntries && payRowsComplete && !hasBlockingCompliance && !hasSubmitReadyBlockers;
  const canMarkSubmitted = canGenerateCertifiedPayroll && Boolean(week && !week.submittedAt);
  const requiredFormRows = [
    {
      label: 'Federal WH-347',
      description: 'Certified payroll record for Davis-Bacon covered work.',
      available: canGenerateCertifiedPayroll,
      submitted: Boolean(week?.submittedAt),
      nextAction: week?.submittedAt
        ? `Submitted to ${week.submittedTo ?? 'agency'}`
        : canGenerateCertifiedPayroll
        ? 'Download WH-347, submit to the contracting officer, then mark submitted.'
        : 'Complete payroll entries and clear blocking issues.',
    },
    stateFormConfig
      ? {
          label: stateFormConfig.downloadLabel.replace(/^Download\s+/, ''),
          description: `Required state export for ${projectData?.data?.project?.state?.toUpperCase()} public work when applicable.`,
          available: canGenerateCertifiedPayroll,
          submitted: Boolean(week?.submittedAt),
          nextAction: week?.submittedAt
            ? 'Keep the export with the submitted weekly record.'
            : canGenerateCertifiedPayroll
            ? `${stateFormConfig.downloadLabel}, submit through the state or agency portal, then record submission.`
            : 'Finish readiness before generating the state form.',
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    description: string;
    available: boolean;
    submitted: boolean;
    nextAction: string;
  }>;

  // Build a set of entry IDs that have violations for quick lookup
  const violationsByEntryId = new Map<string, ComplianceViolation>();
  if (complianceData?.violations) {
    for (const v of complianceData.violations) {
      violationsByEntryId.set(v.entryId, v);
    }
  }

  function scrollToElement(target: HTMLElement | null | undefined) {
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
  }

  function scrollToPayrollEntry(entryId: string) {
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    const targetId = isMobile ? `payroll-entry-mobile-${entryId}` : `payroll-entry-row-${entryId}`;
    const target = document.getElementById(targetId) ?? document.getElementById(`payroll-entry-row-${entryId}`);
    setHighlightedEntryId(entryId);
    scrollToElement(target);
    window.setTimeout(() => setHighlightedEntryId(null), 3500);
  }

  function scrollToSubmitReadyIssue(issue: SubmitReadyIssue) {
    setActiveFixIssue(issue);
    if (issue.id === 'pay-calculation') {
      const row = entries.find(({ entry }) => entry.grossWages == null || entry.netPay == null);
      if (row) {
        scrollToPayrollEntry(row.entry.id);
        window.setTimeout(() => setActiveFixIssue(null), 10_000);
        return;
      }
    }

    if (issue.id === 'rate-snapshots') {
      const row = entries.find(({ entry }) => entry.baseRateSnapshot === 0 && entry.fringeRateSnapshot === 0);
      if (row) {
        scrollToPayrollEntry(row.entry.id);
        window.setTimeout(() => setActiveFixIssue(null), 10_000);
        return;
      }
    }

    if (issue.actionId === 'review-week-violations' || issue.id === 'compliance-review') {
      const violationEntryId =
        complianceData?.violations?.[0]?.entryId ??
        complianceData?.deductionViolations?.[0]?.entryId;
      if (violationEntryId) {
        scrollToPayrollEntry(violationEntryId);
        window.setTimeout(() => setActiveFixIssue(null), 10_000);
        return;
      }
      scrollToElement(complianceSectionRef.current);
      window.setTimeout(() => setActiveFixIssue(null), 10_000);
      return;
    }

    if (issue.actionId === 'prepare-import-review' || issue.id === 'payroll-entries') {
      scrollToElement(entries.length > 0 ? entriesSectionRef.current : importReconciliationSectionRef.current ?? entriesSectionRef.current);
      window.setTimeout(() => setActiveFixIssue(null), 10_000);
      return;
    }

    if (issue.actionId === 'prepare-missing-wd') {
      navigate(`/projects/${projectId}#wage-determinations`);
      return;
    }

    scrollToElement(complianceSectionRef.current ?? entriesSectionRef.current ?? submitReadySectionRef.current);
    window.setTimeout(() => setActiveFixIssue(null), 10_000);
  }

  function scrollToFirstIssue(severity: 'blocker' | 'warning') {
    const issue = submitReadyData?.issues.find((candidate) => candidate.severity === severity);
    if (issue) scrollToSubmitReadyIssue(issue);
  }

  function buildPreflightParams(format: ExportPreflightFormat) {
    const params = new URLSearchParams();
    if (format === 'ecpr-xml') {
      params.set('contractorFein', ecprFein.replace(/-/g, ''));
      params.set('dirProjectId', ecprDirProjectId);
      params.set('awardingAgency', ecprAwardingAgency);
      params.set('contractNumber', ecprContractNumber);
    }
    return params.toString();
  }

  async function openExportPreflight(format: ExportPreflightFormat, action: PendingExportAction) {
    setPendingExportAction(action);
    setExportPreflight(null);
    setPreflightError(null);
    setPreflightLoading(true);
    setShowPreflight(true);
    try {
      const query = buildPreflightParams(format);
      const res = await fetch(`/api/export/preflight/${format}/${weekId}${query ? `?${query}` : ''}`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || `Preflight failed: ${res.status}`);
      setExportPreflight((data as { data: ExportPreflightResult }).data);
    } catch (err) {
      setPreflightError(err instanceof Error ? err.message : 'Export preflight failed');
    } finally {
      setPreflightLoading(false);
    }
  }

  function handlePreflightFix(issue: ExportPreflightIssue) {
    setShowPreflight(false);
    setPendingExportAction(null);

    if (issue.fix?.href) {
      navigate(issue.fix.href);
      return;
    }

    if (issue.entryId) {
      scrollToPayrollEntry(issue.entryId);
      return;
    }

    if (issue.category === 'project') {
      navigate(`/projects/${projectId}/settings`);
      return;
    }

    if (issue.category === 'worker') {
      navigate(`/projects/${projectId}/workers`);
      return;
    }

    if (issue.category === 'payroll' || issue.category === 'fringe') {
      navigate(`/projects/${projectId}/payroll/${weekId}/edit`);
      return;
    }

    scrollToElement(complianceSectionRef.current ?? submitReadySectionRef.current ?? entriesSectionRef.current);
  }

  function handleDownloadClick() {
    void openExportPreflight('wh347', 'wh347');
  }

  async function handleConfirmedDownload() {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setShowPreflight(false);
    try {
      const res = await fetch(`/api/export/wh347/${weekId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      hiddenAnchorRef.current!.href = url;
      hiddenAnchorRef.current!.download = `wh347-${weekId}.pdf`;
      hiddenAnchorRef.current!.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  // CA A-1-131 download handlers
  function handleCaDownloadClick() {
    void openExportPreflight('a1131', 'a1131');
  }

  function handleContinueAfterPreflight() {
    const action = pendingExportAction;
    setShowPreflight(false);
    setPendingExportAction(null);
    if (action === 'wh347') {
      void handleConfirmedDownload();
    } else if (action === 'a1131') {
      setShowCaDisclosure(true);
    } else if (action === 'ecpr-xml') {
      void handleEcprXmlDownload();
    }
  }

  async function handleCaConfirmedDownload() {
    if (caGeneratingRef.current) return;
    caGeneratingRef.current = true;
    setShowCaDisclosure(false);
    try {
      const res = await fetch(`/api/export/a1131/${weekId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      hiddenAnchorRef.current!.href = url;
      hiddenAnchorRef.current!.download = `a1131-${weekData?.week.payrollNumber || weekId}.pdf`;
      hiddenAnchorRef.current!.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error('CA A-1-131 download failed:', err);
    } finally {
      caGeneratingRef.current = false;
    }
  }

  // WA F700-065-000 download handlers
  // PWIA disclosure is ALWAYS shown — not conditional on violations (critical rule)
  function handleWaDownloadClick() {
    setShowWaDisclosure(true);  // always show — no compliance condition check
  }

  async function handleWaConfirmedDownload() {
    if (waGeneratingRef.current) return;
    waGeneratingRef.current = true;
    setShowWaDisclosure(false);
    try {
      const res = await fetch(`/api/export/f700/${weekId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      hiddenAnchorRef.current!.href = url;
      hiddenAnchorRef.current!.download = `f700-${weekData?.week.payrollNumber || weekId}.pdf`;
      hiddenAnchorRef.current!.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error('WA F700-065-000 download failed:', err);
    } finally {
      waGeneratingRef.current = false;
    }
  }

  // WA CPR XML download handlers (separate from F700 PDF flow)
  function handleWaCprDownloadClick() {
    setShowWaCprModal(true);
  }

  async function handleWaCprConfirm() {
    if (waCprGeneratingRef.current) return;
    waCprGeneratingRef.current = true;
    setWaCprGenerating(true);

    try {
      // Validate intentId is numeric
      const intentNum = parseInt(waCprIntentId, 10);
      if (!waCprIntentId || !Number.isInteger(intentNum) || intentNum <= 0) {
        alert('Please enter a valid numeric PWIA Intent ID.');
        return;
      }

      // Persist intentId to project via PATCH
      await fetch(`/api/projects/${projectData?.data?.project?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pwiaIntentId: waCprIntentId }),
      });

      // Fetch XML
      const res = await fetch(`/api/export/wa-cpr-xml/${weekId}`, {
        credentials: 'include',
      });

      if (res.status === 422) {
        // Trade code gate — show gate screen
        const data = await res.json();
        setWaCprGateWorkers(data.workers || []);
        setShowWaCprModal(false);
        setShowWaCprGate(true);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to generate WA CPR XML');
        return;
      }

      // Blob download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="(.+?)"/);
      a.href = url;
      a.download = filenameMatch?.[1] || `wa-cpr-${waCprIntentId}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);

      setWaCprStep(2);
    } catch (err) {
      alert('Error generating WA CPR XML. Please try again.');
    } finally {
      waCprGeneratingRef.current = false;
      setWaCprGenerating(false);
    }
  }

  // NY MPWR modal close handler — resets step to 1 (prevents stale state per Research Pitfall 5)
  function closeNyModal() {
    setShowNyMpwrModal(false);
    setNyMpwrStep(1);
  }

  // IL IDOL modal close handler — resets step to 1 on close
  function closeIlModal() {
    setShowIlIdolModal(false);
    setIlIdolStep(1);
  }

  // STATE_FORMS registry-driven download handler (STATE-12, NFR-06)
  async function handleStateFormDownload(route: string, wkId: string) {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    try {
      const res = await fetch(`/api/export/${route}/${wkId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      hiddenAnchorRef.current!.href = url;
      hiddenAnchorRef.current!.download = `${route}-${wkId}.pdf`;
      hiddenAnchorRef.current!.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error('State form download failed:', err);
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  // IL IDOL PDF download handler — fetch + blob + anchor click pattern (mirrors handleNyDownload)
  async function handleIlDownloadPdf() {
    try {
      const res = await fetch(`/api/export/il-pdf/${weekId}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error || `Download failed: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `il-certified-transcript-${weekId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    } catch (err) {
      console.error('IL PDF download error:', err);
      alert('Download failed. Please try again.');
    }
  }

  // IL IDOL mark as submitted handler — PATCH /api/payroll/weeks/:id/il-submit
  async function handleIlMarkSubmitted() {
    if (ilIdolSubmitting) return;
    setIlIdolSubmitting(true);
    try {
      const res = await fetch(`/api/payroll/weeks/${weekId}/il-submit`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error || 'Failed to mark as submitted');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
      closeIlModal();
    } catch (err) {
      console.error('IL IDOL submit error:', err);
      alert('Failed to mark as submitted. Please try again.');
    } finally {
      setIlIdolSubmitting(false);
    }
  }

  // NY MPWR Step 1: persist PRC + Reg numbers to project, then advance
  async function handleNyStep1Save() {
    try {
      await fetch(`/api/projects/${projectData?.data?.project?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nyprcNumber: nyPrcNumber, nysContractorRegNumber }),
      });
      setNyMpwrStep(2);
    } catch (err) {
      console.error('Failed to persist NY registration numbers:', err);
      // Still advance — non-blocking
      setNyMpwrStep(2);
    }
  }

  // NY MPWR download helper — fetch + blob + anchor click pattern
  async function handleNyDownload(url: string, filename: string) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error || `Download failed: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="(.+?)"/);
      a.href = objectUrl;
      a.download = filenameMatch?.[1] || filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    } catch (err) {
      console.error('NY download failed:', err);
      alert('Download failed. Please try again.');
    }
  }

  // NY MPWR Step 3: mark as submitted
  async function handleNyMarkSubmitted() {
    if (nyMpwrSubmitting) return;
    setNyMpwrSubmitting(true);
    try {
      const res = await fetch(`/api/payroll/weeks/${weekId}/ny-submit`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error || 'Failed to mark as submitted');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
      closeNyModal();
    } catch (err) {
      console.error('NY submit failed:', err);
      alert('Failed to mark as submitted. Please try again.');
    } finally {
      setNyMpwrSubmitting(false);
    }
  }

  // CA eCPR XML download handler
  async function handleEcprXmlDownload() {
    if (ecprGeneratingRef.current) return;
    ecprGeneratingRef.current = true;
    setEcprGenerating(true);

    try {
      // Persist fields to project record
      await api.patch(`/projects/${projectData?.data?.project?.id}`, {
        contractorFein: ecprFein.replace(/-/g, ''),
        dirProjectId: ecprDirProjectId,
        awardingAgency: ecprAwardingAgency,
        contractNumber: ecprContractNumber,
      });

      // Build query params
      const params = new URLSearchParams({
        checkNum: ecprCheckNum,
        contractorFein: ecprFein.replace(/-/g, ''),
        dirProjectId: ecprDirProjectId,
        awardingAgency: ecprAwardingAgency,
        contractNumber: ecprContractNumber,
      });

      const response = await fetch(`/api/export/ecpr-xml/${weekId}?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json();
        alert(err.error || 'Failed to generate eCPR XML');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="(.+?)"/);
      a.href = url;
      a.download = filenameMatch?.[1] || 'ecpr-export.xml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);

      // Transition to Step 2 (checklist)
      setEcprStep(2);
    } catch (err) {
      alert('Failed to generate eCPR XML. Please try again.');
    } finally {
      ecprGeneratingRef.current = false;
      setEcprGenerating(false);
    }
  }

  const handleAmendClick = async () => {
    if (amendingRef.current) return;
    amendingRef.current = true;
    try {
      const res = await fetch('/api/payroll/weeks/amend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ originalWeekId: weekId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to create amendment');
        return;
      }
      const result = await res.json();
      navigate(`/projects/${projectId}/payroll/${result.weekId}`);
    } finally {
      amendingRef.current = false;
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto pb-24">
        {/* Hidden anchor for Blob download — must be outside modal so it persists when modal unmounts */}
        <a ref={hiddenAnchorRef} className="hidden" />

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => navigate(`/projects/${projectId}/payroll`)}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              &larr; Back to Payroll
            </button>
            {week && (
              <PageHeader
                title={`Payroll Week #${week.payrollNumber}`}
                subtitle={`Week Ending ${week.weekEndingDate}`}
                action={week.amendmentNumber != null ? <Badge variant="warning">Amendment {week.amendmentNumber}</Badge> : undefined}
                className="mb-0"
              />
            )}
          </div>
          {/* Offline auto-save indicator */}
          {autoSaving && !navigator.onLine && (
            <span className="text-xs text-amber-600 font-medium shrink-0">Auto-saving...</span>
          )}
        </div>
        <section className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {submitReadyData && (
          <div ref={submitReadySectionRef} tabIndex={-1} className="xl:row-span-2">
            <Card padding="default" className="h-full border border-border-default">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">Submit-ready score</h2>
                  <Badge
                    variant={
                      submitReadyData.status === 'ready' || submitReadyData.status === 'submitted'
                        ? 'compliant'
                        : submitReadyData.status === 'needs_review'
                        ? 'warning'
                        : 'violation'
                    }
                  >
                    {submitReadyData.score}/100
                  </Badge>
                  <Badge variant="neutral">{submitReadyData.summary.exportFormat}</Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{submitReadyData.headline}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[220px]">
                <button
                  type="button"
                  onClick={() => scrollToFirstIssue('blocker')}
                  className="rounded-sm px-2 py-1 text-center transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  aria-label="Go to first blocker"
                >
                  <p className="text-lg font-semibold text-status-violation">{submitReadyData.blockers}</p>
                  <p className="text-xs text-text-secondary">Blockers</p>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToFirstIssue('warning')}
                  className="rounded-sm px-2 py-1 text-center transition-colors hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  aria-label="Go to first warning"
                >
                  <p className="text-lg font-semibold text-status-warning">{submitReadyData.warnings}</p>
                  <p className="text-xs text-text-secondary">Warnings</p>
                </button>
                <div>
                  <p className="text-lg font-semibold text-status-compliant">{submitReadyData.passes}</p>
                  <p className="text-xs text-text-secondary">Passed</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {submitReadyData.issues
                .filter((issue) => issue.severity !== 'pass')
                .slice(0, 4)
                .map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => scrollToSubmitReadyIssue(issue)}
                    className="flex w-full items-start justify-between gap-3 rounded-sm border border-border-default px-3 py-2 text-left transition-colors hover:border-brand-gold hover:bg-brand-gold/5 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{issue.title}</p>
                      <p className="text-xs text-text-secondary">{issue.detail}</p>
                      <p className="mt-1 text-xs font-medium text-brand-gold">Click to go to the fix.</p>
                    </div>
                    <Badge variant={issue.severity === 'blocker' ? 'violation' : 'warning'}>
                      {issue.severity}
                    </Badge>
                  </button>
                ))}
              {submitReadyData.issues.every((issue) => issue.severity === 'pass') && (
                <p className="text-sm text-status-compliant">All pre-submission checks are passing.</p>
              )}
            </div>
            </Card>
          </div>
        )}
        {importReconciliationData?.data && (
          <div ref={importReconciliationSectionRef} tabIndex={-1}>
            <Card padding="default" className="h-full border border-border-default">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">Import reconciliation</h2>
                  <Badge
                    variant={
                      importReconciliationData.data.status === 'reconciled'
                        ? 'compliant'
                        : importReconciliationData.data.status === 'blocked'
                        ? 'violation'
                        : 'warning'
                    }
                  >
                    {importReconciliationData.data.status.replace('_', ' ')}
                  </Badge>
                  {importReconciliationData.data.latestImport && (
                    <Badge variant="neutral">
                      {PROVIDER_LABELS[importReconciliationData.data.latestImport.provider] ?? importReconciliationData.data.latestImport.provider}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {importReconciliationData.data.latestImport
                    ? `${importReconciliationData.data.latestImport.committedCount} rows committed, ${importReconciliationData.data.latestImport.unmatchedCount} unmatched.`
                    : 'No committed provider import has been recorded for this week.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[260px]">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{importReconciliationData.data.summary.entryCount}</p>
                  <p className="text-xs text-text-secondary">Entries</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-status-violation">{importReconciliationData.data.summary.zeroRateCount}</p>
                  <p className="text-xs text-text-secondary">Zero Rates</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-status-warning">{importReconciliationData.data.summary.missingPayCount}</p>
                  <p className="text-xs text-text-secondary">Pay Gaps</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 lg:grid-cols-2 xl:grid-cols-1">
              {importReconciliationData.data.issues.slice(0, 3).map((issue) => (
                <div key={issue.id} className="rounded-sm border border-border-default px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{issue.title}</p>
                      <p className="text-xs text-text-secondary">{issue.detail}</p>
                      <p className="mt-1 text-xs font-medium text-gray-700">{issue.nextAction}</p>
                    </div>
                    <Badge variant={issue.severity === 'pass' ? 'compliant' : issue.severity === 'blocker' ? 'violation' : 'warning'}>
                      {issue.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {importReconciliationData.data.providerGuide && (
              <div className="mt-4 rounded-sm border border-brand-gold/30 bg-brand-gold/5 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {importReconciliationData.data.providerGuide.label} import checklist
                </p>
                <p className="mt-1 text-xs text-gray-700">
                  Required columns: {importReconciliationData.data.providerGuide.requiredColumns.join(', ')}.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  {importReconciliationData.data.providerGuide.notes.map((note) => (
                    <li key={note}>- {note}</li>
                  ))}
                </ul>
              </div>
            )}
            </Card>
          </div>
        )}
        {stateReadinessData?.data && (
          <Card padding="default" className="border border-border-default">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">State export readiness</h2>
                  <Badge variant={stateReadinessData.data.ready ? 'compliant' : 'warning'}>
                    {stateReadinessData.data.state}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {stateReadinessData.data.label}: {stateReadinessData.data.supportedExports.join(', ')}.
                </p>
                {stateReadinessData.data.statusLabel && (
                  <p className="mt-1 text-xs text-gray-500">
                    {stateReadinessData.data.statusLabel}. {stateReadinessData.data.nextGate}
                  </p>
                )}
              </div>
              {!stateReadinessData.data.ready && (
                <Link
                  to={`/projects/${projectId}/settings`}
                  className="inline-flex items-center justify-center rounded-sm border border-border-default px-3 py-2 text-xs font-semibold text-gray-800 hover:border-brand-gold hover:bg-brand-gold/5"
                >
                  Complete Fields
                </Link>
              )}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {stateReadinessData.data.requiredFields.map((field) => (
                <div key={field.key} className="flex items-center justify-between rounded-sm border border-border-default px-3 py-2 text-sm">
                  <span className="text-gray-700">{field.label}</span>
                  <Badge variant={field.present ? 'compliant' : 'warning'}>
                    {field.present ? 'Ready' : 'Missing'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
        </section>
        {/* MOB-13: sticky download bar with iOS safe-area padding */}
        <div
          className="sticky bottom-0 z-10 bg-white border-t border-brand-navy/10 px-4 sm:px-6 pt-3 -mx-4 sm:-mx-6 mt-8"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.75rem)' }}
        >
          {/* MOB-13: "Fill from Field Clock" — full-width on mobile, inline on sm+ */}
          {weekId && !week?.submittedAt && (
            <div className="mb-2 sm:hidden">
              <Button
                variant="secondary"
                disabled={fillFetching}
                onClick={handleFillFromPunches}
                className="w-full min-h-[44px]"
              >
                {fillFetching ? 'Loading...' : 'Fill from Field Clock'}
              </Button>
            </div>
          )}
          <div className="flex gap-2 flex-wrap items-center">
            {weekId && week && !week.isFinal && !week.submittedAt && (
              <Link
                to={`/projects/${projectId}/payroll/${weekId}/edit`}
                className="inline-flex items-center justify-center text-xs px-3 py-2.5 min-h-[44px] font-semibold rounded-sm bg-brand-gold text-nav-dark hover:bg-brand-gold/90 transition-colors"
              >
                Edit hours
              </Link>
            )}
            {weekId && (
              <span className="inline-flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={generating || !canGenerateCertifiedPayroll}
                  onClick={handleDownloadClick}
                >
                  {generating ? 'Generating...' : 'Download WH-347'}
                </Button>
                <Tooltip content={canGenerateCertifiedPayroll
                  ? 'Federal Certified Payroll Report required for Davis-Bacon Act projects. The January 2025 revision is the only version accepted by the Department of Labor.'
                  : 'Complete payroll entries and clear blocking compliance issues before generating WH-347.'} />
              </span>
            )}
            {/* STATE_FORMS registry-driven primary download button (STATE-12, NFR-06) */}
            {stateFormConfig && weekId && (
              <Button
                variant="secondary"
                size="sm"
                disabled={generating || !canGenerateCertifiedPayroll}
                onClick={() =>
                  stateFormConfig.route === 'a1131'
                    ? handleCaDownloadClick()
                    : handleStateFormDownload(stateFormConfig.route, weekId)
                }
              >
                {stateFormConfig.downloadLabel}
              </Button>
            )}
            {isCA && weekId && (
              <span className="inline-flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setEcprStep(1); setShowEcprModal(true); }}
                >
                  Download CA eCPR XML
                </Button>
                <Tooltip content="California's electronic certified payroll submission format required for public works projects. Export as XML and upload to DIR's eCPR portal at efiling.dir.ca.gov/eCPR." />
              </span>
            )}
            {isWA && weekId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleWaCprDownloadClick}
              >
                Download WA CPR XML
              </Button>
            )}
            {isNY && weekId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setNyMpwrStep(1); setShowNyMpwrModal(true); }}
              >
                NY MPWR Submission
              </Button>
            )}
            {isIL && weekId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setIlIdolStep(1); setShowIlIdolModal(true); }}
              >
                IL IDOL Submission
              </Button>
            )}
            {weekId && (
              <Button
                variant="secondary"
                size="sm"
                disabled={!!week?.submittedAt}
                title={week?.submittedAt ? 'This payroll week has been submitted and cannot be modified.' : undefined}
                onClick={() => { setImportStep(1); setShowImportModal(true); }}
              >
                Import from Payroll Provider
              </Button>
            )}
            {/* Hidden on mobile — shown full-width above this row instead */}
            {weekId && !week?.submittedAt && (
              <span className="hidden sm:contents">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={fillFetching}
                  onClick={handleFillFromPunches}
                >
                  {fillFetching ? 'Loading...' : 'Fill from Field Clock'}
                </Button>
              </span>
            )}
            {weekId && qboConnected && !week?.submittedAt && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowQboImportModal(true)}
              >
                Import from QuickBooks
              </Button>
            )}
            {weekId && qboConnected && !week?.submittedAt && (
              <Button
                variant="secondary"
                size="sm"
                disabled={qboSyncFetching}
                onClick={handleQboSync}
              >
                {qboSyncFetching ? 'Syncing...' : 'Sync from QB'}
              </Button>
            )}
          </div>
        </div>

        <HelpCallout
          icon={FileCheck}
          title="Review Before You Submit"
          body={<>Verify all hours and rates are correct. Once you download the <TermTooltip term="WH-347" definition={WH347_DEF} />, it becomes your certified payroll record. Violations shown here must be corrected or documented.</>}
        />

        {importSuccessBanner && (
          <div className="mb-4 rounded-sm border border-status-compliant/30 bg-status-compliant/10 px-4 py-2 text-sm text-status-compliant">
            {importSuccessBanner}
          </div>
        )}

        {qboSyncSuccess && (
          <div className="mb-4 rounded-sm border border-status-compliant/30 bg-status-compliant/10 px-4 py-2 text-sm text-status-compliant">
            {qboSyncSuccess}
          </div>
        )}

        {qboSyncError && !showQboSyncModal && (
          <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {qboSyncError}
          </div>
        )}

        {fillError && (
          <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {fillError}
          </div>
        )}

        {/* Loading state */}
        {isLoading && <PayrollWeekDetailSkeleton />}

        {/* Error state */}
        {isError && !isLoading && (
          <p className="text-sm text-red-600">Failed to load payroll week details.</p>
        )}

        {/* Lock notice — shown when week is submitted */}
        {!isLoading && !isError && week?.submittedAt && (
          <Card padding="sm" className="mb-6 flex items-center gap-3 border-amber-200 bg-amber-50">
            <Badge variant="warning">Read-Only</Badge>
            <span className="text-sm text-gray-700">
              This payroll week is submitted and cannot be edited. Un-submit to make changes.
            </span>
          </Card>
        )}

        {activeFixIssue && (
          <div className="mb-4 rounded-lg border border-brand-gold bg-brand-gold/10 px-4 py-3 text-sm text-nav-dark">
            <p className="font-semibold">Fix target: {activeFixIssue.title}</p>
            <p className="mt-1 text-xs text-gray-700">{activeFixIssue.detail}</p>
            {activeFixIssue.actionLabel && (
              <p className="mt-1 text-xs font-medium text-gray-900">Action: {activeFixIssue.actionLabel}</p>
            )}
          </div>
        )}

        {/* lg: two-column layout — entries (left) + compliance/submission sidebar (right) */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
        <div className="lg:col-span-2">

        {/* Entries — MOB-13: card view on mobile, table on sm+ */}
        <div ref={entriesSectionRef} tabIndex={-1}>
        {!isLoading && !isError && entries.length > 0 && (
          <Card padding="none" className="mb-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Payroll Entries</h2>
            </div>

            {/* Mobile card list (< sm) */}
            <div className="sm:hidden divide-y divide-gray-100">
              {entries.map((row, index) => {
                const e = row.entry;
                const totalSt = e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
                const totalOt = e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
                const violation = violationsByEntryId.get(e.id);
                return (
                  <div
                    key={e.id}
                    id={`payroll-entry-mobile-${e.id}`}
                    tabIndex={-1}
                    className={cn(
                      'px-4 py-4 min-h-[56px] scroll-mt-24 outline-none transition-colors',
                      highlightedEntryId === e.id ? 'ring-2 ring-brand-gold bg-brand-gold/10' : index % 2 === 0 ? 'bg-white' : 'bg-surface-muted',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{row.workerName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{row.tradeDescription}</p>
                      </div>
                      <div className="shrink-0">
                        {violation ? (
                          <Badge variant="violation">{violationLabel(violation.violationType)}</Badge>
                        ) : (
                          <Badge variant="compliant">OK</Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">Hours</p>
                        <p>{totalSt} ST / {totalOt} OT</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">Base / Fringe</p>
                        <RateProvenance
                          baseRate={e.baseRateSnapshot}
                          fringeRate={e.fringeRateSnapshot}
                          sourceLabel="project wage source"
                          classificationLabel={row.tradeDescription}
                          override={Boolean(row.overrideClassificationId)}
                          compact
                        />
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">Net Pay</p>
                        <p className="font-semibold text-gray-900">{e.netPay !== null ? `$${e.netPay.toFixed(2)}` : '—'}</p>
                      </div>
                    </div>
                    {violation && violation.violationType === 'cwhssa-ot' && (
                      <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                        CWHSSA OT: expected ${violation.expected.toFixed(2)}, paid ${violation.actual.toFixed(2)} (delta ${violation.delta.toFixed(2)})
                      </div>
                    )}
                    {violation && violation.violationType === 'under-wage' && (
                      <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                        Under-Wage: expected ${violation.expected.toFixed(2)}, paid ${violation.actual.toFixed(2)} (delta ${violation.delta.toFixed(2)})
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-700 flex justify-between">
                <span>Total Net Pay</span>
                <span>${entries.reduce((s, r) => s + (r.entry.netPay ?? 0), 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Desktop table (sm+) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-5 py-3">Worker Name</th>
                    <th className="px-5 py-3">Trade</th>
                    <th className="px-5 py-3">Override</th>
                    <th className="px-5 py-3">Hours (ST/OT)</th>
                    <th className="px-5 py-3">Base Rate</th>
                    <th className="px-5 py-3">Fringe Rate</th>
                    <th className="px-5 py-3">Gross Wages</th>
                    <th className="px-5 py-3">Deductions</th>
                    <th className="px-5 py-3">Net Pay</th>
                    {subs.length > 0 && <th className="px-5 py-3">Subcontractor</th>}
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((row, index) => {
                    const e = row.entry;
                    const totalSt =
                      e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
                    const totalOt =
                      e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
                    const violation = violationsByEntryId.get(e.id);

                    return (
                      <React.Fragment key={e.id}>
                      <tr
                        id={`payroll-entry-row-${e.id}`}
                        tabIndex={-1}
                        className={cn(
                          'scroll-mt-24 outline-none transition-colors hover:bg-gray-50',
                          highlightedEntryId === e.id ? 'ring-2 ring-brand-gold bg-brand-gold/10' : index % 2 === 0 ? 'bg-white' : 'bg-surface-muted',
                        )}
                      >
                        <td className="px-5 py-3 font-medium text-gray-900">
                          <span className="inline-flex items-center gap-1.5">
                            {row.workerName}
                            {(() => {
                              const sub = e.subcontractorId ? subById[e.subcontractorId] : null;
                              if (!sub || sub.dbeClassification === 'none') return null;
                              const cls = DBE_BADGE[sub.dbeClassification as DbeClassVal];
                              if (!cls) return null;
                              return (
                                <span className={`px-1.5 py-0.5 text-xs font-semibold rounded uppercase ${cls}`}>
                                  {sub.dbeClassification.toUpperCase()}
                                </span>
                              );
                            })()}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {row.tradeDescription}
                          {row.overrideClassificationId && (
                            <Badge variant="warning" className="ml-2">Override</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {(() => {
                            const worker = projectWorkers.find((w) => w.id === e.workerId);
                            const classifications = worker?.classifications ?? [];
                            if (classifications.length <= 1) return <span className="text-xs text-gray-400">—</span>;
                            return (
                              <select
                                value={row.overrideClassificationId ?? ''}
                                onChange={ev => {
                                  const val = ev.target.value;
                                  setIsDirty(true);
                                  if (val) {
                                    overrideMutation.mutate({
                                      payrollWeekId: e.payrollWeekId,
                                      workerId: e.workerId,
                                      classificationId: val,
                                    });
                                  } else if (row.overrideId) {
                                    removeOverrideMutation.mutate(row.overrideId);
                                  }
                                }}
                                className="text-base border border-gray-200 rounded px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                                disabled={!!week?.submittedAt}
                              >
                                <option value="">Default</option>
                                {classifications.map((c: ImportWorkerClassification) => (
                                  <option key={c.id} value={c.id}>
                                    {c.tradeDescription} ({c.laborType})
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {totalSt} ST / {totalOt} OT
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          <RateProvenance
                            baseRate={e.baseRateSnapshot}
                            sourceLabel="project wage source"
                            classificationLabel={row.tradeDescription}
                            override={Boolean(row.overrideClassificationId)}
                            compact
                          />
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          <RateProvenance
                            baseRate={e.fringeRateSnapshot}
                            sourceLabel="classification fringe snapshot"
                            rateLabel="fringe"
                            missingIsProblem={false}
                            compact
                          />
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {e.grossWages !== null ? `$${e.grossWages.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {e.deductions !== null ? `$${e.deductions.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {e.netPay !== null ? `$${e.netPay.toFixed(2)}` : '—'}
                        </td>
                        {subs.length > 0 && (
                          <td className="px-5 py-3">
                            <select
                              value={e.subcontractorId ?? ''}
                              onChange={ev => {
                                subAttributionMutation.mutate({
                                  entryRow: row,
                                  subcontractorId: ev.target.value || null,
                                });
                              }}
                              className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                              disabled={!!week?.submittedAt}
                            >
                              <option value="">— GC Direct —</option>
                              {subs.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="px-5 py-3">
                          {violation ? (
                            <Badge variant="violation">{violationLabel(violation.violationType)}</Badge>
                          ) : (
                            <Badge variant="compliant">OK</Badge>
                          )}
                        </td>
                      </tr>
                      {violation && violation.violationType === 'cwhssa-ot' && (
                        <tr className={index % 2 === 0 ? 'bg-white' : 'bg-surface-muted'}>
                          <td colSpan={subs.length > 0 ? 11 : 10} className="px-5 pb-3 pt-0">
                            <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                              CWHSSA OT violation: expected ${violation.expected.toFixed(2)}, paid ${violation.actual.toFixed(2)} (delta ${violation.delta.toFixed(2)})
                            </div>
                          </td>
                        </tr>
                      )}
                      {violation && violation.violationType === 'under-wage' && (
                        <tr className={index % 2 === 0 ? 'bg-white' : 'bg-surface-muted'}>
                          <td colSpan={subs.length > 0 ? 11 : 10} className="px-5 pb-3 pt-0">
                            <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                              Under-Wage violation: expected ${violation.expected.toFixed(2)}, paid ${violation.actual.toFixed(2)} (delta ${violation.delta.toFixed(2)})
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 text-sm font-semibold text-gray-700">
                    <td colSpan={6} className="px-5 py-3">Totals</td>
                    <td className="px-5 py-3">
                      ${entries.reduce((s, r) => s + (r.entry.grossWages ?? 0), 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      ${entries.reduce((s, r) => s + (r.entry.deductions ?? 0), 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      ${entries.reduce((s, r) => s + (r.entry.netPay ?? 0), 0).toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>{/* end sm:block */}
          </Card>
        )}

        {/* Empty entries state */}
        {!isLoading && !isError && entries.length === 0 && (
          <Card padding="none" className="mb-6 py-12 text-center">
            <p className="text-sm text-gray-500">No payroll entries for this week.</p>
          </Card>
        )}
        </div>

        </div>{/* end lg:col-span-2 */}
        <div className="lg:col-span-1 space-y-6">

        {!isLoading && !isError && (
          <Card padding="none">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">Week Readiness</h2>
              <Badge variant={readinessCompleteCount === readinessChecks.length ? 'compliant' : 'warning'}>
                {readinessCompleteCount}/{readinessChecks.length}
              </Badge>
            </div>
            <div className="px-5 py-4 space-y-3">
              {readinessChecks.map((check) => (
                <div key={check.label} className="flex items-start gap-3">
                  <span className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-xs font-semibold ${
                    check.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {check.complete ? '\u2713' : '!'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{check.label}</p>
                    <p className="text-xs text-gray-500">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!isLoading && !isError && (
          <Card padding="none">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Required Forms</h2>
              <p className="mt-1 text-xs text-gray-500">The filing checklist for this payroll week.</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {requiredFormRows.map((form) => (
                <div key={form.label} className="rounded border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{form.label}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{form.description}</p>
                    </div>
                    <Badge variant={form.submitted ? 'compliant' : form.available ? 'warning' : 'neutral'}>
                      {form.submitted ? 'Filed' : form.available ? 'Ready' : 'Blocked'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">{form.nextAction}</p>
                </div>
              ))}
              <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                PrevWage prepares the certified payroll package and keeps the evidence trail. If your contract requires eComply, LCPtracker, DIR, L&I, or another portal, download the matching export here and upload it in that portal unless a live integration is configured.
              </div>
            </div>
          </Card>
        )}

        {/* Compliance violations panel */}
        {!isLoading && !isError && (
          <div ref={complianceSectionRef} tabIndex={-1}>
          <Card padding="none">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Compliance Check</h2>
            </div>
            {complianceData?.hasViolations ? (
              <div className="px-5 py-4">
                <p className="text-sm font-semibold text-red-700 mb-3">Compliance Violations</p>
                <ul className="space-y-2">
                  {complianceData.violations.map((v, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Badge variant="violation" className="mt-0.5 shrink-0">
                        {violationLabel(v.violationType)}
                      </Badge>
                      {v.violationType === 'cwhssa-ot' && (
                        <TermTooltip term="CWHSSA OT" definition={CWHSSA_OT_DEF} className="mt-0.5 shrink-0" />
                      )}
                      <span>
                        <span className="font-medium">{v.workerName}</span>
                        {': expected $'}{v.expected.toFixed(2)}{', paid $'}{v.actual.toFixed(2)}{' (delta $'}{v.delta.toFixed(2)}{')'}
                        <span className="block text-xs text-gray-500 mt-0.5">
                          Fix: {getViolationFix(v)}
                        </span>
                      </span>
                    </li>
                  ))}
                  {complianceData.weekViolations?.map((wv, i) => (
                    <li key={`week-${i}`} className="flex items-start gap-2 text-sm text-gray-700">
                      <Badge variant="violation" className="mt-0.5 shrink-0">
                        {wv.violationType === 'apprentice-trade-ratio' ? 'Trade Ratio' :
                         wv.violationType === 'ira-iija-apprentice-pct' ? 'IRA/IIJA' :
                         'Apprentice Ratio'}
                      </Badge>
                      {wv.violationType === 'apprentice-trade-ratio' && wv.trade ? (
                        <span>
                          <strong>{wv.trade}</strong>:{' '}
                          {wv.apprenticeHours.toFixed(1)} apprentice hrs,{' '}
                          {wv.journeyworkerHours.toFixed(1)} JW hrs
                          {' '}(max: {wv.maxAllowedApprenticeHours.toFixed(1)}).
                          {' '}Excess: {(wv.excessHours ?? 0).toFixed(1)} hrs.
                          {' '}Est. wage adjustment: ${(wv.estimatedLiabilityUsd ?? 0).toFixed(2)}
                          <span className="block text-xs text-gray-500 mt-0.5">
                            Fix: {getWeekViolationFix(wv)}
                          </span>
                        </span>
                      ) : (
                        <span>
                          {wv.detail}
                          <span className="block text-xs text-gray-500 mt-0.5">
                            Fix: {getWeekViolationFix(wv)}
                          </span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="px-5 py-4 flex items-center gap-2">
                <Badge variant="compliant">Compliant</Badge>
                <span className="text-sm text-gray-700">No violations for this payroll week.</span>
              </div>
            )}
            {/* 29 CFR Part 3 §3.5 — 30% deduction cap warning (COMP-08) */}
            {(complianceData?.deductionViolations?.length ?? 0) > 0 && (
              <div className="px-5 pb-4">
                <div className="rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    30% Deduction Cap Notice (29 CFR Part 3 §3.5)
                  </p>
                  <p className="text-xs text-amber-700 mb-2">
                    The following workers have total deductions exceeding 30% of gross wages.
                    Deductions above this threshold require written worker authorization and may be disallowed by the DOL.
                  </p>
                  <ul className="space-y-1">
                    {complianceData!.deductionViolations!.map((dv, i) => (
                      <li key={i} className="text-xs text-amber-800">
                        <span className="font-semibold">{dv.workerName}</span>
                        {': '}${dv.deductions.toFixed(2)} deducted from ${dv.grossWages.toFixed(2)} gross ({dv.deductionPct}%)
                        <span className="block text-amber-700">Fix: {getDeductionFix()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
          </div>
        )}

        {/* Submission status panel */}
        {!isLoading && !isError && week && (
          <Card padding="none" className="mt-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Submission Status</h2>
            </div>
            {week.submittedAt ? (
              <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="flex items-center gap-3">
                  <Badge variant="compliant">Submitted</Badge>
                  <span className="text-sm text-gray-700">
                    {week.submittedAt} — {week.submittedTo}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleAmendClick}
                  >
                    Amend This Week
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={unsubmitMutation.isPending}
                    onClick={() => unsubmitMutation.mutate()}
                  >
                    {unsubmitMutation.isPending ? 'Clearing...' : 'Un-submit'}
                  </Button>
                </div>
              </div>
            ) : showSubmitForm ? (
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-gray-600">Record the submission date and agency name.</p>
                <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Submission Date</label>
                    <input
                      type="date"
                      value={submitDate}
                      onChange={(e) => setSubmitDate(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1.5 text-base focus:border-brand-gold focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Agency / Recipient</label>
                    <input
                      type="text"
                      value={submitAgency}
                      onChange={(e) => setSubmitAgency(e.target.value)}
                      placeholder="e.g. DOL Wage and Hour Division, Region 9"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-brand-gold focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowSubmitForm(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!submitDate || !submitAgency.trim() || submitMutation.isPending || !canMarkSubmitted}
                    onClick={() => submitMutation.mutate()}
                  >
                    {submitMutation.isPending ? 'Saving...' : 'Mark as Submitted'}
                  </Button>
                </div>
                {!canGenerateCertifiedPayroll && (
                  <p className="text-xs text-amber-700">
                    Complete week readiness and clear blocking compliance issues before marking this CPR submitted.
                  </p>
                )}
                {submitMutation.isError && (
                  <p className="text-xs text-red-600">Failed to submit. Please try again.</p>
                )}
              </div>
            ) : (
              <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">Not Submitted</Badge>
                  <span className="text-sm text-gray-500 inline-flex items-baseline gap-1"><TermTooltip term="WH-347" definition={WH347_DEF} /> not yet submitted to agency.</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowSubmitForm(true)}>
                  Mark as Submitted
                </Button>
              </div>
            )}

            {/* Agency Submission Rows per D-10, D-11, D-12, D-13 */}
            {isCA && (
              <>
                <div className="border-t border-gray-100" />
                <div className="px-5 py-3 flex items-center justify-between">
                  {week.caEcprSubmittedAt ? (
                    <>
                      <div className="flex items-center gap-3">
                        <Badge variant="warning">CA DIR Submitted</Badge>
                        <span className="text-sm text-gray-600">
                          {week.caEcprSubmittedAt.slice(0, 10)}
                        </span>
                      </div>
                      <button
                        className="text-sm text-gray-500 underline hover:text-gray-700"
                        disabled={caUnsubmitMutation.isPending}
                        onClick={() => caUnsubmitMutation.mutate()}
                      >
                        {caUnsubmitMutation.isPending ? 'Clearing...' : 'Un-submit'}
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">Not Submitted to CA DIR</Badge>
                    </div>
                  )}
                </div>
              </>
            )}

            {isWA && (
              <>
                <div className="border-t border-gray-100" />
                <div className="px-5 py-3 flex items-center justify-between">
                  {week.waLniSubmittedAt ? (
                    <>
                      <div className="flex items-center gap-3">
                        <Badge variant="neutral">WA L&amp;I Submitted</Badge>
                        <span className="text-sm text-gray-600">
                          {week.waLniSubmittedAt.slice(0, 10)}
                        </span>
                      </div>
                      <button
                        className="text-sm text-gray-500 underline hover:text-gray-700"
                        disabled={waUnsubmitMutation.isPending}
                        onClick={() => waUnsubmitMutation.mutate()}
                      >
                        {waUnsubmitMutation.isPending ? 'Clearing...' : 'Un-submit'}
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">Not Submitted to WA L&amp;I</Badge>
                    </div>
                  )}
                </div>
              </>
            )}

            {isNY && (
              <>
                <div className="border-t border-gray-100" />
                <div className="px-5 py-3 flex items-center justify-between">
                  {week.nyMpwrSubmittedAt ? (
                    <div className="flex items-center gap-3">
                      <Badge variant="compliant">NY MPWR Submitted</Badge>
                      <span className="text-sm text-gray-600">
                        {week.nyMpwrSubmittedAt.slice(0, 10)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">Not Submitted to NY MPWR</Badge>
                    </div>
                  )}
                </div>
              </>
            )}
            {isIL && (
              <>
                <div className="border-t border-gray-100" />
                <div className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={week?.ilIdolSubmittedAt ? 'compliant' : 'neutral'}>
                      IL IDOL Submission
                    </Badge>
                    {week?.ilIdolSubmittedAt && (
                      <span className="text-sm text-gray-500">
                        Submitted {week.ilIdolSubmittedAt.slice(0, 10)}
                      </span>
                    )}
                  </div>
                  {!week?.ilIdolSubmittedAt && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setIlIdolStep(1); setShowIlIdolModal(true); }}
                    >
                      Submit to IL IDOL
                    </Button>
                  )}
                </div>
              </>
            )}
          </Card>
        )}

        </div>{/* end lg:col-span-1 sidebar */}
        </div>{/* end lg:grid */}

        {/* WAL-04 WA PWIA Submission Guide panel */}
        {!isLoading && !isError && isWA && (
          <Card className="mt-6">
            <div className="p-4">
              <h3 className="font-headline text-lg font-semibold mb-1 flex items-baseline gap-2">
                WA <TermTooltip term="PWIA Intent" definition={PWIA_INTENT_DEF} /> Submission Guide
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Data-entry reference for the{' '}
                <a
                  href="https://secure.lni.wa.gov/pwia/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-gold underline"
                >
                  L&amp;I PWIA portal
                </a>
                . This is not a submission mechanism — enter these values manually in the portal.
              </p>

              {/* Intent to Pay section */}
              <div className="mb-6">
                <h4 className="font-headline text-base font-semibold mb-2 border-b pb-1">
                  Intent to Pay Prevailing Wages
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                  <span className="text-gray-500">Contractor:</span>
                  <span>{projectData?.data?.project?.name || '—'}</span>
                  <span className="text-gray-500">UBI Number:</span>
                  <span>{projectData?.data?.project?.ubiNumber || '—'}</span>
                  <span className="text-gray-500">L&amp;I Certificate:</span>
                  <span>{projectData?.data?.project?.lniCertificate || '—'}</span>
                  <span className="text-gray-500">WC Account:</span>
                  <span>{projectData?.data?.project?.wcAccount || '—'}</span>
                  <span className="text-gray-500">County:</span>
                  <span>{projectData?.data?.project?.county || '—'}</span>
                </div>
                {/* Per-classification aggregation */}
                {(() => {
                  const classMap = new Map<
                    string,
                    {
                      label: string;
                      totalSt: number;
                      totalOt: number;
                      baseRate: number;
                      fringeRate: number;
                      workerIds: Set<string>;
                    }
                  >();
                  for (const row of entries) {
                    const key = row.tradeDescription || 'Unknown';
                    const e = row.entry;
                    const st =
                      e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
                    const ot =
                      e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
                    if (!classMap.has(key)) {
                      classMap.set(key, {
                        label: key,
                        totalSt: 0,
                        totalOt: 0,
                        baseRate: e.baseRateSnapshot,
                        fringeRate: e.fringeRateSnapshot,
                        workerIds: new Set(),
                      });
                    }
                    const entry = classMap.get(key)!;
                    entry.totalSt += st;
                    entry.totalOt += ot;
                    entry.workerIds.add(e.workerId);
                  }
                  const rows = Array.from(classMap.values());
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                            <th className="py-1 pr-3">Classification</th>
                            <th className="py-1 pr-3 text-right">ST Hours</th>
                            <th className="py-1 pr-3 text-right">OT Hours</th>
                            <th className="py-1 pr-3 text-right">Base Rate</th>
                            <th className="py-1 pr-3 text-right">Fringe Rate</th>
                            <th className="py-1 text-right">Workers</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rows.map((r) => (
                            <tr key={r.label}>
                              <td className="py-1.5 pr-3 text-gray-800">{r.label}</td>
                              <td className="py-1.5 pr-3 text-right text-gray-700">{r.totalSt}</td>
                              <td className="py-1.5 pr-3 text-right text-gray-700">{r.totalOt}</td>
                              <td className="py-1.5 pr-3 text-right text-gray-700">
                                ${r.baseRate.toFixed(2)}
                              </td>
                              <td className="py-1.5 pr-3 text-right text-gray-700">
                                ${r.fringeRate.toFixed(2)}
                              </td>
                              <td className="py-1.5 text-right text-gray-700">
                                {r.workerIds.size}
                              </td>
                            </tr>
                          ))}
                          {rows.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-3 text-center text-gray-400 text-xs">
                                No payroll entries for this week.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Affidavit of Wages Paid section */}
              <div>
                <h4 className="font-headline text-base font-semibold mb-2 border-b pb-1">
                  Affidavit of Wages Paid
                </h4>
                <p className="text-xs text-gray-400 mb-2">
                  Worker SSNs: Not stored — enter full SSN directly in portal. Shown as
                  ***-**-XXXX below.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="py-1 pr-3">Worker</th>
                        <th className="py-1 pr-2 text-right">Mon</th>
                        <th className="py-1 pr-2 text-right">Tue</th>
                        <th className="py-1 pr-2 text-right">Wed</th>
                        <th className="py-1 pr-2 text-right">Thu</th>
                        <th className="py-1 pr-2 text-right">Fri</th>
                        <th className="py-1 pr-2 text-right">Sat</th>
                        <th className="py-1 pr-2 text-right">Sun</th>
                        <th className="py-1 pr-2 text-right">Total ST</th>
                        <th className="py-1 pr-2 text-right">Total OT</th>
                        <th className="py-1 pr-2 text-right">Base Rate</th>
                        <th className="py-1 pr-2 text-right">Fringe</th>
                        <th className="py-1 text-right">Gross Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {entries.map((row) => {
                        const e = row.entry;
                        const totalSt =
                          e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
                        const totalOt =
                          e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
                        const fmt = (h: number) => (h === 0 ? '—' : String(h));
                        return (
                          <tr key={e.id}>
                            <td className="py-1.5 pr-3 text-gray-800 whitespace-nowrap">
                              {row.workerName}
                            </td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">{fmt(e.monSt)}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">{fmt(e.tueSt)}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">{fmt(e.wedSt)}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">{fmt(e.thuSt)}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">{fmt(e.friSt)}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">{fmt(e.satSt)}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">{fmt(e.sunSt)}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">{totalSt}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">{totalOt}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">
                              ${e.baseRateSnapshot.toFixed(2)}
                            </td>
                            <td className="py-1.5 pr-2 text-right text-gray-700">
                              ${e.fringeRateSnapshot.toFixed(2)}
                            </td>
                            <td className="py-1.5 text-right text-gray-700">
                              {e.grossWages !== null ? `$${e.grossWages.toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {entries.length === 0 && (
                        <tr>
                          <td
                            colSpan={13}
                            className="py-3 text-center text-gray-400 text-xs"
                          >
                            No payroll entries for this week.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* TX LCPtracker informational callout — TX-02 */}
        {!isLoading && !isError && isTX && (
          <HelpCallout
            icon={ExternalLink}
            title="Texas LCPtracker Electronic Submission Required"
            body={<>
              Texas Chapter 2258 requires electronic submission of certified payroll
              records via LCPtracker for TxDOT and other public works contracts.
              Submit your WH-347 through the{' '}
              <a href="https://lcp123.com" target="_blank" rel="noopener noreferrer"
                className="text-brand-gold underline">
                LCPtracker portal (lcp123.com)
              </a>
              . Refer to the{' '}
              <a href="https://www.txdot.gov/business/contractors/labor-compliance.html"
                target="_blank" rel="noopener noreferrer"
                className="text-brand-gold underline">
                TxDOT contractor compliance page
              </a>
              {' '}for submission requirements.
            </>}
          />
        )}

        {/* FL informational callout — FL-01 */}
        {!isLoading && !isError && isFL && (
          <HelpCallout
            icon={Info}
            title="Florida — Federal WH-347 Applies"
            body="Florida has no state-specific certified payroll form. Federal Davis-Bacon WH-347 applies to all Florida public works projects. Florida repealed its state prevailing wage law in 1979; HB 705 (July 2024) preempted all local wage ordinances."
          />
        )}

        {/* Phase 76 — Job-Site Photos section */}
        {!isLoading && !isError && weekId && projectId && (
          <Card padding="none" className="mt-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Job-Site Photos</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Photos uploaded by field workers for this payroll week.
              </p>
            </div>
            <div className="px-5 py-4">
              <PhotoCapture projectId={projectId} weekId={weekId} />
            </div>
          </Card>
        )}

        {/* Phase 76 — Fill from Field Clock confirmation modal */}
        {showFillModal && fillResult && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowFillModal(false)}
          >
            <div
              className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-headline font-bold text-gray-900">
                Field Clock — Suggested Hours
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Found {fillResult.workerCount} worker{fillResult.workerCount !== 1 ? 's' : ''},{' '}
                {fillResult.totalPunchPairs} punch pair{fillResult.totalPunchPairs !== 1 ? 's' : ''}{' '}
                covering {fillResult.weekStart} to {fillResult.weekEnd}.
              </p>

              {fillResult.suggestions.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">
                  No complete clock-in/clock-out pairs found for this week.
                  Make sure workers have clocked both in and out.
                </p>
              ) : (
                <div className="mt-4 overflow-y-auto flex-1 space-y-4">
                  {fillResult.suggestions.map((s) => (
                    <div key={s.workerId} className="rounded border border-gray-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-gray-900">{s.workerName}</span>
                        <span className="text-xs text-gray-500">
                          {s.totalHours}h total from {s.punchPairs} pair{s.punchPairs !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 text-left">
                            <th className="pb-1">Date</th>
                            <th className="pb-1">Day</th>
                            <th className="pb-1 text-right">Regular Hours</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {s.entries.map((entry) => (
                            <tr key={entry.date}>
                              <td className="py-1 text-gray-700">{entry.date}</td>
                              <td className="py-1 text-gray-500">
                                {entry.dayKey.slice(0, 3).toUpperCase()}
                              </td>
                              <td className="py-1 text-right font-medium text-gray-900">
                                {entry.regularHours}h
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                    These are suggested hours only. You must create or edit payroll entries manually — use these values as a reference when editing hours for each worker.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setShowFillModal(false)}
                    className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  {weekId && !week?.submittedAt && (
                    <button
                      onClick={() => {
                        setShowFillModal(false);
                        // Navigate to edit page where user can apply the hours
                        window.location.href = `/projects/${projectId}/payroll/${weekId}/edit`;
                      }}
                      className="rounded bg-brand-gold text-nav-dark text-sm font-semibold px-4 py-2 hover:bg-brand-gold/90"
                    >
                      Go to Edit Hours
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CA eCPR disclosure modal — persistent, shown on every CA download click */}
        {showCaDisclosure && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowCaDisclosure(false)}
          >
            <div
              className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-headline font-bold text-gray-900">
                California A-1-131 — Important Notice
              </h3>
              <div className="mt-3 space-y-3 text-sm text-gray-700">
                <p>
                  This PDF is a local reference copy of the DIR A-1-131 certified payroll form.
                </p>
                <p className="font-medium text-amber-800">
                  Official electronic submission of certified payroll records for California
                  public works projects is required through the DIR eCPR portal:
                </p>
                <a
                  href="https://efiling.dir.ca.gov/eCPR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center font-medium text-blue-600 underline hover:text-blue-800"
                >
                  efiling.dir.ca.gov/eCPR
                </a>
                {(!projectData?.data?.project?.cslbLicense || !projectData?.data?.project?.wcPolicyNumber) && (
                  <p className="rounded bg-amber-50 p-2 text-amber-800">
                    Warning: CSLB License or WC Policy number is missing. Edit the project to add them before official submission.
                  </p>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowCaDisclosure(false)}
                  className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <Button onClick={handleCaConfirmedDownload}>
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* WA PWIA disclosure modal — persistent, shown on every WA download click */}
        {showWaDisclosure && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowWaDisclosure(false)}
          >
            <div
              className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-headline font-bold text-gray-900">
                Washington F700-065-000 — Important Notice
              </h3>
              <div className="mt-3 space-y-3 text-sm text-gray-700">
                <p>
                  This PDF is a local reference copy of the L&amp;I F700-065-000 certified payroll
                  record for Washington State public works projects.
                </p>
                <p className="font-medium text-blue-800">
                  Official electronic submission of certified payroll records for Washington State
                  public works projects is required through the L&amp;I PWIA portal:
                </p>
                <a
                  href="https://lni.wa.gov/licensing-permits/public-works-projects/prevailing-wage/public-works-information-access-pwia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center font-medium text-blue-600 underline hover:text-blue-800"
                >
                  L&amp;I PWIA Portal
                </a>
                {(!projectData?.data?.project?.ubiNumber ||
                  !projectData?.data?.project?.lniCertificate ||
                  !projectData?.data?.project?.wcAccount) && (
                  <p className="rounded bg-blue-50 p-2 text-blue-800">
                    Warning: UBI Number, L&amp;I Certificate, or WC Account is missing. Edit the
                    project to add them before official submission.
                  </p>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowWaDisclosure(false)}
                  className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <Button onClick={handleWaConfirmedDownload}>Download PDF</Button>
              </div>
            </div>
          </div>
        )}

        {/* CA eCPR XML Export — 2-step modal (per D-09, D-10, D-12) */}
        {showEcprModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowEcprModal(false)}
          >
            <div
              className="mx-4 max-w-lg rounded-lg bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {ecprStep === 1 ? (
                <>
                  <h3 className="text-lg font-headline font-bold text-gray-900 flex items-baseline gap-1">
                    CA <TermTooltip term="ECPR XML" definition={ECPR_XML_DEF} /> Export — Step 1 of 2
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Confirm or enter the fields required for the DIR eCPR portal.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contractor FEIN (9 digits)</label>
                      <input
                        type="text"
                        value={ecprFein}
                        onChange={(e) => setEcprFein(e.target.value)}
                        placeholder="123456789"
                        maxLength={10}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        CA DIR Project ID
                        <span className="ml-1 text-xs text-gray-400">(from DIR portal, NOT this app's project number)</span>
                      </label>
                      <input
                        type="text"
                        value={ecprDirProjectId}
                        onChange={(e) => setEcprDirProjectId(e.target.value)}
                        placeholder="DIR portal project number"
                        maxLength={18}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Awarding Agency</label>
                      <input
                        type="text"
                        value={ecprAwardingAgency}
                        onChange={(e) => setEcprAwardingAgency(e.target.value)}
                        placeholder="e.g., Caltrans, City of Los Angeles"
                        maxLength={56}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contract Number</label>
                      <input
                        type="text"
                        value={ecprContractNumber}
                        onChange={(e) => setEcprContractNumber(e.target.value)}
                        placeholder="Contract or PO number"
                        maxLength={25}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Check / Direct Deposit Number</label>
                      <input
                        type="text"
                        value={ecprCheckNum}
                        onChange={(e) => setEcprCheckNum(e.target.value)}
                        maxLength={20}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
                      />
                      <p className="mt-0.5 text-xs text-gray-400">Applies to all workers this week. Default: DIRECT DEPOSIT</p>
                    </div>
                  </div>

                  {/* SSN Disclosure (per D-14) */}
                  <div className="mt-4 rounded bg-amber-50 border border-amber-200 p-3">
                    <p className="text-sm font-medium text-amber-800">SSN Notice</p>
                    <p className="mt-1 text-xs text-amber-700">
                      This app does not store full Social Security Numbers. The XML file will contain placeholder SSNs
                      (000000XXXX using the last 4 digits on file). You must enter full SSNs for each worker directly
                      in the DIR eCPR portal after uploading the XML file.
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      onClick={() => setShowEcprModal(false)}
                      className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <Button
                      onClick={() => void openExportPreflight('ecpr-xml', 'ecpr-xml')}
                      disabled={!ecprFein.replace(/-/g, '') || !ecprDirProjectId || ecprGenerating}
                    >
                      {ecprGenerating ? 'Generating...' : 'Generate & Download XML'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-headline font-bold text-gray-900 flex items-baseline gap-1">
                    CA <TermTooltip term="ECPR XML" definition={ECPR_XML_DEF} /> Export — Step 2 of 2
                  </h3>
                  <p className="mt-1 text-sm text-green-700 font-medium">
                    XML file downloaded successfully. Now upload it to the DIR eCPR portal.
                  </p>

                  <ol className="mt-4 space-y-2 text-sm text-gray-700 list-decimal list-inside">
                    <li>
                      Log in to{' '}
                      <a href="https://efiling.dir.ca.gov/eCPR" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                        efiling.dir.ca.gov/eCPR
                      </a>
                    </li>
                    <li>Select your project (must match DIR Project ID: <strong>{ecprDirProjectId}</strong>)</li>
                    <li>Upload the downloaded XML file</li>
                    <li>Verify all workers appear in the submission preview</li>
                    <li>
                      <strong>Enter full SSNs</strong> for each worker directly in the portal
                      <span className="text-amber-700"> (the XML contains placeholder SSNs)</span>
                    </li>
                    <li>
                      Submit and confirm status — if the submission shows "Draft," follow up at{' '}
                      <a href="mailto:publicworks@dir.ca.gov" className="text-blue-600 underline hover:text-blue-800">
                        publicworks@dir.ca.gov
                      </a>
                    </li>
                  </ol>

                  <div className="mt-4 rounded bg-blue-50 border border-blue-200 p-3">
                    <p className="text-xs text-blue-800">
                      The DIR eCPR portal may take several minutes to process your upload. If the submission appears
                      stuck as "Draft," this is a known portal issue — contact DIR Public Works at the email above.
                    </p>
                  </div>

                  {week?.caEcprSubmittedAt ? (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="warning">CA DIR Submitted</Badge>
                        <span className="text-sm text-gray-600">{week.caEcprSubmittedAt.slice(0, 10)}</span>
                      </div>
                      <button
                        className="text-sm text-gray-500 underline hover:text-gray-700"
                        disabled={caUnsubmitMutation.isPending}
                        onClick={() => caUnsubmitMutation.mutate()}
                      >
                        {caUnsubmitMutation.isPending ? 'Clearing...' : 'Un-submit'}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex justify-end gap-3">
                      <Button
                        disabled={caSubmitMutation.isPending}
                        onClick={() => caSubmitMutation.mutate()}
                      >
                        {caSubmitMutation.isPending ? 'Saving...' : 'Mark as Submitted to CA DIR'}
                      </Button>
                    </div>
                  )}
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => setShowEcprModal(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* WA CPR XML — trade code gate screen (blocking, not modal) */}
        {showWaCprGate && (
          <Card className="mt-6">
            <div className="p-4">
              <h3 className="font-headline text-lg font-semibold mb-3">WA Trade Code Required</h3>
              <p className="mb-4 text-sm text-gray-700">
                The following workers are missing a WA L&amp;I trade code. All workers must have a
                trade code assigned before generating WA <TermTooltip term="CPR" definition={CPR_DEF} /> XML.
              </p>
              <ul className="list-disc pl-5 mb-4 space-y-1 text-sm">
                {waCprGateWorkers.map((w) => (
                  <li key={w.workerId}>
                    {w.name} —{' '}
                    <a
                      href={`/projects/${projectData?.data?.project?.id}/workers`}
                      className="text-brand-gold underline"
                    >
                      Edit classification
                    </a>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" onClick={() => setShowWaCprGate(false)}>
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {/* WA CPR XML — intentId modal (step 1) + submission modal (step 2) */}
        {showWaCprModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => { setShowWaCprModal(false); setWaCprStep(1); }}
          >
            <div
              className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {waCprStep === 1 ? (
                <>
                  <h3 className="text-lg font-headline font-bold text-gray-900 flex items-baseline gap-1">
                    WA <TermTooltip term="CPR" definition={CPR_DEF} /> XML Export
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Generate and download the WA <TermTooltip term="PWIA Intent" definition={PWIA_INTENT_DEF} /> certified payroll XML for this week.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 flex items-baseline gap-1">
                        <TermTooltip term="PWIA Intent" definition={PWIA_INTENT_DEF} /> ID
                      </label>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Issued by L&amp;I after Statement of Intent approval. Enter the numeric ID from
                        your My L&amp;I PWIA portal.
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={waCprIntentId}
                        onChange={(e) => setWaCprIntentId(e.target.value)}
                        placeholder="e.g., 12345"
                        maxLength={20}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-brand-gold focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* SSN disclosure */}
                  <div className="mt-4 rounded bg-amber-50 border border-amber-200 p-3">
                    <p className="text-sm font-medium text-amber-800">SSN Notice</p>
                    <p className="mt-1 text-xs text-amber-700">
                      Worker SSNs are not stored in this application. The generated XML uses placeholder
                      SSNs (00000XXXX). You must enter full SSNs directly in the L&amp;I PWIA portal.
                    </p>
                    <a
                      href="https://secure.lni.wa.gov/pwia/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-brand-gold underline hover:opacity-80"
                    >
                      secure.lni.wa.gov/pwia/
                    </a>
                  </div>

                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      onClick={() => { setShowWaCprModal(false); setWaCprStep(1); }}
                      className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <Button
                      onClick={handleWaCprConfirm}
                      disabled={!waCprIntentId.trim() || waCprGenerating}
                    >
                      {waCprGenerating ? 'Generating...' : 'Generate & Download'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-headline font-bold text-gray-900 flex items-baseline gap-1">
                    WA <TermTooltip term="CPR" definition={CPR_DEF} /> XML — Step 2 of 2
                  </h3>
                  <p className="mt-1 text-sm text-green-700 font-medium">
                    XML file downloaded successfully. Now upload it to the My L&amp;I PWIA portal.
                  </p>

                  <ol className="mt-4 space-y-2 text-sm text-gray-700 list-decimal list-inside">
                    <li>Log in to <a href="https://secure.lni.wa.gov/pwia/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">secure.lni.wa.gov/pwia</a></li>
                    <li>Navigate to your Intent ID and select "Upload CPR XML"</li>
                    <li>Upload the downloaded XML file</li>
                    <li>Verify all workers and hours in the submission preview</li>
                    <li><strong>Enter full SSNs</strong> for each worker directly in the portal <span className="text-amber-700">(the XML contains placeholder SSNs)</span></li>
                    <li>Submit the certified payroll report</li>
                  </ol>

                  {week?.waLniSubmittedAt ? (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral">WA L&amp;I Submitted</Badge>
                        <span className="text-sm text-gray-600">{week.waLniSubmittedAt.slice(0, 10)}</span>
                      </div>
                      <button
                        className="text-sm text-gray-500 underline hover:text-gray-700"
                        disabled={waUnsubmitMutation.isPending}
                        onClick={() => waUnsubmitMutation.mutate()}
                      >
                        {waUnsubmitMutation.isPending ? 'Clearing...' : 'Un-submit'}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex justify-end gap-3">
                      <Button
                        disabled={waSubmitMutation.isPending}
                        onClick={() => waSubmitMutation.mutate()}
                      >
                        {waSubmitMutation.isPending ? 'Saving...' : 'Mark as Submitted to WA L&I'}
                      </Button>
                    </div>
                  )}
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => { setShowWaCprModal(false); setWaCprStep(1); }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* NY MPWR Submission — 3-step modal (Phase 41) */}
        {showNyMpwrModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={closeNyModal}
          >
            <div
              className="mx-4 max-w-lg w-full rounded-lg bg-surface-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {nyMpwrStep === 1 && (
                <>
                  <h3 className="text-lg font-headline font-bold text-gray-900">
                    Step 1: Confirm NY Registration Details
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    These values will be saved to your project and pre-filled next time.
                  </p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        PRC Number
                      </label>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Project Registration Certificate number from NYSDOL
                      </p>
                      <input
                        type="text"
                        value={nyPrcNumber}
                        onChange={(e) => setNyPrcNumber(e.target.value)}
                        placeholder="e.g., PRC-2024-001234"
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-brand-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        NYS Contractor Registration Number
                      </label>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Your NYS contractor registration number
                      </p>
                      <input
                        type="text"
                        value={nysContractorRegNumber}
                        onChange={(e) => setNysContractorRegNumber(e.target.value)}
                        placeholder="e.g., 12345678"
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-brand-gold focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={closeNyModal}
                      className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <Button onClick={handleNyStep1Save}>
                      Save &amp; Continue
                    </Button>
                  </div>
                </>
              )}

              {nyMpwrStep === 2 && (
                <>
                  <h3 className="text-lg font-headline font-bold text-gray-900">
                    Step 2: Download Submission Files
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Download both files, then continue to the submission checklist.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="rounded border border-gray-200 bg-surface-card p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">PW-12 PDF</p>
                        <p className="text-xs text-gray-500">NY prevailing wage statement — keep for offline records</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleNyDownload(`/api/export/pw12/${weekId}`, `pw12-${weekId}.pdf`)}
                      >
                        Download PDF
                      </Button>
                    </div>
                    <div className="rounded border border-gray-200 bg-surface-card p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">MPWR XML</p>
                        <p className="text-xs text-gray-500">Upload this file to the NYSDOL MPWR portal</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleNyDownload(`/api/export/ny-mpwr-xml/${weekId}`, `mpwr-${weekId}.xml`)}
                      >
                        Download XML
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={closeNyModal}
                      className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <Button onClick={() => setNyMpwrStep(3)}>
                      Continue to Checklist
                    </Button>
                  </div>
                </>
              )}

              {nyMpwrStep === 3 && (
                <>
                  <h3 className="text-lg font-headline font-bold text-gray-900">
                    Step 3: Submit to NY MPWR Portal
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Complete these steps in the NYSDOL MPWR portal.
                  </p>

                  <ul className="mt-4 space-y-2 text-sm text-gray-700 list-disc list-inside">
                    <li>
                      Upload the MPWR XML file to the NYSDOL MPWR portal at{' '}
                      <a
                        href="https://dol.ny.gov"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-gold underline hover:opacity-80"
                      >
                        dol.ny.gov
                      </a>
                    </li>
                    <li>
                      Submissions must be made within <strong>30 days</strong> of the payroll week ending date
                    </li>
                    <li>Keep the PW-12 PDF for your offline records</li>
                    <li>Verify work category names match the MPWR portal dropdown values</li>
                  </ul>

                  {week?.nyMpwrSubmittedAt ? (
                    <div className="mt-6 flex items-center gap-3">
                      <Badge variant="compliant">NY MPWR Submitted</Badge>
                      <span className="text-sm text-gray-600">{week.nyMpwrSubmittedAt.slice(0, 10)}</span>
                    </div>
                  ) : (
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        onClick={closeNyModal}
                        className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                      >
                        Close
                      </button>
                      <Button
                        disabled={nyMpwrSubmitting}
                        onClick={handleNyMarkSubmitted}
                      >
                        {nyMpwrSubmitting ? 'Saving...' : 'Mark as Submitted to NY MPWR'}
                      </Button>
                    </div>
                  )}

                  {week?.nyMpwrSubmittedAt && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={closeNyModal}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* IL IDOL Submission Modal — 2-step (Phase 43) */}
        {showIlIdolModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={closeIlModal}
          >
            <div
              className="mx-4 max-w-lg w-full rounded-lg bg-surface-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-headline font-bold text-gray-900">
                  {ilIdolStep === 1
                    ? 'Step 1: Download IL Certified Transcript'
                    : 'Step 2: Submit to IL IDOL Portal'}
                </h3>
                <button
                  onClick={closeIlModal}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>

              {ilIdolStep === 1 && (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Download the IL Certified Transcript of Payroll PDF for this payroll week before submitting to the IDOL portal.
                  </p>
                  <Button variant="secondary" size="sm" onClick={handleIlDownloadPdf}>
                    Download IL Certified Transcript PDF
                  </Button>
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <Button variant="secondary" size="sm" onClick={closeIlModal}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setIlIdolStep(2)}>
                      Continue to Checklist
                    </Button>
                  </div>
                </>
              )}

              {ilIdolStep === 2 && (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Upload your certified payroll to the IL IDOL portal and mark as submitted below.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5 mb-4">
                    <li>
                      Upload the Certified Transcript to the{' '}
                      <a
                        href="https://idol.illinois.gov"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-gold underline"
                      >
                        IL IDOL portal at idol.illinois.gov
                      </a>
                    </li>
                    <li>
                      Submissions are due by the <strong>15th of the month</strong> following the payroll week ending date
                    </li>
                    <li>
                      The IDOL portal also accepts Excel format — see portal for template
                    </li>
                    <li>
                      Retain a copy of the PDF for your records
                    </li>
                  </ul>

                  {week?.ilIdolSubmittedAt ? (
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="compliant">Submitted</Badge>
                      <span className="text-sm text-gray-500">
                        {week.ilIdolSubmittedAt.slice(0, 10)}
                      </span>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleIlMarkSubmitted}
                        disabled={ilIdolSubmitting}
                      >
                        {ilIdolSubmitting ? 'Submitting...' : 'Mark as Submitted to IL IDOL'}
                      </Button>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <Button variant="secondary" size="sm" onClick={closeIlModal}>
                      {week?.ilIdolSubmittedAt ? 'Close' : 'Cancel'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* QB Native Sync Modal (Fix 1) */}
        {showQboSyncModal && qboSyncResult && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowQboSyncModal(false); setQboSyncResult(null); setQboSyncError(null); } }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowQboSyncModal(false); setQboSyncResult(null); setQboSyncError(null); } }}
            tabIndex={-1}
          >
            <Card className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-base font-headline text-gray-900 mb-1">Sync from QuickBooks</h2>
              <p className="text-sm text-gray-500 mb-4">
                Week {qboSyncResult.startDate} — {qboSyncResult.endDate}. Check the workers to import,
                then confirm. Hours are grouped by worker and pushed to payroll entries.
              </p>

              {qboSyncError && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {qboSyncError}
                </div>
              )}

              {qboSyncResult.matched.length === 0 && (
                <p className="text-sm text-gray-500 mb-4">
                  No QB employees could be matched to workers on this project. Check the
                  Employee Mapping on the Integrations page.
                </p>
              )}

              {qboSyncResult.matched.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Matched workers ({qboSyncResult.matched.length})
                  </p>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {qboSyncResult.matched.map((match, i) => {
                      const totalHours = match.entries.reduce((s, e) => s + e.hours, 0);
                      return (
                        <label key={i} className="flex items-center gap-3 px-4 py-2.5 bg-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!qboSyncChecked[i]}
                            onChange={() => setQboSyncChecked((prev) => ({ ...prev, [i]: !prev[i] }))}
                            className="rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{match.workerName}</p>
                            <p className="text-xs text-gray-400">QB: {match.qboEmployeeRef} — {match.entries.length} record{match.entries.length !== 1 ? 's' : ''}</p>
                          </div>
                          <span className="text-sm font-semibold text-gray-800 shrink-0">
                            {totalHours.toFixed(2)} hrs
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {qboSyncResult.unmatched.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Unmatched QB employees ({qboSyncResult.unmatched.length}) — not imported
                  </p>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {qboSyncResult.unmatched.map((u, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2 bg-gray-50">
                        <p className="text-sm text-gray-600 flex-1">{u.employeeRef}</p>
                        <span className="text-xs text-gray-400">{u.totalHours.toFixed(2)} hrs</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Map these employees on the Integrations page, then sync again.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setShowQboSyncModal(false); setQboSyncResult(null); setQboSyncError(null); }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={qboSyncPushing || qboSyncResult.matched.length === 0 || Object.values(qboSyncChecked).every((v) => !v)}
                  onClick={handleQboSyncPush}
                  loading={qboSyncPushing}
                >
                  {qboSyncPushing ? 'Pushing...' : 'Confirm and Push Hours'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* QB Online Time Import Modal (Phase 69) */}
        {showQboImportModal && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowQboImportModal(false); setQboActivities(null); setQboImportError(null); setQboImportNote(null); } }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowQboImportModal(false); setQboActivities(null); setQboImportError(null); setQboImportNote(null); } }}
            tabIndex={-1}
          >
            <Card className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-base font-headline text-gray-900 mb-1">
                Import from QuickBooks
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Week ending <strong>{week?.weekEndingDate}</strong>
              </p>

              {qboImportError && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {qboImportError}
                </div>
              )}

              {qboImportNote && (
                <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {qboImportNote}
                </div>
              )}

              {!qboActivities && !qboImportFetching && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Fetch time records from QuickBooks Online for this payroll week and route them through
                    the standard import pipeline.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={qboImportFetching}
                    onClick={async () => {
                      if (!week) return;
                      setQboImportFetching(true);
                      setQboImportError(null);
                      setQboImportNote(null);
                      try {
                        // Derive week start date (Mon) from weekEndingDate (Sun)
                        const endDate = week.weekEndingDate;
                        const end = new Date(endDate + 'T00:00:00Z');
                        const start = new Date(end);
                        start.setUTCDate(end.getUTCDate() - 6);
                        const startDate = start.toISOString().slice(0, 10);

                        const resp = await api.get<{
                          data: {
                            activities: typeof qboActivities;
                            count: number;
                            note: string | null;
                          };
                        }>(`/integrations/qbo/timeactivities?startDate=${startDate}&endDate=${endDate}`);

                        setQboActivities(resp.data.activities);
                        if (resp.data.note) setQboImportNote(resp.data.note);
                      } catch {
                        setQboImportError('Failed to fetch time records from QuickBooks. Check your connection and try again.');
                      } finally {
                        setQboImportFetching(false);
                      }
                    }}
                  >
                    Fetch time records
                  </Button>
                </div>
              )}

              {qboImportFetching && (
                <p className="text-sm text-gray-500">Fetching time records from QuickBooks...</p>
              )}

              {qboActivities && qboActivities.length === 0 && (
                <p className="text-sm text-gray-500">No time records found for this week in QuickBooks.</p>
              )}

              {qboActivities && qboActivities.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    {qboActivities.length} time {qboActivities.length === 1 ? 'record' : 'records'} found.
                    Review below, then use <strong>Import from Payroll Provider</strong> with a QB export
                    file to commit hours through the full matching pipeline.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-1 pr-3 font-medium">Employee</th>
                          <th className="py-1 pr-3 font-medium">Date</th>
                          <th className="py-1 pr-3 font-medium text-right">Hours</th>
                          <th className="py-1 pr-3 font-medium">Customer / Job</th>
                          <th className="py-1 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qboActivities.map((act) => (
                          <tr key={act.qboId} className="border-b border-gray-100 last:border-0">
                            <td className="py-1 pr-3 text-gray-800">{act.employeeRef}</td>
                            <td className="py-1 pr-3 text-gray-600">{act.date}</td>
                            <td className="py-1 pr-3 text-right text-gray-800">
                              {act.hours.toFixed(2)}
                              {act.needsDailySplit && (
                                <span className="ml-1 text-amber-600" title="Needs daily split">*</span>
                              )}
                            </td>
                            <td className="py-1 pr-3 text-gray-500">{act.customerRef ?? '—'}</td>
                            <td className="py-1 text-gray-400">{act.description ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {qboActivities.some((a) => a.needsDailySplit) && (
                    <p className="mt-2 text-xs text-amber-700">
                      * QuickBooks stores weekly totals for these entries. Daily hour split required before
                      importing — use the QB payroll export CSV with per-day columns.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-100 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowQboImportModal(false);
                    setQboActivities(null);
                    setQboImportError(null);
                    setQboImportNote(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Export preflight modal */}
        {showPreflight && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPreflight(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowPreflight(false);
            }}
            tabIndex={-1}
          >
            <Card className="max-w-2xl w-full mx-4 max-h-[82vh] overflow-y-auto">
              <h2 className="text-base font-headline text-gray-900 mb-2">
                Export Preflight Review
              </h2>
              {preflightLoading ? (
                <p className="text-sm text-gray-600 mb-6">Checking export readiness...</p>
              ) : preflightError ? (
                <p className="text-sm text-red-700 mb-6">{preflightError}</p>
              ) : exportPreflight ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {exportPreflight.summary.exportLabel}: {exportPreflight.summary.entryCount} entries,
                    {' '}{exportPreflight.summary.totalHours.toFixed(1)} hours reviewed.
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-xs text-red-700">Blockers</p>
                      <p className="text-lg font-semibold text-red-900">{exportPreflight.blockers}</p>
                    </div>
                    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs text-amber-700">Warnings</p>
                      <p className="text-lg font-semibold text-amber-900">{exportPreflight.warnings}</p>
                    </div>
                    <div className="rounded border border-green-200 bg-green-50 px-3 py-2">
                      <p className="text-xs text-green-700">Passed</p>
                      <p className="text-lg font-semibold text-green-900">{exportPreflight.passes}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {exportPreflight.issues.map((issue) => (
                      <li key={issue.id} className="flex items-start gap-2 text-sm text-gray-700">
                        <Badge
                          variant={issue.severity === 'blocker' ? 'violation' : issue.severity === 'warning' ? 'warning' : 'compliant'}
                          className="mt-0.5 shrink-0"
                        >
                          {issue.severity === 'blocker' ? 'Blocker' : issue.severity === 'warning' ? 'Review' : 'Pass'}
                        </Badge>
                        <span className="flex-1">
                          <span className="font-medium">{issue.title}</span>
                          <span className="block text-gray-600">{issue.detail}</span>
                        </span>
                        {issue.severity !== 'pass' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreflightFix(issue)}
                          >
                            {issue.fix?.label ?? 'Fix'}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  autoFocus
                  onClick={() => {
                    setShowPreflight(false);
                    setPendingExportAction(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={preflightLoading || !exportPreflight || exportPreflight.blockers > 0}
                  onClick={handleContinueAfterPreflight}
                >
                  {exportPreflight?.blockers ? 'Resolve Blockers First' : 'Continue Export'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Payroll Import Modal — 3-step (Phase 36, per D-01 through D-09) */}
        {showImportModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={closeImportModal}
          >
            <div
              className="mx-4 max-w-3xl w-full rounded-lg bg-surface-card shadow-card-elevated p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {importStep === 1 && (
                <>
                  <p className="text-xs text-text-secondary">Step 1 of 3</p>
                  <h3 className="text-xl font-headline font-semibold text-gray-900">
                    Import Payroll — Step 1: Select File
                  </h3>
                  <div className="mt-4">
                    <label className="inline-block cursor-pointer rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                      Browse file
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        disabled={importParsing}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setImportFile(f);
                          setImportError(null);
                          if (f) handleImportPreview(f);
                        }}
                      />
                    </label>
                    {importFile && !importParsing && !importError && (
                      <span className="ml-3 text-sm text-text-secondary">{importFile.name}</span>
                    )}
                    {importParsing && (
                      <span className="ml-3 text-sm text-text-secondary italic">Parsing...</span>
                    )}
                    {importError && (
                      <p className="mt-2 text-sm text-status-violation">{importError}</p>
                    )}
                  </div>
                  <div className="mt-4 rounded-sm border border-border-default bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">CSV templates</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(PROVIDER_LABELS)
                        .filter(([provider]) => ['quickbooks', 'adp', 'gusto', 'paychex', 'sage_300', 'sage_100'].includes(provider))
                        .map(([provider, label]) => (
                          <a
                            key={provider}
                            href={`/api/payroll/import/templates/${provider}.csv`}
                            className="rounded-sm border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-brand-gold"
                          >
                            {label}
                          </a>
                        ))}
                    </div>
                  </div>
                  <div className="mt-6 flex justify-between items-center pt-4 border-t border-border-default">
                    <Button variant="ghost" size="md" onClick={closeImportModal}>
                      Close Import
                    </Button>
                    <div />
                  </div>
                </>
              )}

              {importStep === '2b' && importPreview && (
                <>
                  <p className="text-xs text-text-secondary">Step 2a of 3</p>
                  <h3 className="text-xl font-headline font-semibold text-gray-900">
                    Import Payroll — Map Employees
                  </h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    {PROVIDER_LABELS[importPreview.provider] ?? importPreview.provider} uses numeric employee IDs.
                    Match each ID to a project worker. This mapping is saved for future imports.
                  </p>

                  {idMappingsError && (
                    <p className="mt-2 text-sm text-status-violation">{idMappingsError}</p>
                  )}

                  <div className="mt-4 max-h-[60vh] overflow-y-auto">
                    <Card padding="none">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-default">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Provider ID</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Project Worker</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(importPreview.unmappedIds ?? []).map((provId) => (
                            <tr key={provId} className="border-b border-border-default last:border-0">
                              <td className="px-3 py-2 font-mono text-sm">{provId}</td>
                              <td className="px-3 py-2">
                                <select
                                  className="w-full rounded border border-border-default px-2 py-1.5 text-base"
                                  value={idMappings[provId] ?? ''}
                                  onChange={(e) => setIdMappings((prev) => ({ ...prev, [provId]: e.target.value }))}
                                >
                                  <option value="">-- Skip this employee --</option>
                                  {projectWorkers.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  </div>

                  {importPreview.matched.length > 0 && (
                    <p className="mt-3 text-xs text-text-secondary">
                      {importPreview.matched.length} employee(s) already mapped from previous imports.
                    </p>
                  )}

                  <div className="mt-6 flex justify-between items-center pt-4 border-t border-border-default">
                    <Button variant="ghost" size="md" onClick={closeImportModal}>
                      Cancel
                    </Button>
                    <Button
                      size="md"
                      disabled={idMappingsSaving}
                      onClick={async () => {
                        const toSave = Object.entries(idMappings)
                          .filter(([, workerId]) => workerId !== '')
                          .map(([providerWorkerId, workerId]) => ({ providerWorkerId, workerId }));

                        if (toSave.length === 0 && (importPreview.unmappedIds ?? []).length > 0) {
                          // User skipped ALL — proceed to Step 2 (IDs appear as unmatched)
                          setImportStep(2);
                          return;
                        }

                        setIdMappingsSaving(true);
                        setIdMappingsError(null);
                        try {
                          const saveRes = await fetch('/api/payroll/import/mappings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              projectId,
                              provider: importPreview.provider,
                              mappings: toSave,
                            }),
                          });
                          if (!saveRes.ok) {
                            const body = await saveRes.json().catch(() => ({}));
                            throw new Error((body as { error?: string }).error || 'Failed to save mappings');
                          }

                          // Re-call preview with the saved file for server-authoritative re-resolution
                          if (importFile) {
                            await handleImportPreview(importFile);
                            // handleImportPreview sets importStep to 2 if all resolved, or '2b' if some remain
                          } else {
                            setImportStep(2);
                          }
                        } catch (err: unknown) {
                          const message = err instanceof Error ? err.message : 'Failed to save mappings';
                          setIdMappingsError(message);
                        } finally {
                          setIdMappingsSaving(false);
                        }
                      }}
                    >
                      {idMappingsSaving ? 'Saving...' : 'Save Mappings & Continue'}
                    </Button>
                  </div>
                </>
              )}

              {importStep === 2 && importPreview && (
                <>
                  <p className="text-xs text-text-secondary">Step 2 of 3</p>
                  <h3 className="text-xl font-headline font-semibold text-gray-900">
                    Import Payroll — Step 2: Review Entries
                  </h3>

                  {/* Provider badge (D-04) */}
                  <div className="mt-3">
                    <Badge variant="neutral">
                      {PROVIDER_LABELS[importPreview.provider] ?? importPreview.provider}
                    </Badge>
                  </div>

                  {/* ADP amber banner — only when adpWeeklyTotalsOnly (D-13) */}
                  {importPreview.adpWeeklyTotalsOnly && (
                    <Card padding="sm" className="mt-3 border border-status-warning/30 bg-status-warning/10">
                      <p className="text-sm text-status-warning">
                        ADP export does not include daily breakdown. Hours are shown as weekly totals placed on Monday.
                      </p>
                    </Card>
                  )}

                  {/* Gusto amber banner — only when gustoWeeklyTotalsOnly */}
                  {importPreview.gustoWeeklyTotalsOnly && (
                    <Card padding="sm" className="mt-3 border border-status-warning/30 bg-status-warning/10">
                      <p className="text-sm text-status-warning">
                        Gusto export does not include daily breakdown. Hours are shown as weekly totals placed on Monday.
                      </p>
                    </Card>
                  )}

                  {/* Conflict warning panel — only when conflicts exist (D-12) */}
                  {importPreview.conflicts.length > 0 && (
                    <Card padding="sm" className="mt-3 border border-status-warning/30 bg-status-warning/10">
                      <p className="text-sm font-semibold text-status-warning">Cannot import — existing entries conflict</p>
                      <p className="mt-1 text-sm text-status-warning">
                        These workers already have manual entries this week:{' '}
                        {importPreview.conflicts.map((c) => c.workerName).join(', ')}.
                        Delete their existing entries on the Payroll Entry page, then re-import.
                      </p>
                    </Card>
                  )}

                  {/* Scrollable content area */}
                  <div className="mt-4 max-h-[70vh] overflow-y-auto">

                    {/* Matched workers table (D-04, D-05) */}
                    {importPreview.matched.length > 0 ? (
                      <Card padding="none">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border-default">
                                <th className="w-8 px-2 py-2">
                                  <input
                                    type="checkbox"
                                    checked={importPreview.matched.every((_, i) => importCheckedRows[i])}
                                    onChange={(e) => {
                                      const next: Record<number, boolean> = {};
                                      importPreview.matched.forEach((_, i) => { next[i] = e.target.checked; });
                                      setImportCheckedRows(next);
                                    }}
                                  />
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-text-secondary">Worker</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-text-secondary">Classification</th>
                                {importPreview.adpWeeklyTotalsOnly ? (
                                  <>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">Total ST</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">Total OT</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">M ST</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">M OT</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">T ST</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">T OT</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">W ST</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">W OT</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">Th ST</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">Th OT</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">F ST</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">F OT</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">Sa ST</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">Sa OT</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">Su ST</th>
                                    <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-text-secondary">Su OT</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {importPreview.matched.map((row, i) => (
                                <tr key={i} className="border-b border-border-default last:border-0">
                                  <td className="px-2 py-2">
                                    <input
                                      type="checkbox"
                                      checked={!!importCheckedRows[i]}
                                      onChange={(e) => setImportCheckedRows((prev) => ({ ...prev, [i]: e.target.checked }))}
                                    />
                                  </td>
                                  <td className="px-2 py-2">{row.workerName}</td>
                                  <td className="px-2 py-2">{row.classificationName}</td>
                                  {importPreview.adpWeeklyTotalsOnly ? (
                                    <>
                                      <td className="px-2 py-2 text-right">{sumSt(row)}</td>
                                      <td className="px-2 py-2 text-right">{sumOt(row)}</td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-2 py-2 text-right">{row.monSt}</td>
                                      <td className="px-2 py-2 text-right">{row.monOt}</td>
                                      <td className="px-2 py-2 text-right">{row.tueSt}</td>
                                      <td className="px-2 py-2 text-right">{row.tueOt}</td>
                                      <td className="px-2 py-2 text-right">{row.wedSt}</td>
                                      <td className="px-2 py-2 text-right">{row.wedOt}</td>
                                      <td className="px-2 py-2 text-right">{row.thuSt}</td>
                                      <td className="px-2 py-2 text-right">{row.thuOt}</td>
                                      <td className="px-2 py-2 text-right">{row.friSt}</td>
                                      <td className="px-2 py-2 text-right">{row.friOt}</td>
                                      <td className="px-2 py-2 text-right">{row.satSt}</td>
                                      <td className="px-2 py-2 text-right">{row.satOt}</td>
                                      <td className="px-2 py-2 text-right">{row.sunSt}</td>
                                      <td className="px-2 py-2 text-right">{row.sunOt}</td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    ) : (
                      <p className="mt-4 text-sm text-text-secondary">No importable entries found in this file.</p>
                    )}

                    {/* Unmatched workers section (D-06, D-10, D-11, D-15) */}
                    {importPreview.unmatched.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-900">Unmatched Workers</h4>
                        <div className="mt-2 space-y-3">
                          {importPreview.unmatched.map((u, i) => {
                            const selectedWorkerId = importRemaps[i] || '';
                            const selectedWorker = projectWorkers.find((w) => w.id === selectedWorkerId);
                            const hasNoClassifications = selectedWorker && selectedWorker.classifications.length === 0;
                            return (
                              <div key={i} className="flex items-start gap-3 rounded border border-border-default p-3">
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{u.csvName}</p>
                                  <p className="text-xs text-text-secondary">
                                    {importPreview.adpWeeklyTotalsOnly
                                      ? `ST: ${sumSt(u.hours)} / OT: ${sumOt(u.hours)}`
                                      : `Total: ${sumSt(u.hours) + sumOt(u.hours)} hrs`}
                                  </p>
                                </div>
                                <div>
                                  <select
                                    className="rounded border border-gray-300 px-2 py-1 text-base"
                                    value={selectedWorkerId}
                                    onChange={(e) => setImportRemaps((prev) => ({ ...prev, [i]: e.target.value }))}
                                  >
                                    <option value="">&mdash; Select worker &mdash;</option>
                                    {projectWorkers.map((w) => (
                                      <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                  </select>
                                  {hasNoClassifications && (
                                    <p className="mt-1 text-xs text-status-violation">
                                      This worker has no classifications. Add one on the Workers page before importing.
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-xs text-text-secondary">
                          Workers not remapped will be skipped. To import a new worker, add them on the Workers page first.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer navigation */}
                  <div className="mt-6 flex justify-between items-center pt-4 border-t border-border-default">
                    <Button variant="ghost" size="md" onClick={() => { setImportStep(1); setImportFile(null); }}>
                      Back
                    </Button>
                    <Button variant="primary" size="md" onClick={() => setImportStep(3)}>
                      Review Import &rarr;
                    </Button>
                  </div>
                </>
              )}

              {importStep === 3 && importPreview && (() => {
                // Compute summary values for display
                const checkedMatched = importPreview.matched.filter((_, i) => importCheckedRows[i]);
                const remappedUnmatched = importPreview.unmatched.filter((_, i) => {
                  const wid = importRemaps[i];
                  if (!wid) return false;
                  const w = projectWorkers.find((pw) => pw.id === wid);
                  return w && w.classifications.length > 0;
                });
                const totalToImport = checkedMatched.length + remappedUnmatched.length;
                const deselectedMatched = importPreview.matched.length - checkedMatched.length;
                const skippedUnmatched = importPreview.unmatched.length - remappedUnmatched.length;
                const totalSkipped = deselectedMatched + skippedUnmatched;
                const providerLabel = PROVIDER_LABELS[importPreview.provider] ?? importPreview.provider;

                return (
                  <>
                    <p className="text-xs text-text-secondary">Step 3 of 3</p>
                    <h3 className="text-xl font-headline font-semibold text-gray-900">
                      Import Payroll — Step 3: Confirm Import
                    </h3>

                    <div className="mt-4 max-h-[70vh] overflow-y-auto">
                      {/* Summary heading (D-07) */}
                      <p className="text-sm">
                        Ready to import <strong>{totalToImport}</strong> entries from {providerLabel}.
                      </p>

                      {/* Worker names list */}
                      {totalToImport > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-sm">
                          {checkedMatched.map((row, i) => (
                            <li key={`m-${i}`}>{row.workerName} — {row.classificationName}</li>
                          ))}
                          {remappedUnmatched.map((u, i) => {
                            const wid = importRemaps[importPreview.unmatched.indexOf(u)];
                            const worker = projectWorkers.find((w) => w.id === wid);
                            return (
                              <li key={`u-${i}`}>
                                {worker?.name ?? u.csvName} (remapped from &ldquo;{u.csvName}&rdquo;)
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {/* Skipped count */}
                      {totalSkipped > 0 && (
                        <p className="mt-3 text-sm text-text-secondary">
                          {totalSkipped} row{totalSkipped !== 1 ? 's' : ''} will be skipped.
                        </p>
                      )}

                      {/* Conflict warning repeat (D-07) */}
                      {importPreview.conflicts.length > 0 && (
                        <Card padding="sm" className="mt-3 border border-status-warning/30 bg-status-warning/10">
                          <p className="text-sm font-semibold text-status-warning">Cannot import — existing entries conflict</p>
                          <p className="mt-1 text-sm text-status-warning">
                            These workers already have manual entries this week:{' '}
                            {importPreview.conflicts.map((c) => c.workerName).join(', ')}.
                            Delete their existing entries on the Payroll Entry page, then re-import.
                          </p>
                        </Card>
                      )}

                      {/* Commit error (D-09) */}
                      {importCommitError && (
                        <p className="mt-3 text-sm text-status-violation">{importCommitError}</p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="mt-6 flex justify-between items-center pt-4 border-t border-border-default">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="md" onClick={() => setImportStep(2)}>
                          Back
                        </Button>
                        <Button variant="ghost" size="md" onClick={closeImportModal}>
                          Discard Import
                        </Button>
                      </div>
                      <Button
                        variant="primary"
                        size="md"
                        disabled={totalToImport === 0 || importCommitMutation.isPending}
                        onClick={() => {
                          setImportCommitError(null);
                          importCommitMutation.mutate();
                        }}
                      >
                        {importCommitMutation.isPending ? 'Importing...' : 'Confirm Import'}
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
