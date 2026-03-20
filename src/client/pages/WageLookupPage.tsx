// src/client/pages/WageLookupPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WageClassificationsTable } from '../components/WageClassificationsTable.js';
import { ManualWageEntryForm } from '../components/ManualWageEntryForm.js';
import type { WageDetermination, WageClassification } from '../../shared/types.js';

interface LookupResult {
  wd: WageDetermination;
  classifications: WageClassification[];
}

async function fetchWageLookup(state: string, county: string): Promise<LookupResult> {
  const res = await fetch(
    `/api/wages/lookup?state=${encodeURIComponent(state)}&county=${encodeURIComponent(county)}`,
    { credentials: 'include' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Lookup failed' }));
    const e = new Error(err.error ?? 'Lookup failed') as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return res.json() as Promise<LookupResult>;
}

export function WageLookupPage() {
  const [stateInput, setStateInput] = useState('');
  const [countyInput, setCountyInput] = useState('');
  const [submitted, setSubmitted] = useState<{ state: string; county: string } | null>(null);
  const [manualResult, setManualResult] = useState<WageDetermination | null>(null);

  const { data, isLoading, error } = useQuery<LookupResult, Error & { status?: number }>({
    queryKey: ['wages', 'lookup', submitted?.state, submitted?.county],
    queryFn: () => fetchWageLookup(submitted!.state, submitted!.county),
    enabled: Boolean(submitted),
    retry: false, // Don't retry 404s
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stateInput.trim() || !countyInput.trim()) return;
    setManualResult(null);
    setSubmitted({ state: stateInput.trim().toUpperCase(), county: countyInput.trim() });
  };

  const is404 = (error as any)?.status === 404;
  const showManualForm = Boolean(submitted && (is404 || manualResult));

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="font-headline text-2xl font-bold text-gray-900 mb-6">
        Prevailing Wage Lookup
      </h1>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
          <input
            type="text"
            value={stateInput}
            onChange={(e) => setStateInput(e.target.value.toUpperCase())}
            placeholder="CA"
            maxLength={2}
            className="w-20 border border-gray-300 rounded px-3 py-2 text-sm uppercase"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">County</label>
          <input
            type="text"
            value={countyInput}
            onChange={(e) => setCountyInput(e.target.value)}
            placeholder="Los Angeles"
            className="w-56 border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="px-5 py-2 rounded font-semibold text-gray-900 bg-brand-gold"
          >
            Search
          </button>
        </div>
      </form>

      {isLoading && <p className="text-sm text-gray-500">Searching...</p>}

      {data && !manualResult && (
        <div>
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="font-semibold text-gray-600">WD Number</dt>
                <dd className="font-mono">{data.wd.wdNumber}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-600">Location</dt>
                <dd>{data.wd.county}, {data.wd.state}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-600">Source</dt>
                <dd className="uppercase text-xs font-mono bg-gray-200 px-2 py-0.5 rounded inline-block">
                  {data.wd.source}
                </dd>
              </div>
              {data.wd.constructionType && (
                <div>
                  <dt className="font-semibold text-gray-600">Construction Type</dt>
                  <dd>{data.wd.constructionType}</dd>
                </div>
              )}
              {data.wd.publishDate && (
                <div>
                  <dt className="font-semibold text-gray-600">Publish Date</dt>
                  <dd>{data.wd.publishDate}</dd>
                </div>
              )}
            </dl>
          </div>
          <WageClassificationsTable classifications={data.classifications} />
        </div>
      )}

      {manualResult && (
        <div>
          <p className="text-sm text-green-700 mb-3">Manual entry saved successfully.</p>
          <WageClassificationsTable classifications={manualResult.classifications ?? []} />
        </div>
      )}

      {submitted && is404 && !manualResult && (
        <div>
          <p className="text-sm text-gray-600 mb-2">
            No federal wage determination found for {submitted.county}, {submitted.state}.
          </p>
          <ManualWageEntryForm
            state={submitted.state}
            county={submitted.county}
            onSuccess={(wd) => setManualResult(wd)}
          />
        </div>
      )}

      {error && !is404 && (
        <p className="text-sm text-red-700">Error: {error.message}</p>
      )}
    </div>
  );
}
