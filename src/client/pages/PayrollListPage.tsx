// src/client/pages/PayrollListPage.tsx
// Route: /projects/:projectId/payroll
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileCheck, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PayrollListSkeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';
import { EmptyState } from '../components/ui/EmptyState';
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
          title="Payroll Weeks"
          action={
            <button
              onClick={handleNewWeekClick}
              className="bg-brand-gold text-nav-dark font-semibold hover:bg-brand-gold/90 border border-transparent inline-flex items-center justify-center font-semibold rounded-sm transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 text-sm px-4 py-2"
            >
              + New Week
            </button>
          }
        />

        <HelpCallout
          icon={FileCheck}
          title="Your Payroll Weeks"
          body={<>Each week records your workers' hours and pay. Create a new payroll week for each reporting period. Download the <TermTooltip term="WH-347" definition={WH347_DEF} /> when all entries are complete.</>}
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
            icon={FileText}
            heading="No payroll weeks yet"
            message="Start your first payroll week to begin compliance tracking and generate certified payroll reports. You must add workers to the project before entering payroll."
            action={
              <Link
                to={`/projects/${projectId}/payroll/new`}
                className="inline-flex items-center justify-center font-semibold rounded-sm transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 bg-brand-gold text-nav-dark hover:bg-brand-gold/90 border border-transparent text-sm px-4 py-2"
              >
                Create First Payroll Week
              </Link>
            }
          />
        )}

        {weeks.length > 0 && (
          <Card padding="none" className="divide-y divide-gray-100 shadow-card-elevated">
            {weeks.map((week) => (
              <div key={week.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-3 gap-3">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Week Ending {week.weekEndingDate}
                  </span>
                  <span className="ml-3 text-xs text-gray-500">
                    Payroll #{week.payrollNumber}
                  </span>
                  {week.submittedAt ? (
                    <Badge variant="neutral" className="ml-2 bg-amber-100 text-amber-800 border-amber-300 font-medium">Submitted</Badge>
                  ) : week.isFinal ? (
                    <Badge variant="neutral" className="ml-2 bg-emerald-100 text-emerald-800 border-emerald-300 font-medium">Final</Badge>
                  ) : (
                    <Badge variant="neutral" className="ml-2">Draft</Badge>
                  )}
                  {week.amendmentNumber != null && (
                    <>
                      <Badge variant="neutral" className="ml-2 bg-blue-100 text-blue-800 border-blue-300 font-medium">Amendment {week.amendmentNumber}</Badge>
                      <TermTooltip
                        term="Amendment"
                        definition="A corrected re-filing of a previously submitted certified payroll. Required when you discover errors in a submitted WH-347. The amendment number increments with each correction."
                        className="ml-1"
                      />
                    </>
                  )}
                  {week.workerCount > 0 && (
                    <span className="ml-3 text-xs text-gray-400">
                      {week.workerCount} worker{week.workerCount !== 1 ? 's' : ''}
                      {week.totalGross != null && ` · $${parseFloat(week.totalGross).toFixed(2)} gross`}
                      {week.totalNet != null && ` · $${parseFloat(week.totalNet).toFixed(2)} net`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <a
                    href={`/api/export/wh347/${week.id}`}
                    className="inline-flex items-center justify-center text-xs px-3 py-2 min-h-[44px] sm:min-h-0 font-semibold rounded-sm bg-brand-gold text-nav-dark hover:bg-brand-gold/90 border border-transparent transition-all duration-150"
                    onClick={() => toast.success('WH-347 downloading — submit to your contracting officer within 7 days of the week ending date.')}
                  >
                    Download WH-347
                  </a>
                  <Link
                    to={`/projects/${projectId}/payroll/${week.id}`}
                    className="text-xs text-gray-500 hover:text-gray-900 underline min-h-[44px] sm:min-h-0 flex items-center"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
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
                      <span className="text-xs text-gray-500">Create a new week with no pre-filled entries</span>
                    </button>
                    <button
                      onClick={handleChooseCopy}
                      className="w-full text-left border border-gray-200 rounded px-4 py-3 hover:border-gray-400 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900 block">Copy Previous Week</span>
                      <span className="text-xs text-gray-500">Pre-fill entries from a previous week with current wage rates</span>
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
                        className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:border-brand-gold focus:outline-none"
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
                        className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:border-brand-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Week Ending Date</label>
                      <input
                        type="date"
                        value={weekEndingDate}
                        onChange={(e) => setWeekEndingDate(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:border-brand-gold focus:outline-none"
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
