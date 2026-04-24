// src/client/components/LiveCalcDisplay.tsx
// Reads watch() values from FormProvider context — NO useEffect, NO server calls.
// Calls calculateCwhssaOt() directly in the render body (pure function, synchronous).
import { useFormContext } from 'react-hook-form';
import { calculateCwhssaOt } from '../../server/services/calculations.js';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function LiveCalcDisplay() {
  const { watch } = useFormContext();

  // Read all ST and OT fields plus rate fields synchronously in render body
  const monSt = Number(watch('monSt') || 0);
  const tueSt = Number(watch('tueSt') || 0);
  const wedSt = Number(watch('wedSt') || 0);
  const thuSt = Number(watch('thuSt') || 0);
  const friSt = Number(watch('friSt') || 0);
  const satSt = Number(watch('satSt') || 0);
  const sunSt = Number(watch('sunSt') || 0);
  const monOt = Number(watch('monOt') || 0);
  const tueOt = Number(watch('tueOt') || 0);
  const wedOt = Number(watch('wedOt') || 0);
  const thuOt = Number(watch('thuOt') || 0);
  const friOt = Number(watch('friOt') || 0);
  const satOt = Number(watch('satOt') || 0);
  const sunOt = Number(watch('sunOt') || 0);
  const baseRate = Number(watch('baseRate') || 0);
  const fringeRate = Number(watch('fringeRate') || 0);

  const totalSt = monSt + tueSt + wedSt + thuSt + friSt + satSt + sunSt;
  const totalOt = monOt + tueOt + wedOt + thuOt + friOt + satOt + sunOt;
  const totalHoursWorked = totalSt + totalOt;
  // CWHSSA: overtime hours = hours beyond weekly threshold (40)
  const overtimeHours = Math.max(0, totalHoursWorked - 40);

  const result = calculateCwhssaOt({
    baseRate,
    fringeRate,
    totalHoursWorked,
    overtimeHours,
  });

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        Live Weekly Cost Estimate
      </h3>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-600">Total Hours</td>
            <td className="py-1.5 text-right font-mono text-gray-900">
              {totalHoursWorked.toFixed(1)} hrs
              {overtimeHours > 0 && (
                <span className="ml-2 text-amber-600">
                  ({overtimeHours.toFixed(1)} OT)
                </span>
              )}
            </td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-600">Straight Time Base Pay</td>
            <td className="py-1.5 text-right font-mono text-gray-900">
              {fmt(result.straightTimeBasePay)}
            </td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-600">OT Premium (0.5x base only)</td>
            <td className="py-1.5 text-right font-mono text-gray-900">
              {fmt(result.overtimePremium)}
            </td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-600">Fringe Pay (1.0x all hours)</td>
            <td className="py-1.5 text-right font-mono text-gray-900">
              {fmt(result.totalFringePay)}
            </td>
          </tr>
          <tr className="font-semibold">
            <td className="pt-2 text-gray-900">Total Weekly Cost</td>
            <td className="pt-2 text-right font-mono text-brand-gold">
              {fmt(result.totalWeeklyCost)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-gray-400">
        CWHSSA: fringe is 1.0x for all hours. OT premium applies to base rate only.
      </p>
    </div>
  );
}
