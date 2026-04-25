// src/client/pages/ReportsPage.tsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, TrendingUp, PieChart, Download, Printer } from 'lucide-react';
import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader';
import { ReportsSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
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
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10);
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
      className={`w-full text-left rounded-xl border p-5 shadow-sm hover:shadow-md transition-all duration-150 space-y-2 ${
        active
          ? 'border-brand-gold bg-brand-gold/5 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${active ? 'bg-brand-gold/20 text-brand-navy' : 'bg-gray-100 text-gray-500'}`}>
          {icon}
        </div>
        <span className={`font-semibold text-sm ${active ? 'text-brand-navy' : 'text-gray-800'}`}>
          {title}
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </button>
  );
}

// ---- Component ----

export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<'fringe' | 'payHistory' | 'fringeBreakdown'>('fringe');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);

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
      icon: <FileText className="w-4 h-4" />,
      title: 'Fringe Benefit Summary',
      description: 'Total fringe credits earned per worker across all payroll weeks — ST hours, OT hours, and cumulative fringe totals.',
    },
    {
      key: 'payHistory' as const,
      icon: <TrendingUp className="w-4 h-4" />,
      title: 'Pay History',
      description: 'Week-by-week pay detail for a selected worker: hours, base rate, fringe rate, gross wages, deductions, and net pay.',
    },
    {
      key: 'fringeBreakdown' as const,
      icon: <PieChart className="w-4 h-4" />,
      title: 'Fringe Breakdown',
      description: 'Fringe contributions pivoted by fund type (H&W, Pension, Vacation, Training) and classification level.',
    },
  ];

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
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <PageHeader
            title="Reports"
            action={
              <Link to={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700 print-hidden">
                &larr; Project
              </Link>
            }
          />
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="print-hidden inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-60 min-h-[44px]"
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

        {/* Report selector cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print-hidden">
          {REPORT_CARDS.map(card => (
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

        {/* ---- Fringe Summary tab (RPT-01) ---- */}
        {activeTab === 'fringe' && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-gold/10 text-brand-navy">
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
                  className="print-hidden inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
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
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-gold/10 text-brand-navy">
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
                    className="border border-gray-300 rounded px-3 py-1.5 text-base bg-white text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
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
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-gold/10 text-brand-navy">
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

      </div>
    </Layout>
    </>
  );
}
