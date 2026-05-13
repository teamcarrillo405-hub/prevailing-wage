// src/client/pages/PayrollListPage.tsx
// Route: /projects/:projectId/payroll
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileCheck, FileText, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PayrollListSkeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';
import { EmptyState } from '../components/ui/EmptyState';
import { PayrollEmptyIllustration } from '../components/illustrations/EmptyIllustrations';
import { TermTooltip } from '../components/ui/TermTooltip';

const WH347_DEF = "The Department of Labor's official certified payroll form. Contractors must submit it weekly to the contracting officer as proof that workers were paid the correct prevailing wage.";
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useToast } from '../contexts/ToastContext';

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
  totalGross: string | null;
  totalNet: string | null;
  workerCount: number;
}

interface PayrollWeeksResponse {
  weeks: PayrollWeek[];
}

interface CopiedEntry {
  workerId: string;
  workerName: string;
  classificationId: string;
  tradeDescription: string;
  baseRate: number;
  fringeRate: number;
}

interface SkippedEntry {
  workerId: string;
  workerName: string;
  classificationId: string;
  tradeDescription: string;
  reason: 'worker-inactive' | 'rate-lookup-failed' | 'no-wd-found';
}

interface CopyPreviewResult {
  weekId: string | null;
  copied: CopiedEntry[];
  skipped: SkippedEntry[];
}

