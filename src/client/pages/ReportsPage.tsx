// src/client/pages/ReportsPage.tsx
import { Fragment, useState, useEffect, type KeyboardEvent } from 'react';
import { cn } from '../lib/utils';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, FileText, TrendingUp, PieChart, Download, Printer, Shield, HardHat } from 'lucide-react';
import { ApprenticeshipDashboard } from '../components/ApprenticeshipDashboard';
import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader';
import { ReportsSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ReportsEmptyIllustration } from '../components/illustrations/EmptyIllustrations';
import { TermTooltip } from '../components/ui/TermTooltip';

// ---- Interfaces from Plan 02 shapes ----

interface FringeSummaryRow {
  workerId: string;
  workerName: string;
  totalSt: number;
  totalOt: number;
  totalHours: number;
  totalFringeCredits: number;
  weekCount: number;
}

interface WorkerPayHistoryRow {
  payrollWeekId: string;
  weekNumber: number;
  weekEndingDate: string;
  totalSt: number;
  totalOt: number;
  grossWages: number | null;
  deductions: number | null;
  netPay: number | null;
  baseRateSnapshot: number | null;
  fringeRateSnapshot: number | null;
}

interface FringeBreakdownRow {
  fundType: 'healthWelfare' | 'pension' | 'vacation' | 'training';
  unionLocal: string;
  classificationLevel: 'journeyworker' | 'apprentice' | 'foreman';
  totalAmount: number;
  workerCount: number;
}

interface Worker {
  id: string;
  name: string;
}

// ---- Helpers ----

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'Not set';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function toggleOnEnterOrSpace(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  action();
}

// ---- Report card wrapper ----

interface ReportCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}

function ReportCard({ icon, title, description, active, onClick }: ReportCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex min-h-[96px] w-full items-stretch rounded-sm border p-3 text-left transition-all duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2',
        active
          ? 'border-brand-gold bg-brand-gold/10'
          : 'border-border-default bg-white hover:border-brand-gold/60 hover:bg-gray-50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border',
          active ? 'border-brand-gold bg-brand-gold text-black' : 'border-border-subtle bg-surface-muted text-text-secondary'
        )}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-headline text-sm text-text-primary">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">{description}</p>
        </div>
      </div>
    </button>
  );
}

// ---- Component ----

// ── Phase 104: Pivot row shape (REPT-06) ─────────────────────────────────────

interface PivotRow {
  weekEndingDate: string;
  tradeCode: string;
  tradeDescription: string;
  laborType: string;
  totalStraightHours: number;
  totalOvertimeHours: number;
  totalDoubleHours: number;
  totalHours: number;
  workerCount: number;
  grossWages: number;
}

// Phase 109 (DBE-09): DBE Participation result type
interface DbeClassificationBucket {
  hours: number;
  pct: number;
}

interface DbeParticipationResult {
  projectId: string;
  totalHours: number;
  byClassification: {
    dbe:         DbeClassificationBucket;
    mbe:         DbeClassificationBucket;
    wbe:         DbeClassificationBucket;
    sdvosb:      DbeClassificationBucket;
    uncertified: DbeClassificationBucket;
  };
  byWeek: Array<{ weekEndingDate: string; totalHours: number; certifiedHours: number; pct: number }>;
}

