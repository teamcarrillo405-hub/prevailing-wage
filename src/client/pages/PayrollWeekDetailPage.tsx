// src/client/pages/PayrollWeekDetailPage.tsx
// Route: /projects/:projectId/payroll/:weekId
import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck, ExternalLink, Info } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { HelpCallout } from '../components/ui/HelpCallout';
import { TermTooltip } from '../components/ui/TermTooltip';
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
  violationType: 'under-wage' | 'cwhssa-ot';
  expected: number;
  actual: number;
  delta: number;
  entryId: string;
}

interface WeekViolation {
  violationType: 'apprentice-ratio';
  detail: string;
  apprenticeHours: number;
  journeyworkerHours: number;
  maxAllowedApprenticeHours: number;
}

interface ComplianceResult {
  weekId: string;
  projectId: string;
  violations: ComplianceViolation[];
  weekViolations: WeekViolation[];
  hasViolations: boolean;
  certProperPayment: boolean;
  certAccuratePayroll: boolean;
}

// ── Payroll Import types (Phase 36 — mirrors src/server/services/importTypes.ts) ──

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

function violationLabel(type: 'under-wage' | 'cwhssa-ot'): string {
  if (type === 'under-wage') return 'Under-Wage';
  return 'CWHSSA OT Error';
}

