// src/client/components/GsaRateForm.tsx
// Inputs only — no calculation logic here. GsaRateDisplay handles live calc.
import { useFormContext } from 'react-hook-form';

export interface GsaRateFormValues {
  name: string;
  baseRate: number;
  fringeRate: number;
  overheadPct: number;
  gaPct: number;
  profitPct: number;
}

export function GsaRateForm() {
  const { register, formState: { errors } } = useFormContext<GsaRateFormValues>();

  const inputClass = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#F5C518]';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Rate Name</label>
        <input
          {...register('name', { required: 'Required' })}
          className={inputClass}
          placeholder="e.g. 2026 GSA Electrician JW"
        />
        {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Base Rate ($/hr)</label>
        <input
          type="number" step="0.01"
          {...register('baseRate', { required: 'Required', valueAsNumber: true, min: 0 })}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Fringe Rate ($/hr)</label>
        <input
          type="number" step="0.01"
          {...register('fringeRate', { valueAsNumber: true, min: 0 })}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Overhead %</label>
        <input
          type="number" step="0.1"
          {...register('overheadPct', { required: 'Required', valueAsNumber: true, min: 0, max: 200 })}
          className={inputClass}
          placeholder="e.g. 30"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">G&A %</label>
        <input
          type="number" step="0.1"
          {...register('gaPct', { required: 'Required', valueAsNumber: true, min: 0, max: 200 })}
          className={inputClass}
          placeholder="e.g. 12"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Profit %</label>
        <input
          type="number" step="0.1"
          {...register('profitPct', { required: 'Required', valueAsNumber: true, min: 0, max: 100 })}
          className={inputClass}
          placeholder="e.g. 8"
        />
      </div>
    </div>
  );
}
