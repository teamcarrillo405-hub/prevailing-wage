// src/client/components/PayrollWeekForm.tsx
// Weekly hours entry grid: one row per worker classification, columns Mon-Sun ST + Mon-Sun OT.
// FormProvider wraps the form so LiveCalcDisplay can call useFormContext().
import { useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { LiveCalcDisplay } from './LiveCalcDisplay';

interface WorkerRow {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  fringeRate: number;
}

interface PayrollWeekFormValues {
  weekEndingDate: string;
  payrollNumber: number;
  baseRate: number;
  fringeRate: number;
  fringeHealthWelfare: number;
  fringePension: number;
  fringeVacation: number;
  fringeTraining: number;
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
  monDt: number;
  tueDt: number;
  wedDt: number;
  thuDt: number;
  friDt: number;
  satDt: number;
  sunDt: number;
}

interface PayrollWeekFormProps {
  projectId: string;
  workers: WorkerRow[];
  onSave: (weekId: string) => void;
  isCA?: boolean;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export function PayrollWeekForm({ projectId, workers, onSave, isCA = false }: PayrollWeekFormProps) {
  // Single-worker form — uses first worker for live display
  // Full multi-worker grid would iterate workers; this delivers the CPAY-01 behavior
  const firstWorker = workers[0];

  const methods = useForm<PayrollWeekFormValues>({
    defaultValues: {
      weekEndingDate: '',
      payrollNumber: 1,
      baseRate: firstWorker?.baseRate ?? 0,
      fringeRate: firstWorker?.fringeRate ?? 0,
      fringeHealthWelfare: 0,
      fringePension: 0,
      fringeVacation: 0,
      fringeTraining: 0,
      monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
      monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
      monDt: 0, tueDt: 0, wedDt: 0, thuDt: 0, friDt: 0, satDt: 0, sunDt: 0,
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = methods;

  const watchedFringe = watch(['fringeHealthWelfare', 'fringePension', 'fringeVacation', 'fringeTraining']);
  useEffect(() => {
    if (isCA) {
      const sum = (watchedFringe[0] || 0) + (watchedFringe[1] || 0) + (watchedFringe[2] || 0) + (watchedFringe[3] || 0);
      setValue('fringeRate', parseFloat(sum.toFixed(2)));
    }
  }, [isCA, watchedFringe, setValue]);

  async function onSubmit(data: PayrollWeekFormValues) {
    // 1. Create the payroll week
    const weekRes = await fetch('/api/payroll/weeks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        weekEndingDate: data.weekEndingDate,
        payrollNumber: data.payrollNumber,
      }),
    });

    if (!weekRes.ok) {
      throw new Error('Failed to create payroll week');
    }

    const { id: weekId } = await weekRes.json() as { id: string };

    // 2. Upsert entry for the first worker (multi-worker extension in Phase 4 plans 02-04)
    if (firstWorker) {
      await fetch(`/api/payroll/entries/${weekId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollWeekId: weekId,
          workerId: firstWorker.workerId,
          classificationId: firstWorker.classificationId,
          monSt: data.monSt,
          tueSt: data.tueSt,
          wedSt: data.wedSt,
          thuSt: data.thuSt,
          friSt: data.friSt,
          satSt: data.satSt,
          sunSt: data.sunSt,
          monOt: data.monOt,
          tueOt: data.tueOt,
          wedOt: data.wedOt,
          thuOt: data.thuOt,
          friOt: data.friOt,
          satOt: data.satOt,
          sunOt: data.sunOt,
          ...(isCA ? {
            monDt: data.monDt || 0,
            tueDt: data.tueDt || 0,
            wedDt: data.wedDt || 0,
            thuDt: data.thuDt || 0,
            friDt: data.friDt || 0,
            satDt: data.satDt || 0,
            sunDt: data.sunDt || 0,
          } : {}),
          baseRateSnapshot: data.baseRate,
          fringeRateSnapshot: data.fringeRate,
          ...(isCA ? {
            fringeHealthWelfare: data.fringeHealthWelfare || 0,
            fringePension: data.fringePension || 0,
            fringeVacation: data.fringeVacation || 0,
            fringeTraining: data.fringeTraining || 0,
          } : {}),
        }),
      });
    }

    onSave(weekId);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header fields */}
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Week Ending Date
            </label>
            <input
              type="date"
              {...register('weekEndingDate', { required: 'Required' })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-hidden focus:ring-1 focus:ring-brand-gold"
            />
            {errors.weekEndingDate && (
              <p className="text-xs text-red-500 mt-0.5">{errors.weekEndingDate.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Payroll #
            </label>
            <input
              type="number"
              min={1}
              {...register('payrollNumber', { required: true, valueAsNumber: true, min: 1 })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-hidden focus:ring-1 focus:ring-brand-gold"
            />
          </div>
        </div>

        {/* Rate fields (hidden but watched by LiveCalcDisplay) */}
        <input type="hidden" {...register('baseRate', { valueAsNumber: true })} />
        <input type="hidden" {...register('fringeRate', { valueAsNumber: true })} />

        {/* CA fringe disaggregation fields */}
        {isCA && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-sm font-semibold text-amber-900 mb-2">CA Fringe Contributions (per hour)</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Health &amp; Welfare</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('fringeHealthWelfare', { valueAsNumber: true })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Pension</label>
                <input type="number" step="0.01" min="0" {...register('fringePension', { valueAsNumber: true })} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Vacation</label>
                <input type="number" step="0.01" min="0" {...register('fringeVacation', { valueAsNumber: true })} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Training</label>
                <input type="number" step="0.01" min="0" {...register('fringeTraining', { valueAsNumber: true })} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">Sum auto-fills the fringe rate below.</p>
          </div>
        )}

        {/* Hours grid */}
        {workers.length === 0 ? (
          <p className="text-sm text-gray-500">
            No workers assigned to this project yet. Add workers before entering payroll.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-48">
                    Worker / Trade
                  </th>
                  {DAYS.map((d) => (
                    <th key={`${d}-st`} className="text-center px-1 py-2 font-medium text-gray-600 w-16">
                      {DAY_LABELS[d]} ST
                    </th>
                  ))}
                  {DAYS.map((d) => (
                    <th key={`${d}-ot`} className="text-center px-1 py-2 font-medium text-amber-600 w-16">
                      {DAY_LABELS[d]} OT
                    </th>
                  ))}
                  {isCA && DAYS.map((d) => (
                    <th key={`${d}-dt`} className="text-center px-1 py-2 font-medium text-amber-800 w-16">
                      {DAY_LABELS[d]} DT
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr
                    key={`${worker.workerId}-${worker.classificationId}`}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{worker.workerName}</div>
                      <div className="text-gray-500">{worker.tradeDescription}</div>
                      <div className="text-gray-400">
                        ${worker.baseRate.toFixed(2)} + ${worker.fringeRate.toFixed(2)}/hr
                      </div>
                    </td>
                    {DAYS.map((d) => (
                      <td key={`${d}-st`} className="px-1 py-2 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          {...register(`${d}St` as keyof PayrollWeekFormValues, {
                            valueAsNumber: true,
                            min: 0,
                          })}
                          className="w-14 px-1 py-1 text-center border border-gray-200 rounded text-xs focus:outline-hidden focus:border-gray-400"
                        />
                      </td>
                    ))}
                    {DAYS.map((d) => (
                      <td key={`${d}-ot`} className="px-1 py-2 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          {...register(`${d}Ot` as keyof PayrollWeekFormValues, {
                            valueAsNumber: true,
                            min: 0,
                          })}
                          className="w-14 px-1 py-1 text-center border border-amber-200 rounded text-xs focus:outline-hidden focus:border-amber-400"
                        />
                      </td>
                    ))}
                    {isCA && DAYS.map((d) => (
                      <td key={`${d}-dt`} className="px-1 py-2 text-center">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          {...register(`${d}Dt` as keyof PayrollWeekFormValues, { valueAsNumber: true })}
                          className="w-14 rounded border border-amber-300 px-1 py-0.5 text-center text-sm"
                          defaultValue={0}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Live calculation panel */}
        <LiveCalcDisplay />

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || workers.length === 0}
            className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Saving...' : 'Save Payroll Week'}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