export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<'fringe' | 'payHistory' | 'fringeBreakdown' | 'dbeParticipation' | 'apprenticeship'>('fringe');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Phase 104 — Hours pivot query (REPT-06)
  const pivotQuery = useQuery({
    queryKey: ['hoursPivot', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${projectId}/hours-pivot`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load pivot data');
      return res.json() as Promise<{ pivot: PivotRow[] }>;
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });

  // Workers list for the pay history selector
  const { data: workersData } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/workers`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch workers');
      return res.json() as Promise<{ data: { workers: Worker[] } }>;
    },
    staleTime: 60_000,
    enabled: !!projectId,
  });

  const workers = workersData?.data?.workers ?? [];

  // Default to first worker when list loads
  useEffect(() => {
    if (workers.length > 0 && !selectedWorkerId) {
      setSelectedWorkerId(workers[0].id);
    }
  }, [workers, selectedWorkerId]);

  // Fringe summary query
  const {
    data: fringeData,
    isLoading: fringeLoading,
    error: fringeError,
  } = useQuery({
    queryKey: ['fringe-summary', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${projectId}/fringe-summary`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch fringe summary');
      return res.json() as Promise<{ rows: FringeSummaryRow[] }>;
    },
    staleTime: 60_000,
    enabled: !!projectId,
  });

  const fringeRows = fringeData?.rows ?? [];

  // Pay history query — only runs when a worker is selected
  const {
    data: payHistoryData,
    isLoading: payHistoryLoading,
    error: payHistoryError,
  } = useQuery({
    queryKey: ['pay-history', projectId, selectedWorkerId],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/${projectId}/worker/${selectedWorkerId}/pay-history`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch pay history');
      return res.json() as Promise<{ rows: WorkerPayHistoryRow[] }>;
    },
    staleTime: 60_000,
    enabled: !!projectId && !!selectedWorkerId,
  });

  const payHistoryRows = payHistoryData?.rows ?? [];

  // Fringe breakdown query — RPT-03
  const {
    data: fringeBreakdownData,
    isLoading: fringeBreakdownLoading,
    error: fringeBreakdownError,
  } = useQuery({
    queryKey: ['fringe-breakdown', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${projectId}/fringe-breakdown`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch fringe breakdown');
      return res.json() as Promise<{ rows: FringeBreakdownRow[] }>;
    },
    staleTime: 60_000,
    enabled: !!projectId,
  });

  const fringeBreakdownRows = fringeBreakdownData?.rows ?? [];

  // Phase 109 (DBE-09): DBE Participation query — lazy-load when tab is active
  const {
    data: dbeData,
    isLoading: dbeLoading,
  } = useQuery({
    queryKey: ['dbe-participation', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${projectId}/dbe-participation`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch DBE participation data');
      return res.json() as Promise<{ data: DbeParticipationResult }>;
    },
    staleTime: 60_000,
    enabled: !!projectId && activeTab === 'dbeParticipation',
  });
  const dbe = dbeData?.data;

  function handlePrint() {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 200);
  }

  const REPORT_CARDS = [
    {
      key: 'fringe' as const,
      group: 'Payroll review',
      icon: <FileText className="w-4 h-4" />,
      title: 'Fringe Benefit Summary',
      description: 'Total fringe credits earned per worker across all payroll weeks — ST hours, OT hours, and cumulative fringe totals.',
    },
    {
      key: 'payHistory' as const,
      group: 'Payroll review',
      icon: <TrendingUp className="w-4 h-4" />,
      title: 'Pay History',
      description: 'Week-by-week pay detail for a selected worker: hours, base rate, fringe rate, gross wages, deductions, and net pay.',
    },
    {
      key: 'fringeBreakdown' as const,
      group: 'Deductions & fringes',
      icon: <PieChart className="w-4 h-4" />,
      title: 'Fringe Breakdown',
      description: 'Fringe contributions pivoted by fund type (H&W, Pension, Vacation, Training) and classification level.',
    },
    {
      key: 'dbeParticipation' as const,
      group: 'Agency reporting',
      icon: <Shield className="w-4 h-4" />,
      title: 'DBE Participation',
      description: 'DBE/MBE/WBE/SDVOSB hours as a percentage of total project hours — DOT DBE program reporting.',
    },
    {
      key: 'apprenticeship' as const,
      group: 'Agency reporting',
      icon: <HardHat className="w-4 h-4" />,
      title: 'Apprenticeship',
      description: 'Per-trade apprenticeship ratios, IRA/IIJA 15% compliance check, and 12-week trend.',
    },
  ];
  const totalFringeCredits = fringeRows.reduce((sum, row) => sum + row.totalFringeCredits, 0);
  const totalPivotHours = pivotQuery.data?.pivot.reduce((sum, row) => sum + row.totalHours, 0) ?? 0;
  const totalGrossWages = pivotQuery.data?.pivot.reduce((sum, row) => sum + row.grossWages, 0) ?? 0;
  const activeReport = REPORT_CARDS.find((card) => card.key === activeTab) ?? REPORT_CARDS[0];

  return (
    <>
      <style>{`
        @media print {
          /* Hide navigation, tab chrome, and interactive controls */
          nav { display: none !important; }
          .print-hidden { display: none !important; }

          /* Allow tables to break across pages with header repeat */
          .overflow-x-auto { overflow: visible !important; }
          table { width: 100% !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          tbody tr { page-break-inside: avoid; }

          /* Remove ink-wasting alternating row backgrounds */
          .bg-gray-50 { background-color: white !important; }

          /* Consistent column widths */
          th, td { white-space: nowrap; padding: 6px 12px !important; }

          /* Remove rounded borders that clip on print */
          .rounded-lg { border-radius: 0 !important; }

          /* Reduce page margins for more content area */
          @page { margin: 0.5in; }
        }
      `}</style>
      <Layout>
      <div className="w-full space-y-6">

        {/* Page header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <PageHeader
            title="Review & Forms"
            subtitle="Review payroll totals, worker pay history, fringe evidence, and agency reporting before submission."
            action={
              <Link to={`/projects/${projectId}`} className="print-hidden inline-flex min-h-11 items-center text-sm font-semibold text-gray-600 hover:text-gray-900">
                &larr; Project
              </Link>
            }
          />
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="print-hidden inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-brand-gold bg-brand-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/90 disabled:opacity-60"
            aria-label="Print report"
          >
            {isPrinting ? (
              <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {isPrinting ? 'Preparing...' : 'Print'}
          </button>
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-black px-5 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Review package</p>
              <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-headline text-xl text-white">{activeReport.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-gray-200">{activeReport.description}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-brand-gold text-black">
                  <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="grid divide-y divide-gray-200 md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Project hours</p>
                <p className="mt-2 font-headline text-lg text-gray-950">{totalPivotHours.toFixed(1)}</p>
                <p className="mt-1 text-sm text-gray-600">Hours in the project reporting pivot.</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gross wages</p>
                <p className="mt-2 font-headline text-lg text-gray-950">{formatCurrency(totalGrossWages)}</p>
                <p className="mt-1 text-sm text-gray-600">Wages represented in report exports.</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fringe credits</p>
                <p className="mt-2 font-headline text-lg text-gray-950">{formatCurrency(totalFringeCredits)}</p>
                <p className="mt-1 text-sm text-gray-600">Credits accumulated across payroll weeks.</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-brand-gold text-black">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-headline text-base text-gray-950">Best next action</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Start with payroll review, then move through fringes and agency reporting only when the week totals look right.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Report selector grouped by user intent */}
        <div className="grid grid-cols-1 gap-4 print-hidden xl:grid-cols-3">
          {['Payroll review', 'Deductions & fringes', 'Agency reporting'].map((group) => (
            <div key={group} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{group}</p>
              <div className="space-y-2">
                {REPORT_CARDS.filter((card) => card.group === group).map((card) => (
                  <ReportCard
                    key={card.key}
                    icon={card.icon}
                    title={card.title}
                    description={card.description}
                    active={activeTab === card.key}
                    onClick={() => setActiveTab(card.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ---- Fringe Summary tab (RPT-01) ---- */}
        {activeTab === 'fringe' && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-brand-gold text-black">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 font-headline">Fringe Benefit Summary</h2>
                  <p className="text-xs text-gray-500">All workers — cumulative across payroll weeks</p>
                </div>
              </div>
              {fringeRows.length > 0 && (
                <button
                  onClick={handlePrint}
                  className="print-hidden inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-brand-gold px-3 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/10"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              )}
            </div>

            {fringeLoading && <ReportsSkeleton />}

            {fringeError && (
              <p className="text-sm text-red-600">
                Failed to load fringe summary. Please try again.
              </p>
            )}

            {!fringeLoading && !fringeError && fringeRows.length === 0 && (
              <EmptyState
                illustration={<ReportsEmptyIllustration />}
                heading="No payroll data yet"
                message="Enter payroll weeks with worker hours to see fringe benefit totals here. Fringe credits accumulate across all completed payroll weeks."
              />
            )}

            {!fringeLoading && !fringeError && fringeRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Worker Name</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right"><TermTooltip term="ST Hours" definition="Straight-time hours — regular hours at the base prevailing wage rate (typically up to 40 hours/week)." /></th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right"><TermTooltip term="OT Hours" definition="Overtime hours — hours beyond the weekly threshold (usually 40h) paid at 1.5x the base rate under CWHSSA." /></th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Total Hours</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Total Fringe Credits</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Weeks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fringeRows.map((row, idx) => (
                      <tr
                        key={row.workerId}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-900 font-medium">
                          {row.workerName}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 text-right">
                          {row.totalSt.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 text-right">
                          {row.totalOt.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 text-right font-medium">
                          {(row.totalSt + row.totalOt).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-900 text-right font-semibold">
                          {formatCurrency(row.totalFringeCredits)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-500 text-right">
                          {row.weekCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-4 py-3 text-gray-900">Totals</td>
                      <td className="px-4 py-3 text-gray-900 text-right">
                        {fringeRows.reduce((sum, r) => sum + r.totalSt, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 text-right">
                        {fringeRows.reduce((sum, r) => sum + r.totalOt, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 text-right">
                        {fringeRows.reduce((sum, r) => sum + r.totalSt + r.totalOt, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 text-right">
                        {formatCurrency(fringeRows.reduce((sum, r) => sum + r.totalFringeCredits, 0))}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-right">
                        {fringeRows.reduce((sum, r) => sum + r.weekCount, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---- Pay History tab (RPT-02) ---- */}
        {activeTab === 'payHistory' && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-brand-gold text-black">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 font-headline">Pay History</h2>
                  <p className="text-xs text-gray-500">Week-by-week earnings for selected worker</p>
                </div>
              </div>

              {/* Worker selector */}
              {workers.length > 0 && (
                <div className="flex items-center gap-2 print-hidden">
                  <label className="text-sm text-gray-600 font-medium" htmlFor="worker-select">
                    Worker:
                  </label>
                  <select
                    id="worker-select"
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="min-h-11 rounded-sm border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                  >
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {!selectedWorkerId && workers.length === 0 && (
              <EmptyState
                heading="No workers on this project"
                message="Add workers to the project before viewing pay history. Each worker's weekly hours and wages will appear here after payroll entries are saved."
              />
            )}

            {payHistoryLoading && <ReportsSkeleton />}

            {payHistoryError && (
              <p className="text-sm text-red-600">
                Failed to load pay history. Please try again.
              </p>
            )}

            {!payHistoryLoading && !payHistoryError && selectedWorkerId && payHistoryRows.length === 0 && (
              <EmptyState
                heading="No pay history for this worker"
                message="This worker has no payroll entries yet. Enter hours in a payroll week to see their pay history here."
              />
            )}

            {!payHistoryLoading && !payHistoryError && payHistoryRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Week #</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Week Ending</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right"><TermTooltip term="ST Hours" definition="Straight-time hours — regular hours at the base prevailing wage rate (typically up to 40 hours/week)." /></th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right"><TermTooltip term="OT Hours" definition="Overtime hours — hours beyond the weekly threshold (usually 40h) paid at 1.5x the base rate under CWHSSA." /></th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Base Rate</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Fringe Rate</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Gross Wages</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Deductions</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payHistoryRows.map((row, idx) => (
                      <tr
                        key={row.payrollWeekId}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700">
                          {row.weekNumber}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700">
                          {formatDate(row.weekEndingDate)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 text-right">
                          {row.totalSt.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 text-right">
                          {row.totalOt.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 text-right">
                          {formatCurrency(row.baseRateSnapshot)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 text-right">
                          {formatCurrency(row.fringeRateSnapshot)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-900 text-right font-medium">
                          {formatCurrency(row.grossWages)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 text-right">
                          {formatCurrency(row.deductions)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-200 text-gray-900 text-right font-semibold">
                          {formatCurrency(row.netPay)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---- Fringe Breakdown tab (RPT-03) ---- */}
        {activeTab === 'fringeBreakdown' && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-brand-gold text-black">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800 font-headline">Fringe Breakdown by Fund Type</h2>
                <p className="text-xs text-gray-500">H&amp;W, Pension, Vacation, Training — by union local and classification</p>
              </div>
            </div>

            {fringeBreakdownLoading && <ReportsSkeleton />}

            {fringeBreakdownError && (
              <p className="text-sm text-red-600">Failed to load fringe breakdown. Please try again.</p>
            )}

            {!fringeBreakdownLoading && !fringeBreakdownError && fringeBreakdownRows.length === 0 && (
              <EmptyState
                heading="No fringe data yet"
                message="Enter fringe benefit amounts (H&W, Pension, Vacation, Training) in your payroll entries to see the breakdown by fund type and classification here."
              />
            )}

            {!fringeBreakdownLoading && !fringeBreakdownError && fringeBreakdownRows.length > 0 && (() => {
              // Build pivot: group rows by (unionLocal, classificationLevel), columns = fund types
              const FUND_COLS: Array<{ key: FringeBreakdownRow['fundType']; label: string }> = [
                { key: 'healthWelfare', label: 'H&W' },
                { key: 'pension',       label: 'Pension' },
                { key: 'vacation',      label: 'Vacation' },
                { key: 'training',      label: 'Training' },
              ];

              // Collect unique group keys in order (rows are pre-sorted by service)
              const groupKeys: string[] = [];
              const groupMap = new Map<string, Map<FringeBreakdownRow['fundType'], number>>();

              for (const row of fringeBreakdownRows) {
                const gk = `${row.unionLocal}||${row.classificationLevel}`;
                if (!groupMap.has(gk)) {
                  groupKeys.push(gk);
                  groupMap.set(gk, new Map());
                }
                groupMap.get(gk)!.set(row.fundType, (groupMap.get(gk)!.get(row.fundType) ?? 0) + row.totalAmount);
              }

              // Totals per fund type
              const totals = new Map<FringeBreakdownRow['fundType'], number>();
              for (const row of fringeBreakdownRows) {
                totals.set(row.fundType, (totals.get(row.fundType) ?? 0) + row.totalAmount);
              }

              return (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700">Union Local</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Classification</th>
                        {FUND_COLS.map(({ key, label }) => (
                          <th key={key} className="px-4 py-3 font-semibold text-gray-700 text-right">
                            {key === 'healthWelfare' ? (
                              <TermTooltip term="H&W" definition="Health & Welfare — the fringe benefit component covering medical, dental, and vision insurance as required by the prevailing wage determination." />
                            ) : key === 'pension' ? (
                              <TermTooltip term="Pension" definition="The retirement/pension fringe benefit component required under the prevailing wage determination." />
                            ) : label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupKeys.map((gk, idx) => {
                        const [unionLocal, classificationLevel] = gk.split('||');
                        const fundAmounts = groupMap.get(gk)!;
                        return (
                          <tr key={gk} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 border-b border-gray-200 text-gray-900 font-medium">
                              {unionLocal}
                            </td>
                            <td className="px-4 py-3 border-b border-gray-200 text-gray-700 capitalize">
                              {classificationLevel}
                            </td>
                            {FUND_COLS.map(({ key }) => (
                              <td key={key} className="px-4 py-3 border-b border-gray-200 text-gray-700 text-right">
                                {formatCurrency(fundAmounts.get(key) ?? null)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                      <tr>
                        <td className="px-4 py-3 text-gray-900" colSpan={2}>Totals</td>
                        {FUND_COLS.map(({ key }) => (
                          <td key={key} className="px-4 py-3 text-gray-900 text-right">
                            {formatCurrency(totals.get(key) ?? null)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Phase 104: Hours by Trade / Classification / Week Pivot (REPT-06) ── */}
        <div className="mt-10 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-bold text-nav-dark font-headline">
              Hours by Trade / Classification / Week
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={`/api/reports/${projectId}/hours-pivot?format=csv`}
                className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/10"
                download
              >
                Download CSV
              </a>
              <a
                href={`/api/reports/${projectId}/hours-pivot?format=pdf`}
                className="inline-flex min-h-11 items-center justify-center rounded-sm bg-brand-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/90"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download PDF
              </a>
            </div>
          </div>

          {pivotQuery.isLoading && (
            <div className="py-8 text-center text-gray-400">Loading pivot data...</div>
          )}

          {pivotQuery.isError && (
            <div className="py-4 text-red-600 text-sm">Failed to load pivot data.</div>
          )}

          {pivotQuery.data && (
            <>
              {pivotQuery.data.pivot.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  No payroll data found for this project.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-nav-dark text-white">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Week Ending</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Trade</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">ST Hrs</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">OT Hrs</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">DT Hrs</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Workers</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Gross Wages</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pivotQuery.data.pivot.map((row, i) => {
                        const rowKey = `${row.weekEndingDate}-${row.tradeCode}-${row.tradeDescription}-${row.laborType}-${i}`;
                        const isExpanded = expandedKey === rowKey;
                        return (
                          <Fragment key={rowKey}>
                            <tr
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              className={`cursor-pointer hover:bg-gray-50 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold ${
                                i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                              } ${isExpanded ? 'ring-1 ring-inset ring-brand-gold' : ''}`}
                              onClick={() => setExpandedKey((prev) => (prev === rowKey ? null : rowKey))}
                              onKeyDown={(event) => toggleOnEnterOrSpace(event, () => setExpandedKey((prev) => (prev === rowKey ? null : rowKey)))}
                            >
                              <td className="px-4 py-3 text-gray-700 font-medium">{row.weekEndingDate}</td>
                              <td className="px-4 py-3">
                                <span className="bg-nav-dark text-brand-gold font-bold text-xs px-2 py-0.5 rounded font-headline">
                                  {row.tradeCode}
                                </span>
                                <span className="ml-2 text-gray-600 text-xs">- {row.tradeDescription}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs capitalize">{row.laborType}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.totalStraightHours.toFixed(1)}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.totalOvertimeHours.toFixed(1)}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.totalDoubleHours.toFixed(1)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-nav-dark">{row.totalHours.toFixed(1)}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.workerCount}</td>
                              <td className="px-4 py-3 text-right text-gray-700">
                                ${row.grossWages.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-amber-50">
                                <td colSpan={9} className="px-6 py-3 text-xs text-gray-600">
                                  <strong>Drill-down:</strong> {row.workerCount} workers logged hours as{' '}
                                  {row.tradeDescription} ({row.laborType}) during week ending {row.weekEndingDate}.
                                  Navigate to the payroll week to see individual entries.
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* ---- DBE Participation tab (DBE-09) ---- */}
        {activeTab === 'dbeParticipation' && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-brand-gold text-black">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 font-headline">DBE/MBE/WBE Participation</h2>
                  <p className="text-xs text-gray-500">Certified sub hours as % of total project hours — DOT DBE program</p>
                </div>
              </div>
              <button
                onClick={() => window.print()}
                className="print-hidden inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-brand-gold px-3 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/10"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>

            {dbeLoading && <ReportsSkeleton />}

            {!dbeLoading && dbe && (
              <>
                {/* Summary table */}
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700">Classification</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 text-right">Hours</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['dbe', 'mbe', 'wbe', 'sdvosb', 'uncertified'] as const).map(cls => (
                        <tr key={cls} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">
                            {cls === 'uncertified' ? 'Uncertified / GC Direct' : cls.toUpperCase()}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">
                            {dbe.byClassification[cls].hours.toFixed(1)}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">
                            {dbe.byClassification[cls].pct.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td className="px-4 py-2">Total Project Hours</td>
                        <td className="px-4 py-2 text-right">{dbe.totalHours.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right">100.00%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Per-week breakdown */}
                {dbe.byWeek.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Weekly Breakdown</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-gray-700">Week Ending</th>
                            <th className="px-4 py-3 font-semibold text-gray-700 text-right">Total Hours</th>
                            <th className="px-4 py-3 font-semibold text-gray-700 text-right">Certified Hours</th>
                            <th className="px-4 py-3 font-semibold text-gray-700 text-right">Certified %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dbe.byWeek.map(w => (
                            <tr key={w.weekEndingDate} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2">{w.weekEndingDate}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{w.totalHours.toFixed(1)}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{w.certifiedHours.toFixed(1)}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{w.pct.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {dbe.totalHours === 0 && (
                  <p className="text-gray-500 text-sm mt-4">
                    No payroll entries found for this project. Add payroll weeks with worker hours to see DBE participation data.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ---- Apprenticeship tab (Phase 117 APP-01) ---- */}
        {activeTab === 'apprenticeship' && projectId && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-brand-gold text-black">
                <HardHat className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800 font-headline">Apprenticeship Ratios</h2>
                <p className="text-xs text-gray-500">Per-trade apprentice ratios, IRA/IIJA 15% check, and 12-week trend</p>
              </div>
            </div>
            <ApprenticeshipDashboard projectId={projectId} />
          </div>
        )}

      </div>
    </Layout>
    </>
  );
}
