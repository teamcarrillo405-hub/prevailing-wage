// src/client/components/payrollWizard/Step3Review.tsx
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface Props {
  projectId: string;
  weekId: string;
  onBack: (violatedWorkerIds?: string[]) => void;
}

interface ComplianceViolation {
  entryId: string;
  workerId: string;
  workerName: string;
  violationType: string;
  expected: number;
  actual: number;
  delta: number;
}

interface WeekViolation {
  violationType: string;
  detail: string;
}

interface DeductionViolation {
  entryId: string;
  workerId: string;
  workerName: string;
  deductions: number;
  grossWages: number;
  deductionPct: number;
}

interface ComplianceResponse {
  weekId: string;
  projectId: string;
  violations: ComplianceViolation[];
  weekViolations: WeekViolation[];
  deductionViolations: DeductionViolation[];
  hasViolations: boolean;
  certProperPayment: boolean;
  certAccuratePayroll: boolean;
}

interface WeekEntryRow {
  entry: {
    id: string;
    workerId: string;
    baseRateSnapshot: number;
    fringeRateSnapshot: number;
    grossWages: number | null;
    deductions: number | null;
    netPay: number | null;
  };
  workerName: string;
  tradeDescription: string;
}

interface WeekResponse {
  week: { id: string; payrollNumber: number; weekEndingDate: string };
  entries: WeekEntryRow[];
}

export function Step3Review({ projectId, weekId, onBack }: Props) {
  const navigate = useNavigate();

  const { data: weekData, isLoading: weekLoading } = useQuery<WeekResponse>({
    queryKey: ['payroll-week', weekId],
    queryFn: () => api.get<WeekResponse>(`/payroll/weeks/${weekId}`),
  });

  const { data: compliance, isLoading: cLoading, isError: cError } = useQuery<ComplianceResponse>({
    queryKey: ['compliance', weekId],
    queryFn: () => api.get<ComplianceResponse>(`/compliance/${weekId}`),
    refetchOnMount: 'always',
  });

  if (weekLoading || cLoading) return <LoadingSpinner />;

  const violations = compliance?.violations ?? [];
  const weekViolations = compliance?.weekViolations ?? [];
  const deductionViolations = compliance?.deductionViolations ?? [];
  const entries = weekData?.entries ?? [];
  const totalGross = entries.reduce((sum, e) => sum + (e.entry.grossWages ?? 0), 0);
  const totalNet = entries.reduce((sum, e) => sum + (e.entry.netPay ?? 0), 0);

  const hasViolations = compliance?.hasViolations ?? (
    violations.length > 0 || weekViolations.length > 0 || deductionViolations.length > 0
  );

  // Deduplicated list of worker names from entry-level violations
  const affectedWorkers = violations.length > 0 || deductionViolations.length > 0
    ? [...new Set([...violations, ...deductionViolations].map((v) => v.workerName))]
    : [];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-3">Compliance check</h3>
        {cError && (
          <p className="text-sm text-yellow-700">
            Compliance check couldn't load — you can still save, but violations won't be flagged.
          </p>
        )}
        {!cError && !hasViolations && (
          <p className="text-sm text-green-700">
            No blocking wage, overtime, deduction, or apprentice issue was detected for {entries.length} worker{entries.length === 1 ? '' : 's'}.
          </p>
        )}
        {!cError && hasViolations && (
          <div className="rounded-sm border border-red-200 bg-red-50 p-3 mb-3 text-sm text-red-700">
            <p className="font-semibold mb-1">Payroll review required before certification.</p>
            {affectedWorkers.length > 0 && (
              <p>
                Fix the issues below for{' '}
                {violations
                  .filter((v, i, arr) => arr.findIndex((x) => x.workerId === v.workerId) === i)
                  .map((v, i, arr) => (
                    <span key={v.workerId}>
                      <button
                        type="button"
                        className="font-semibold underline cursor-pointer hover:text-red-900"
                        onClick={() => onBack([v.workerId])}
                      >
                        {v.workerName}
                      </button>
                      {i < arr.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                , then use <span className="font-semibold">Back to fix hours</span> to correct their entries in the hours grid.
              </p>
            )}
            {affectedWorkers.length === 0 && (
              <p>Review the week-level issues below, then go back to correct the payroll grid.</p>
            )}
          </div>
        )}
        {violations.map((v, i) => (
          <div
            key={`${v.entryId}-${i}`}
            className="rounded-sm border border-red-300 bg-red-50 p-3 mb-2 text-sm"
          >
            <button
              type="button"
              className="font-semibold underline cursor-pointer hover:text-red-900"
              onClick={() => onBack([v.workerId])}
            >
              {v.workerName}
            </button>{' '}
            — {v.violationType}: expected ${v.expected.toFixed(2)},
            actual ${v.actual.toFixed(2)} (delta ${v.delta.toFixed(2)})
          </div>
        ))}
        {weekViolations.map((w, i) => (
          <div
            key={`wv-${i}`}
            className="rounded-sm border border-yellow-300 bg-yellow-50 p-3 mb-2 text-sm"
          >
            <strong>{w.violationType}</strong>: {w.detail}
          </div>
        ))}
        {deductionViolations.map((v, i) => (
          <div
            key={`deduction-${v.entryId}-${i}`}
            className="rounded-sm border border-amber-300 bg-amber-50 p-3 mb-2 text-sm"
          >
            <button
              type="button"
              className="font-semibold underline cursor-pointer hover:text-amber-900"
              onClick={() => onBack([v.workerId])}
            >
              {v.workerName}
            </button>{' '}
            - deduction review: ${v.deductions.toFixed(2)} non-tax deductions from ${v.grossWages.toFixed(2)} gross ({v.deductionPct}%).
          </div>
        ))}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Summary</h3>
        <table className="min-w-full text-sm border border-gray-200 rounded-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Worker</th>
              <th className="px-3 py-2 text-left">Trade</th>
              <th className="px-3 py-2 text-right text-xs">Base $/hr</th>
              <th className="px-3 py-2 text-right text-xs">Fringe $/hr</th>
              <th className="px-3 py-2 text-right">Gross</th>
              <th className="px-3 py-2 text-right">Deductions</th>
              <th className="px-3 py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.entry.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{e.workerName}</td>
                <td className="px-3 py-2 text-gray-600">{e.tradeDescription}</td>
                <td className="px-3 py-2 text-right text-gray-500">${e.entry.baseRateSnapshot.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-gray-500">${e.entry.fringeRateSnapshot.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">${(e.entry.grossWages ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">${(e.entry.deductions ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  ${(e.entry.netPay ?? 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-sm font-semibold">Totals</td>
              <td className="px-3 py-2 text-right font-semibold">${totalGross.toFixed(2)}</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right font-semibold">${totalNet.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={() =>
            hasViolations
              ? onBack([...violations, ...deductionViolations].map((v) => v.workerId))
              : onBack()
          }
        >
          {hasViolations ? '← Back to fix hours' : '← Back to hours'}
        </Button>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/payroll`)}>
            Save as draft
          </Button>
          <Button onClick={() => navigate(`/projects/${projectId}/payroll/${weekId}`)}>
            Save & continue to compliance review
          </Button>
        </div>
      </div>
    </div>
  );
}
