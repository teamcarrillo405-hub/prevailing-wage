// src/client/pages/VarianceReportPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { VarianceSummaryTable } from '../components/VarianceSummaryTable.js';
import { VarianceTrendChart } from '../components/VarianceTrendChart.js';
import type { VarianceReport } from '../../server/services/varianceService.js';
import { PageHeader } from '../components/ui/PageHeader';

interface BudgetFormValues {
  bidAmount?: number;
  workingBudget: number;
  totalWeeks: number;
  varianceThresholdPct: number;
}

interface Props {
  projectId: string;
}

export function VarianceReportPage({ projectId }: Props) {
  const [report, setReport] = useState<VarianceReport | null>(null);
  const [noBudget, setNoBudget] = useState(false);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<BudgetFormValues>({
    defaultValues: { varianceThresholdPct: 10, totalWeeks: 52 },
  });

  const loadReport = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/variance/${projectId}/report`, { credentials: 'include' });
    if (res.status === 404) {
      setNoBudget(true);
      setReport(null);
    } else if (res.ok) {
      setNoBudget(false);
      setReport(await res.json());
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  async function onSetBudget(values: BudgetFormValues) {
    await fetch(`/api/variance/${projectId}/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(values),
    });
    await loadReport();
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <PageHeader
        title="Job Cost Variance Report"
        action={report && report.weeks.length > 0 ? (
          <a
            href={`/api/variance/${projectId}/report/pdf`}
            className="text-sm font-medium text-brand-gold hover:underline"
          >
            Export PDF
          </a>
        ) : undefined}
      />

      {noBudget && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold text-amber-900 mb-3">Configure Project Budget</h2>
          <p className="text-sm text-amber-800 mb-4">
            Set a working budget and total week count to enable variance reporting.
            Burn rate is calculated linearly: working budget / total weeks.
          </p>
          <form onSubmit={handleSubmit(onSetBudget)} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Working Budget ($)</label>
              <input
                type="number" step="0.01"
                {...register('workingBudget', { required: 'Required', valueAsNumber: true, min: 0.01 })}
                className="w-full border border-amber-300 rounded px-3 py-1.5 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Total Weeks</label>
              <input
                type="number"
                {...register('totalWeeks', { required: 'Required', valueAsNumber: true, min: 1 })}
                className="w-full border border-amber-300 rounded px-3 py-1.5 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Original Bid ($, optional)</label>
              <input
                type="number" step="0.01"
                {...register('bidAmount', { valueAsNumber: true, min: 0 })}
                className="w-full border border-amber-300 rounded px-3 py-1.5 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Flag Threshold (%)</label>
              <input
                type="number" step="0.1"
                {...register('varianceThresholdPct', { valueAsNumber: true, min: 0, max: 100 })}
                className="w-full border border-amber-300 rounded px-3 py-1.5 text-sm bg-white"
              />
            </div>
            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#F5C518] text-black text-sm font-semibold px-4 py-2 rounded hover:bg-yellow-400 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Set Budget'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {report && !loading && (
        <>
          <VarianceSummaryTable report={report} />
          <VarianceTrendChart weeks={report.weeks} />
        </>
      )}
    </div>
  );
}
