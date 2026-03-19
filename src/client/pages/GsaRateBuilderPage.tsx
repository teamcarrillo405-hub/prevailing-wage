// src/client/pages/GsaRateBuilderPage.tsx
import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { GsaRateForm, type GsaRateFormValues } from '../components/GsaRateForm.js';
import { GsaRateDisplay } from '../components/GsaRateDisplay.js';

interface SavedRate extends GsaRateFormValues {
  id: string;
  billableRate: number;
}

interface Props {
  projectId: string;
}

export function GsaRateBuilderPage({ projectId }: Props) {
  const methods = useForm<GsaRateFormValues>({
    defaultValues: { baseRate: 0, fringeRate: 0, overheadPct: 0, gaPct: 0, profitPct: 0, name: '' },
  });
  const [savedRates, setSavedRates] = useState<SavedRate[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/gsa/${projectId}/rates`, { credentials: 'include' })
      .then(r => r.json())
      .then(setSavedRates)
      .catch(() => {});
  }, [projectId]);

  async function onSave(values: GsaRateFormValues) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/gsa/${projectId}/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json();
        setSaveError(JSON.stringify(body.error));
        return;
      }
      const created = await res.json();
      setSavedRates(prev => [...prev, created]);
      methods.reset();
    } catch (_err) {
      setSaveError('Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">GSA Rate Builder</h1>

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSave)} className="space-y-4">
          <GsaRateForm />
          <GsaRateDisplay />
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#F5C518] text-black text-sm font-semibold px-4 py-2 rounded hover:bg-yellow-400 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Rate'}
            </button>
          </div>
        </form>
      </FormProvider>

      {savedRates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Saved Rates
          </h2>
          <div className="space-y-2">
            {savedRates.map(rate => (
              <div key={rate.id} className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{rate.name}</div>
                  <div className="text-xs text-gray-500">
                    OH {rate.overheadPct}% / G&A {rate.gaPct}% / Profit {rate.profitPct}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-[#F5C518]">
                    {rate.billableRate.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}/hr
                  </div>
                  <div className="text-xs text-gray-500">billable rate</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
