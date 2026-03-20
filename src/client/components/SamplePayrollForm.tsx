// src/client/components/SamplePayrollForm.tsx
// Self-contained sample/mock payroll form with trade selection and dynamic rows.
// Uses useFieldArray for multi-row support. No server calls — calculations only.
import { useForm, useFieldArray, useWatch, FormProvider } from 'react-hook-form';
import { calculateCwhssaOt } from '../../server/services/calculations.js';

// ── Sample trade library ────────────────────────────────────────────────────
// Rates are representative Davis-Bacon prevailing wage ranges (not project-specific).

export const SAMPLE_TRADES: Record<string, { label: string; baseRate: number; fringeRate: number }> = {
  carpenter:      { label: 'Carpenter',                  baseRate: 42.50, fringeRate: 14.75 },
  roofer:         { label: 'Roofer',                     baseRate: 38.00, fringeRate: 12.50 },
  electrician:    { label: 'Electrician',                baseRate: 52.00, fringeRate: 18.50 },
  plumber:        { label: 'Plumber / Pipefitter',       baseRate: 54.00, fringeRate: 19.00 },
  laborer:        { label: 'Laborer (General)',          baseRate: 31.00, fringeRate: 11.20 },
  mason_tender:   { label: 'Laborer (Mason Tender)',     baseRate: 33.00, fringeRate: 11.50 },
  ironworker:     { label: 'Ironworker',                 baseRate: 49.00, fringeRate: 17.25 },
  operator:       { label: 'Equipment Operator (Heavy)', baseRate: 48.00, fringeRate: 16.80 },
  painter:        { label: 'Painter',                    baseRate: 36.50, fringeRate: 13.00 },
  cement_mason:   { label: 'Cement Mason',               baseRate: 39.00, fringeRate: 13.75 },
  sheet_metal:    { label: 'Sheet Metal Worker',         baseRate: 47.00, fringeRate: 16.50 },
  truck_driver:   { label: 'Truck Driver',               baseRate: 34.00, fringeRate: 12.00 },
};

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ── Types ───────────────────────────────────────────────────────────────────

interface SampleRow {
  tradeKey: string;
  workerName: string;
  baseRate: number;
  fringeRate: number;
  monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number;
}

interface SampleFormValues {
  weekEndingDate: string;
  payrollNumber: number;
  rows: SampleRow[];
}