export function PayrollWeekDetailPage() {
  const { projectId, weekId } = useParams<{ projectId: string; weekId: string }>();
  const navigate = useNavigate();

  const [generating, setGenerating] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const generatingRef = useRef(false);
  const amendingRef = useRef(false);
  const hiddenAnchorRef = useRef<HTMLAnchorElement>(null);

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
    IL: { downloadLabel: 'Download IL Certified Transcript', route: 'il-transcript' },
    TX: { downloadLabel: 'Download WH-347 (TX)', route: 'wh347' },
    FL: { downloadLabel: 'Download WH-347 (FL)', route: 'wh347' },
    MA: { downloadLabel: 'Download MA DLS Payroll', route: 'ma-cpr' },
    NJ: { downloadLabel: 'Download NJ MW-562', route: 'nj-mw562' },
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

  const isLoading = weekLoading || complianceLoading;
  const isError = weekError || complianceError;

  const week = weekData?.week;
  const entries = weekData?.entries ?? [];

  // Build a set of entry IDs that have violations for quick lookup
  const violationsByEntryId = new Map<string, ComplianceViolation>();
  if (complianceData?.violations) {
    for (const v of complianceData.violations) {
      violationsByEntryId.set(v.entryId, v);
    }
  }

  function handleDownloadClick() {
    if (complianceData?.hasViolations) {
      setShowPreflight(true);
    } else {
      handleConfirmedDownload();
    }
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
    // ALWAYS show disclosure — persistent regulatory notice, not conditional on violations
    setShowCaDisclosure(true);
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
      <div className="max-w-4xl mx-auto pb-24">
        {/* Hidden anchor for Blob download — must be outside modal so it persists when modal unmounts */}
        <a ref={hiddenAnchorRef} className="hidden" />

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
        </div>
        <div className="sticky bottom-0 z-10 bg-white border-t border-brand-navy/10 px-6 py-3 -mx-6 mt-8">
          <div className="flex gap-2 flex-wrap items-center">
            {weekId && week && !week.isFinal && (
              <Link
                to={`/projects/${projectId}/payroll/${weekId}/edit`}
                className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-brand-gold text-nav-dark hover:bg-brand-gold/90 transition-colors"
              >
                Edit hours
              </Link>
            )}
            {weekId && (
              <Button
                variant="secondary"
                size="sm"
                disabled={generating}
                onClick={handleDownloadClick}
              >
                {generating ? 'Generating...' : 'Download WH-347'}
              </Button>
            )}
            {/* STATE_FORMS registry-driven primary download button (STATE-12, NFR-06) */}
            {stateFormConfig && weekId && (
              <Button
                variant="secondary"
                size="sm"
                disabled={generating}
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setEcprStep(1); setShowEcprModal(true); }}
              >
                Download CA eCPR XML
              </Button>
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

        {/* Loading state */}
        {isLoading && <LoadingSpinner />}

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

        {/* Entries table */}
        {!isLoading && !isError && entries.length > 0 && (
          <Card padding="none" className="mb-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Payroll Entries</h2>
            </div>
            <div className="overflow-x-auto">
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
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((row) => {
                    const e = row.entry;
                    const totalSt =
                      e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
                    const totalOt =
                      e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
                    const violation = violationsByEntryId.get(e.id);

                    return (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{row.workerName}</td>
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
                                className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
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
                          ${e.baseRateSnapshot.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          ${e.fringeRateSnapshot.toFixed(2)}
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
                        <td className="px-5 py-3">
                          {violation ? (
                            <Badge variant="violation">{violationLabel(violation.violationType)}</Badge>
                          ) : (
                            <Badge variant="compliant">OK</Badge>
                          )}
                        </td>
                      </tr>
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
            </div>
          </Card>
        )}

        {/* Empty entries state */}
        {!isLoading && !isError && entries.length === 0 && (
          <Card padding="none" className="mb-6 py-12 text-center">
            <p className="text-sm text-gray-500">No payroll entries for this week.</p>
          </Card>
        )}

        {/* Compliance violations panel */}
        {!isLoading && !isError && (
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
                      </span>
                    </li>
                  ))}
                  {complianceData.weekViolations?.map((wv, i) => (
                    <li key={`week-${i}`} className="flex items-start gap-2 text-sm text-gray-700">
                      <Badge variant="violation" className="mt-0.5 shrink-0">
                        Apprentice Ratio
                      </Badge>
                      <span>{wv.detail}</span>
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
          </Card>
        )}

        {/* Submission status panel */}
        {!isLoading && !isError && week && (
          <Card padding="none" className="mt-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Submission Status</h2>
            </div>
            {week.submittedAt ? (
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="compliant">Submitted</Badge>
                  <span className="text-sm text-gray-700">
                    {week.submittedAt} — {week.submittedTo}
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
                <div className="flex gap-3 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Submission Date</label>
                    <input
                      type="date"
                      value={submitDate}
                      onChange={(e) => setSubmitDate(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-brand-gold focus:outline-none"
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
                    disabled={!submitDate || !submitAgency.trim() || submitMutation.isPending}
                    onClick={() => submitMutation.mutate()}
                  >
                    {submitMutation.isPending ? 'Saving...' : 'Mark as Submitted'}
                  </Button>
                </div>
                {submitMutation.isError && (
                  <p className="text-xs text-red-600">Failed to submit. Please try again.</p>
                )}
              </div>
            ) : (
              <div className="px-5 py-4 flex items-center justify-between">
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
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Check / Direct Deposit Number</label>
                      <input
                        type="text"
                        value={ecprCheckNum}
                        onChange={(e) => setEcprCheckNum(e.target.value)}
                        maxLength={20}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
                      onClick={handleEcprXmlDownload}
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
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-gold focus:outline-hidden"
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
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none"
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
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none"
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

        {/* Preflight compliance modal */}
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
            <Card className="max-w-lg w-full mx-4">
              <h2 className="text-base font-headline text-gray-900 mb-3">
                Compliance Violations Detected
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                This payroll week has the following violations. You may still download the WH-347,
                but these issues will be reflected in the certification checkboxes.
              </p>
              <ul className="space-y-2 mb-6">
                {complianceData!.violations.map((v, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <Badge variant="violation" className="mt-0.5 shrink-0">
                      {violationLabel(v.violationType)}
                    </Badge>
                    <span>
                      <span className="font-medium">{v.workerName}</span>
                      {': delta $'}{v.delta.toFixed(2)}
                    </span>
                  </li>
                ))}
                {complianceData!.weekViolations?.map((wv, i) => (
                  <li key={`week-${i}`} className="flex items-start gap-2 text-sm text-gray-700">
                    <Badge variant="violation" className="mt-0.5 shrink-0">
                      Apprentice Ratio
                    </Badge>
                    <span>{wv.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  autoFocus
                  onClick={() => setShowPreflight(false)}
                >
                  Cancel
                </Button>
                <Button variant="secondary" size="sm" onClick={handleConfirmedDownload}>
                  Download Anyway
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
                                  className="w-full rounded border border-border-default px-2 py-1.5 text-sm"
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
                                    className="rounded border border-gray-300 px-2 py-1 text-sm"
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
