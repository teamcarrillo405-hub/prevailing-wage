// src/client/pages/PayrollListPage.tsx
// Route: /projects/:projectId/payroll
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

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

  const { data, isLoading, isError } = useQuery({
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
      const message = err instanceof Error ? err.message : 'Preview failed';
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
      const message = err instanceof Error ? err.message : 'Copy failed';
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
          body="Each week records your workers' hours and pay. Create a new payroll week for each reporting period. Download the WH-347 when all entries are complete."
        />

        {isLoading && <LoadingSpinner />}

        {isError && (
          <p className="text-sm text-red-600">
            Failed to load payroll weeks.
          </p>
        )}

        {!isLoading && !isError && weeks.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm">No payroll weeks yet.</p>
            <Link
              to={`/projects/${projectId}/payroll/new`}
              className="mt-3 inline-block text-sm font-medium text-gray-900 underline"
            >
              Create the first week
            </Link>
          </div>
        )}

        {weeks.length > 0 && (
          <Card padding="none" className="divide-y divide-gray-100">
            {weeks.map((week) => (
              <div key={week.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Week Ending {week.weekEndingDate}
                  </span>
                  <span className="ml-3 text-xs text-gray-500">
                    Payroll #{week.payrollNumber}
                  </span>
                  {week.submittedAt ? (
                    <Badge variant="compliant" className="ml-2">Submitted</Badge>
                  ) : (
                    <Badge variant="neutral" className="ml-2">Not Submitted</Badge>
                  )}
                  {week.amendmentNumber != null && (
                    <Badge variant="warning" className="ml-2">Amendment {week.amendmentNumber}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/api/export/wh347/${week.id}`}
                    className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded hover:bg-gray-800"
                  >
                    Download WH-347
                  </a>
                  <Link
                    to={`/projects/${projectId}/payroll/${week.id}`}
                    className="text-xs text-gray-500 hover:text-gray-900 underline"
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
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">

              {/* Step: choose */}
              {modalStep === 'choose' && (
                <>
                  <h2 className="text-base font-headline text-gray-900 mb-3">New Payroll Week</h2>
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
                  <h2 className="text-base font-headline text-gray-900 mb-3">Copy Previous Week</h2>
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
                      <label className="block text-xs text-gray-500 mb-1">Payroll Number</label>
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
                    <button
                      onClick={handlePreview}
                      disabled={isCopying}
                      className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCopying ? 'Loading...' : 'Preview Copy'}
                    </button>
                  </div>
                </>
              )}

              {/* Step: preview */}
              {modalStep === 'preview' && previewResult && (
                <>
                  <h2 className="text-base font-headline text-gray-900 mb-3">Preview Copy</h2>
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
                    <p className="text-xs text-red-600 mb-3">{copyError}</p>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowModal(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmCopy}
                      disabled={isCopying || previewResult.copied.length === 0}
                      className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCopying ? 'Copying...' : 'Confirm Copy'}
                    </button>
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
