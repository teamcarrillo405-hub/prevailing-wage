// src/client/components/VarianceSummaryTable.tsx
import type { VarianceReport, WeeklyVarianceRow } from '../../server/services/varianceService.js';

interface Props {
  report: VarianceReport;
}

function fmtCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function VarianceSummaryTable({ report }: Props) {
  if (report.weeks.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-6 text-center">
        No payroll weeks found. Add payroll data to see the variance report.
      </div>
    );
  }

  // VAR-01: three-way budget summary header — Original Bid / Working Budget / Actual / Variance
  // bidAmount is optional; display "—" when null (user did not enter an original bid)
  const overallVarianceAmt = report.totalActual - report.totalBudgetBurned;

  return (
    <div>
      {/* Budget summary header row — VAR-01 three-way comparison */}
      <div className="mb-4 grid grid-cols-4 gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Original Bid</div>
          <div className="font-mono font-semibold text-gray-900">
            {report.bidAmount != null ? fmtCurrency(report.bidAmount) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Working Budget</div>
          <div className="font-mono font-semibold text-gray-900">{fmtCurrency(report.workingBudget)}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Actual to Date</div>
          <div className="font-mono font-semibold text-gray-900">{fmtCurrency(report.totalActual)}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Variance</div>
          <div className={`font-mono font-semibold ${overallVarianceAmt > 0 ? 'text-red-600' : 'text-green-700'}`}>
            {fmtCurrency(Math.abs(overallVarianceAmt))}
            {overallVarianceAmt > 0 ? ' over' : overallVarianceAmt < 0 ? ' under' : ''}
          </div>
        </div>
      </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-700 border-b">Week Ending</th>
            <th className="px-3 py-2 font-medium text-gray-700 border-b text-right">#</th>
            <th className="px-3 py-2 font-medium text-gray-700 border-b text-right">Actual</th>
            <th className="px-3 py-2 font-medium text-gray-700 border-b text-right">Burn Rate</th>
            <th className="px-3 py-2 font-medium text-gray-700 border-b text-right">Cum. Actual</th>
            <th className="px-3 py-2 font-medium text-gray-700 border-b text-right">Cum. Budget</th>
            <th className="px-3 py-2 font-medium text-gray-700 border-b text-right">Variance</th>
          </tr>
        </thead>
        <tbody>
          {report.weeks.map((row: WeeklyVarianceRow) => (
            <tr
              key={row.weekEndingDate}
              className={`border-b border-gray-100 ${row.isOverThreshold ? 'bg-red-50' : 'hover:bg-gray-50'}`}
            >
              <td className="px-3 py-2 font-mono text-gray-700">{row.weekEndingDate}</td>
              <td className="px-3 py-2 text-right text-gray-600">{row.payrollNumber}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-900">{fmtCurrency(row.actualCost)}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-600">{fmtCurrency(row.burnRate)}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-900">{fmtCurrency(row.cumulativeActual)}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-600">{fmtCurrency(row.cumulativeBurnRate)}</td>
              <td className={`px-3 py-2 text-right font-mono font-semibold ${row.isOverThreshold ? 'text-red-600' : 'text-gray-900'}`}>
                {fmtPct(row.variancePct)}
                {row.isOverThreshold && <span className="ml-1 text-red-500 font-bold">!</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td colSpan={4} className="px-3 py-3 text-gray-900">Overall</td>
            <td className="px-3 py-3 text-right font-mono text-gray-900">{fmtCurrency(report.totalActual)}</td>
            <td className="px-3 py-3 text-right font-mono text-gray-900">{fmtCurrency(report.totalBudgetBurned)}</td>
            <td className={`px-3 py-3 text-right font-mono ${Math.abs(report.overallVariancePct) > report.varianceThresholdPct ? 'text-red-600' : 'text-[#F5C518]'}`}>
              {fmtPct(report.overallVariancePct)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-xs text-gray-400">
        Burn rate is linear: working budget / total weeks. Red rows exceed {report.varianceThresholdPct}% threshold.
      </p>
    </div>
    </div>
  );
}
