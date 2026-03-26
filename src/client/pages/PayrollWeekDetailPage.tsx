// src/client/pages/PayrollWeekDetailPage.tsx
// Route: /projects/:projectId/payroll/:weekId
import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
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

interface ProjectData {
  id: string;
  state: string;
  name: string;
  cslbLicense: string | null;
  wcPolicyNumber: string | null;
  // Phase 25 — WA fields
  ubiNumber: string | null;
  lniCertificate: string | null;
  wcAccount: string | null;
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

  // WA-specific state — mirrors CA pattern; separate from caGeneratingRef
  const [showWaDisclosure, setShowWaDisclosure] = useState(false);
  const waGeneratingRef = useRef(false);  // MUST be new ref — do not reuse generatingRef or caGeneratingRef

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
  const isCA = projectData?.data?.project?.state === 'CA';
  const isWA = projectData?.data?.project?.state === 'WA';

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
      <div className="max-w-4xl mx-auto">
        {/* Hidden anchor for Blob download — must be outside modal so it persists when modal unmounts */}
        <a ref={hiddenAnchorRef} className="hidden" />

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/projects/${projectId}/payroll`)}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              &larr; Back to Payroll
            </button>
            {week && (
              <h1 className="text-2xl font-headline text-gray-900 flex items-center flex-wrap gap-2">
                Payroll Week #{week.payrollNumber}
                <span className="text-base font-normal text-gray-500">
                  Week Ending {week.weekEndingDate}
                </span>
                {week.amendmentNumber != null && (
                  <Badge variant="warning" className="ml-1">
                    Amendment {week.amendmentNumber}
                  </Badge>
                )}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            {isCA && weekId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCaDownloadClick}
              >
                Download CA A-1-131
              </Button>
            )}
            {isWA && weekId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleWaDownloadClick}
              >
                Download WA F700-065-000
              </Button>
            )}
          </div>
        </div>

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
                    <th className="px-5 py-3">Hours (ST/OT)</th>
                    <th className="px-5 py-3">Base Rate</th>
                    <th className="px-5 py-3">Fringe Rate</th>
                    <th className="px-5 py-3">Gross Wages</th>
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
                        <td className="px-5 py-3 text-gray-600">{row.tradeDescription}</td>
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
                  <span className="text-sm text-gray-500">WH-347 not yet submitted to agency.</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowSubmitForm(true)}>
                  Mark as Submitted
                </Button>
              </div>
            )}
          </Card>
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
      </div>
    </Layout>
  );
}