function blankRow(tradeKey = 'carpenter'): SampleRow {
  const trade = SAMPLE_TRADES[tradeKey];
  return {
    tradeKey,
    workerName: `Sample ${trade.label}`,
    baseRate: trade.baseRate,
    fringeRate: trade.fringeRate,
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}

// ── Live totals panel ────────────────────────────────────────────────────────

function LiveTotals() {
  const rows = useWatch<SampleFormValues, 'rows'>({ name: 'rows' }) ?? [];

  let grandTotal = 0;
  let grandHours = 0;
  let grandOt = 0;

  const workerLines = rows.map((row, i) => {
    const st = (row.monSt||0)+(row.tueSt||0)+(row.wedSt||0)+(row.thuSt||0)+(row.friSt||0)+(row.satSt||0)+(row.sunSt||0);
    const ot = (row.monOt||0)+(row.tueOt||0)+(row.wedOt||0)+(row.thuOt||0)+(row.friOt||0)+(row.satOt||0)+(row.sunOt||0);
    const total = st + ot;
    const overtimeHours = Math.max(0, total - 40);
    const result = calculateCwhssaOt({
      baseRate: Number(row.baseRate) || 0,
      fringeRate: Number(row.fringeRate) || 0,
      totalHoursWorked: total,
      overtimeHours,
    });
    grandTotal += result.totalWeeklyCost;
    grandHours += total;
    grandOt += overtimeHours;
    return { label: row.workerName || SAMPLE_TRADES[row.tradeKey]?.label, total, overtimeHours, result };
  });

  if (workerLines.every(w => w.total === 0)) return null;

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        Live Weekly Cost Estimate
      </h3>

      {/* Per-worker breakdown */}
      {workerLines.filter(w => w.total > 0).map((w, i) => (
        <div key={i} className="mb-3 pb-3 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-sm font-medium text-gray-900">{w.label}</span>
            <span className="text-sm font-semibold font-mono text-[#F5C518]">{fmt(w.result.totalWeeklyCost)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
            <span>{w.total.toFixed(1)} hrs{w.overtimeHours > 0 && <span className="text-amber-600"> ({w.overtimeHours.toFixed(1)} OT)</span>}</span>
            <span>ST base: {fmt(w.result.straightTimeBasePay)}</span>
            <span>Fringe: {fmt(w.result.totalFringePay)}</span>
          </div>
          {w.overtimeHours > 0 && (
            <div className="text-xs text-amber-700 mt-0.5">OT premium: {fmt(w.result.overtimePremium)}</div>
          )}
        </div>
      ))}

      {/* Grand total */}
      {workerLines.filter(w => w.total > 0).length > 1 && (
        <div className="mt-3 pt-3 border-t-2 border-gray-200 flex justify-between items-center">
          <div>
            <span className="text-sm font-semibold text-gray-900">Total Crew Cost</span>
            <span className="ml-3 text-xs text-gray-500">{grandHours.toFixed(1)} hrs total{grandOt > 0 && <span className="text-amber-600"> ({grandOt.toFixed(1)} OT)</span>}</span>
          </div>
          <span className="text-lg font-bold font-mono text-[#F5C518]">{fmt(grandTotal)}</span>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        CWHSSA: fringe is 1.0x for all hours. OT premium applies to base rate only. Rates are sample Davis-Bacon ranges.
      </p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface SamplePayrollFormProps {
  onAddRealWorkers: () => void;
}

export function SamplePayrollForm({ onAddRealWorkers }: SamplePayrollFormProps) {
  const methods = useForm<SampleFormValues>({
    defaultValues: {
      weekEndingDate: '',
      payrollNumber: 1,
      rows: [blankRow('carpenter')],
    },
  });

  const { register, control, setValue, watch } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  function handleTradeChange(index: number, tradeKey: string) {
    const trade = SAMPLE_TRADES[tradeKey];
    if (!trade) return;
    setValue(`rows.${index}.tradeKey`, tradeKey);
    setValue(`rows.${index}.baseRate`, trade.baseRate);
    setValue(`rows.${index}.fringeRate`, trade.fringeRate);
    setValue(`rows.${index}.workerName`, `Sample ${trade.label}`);
  }

  return (
    <FormProvider {...methods}>
      <div className="space-y-6">

        {/* Sample mode banner */}
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Sample mode</span> — select trade classifications and enter hours to preview costs. Rates are representative Davis-Bacon ranges.
          </p>
          <button
            onClick={onAddRealWorkers}
            className="ml-4 text-xs font-medium text-amber-900 underline hover:text-amber-700 whitespace-nowrap"
          >
            Add real workers
          </button>
        </div>

        {/* Week header */}
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Week Ending Date</label>
            <input
              type="date"
              {...register('weekEndingDate')}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-hidden focus:ring-1 focus:ring-brand-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Payroll #</label>
            <input
              type="number"
              min={1}
              {...register('payrollNumber', { valueAsNumber: true })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-hidden focus:ring-1 focus:ring-brand-gold"
            />
          </div>
        </div>

        {/* Worker rows */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-52">Classification</th>
                <th className="text-center px-2 py-2 font-medium text-gray-500 w-20 text-xs normal-case tracking-normal">Base $/hr</th>
                <th className="text-center px-2 py-2 font-medium text-gray-500 w-20 text-xs normal-case tracking-normal">Fringe $/hr</th>
                {DAYS.map((d) => (
                  <th key={`${d}-st`} className="text-center px-1 py-2 font-medium text-gray-600 w-14">
                    {DAY_LABELS[d]} ST
                  </th>
                ))}
                {DAYS.map((d) => (
                  <th key={`${d}-ot`} className="text-center px-1 py-2 font-medium text-amber-600 w-14">
                    {DAY_LABELS[d]} OT
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50">

                  {/* Trade selector */}
                  <td className="px-3 py-2">
                    <select
                      {...register(`rows.${index}.tradeKey`)}
                      onChange={(e) => handleTradeChange(index, e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-gold"
                    >
                      {Object.entries(SAMPLE_TRADES).map(([key, t]) => (
                        <option key={key} value={key}>{t.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Rates — read-only, set by trade selection */}
                  <td className="px-2 py-2 text-center font-mono text-xs text-gray-600">
                    ${Number(watch(`rows.${index}.baseRate`) || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-xs text-gray-600">
                    ${Number(watch(`rows.${index}.fringeRate`) || 0).toFixed(2)}
                    <input type="hidden" {...register(`rows.${index}.baseRate`, { valueAsNumber: true })} />
                    <input type="hidden" {...register(`rows.${index}.fringeRate`, { valueAsNumber: true })} />
                  </td>

                  {/* ST hours */}
                  {DAYS.map((d) => (
                    <td key={`${d}-st`} className="px-1 py-2 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        {...register(`rows.${index}.${d}St` as any, { valueAsNumber: true, min: 0 })}
                        className="w-12 px-1 py-1 text-center border border-gray-200 rounded text-xs focus:outline-hidden focus:border-gray-400"
                      />
                    </td>
                  ))}

                  {/* OT hours */}
                  {DAYS.map((d) => (
                    <td key={`${d}-ot`} className="px-1 py-2 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        {...register(`rows.${index}.${d}Ot` as any, { valueAsNumber: true, min: 0 })}
                        className="w-12 px-1 py-1 text-center border border-amber-200 rounded text-xs focus:outline-hidden focus:border-amber-400"
                      />
                    </td>
                  ))}

                  {/* Remove row */}
                  <td className="px-1 py-2 text-center">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none"
                        aria-label="Remove row"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row button */}
        <button
          type="button"
          onClick={() => append(blankRow('laborer'))}
          className="text-sm text-gray-600 border border-dashed border-gray-300 rounded px-4 py-2 hover:border-gray-400 hover:text-gray-900 transition-colors"
        >
          + Add worker row
        </button>

        {/* Live totals */}
        <LiveTotals />

      </div>
    </FormProvider>
  );
}