function formatSkipReason(reason: 'worker-inactive' | 'rate-lookup-failed' | 'no-wd-found'): string {
  if (reason === 'worker-inactive') return 'Worker is no longer active';
  if (reason === 'rate-lookup-failed') return 'Wage rate not found in current determination';
  return 'No wage determination found for this project';
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getWeekBadge(week: PayrollWeek): React.ReactNode {
  if (week.submittedAt) {
    return <Badge variant="neutral">Submitted</Badge>;
  }
  if (week.isFinal) {
    return <Badge variant="compliant">Final</Badge>;
  }
  if (week.workerCount > 0) {
    return <Badge variant="warning">In Progress</Badge>;
  }
  return <Badge variant="neutral">Draft</Badge>;
}

function openOnEnterOrSpace(event: React.KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  action();
}

export function PayrollListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<'choose' | 'configure' | 'preview'>('choose');
  const [sourceWeekId, setSourceWeekId] = useState<string>('');
  const [weekEndingDate, setWeekEndingDate] = useState('');
  const [payrollNumber, setPayrollNumber] = useState(1);
  const [previewResult, setPreviewResult] = useState<CopyPreviewResult | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const copyingRef = useRef(false); // synchronous double-click guard
  const modalRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['payroll-weeks', projectId],
    queryFn: () =>
      api.get<PayrollWeeksResponse>(`/payroll/projects/${projectId}/weeks`),
    enabled: !!projectId,
  });

  const weeks = data?.weeks ?? [];

  // Escape key listener for modal
  useEffect(() => {
    if (!showModal) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowModal(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showModal]);

  // Focus management: move focus to first focusable element when modal opens
  useEffect(() => {
    if (!showModal) return;
    const first = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }, [showModal, modalStep]);

  function handleNewWeekClick() {
    if (weeks.length === 0) {
      navigate(`/projects/${projectId}/payroll/new`);
    } else {
      setShowModal(true);
      setModalStep('choose');
      setCopyError(null);
      setPreviewResult(null);
    }
  }

  function handleChooseCopy() {
    const sourceWeek = weeks[0];
    setSourceWeekId(sourceWeek.id);
    setPayrollNumber(Math.max(...weeks.map((w) => w.payrollNumber)) + 1);
    setWeekEndingDate(addDays(sourceWeek.weekEndingDate, 7));
    setModalStep('configure');
  }

  function handleSourceWeekChange(weekId: string) {
    setSourceWeekId(weekId);
    const selected = weeks.find((w) => w.id === weekId);
    if (selected) {
      setWeekEndingDate(addDays(selected.weekEndingDate, 7));
    }
  }

  async function handlePreview() {
    if (copyingRef.current) return;
    copyingRef.current = true;
    setIsCopying(true);
    setCopyError(null);
    try {
      const result = await api.post<CopyPreviewResult>('/payroll/weeks/copy', {
        sourceWeekId,
        weekEndingDate,
        payrollNumber,
        preview: true,
      });
      setPreviewResult(result);
      setModalStep('preview');
    } catch (err: unknown) {
      const message = err instanceof Error && err.message
        ? err.message
        : 'Could not copy that payroll week — the source week may have been modified. Try refreshing and copying again.';
      setCopyError(message);
    } finally {
      setIsCopying(false);
      copyingRef.current = false;
    }
  }

  async function handleConfirmCopy() {
    if (copyingRef.current) return;
    copyingRef.current = true;
    setIsCopying(true);
    setCopyError(null);
    try {
      const result = await api.post<CopyPreviewResult>('/payroll/weeks/copy', {
        sourceWeekId,
        weekEndingDate,
        payrollNumber,
        preview: false,
      });
      setShowModal(false);
      navigate(`/projects/${projectId}/payroll/${result.weekId}`);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message
        ? err.message
        : 'Could not copy that payroll week — the source week may have been modified. Try refreshing and copying again.';
      setCopyError(message);
    } finally {
      setIsCopying(false);
      copyingRef.current = false;
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4 inline-block"
        >
          &larr; Back to Project
        </button>

        <PageHeader
          title="Payroll"
        />

        <HelpCallout
          icon={FileCheck}
          title="Work one week at a time"
          body={<>Fastest path: copy the prior week when the crew is similar, or start fresh when the roster changed. After hours and deductions are entered, clear blockers, then download the <TermTooltip term="WH-347" definition={WH347_DEF} /> and any state forms.</>}
        />

        {isLoading && <PayrollListSkeleton />}

        {isError && (
          <div className="text-center py-12">
            <p className="text-red-600 text-sm mb-4">Failed to load payroll weeks.</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center justify-center font-semibold rounded-sm text-sm px-4 py-2.5 bg-transparent text-brand-gold border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !isError && weeks.length === 0 && (
          <EmptyState
            illustration={<PayrollEmptyIllustration />}
            heading="No payroll weeks yet"
            message="Create your first payroll week to begin tracking prevailing wage compliance."
            action={
              <Button onClick={() => navigate(`/projects/${projectId}/payroll/new`)}>
                Start First Payroll Week
              </Button>
            }
          />
        )}

        {weeks.length > 0 && (
          <Card padding="none" className="shadow-card-elevated overflow-hidden">
            <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
              <h2 className="font-headline text-base text-text-primary">Payroll Weeks</h2>
              <button
                onClick={handleNewWeekClick}
                className="bg-brand-gold text-black font-semibold hover:bg-brand-gold/90 border border-transparent inline-flex items-center justify-center font-semibold rounded-sm transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 text-sm px-4 py-2"
              >
                + New Week
              </button>
            </div>
            <div className="p-4 space-y-2">
              {weeks.map((week) => (
                <Card key={week.id} padding="sm" className="shadow-card-elevated hover:shadow-card-hover cursor-pointer transition-shadow duration-150">
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/projects/${projectId}/payroll/${week.id}`)}
                    onKeyDown={(event) => openOnEnterOrSpace(event, () => navigate(`/projects/${projectId}/payroll/${week.id}`))}
                    className="block min-h-[44px] flex items-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 rounded-sm"
                  >
                    <div className="flex items-center justify-between gap-4 w-full">
                      <div className="min-w-0">
                        <p className="font-headline text-sm text-text-primary">
                          Week Ending {week.weekEndingDate} — Payroll #{week.payrollNumber}
                          {week.amendmentNumber != null ? (
                            <span className="text-text-secondary ml-1">
                              (Amendment {week.amendmentNumber})
                              <TermTooltip
                                term="Amendment"
                                definition="A corrected re-filing of a previously submitted certified payroll. Required when you discover errors in a submitted WH-347. The amendment number increments with each correction."
                                className="ml-1"
                              />
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {week.workerCount} worker{week.workerCount !== 1 ? 's' : ''}
                          {week.totalGross != null ? ` · $${Number(week.totalGross).toLocaleString()} gross` : ' · No payroll entered'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getWeekBadge(week)}
                        {Number(week.workerCount ?? 0) > 0 && week.totalGross != null ? (
                          <a
                            href={`/api/export/wh347/${week.id}`}
                            className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-brand-gold text-black hover:bg-brand-gold/90 border border-transparent transition-all duration-150"
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.success('WH-347 downloading - submit to your contracting officer within 7 days of the week ending date.');
                            }}
                          >
                            WH-347
                          </a>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-gray-100 text-gray-400 border border-gray-200"
                            title="Add payroll entries before downloading WH-347."
                          >
                            WH-347
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-text-secondary" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {/* Copy Previous Week Modal */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowModal(false);
            }}
          >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="copy-modal-title"
              className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6"
            >

              {/* Step indicator */}
              {(() => {
                const currentStep = modalStep === 'choose' ? 1 : modalStep === 'configure' ? 2 : 3;
                return (
                  <div className="flex items-center gap-1.5 mb-4">
                    {[1, 2, 3].map(n => (
                      <div key={n} className={`h-1.5 rounded-full transition-all ${n <= currentStep ? 'bg-brand-gold w-6' : 'bg-gray-200 w-4'}`} />
                    ))}
                    <span className="text-xs text-gray-500 ml-1">Step {currentStep} of 3</span>
                  </div>
                );
              })()}

              {/* Step: choose */}
              {modalStep === 'choose' && (
                <>
                  <h2 id="copy-modal-title" className="text-base font-headline text-gray-900 mb-3">New Payroll Week</h2>
                  <p className="text-sm text-gray-600 mb-5">
                    How would you like to create this week?
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        navigate(`/projects/${projectId}/payroll/new`);
                      }}
                      className="w-full text-left border border-gray-200 rounded px-4 py-3 hover:border-gray-400 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900 block">Start Fresh</span>
                      <span className="text-xs text-gray-500">Use this when the crew, rates, or classifications changed materially</span>
                    </button>
                    <button
                      onClick={handleChooseCopy}
                      className="w-full text-left border border-gray-200 rounded px-4 py-3 hover:border-gray-400 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900 block">Copy Previous Week <span className="text-brand-gold">(recommended)</span></span>
                      <span className="text-xs text-gray-500">Pre-fill the roster and hours, then adjust only what changed</span>
                    </button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setShowModal(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {/* Step: configure */}
              {modalStep === 'configure' && (
                <>
                  <h2 id="copy-modal-title" className="text-base font-headline text-gray-900 mb-3">Copy Previous Week</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Select a source week and confirm the new week details.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Source Week</label>
                      <select
                        value={sourceWeekId}
                        onChange={(e) => handleSourceWeekChange(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-base min-h-[44px] w-full focus:border-brand-gold focus:outline-none"
                      >
                        {weeks.map((w) => (
                          <option key={w.id} value={w.id}>
                            Week Ending {w.weekEndingDate} (Payroll #{w.payrollNumber})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Payroll Number <TermTooltip term="Payroll Number" definition="A sequential number assigned to each certified payroll submission for a project. The first submission is #1; each subsequent week increments by 1. Must match the number on your WH-347 form." />
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={payrollNumber}
                        onChange={(e) => setPayrollNumber(Number(e.target.value))}
                        className="border border-gray-300 rounded px-3 py-2 text-base min-h-[44px] w-full focus:border-brand-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Week Ending Date</label>
                      <input
                        type="date"
                        value={weekEndingDate}
                        onChange={(e) => setWeekEndingDate(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-base min-h-[44px] w-full focus:border-brand-gold focus:outline-none"
                      />
                    </div>
                    {copyError && (
                      <p className="text-xs text-red-600">{copyError}</p>
                    )}
                  </div>
                  <div className="mt-5 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowModal(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <Button onClick={handlePreview} disabled={isCopying}>
                      {isCopying ? 'Loading...' : 'Preview Copy'}
                    </Button>
                  </div>
                </>
              )}

              {/* Step: preview */}
              {modalStep === 'preview' && previewResult && (
                <>
                  <h2 id="copy-modal-title" className="text-base font-headline text-gray-900 mb-3">Preview Copy</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    {previewResult.copied.length} {previewResult.copied.length === 1 ? 'entry' : 'entries'} will be copied with current wage rates.
                  </p>

                  {previewResult.skipped.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
                      <p className="text-sm font-medium text-amber-800 mb-2">
                        {previewResult.skipped.length} {previewResult.skipped.length === 1 ? 'entry' : 'entries'} will be skipped:
                      </p>
                      <ul className="space-y-1">
                        {previewResult.skipped.map((s) => (
                          <li key={s.workerId} className="text-xs text-amber-700">
                            <span className="font-medium">{s.workerName}</span>
                            {' — '}{s.tradeDescription}
                            {': '}
                            <span className="text-amber-700">{formatSkipReason(s.reason)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {previewResult.copied.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
                      <p className="text-sm text-amber-800">
                        No entries can be copied from this week. All workers were skipped.
                      </p>
                    </div>
                  )}

                  {copyError && (
                    <div className="flex items-center gap-3 mb-3">
                      <p className="text-xs text-red-600">{copyError}</p>
                      <Button variant="secondary" size="sm" onClick={handlePreview} disabled={isCopying}>
                        Try Again
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowModal(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <Button onClick={handleConfirmCopy} disabled={isCopying || previewResult.copied.length === 0}>
                      {isCopying ? 'Copying...' : 'Confirm Copy'}
                    </Button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
