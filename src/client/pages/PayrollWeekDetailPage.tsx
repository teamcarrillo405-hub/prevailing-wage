// src/client/pages/PayrollWeekDetailPage.tsx
// Route: /projects/:projectId/payroll/:weekId
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { Card } from '../components/ui/Card';

interface PayrollWeek {
  id: string;
  projectId: string;
  weekEndingDate: string;
  payrollNumber: number;
  isFinal: boolean;
  createdAt: string;
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

interface ComplianceResult {
  weekId: string;
  projectId: string;
  violations: ComplianceViolation[];
  hasViolations: boolean;
  certProperPayment: boolean;
  certAccuratePayroll: boolean;
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
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
              <h1 className="text-2xl font-headline text-gray-900">
                Payroll Week #{week.payrollNumber}
                <span className="ml-3 text-base font-normal text-gray-500">
                  Week Ending {week.weekEndingDate}
                </span>
              </h1>
            )}
          </div>
          {weekId && (
            <a
              href={`/api/export/wh347/${weekId}`}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800"
            >
              Download WH-347
            </a>
          )}
        </div>

        {/* Loading state */}
        {isLoading && <LoadingSpinner />}

        {/* Error state */}
        {isError && !isLoading && (
          <p className="text-sm text-red-600">Failed to load payroll week details.</p>
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
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                              {violationLabel(violation.violationType)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">OK</span>
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
                    <li key={i} className="text-sm text-gray-700">
                      <span className="font-medium">{v.workerName}</span>
                      {' — '}
                      {violationLabel(v.violationType)}: expected ${v.expected.toFixed(2)}, paid $
                      {v.actual.toFixed(2)} (delta ${v.delta.toFixed(2)})
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="px-5 py-4">
                <p className="text-sm text-green-700 font-medium">
                  No compliance violations for this week.
                </p>
              </div>
            )}
          </Card>
        )}
      </div>
    </Layout>
  );
}
