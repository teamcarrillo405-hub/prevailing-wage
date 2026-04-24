// src/client/components/GsaRateDisplay.tsx
// Live calculation display — reads watch() from FormProvider context.
// Calls calculateGsaRate() synchronously in render body. NO useEffect. NO fetch.
// Pattern mirrors LiveCalcDisplay.tsx exactly.
import { useFormContext } from 'react-hook-form';
import { calculateGsaRate } from '../../server/services/gsaRateBuilder.js';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function GsaRateDisplay() {
  const { watch } = useFormContext();

  const baseRate = Number(watch('baseRate') || 0);
  const fringeRate = Number(watch('fringeRate') || 0);
  const overheadPct = Number(watch('overheadPct') || 0);
  const gaPct = Number(watch('gaPct') || 0);
  const profitPct = Number(watch('profitPct') || 0);

  const result = calculateGsaRate({ baseRate, fringeRate, overheadPct, gaPct, profitPct });

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        Live Rate Buildup
      </h3>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-600">Direct Labor Cost (Base + Fringe)</td>
            <td className="py-1.5 text-right font-mono text-gray-900">
              {fmt(result.directLaborCost)}/hr
            </td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-600">After Overhead ({overheadPct.toFixed(1)}%)</td>
            <td className="py-1.5 text-right font-mono text-gray-900">
              {fmt(result.afterOverhead)}/hr
            </td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-600">After G&A ({gaPct.toFixed(1)}%)</td>
            <td className="py-1.5 text-right font-mono text-gray-900">
              {fmt(result.afterGa)}/hr
            </td>
          </tr>
          <tr className="font-semibold">
            <td className="pt-2 text-gray-900">Billable Rate (After Profit {profitPct.toFixed(1)}%)</td>
            <td className="pt-2 text-right font-mono text-brand-gold">
              {fmt(result.billableRate)}/hr
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-gray-400">
        Formula: (base + fringe) x (1 + OH%) x (1 + G&A%) x (1 + profit%)
      </p>
    </div>
  );
}
