// src/client/pages/VarianceReportPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { VarianceSummaryTable } from '../components/VarianceSummaryTable.js';
import { VarianceTrendChart } from '../components/VarianceTrendChart.js';
import type { VarianceReport } from '../../server/services/varianceService.js';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

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
    const statusRes = await fetch(`/api/variance/${projectId}/status`, { credentials: 'include' });
    const status = statusRes.ok ? await statusRes.json() as { configured: boolean } : { configured: false };
    if (!status.configured) {
      setNoBudget(true);
      setReport(null);
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/variance/${projectId}/report`, { credentials: 'include' });
    if (res.ok) {
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
          <form onSubmit={handleSubmit(onSetBudget)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="variance-working-budget" className="block text-xs font-medium text-amber-900 mb-1">Working Budget ($)</label>
              <input
                id="variance-working-budget"
                type="number" step="0.01"
                {...register('workingBudget', { required: 'Required', valueAsNumber: true, min: 0.01 })}
                className="min-h-11 w-full rounded border border-amber-300 bg-white px-3 text-base"
              />
            </div>
            <div>
              <label htmlFor="variance-total-weeks" className="block text-xs font-medium text-amber-900 mb-1">Total Weeks</label>
              <input
                id="variance-total-weeks"
                type="number"
                {...register('totalWeeks', { required: 'Required', valueAsNumber: true, min: 1 })}
                className="min-h-11 w-full rounded border border-amber-300 bg-white px-3 text-base"
              />
            </div>
            <div>
              <label htmlFor="variance-bid-amount" className="block text-xs font-medium text-amber-900 mb-1">Original Bid ($, optional)</label>
              <input
                id="variance-bid-amount"
                type="number" step="0.01"
                {...register('bidAmount', { valueAsNumber: true, min: 0 })}
                className="min-h-11 w-full rounded border border-amber-300 bg-white px-3 text-base"
              />
            </div>
            <div>
              <label htmlFor="variance-threshold" className="block text-xs font-medium text-amber-900 mb-1">Flag Threshold (%)</label>
              <input
                id="variance-threshold"
                type="number" step="0.1"
                {...register('varianceThresholdPct', { valueAsNumber: true, min: 0, max: 100 })}
                className="min-h-11 w-full rounded border border-amber-300 bg-white px-3 text-base"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Set Budget'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {loading && <LoadingSpinner />}

      {report && !loading && (
        <>
          <VarianceSummaryTable report={report} />
          <VarianceTrendChart weeks={report.weeks} />
        </>
      )}
    </div>
  );
}
