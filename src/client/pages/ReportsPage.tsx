// src/client/pages/ReportsPage.tsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader';

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

// ---- Component ----

export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<'fringe' | 'payHistory'>('fringe');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

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

  // ---- Tab button styles ----
  function tabClass(tab: 'fringe' | 'payHistory') {
    return activeTab === tab
      ? 'px-5 py-2 text-sm font-semibold rounded-t border-b-2 border-brand-gold bg-brand-gold text-nav-dark'
      : 'px-5 py-2 text-sm font-medium rounded-t border-b-2 border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200';
  }

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
        <PageHeader
          title="Reports"
          action={
            <Link to={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700 print-hidden">
              &larr; Project
            </Link>
          }
        />

        {/* Tabs */}
        <div className="border-b border-gray-200 print-hidden">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('fringe')}
              className={tabClass('fringe')}
            >
              Fringe Benefit Summary
            </button>
            <button
              onClick={() => setActiveTab('payHistory')}
              className={tabClass('payHistory')}
            >
              Pay History
            </button>
          </div>
        </div>

        {/* ---- Fringe Summary tab (RPT-01) ---- */}
        {activeTab === 'fringe' && (
          <div>
            <h2
              className="text-lg font-semibold text-gray-800 mb-4 font-headline"
            >
              Fringe Benefit Summary
            </h2>

            {fringeLoading && (
              <p className="text-sm text-gray-500">Loading fringe summary...</p>
            )}

            {fringeError && (
              <p className="text-sm text-red-600">
                Failed to load fringe summary. Please try again.
              </p>
            )}

            {!fringeLoading && !fringeError && fringeRows.length === 0 && (
              <p className="text-sm text-gray-500">
                No payroll entries found for this project.
              </p>
            )}

            {!fringeLoading && !fringeError && fringeRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Worker Name</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">ST Hours</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">OT Hours</th>
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
          <div>
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
              <h2
                className="text-lg font-semibold text-gray-800 font-headline"
              >
                Pay History
              </h2>

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
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
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
              <p className="text-sm text-gray-500">No workers found for this project.</p>
            )}

            {payHistoryLoading && (
              <p className="text-sm text-gray-500">Loading pay history...</p>
            )}

            {payHistoryError && (
              <p className="text-sm text-red-600">
                Failed to load pay history. Please try again.
              </p>
            )}

            {!payHistoryLoading && !payHistoryError && selectedWorkerId && payHistoryRows.length === 0 && (
              <p className="text-sm text-gray-500">No pay history found for this worker.</p>
            )}

            {!payHistoryLoading && !payHistoryError && payHistoryRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Week #</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Week Ending</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">ST Hours</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">OT Hours</th>
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

      </div>
    </Layout>
    </>
  );
}
