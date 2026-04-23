// src/client/components/payrollWizard/Step3Review.tsx
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface Props {
  projectId: string;
  weekId: string;
  onBack: () => void;
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

interface ComplianceResponse {
  weekId: string;
  projectId: string;
  violations: ComplianceViolation[];
  weekViolations: WeekViolation[];
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
  const entries = weekData?.entries ?? [];
  const totalGross = entries.reduce((sum, e) => sum + (e.entry.grossWages ?? 0), 0);
  const totalNet = entries.reduce((sum, e) => sum + (e.entry.netPay ?? 0), 0);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-3">Compliance check</h3>
        {cError && (
          <p className="text-sm text-yellow-700">
            Compliance check couldn't load — you can still save, but violations won't be flagged.
          </p>
        )}
        {!cError && violations.length === 0 && weekViolations.length === 0 && (
          <p className="text-sm text-green-700">
            All {entries.length} worker{entries.length === 1 ? '' : 's'} pass federal minimums.
          </p>
        )}
        {violations.map((v, i) => (
          <div
            key={`${v.entryId}-${i}`}
            className="rounded-sm border border-red-300 bg-red-50 p-3 mb-2 text-sm"
          >
            <strong>{v.workerName}</strong> — {v.violationType}: expected ${v.expected.toFixed(2)},
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
        <Button variant="secondary" onClick={onBack}>← Back to hours</Button>
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
