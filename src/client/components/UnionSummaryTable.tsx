// src/client/components/UnionSummaryTable.tsx
import type { UnionAllocationResult } from '../../server/services/unionAllocation.js';

interface Props {
  result: UnionAllocationResult;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function UnionSummaryTable({ result }: Props) {
  if (result.trades.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-6 text-center">
        No payroll entries found for this project. Add payroll data first.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-4 py-2 font-medium text-gray-700 border-b">Trade</th>
            <th className="px-4 py-2 font-medium text-gray-700 border-b text-right">Headcount</th>
            <th className="px-4 py-2 font-medium text-gray-700 border-b text-right">Total Hours</th>
            <th className="px-4 py-2 font-medium text-gray-700 border-b text-right">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {result.trades.map((trade) => (
            <tr key={trade.tradeCode} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2">
                <div className="font-medium text-gray-900">{trade.tradeName}</div>
                <div className="text-xs text-gray-500">{trade.tradeCode}</div>
              </td>
              <td className="px-4 py-2 text-right font-mono text-gray-700">{trade.headcount}</td>
              <td className="px-4 py-2 text-right font-mono text-gray-700">{trade.totalHours.toFixed(1)}</td>
              <td className="px-4 py-2 text-right font-mono text-gray-900">{fmt(trade.totalCost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td className="px-4 py-3 text-gray-900">Grand Total</td>
            <td className="px-4 py-3 text-right font-mono text-gray-900">
              {result.trades.reduce((s, t) => s + t.headcount, 0)}
            </td>
            <td className="px-4 py-3 text-right font-mono text-gray-900">
              {result.grandTotalHours.toFixed(1)}
            </td>
            <td className="px-4 py-3 text-right font-mono text-brand-gold">
              {fmt(result.grandTotalCost)}
            </td>
          </tr>
          <tr>
            <td colSpan={3} className="px-4 py-2 text-sm text-gray-600">
              Blended Hourly Rate
            </td>
            <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">
              {fmt(result.blendedHourlyRate)}/hr
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
