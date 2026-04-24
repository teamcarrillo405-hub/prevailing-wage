// src/client/pages/WageLookupPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WageClassificationsTable } from '../components/WageClassificationsTable.js';
import { ManualWageEntryForm } from '../components/ManualWageEntryForm.js';
import type { WageDetermination, WageClassification } from '../../shared/types.js';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const CONSTRUCTION_TYPES = ['Building', 'Heavy', 'Highway', 'Residential'] as const;
type ConstructionType = typeof CONSTRUCTION_TYPES[number];

interface LookupResult {
  wds: WageDetermination[];
  classifications: WageClassification[][];
}

interface FetchResult {
  wd: WageDetermination;
  classifications: WageClassification[];
}

async function fetchWageLookup(state: string, county: string, constructionType?: string): Promise<LookupResult> {
  const params = new URLSearchParams({ state, county });
  if (constructionType) params.set('constructionType', constructionType);
  const res = await fetch(`/api/wages/lookup?${params}`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Lookup failed' }));
    const e = new Error(err.error ?? 'Lookup failed') as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return res.json() as Promise<LookupResult>;
}

async function fetchByWdNumber(wdNumber: string): Promise<FetchResult> {
  const res = await fetch(`/api/wages/fetch?wdNumber=${encodeURIComponent(wdNumber)}`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Not found' }));
    const e = new Error(err.error ?? 'Not found') as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return res.json();
}

// ─── WdCard ──────────────────────────────────────────────────────────────────

interface WdCardProps {
  wd: WageDetermination;
  classifications: WageClassification[];
}

function WdCard({ wd, classifications }: WdCardProps) {
  const [pinProjectId, setPinProjectId] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const { data: projectsData } = useQuery<{ data: { projects: { id: string; name: string }[] } }>({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects', { credentials: 'include' }).then((r) => r.json()),
  });
  const projects = projectsData?.data?.projects ?? [];

  const handlePin = async () => {
    if (!pinProjectId) return;
    setPinStatus('loading');
    try {
      const res = await fetch(`/api/projects/${pinProjectId}/wage-determinations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wageDeterminationId: wd.id, constructionType: wd.constructionType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? 'Pin failed');
      }
      setPinStatus('done');
    } catch {
      setPinStatus('error');
    }
  };

  return (
    <div className="border rounded-lg p-4 mb-3 bg-white shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-gray-900">{wd.wdNumber}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {wd.constructionType ?? 'All types'} · {wd.county ?? 'Statewide'} · Rev {wd.revisionNumber} · {wd.publishDate ?? 'Unknown date'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <select
              className="text-xs border rounded px-2 py-1"
              value={pinProjectId}
              onChange={(e) => { setPinProjectId(e.target.value); setPinStatus('idle'); }}
            >
              <option value="">Pin to project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {pinProjectId && pinStatus !== 'done' && (
            <Button size="sm" onClick={handlePin} disabled={pinStatus === 'loading'}>
              {pinStatus === 'loading' ? 'Pinning…' : 'Pin'}
            </Button>
          )}
          {pinStatus === 'done' && <span className="text-xs text-green-600">Pinned ✓</span>}
          {pinStatus === 'error' && <span className="text-xs text-red-600">Error — already pinned?</span>}
        </div>
      </div>
      {classifications.length > 0 && (
        <div className="mt-2">
          <WageClassificationsTable classifications={classifications} />
        </div>
      )}
    </div>
  );
}

// ─── WageLookupPage ───────────────────────────────────────────────────────────

function getInitialParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

export function WageLookupPage() {
  const [stateInput, setStateInput] = useState(() => getInitialParam('state').toUpperCase());
  const [countyInput, setCountyInput] = useState(() => getInitialParam('county'));
  const [constructionType, setConstructionType] = useState<ConstructionType | ''>('');
  const [submitted, setSubmitted] = useState<{ state: string; county: string; constructionType?: string } | null>(null);
  const [manualResult, setManualResult] = useState<WageDetermination | null>(null);

  // "Fetch by WD Number" section state
  const [wdNumberInput, setWdNumberInput] = useState('');
  const [submittedWdNumber, setSubmittedWdNumber] = useState<string | null>(null);

  // State/county lookup
  const { data, isLoading, error } = useQuery<LookupResult, Error & { status?: number }>({
    queryKey: ['wages', 'lookup', submitted?.state, submitted?.county, submitted?.constructionType],
    queryFn: () => fetchWageLookup(submitted!.state, submitted!.county, submitted!.constructionType),
    enabled: Boolean(submitted),
    retry: false,
  });

  // Direct WD number lookup
  const { data: wdFetchData, isLoading: wdFetchLoading, error: wdFetchError } = useQuery<FetchResult, Error & { status?: number }>({
    queryKey: ['wages', 'fetch', submittedWdNumber],
    queryFn: () => fetchByWdNumber(submittedWdNumber!),
    enabled: Boolean(submittedWdNumber),
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stateInput.trim() || !countyInput.trim()) return;
    setManualResult(null);
    setSubmitted({
      state: stateInput.trim().toUpperCase(),
      county: countyInput.trim(),
      constructionType: constructionType || undefined,
    });
  };

  const handleWdFetch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wdNumberInput.trim()) return;
    setSubmittedWdNumber(wdNumberInput.trim().toUpperCase());
  };

  const is404 = (error as any)?.status === 404;
  const showManualForm = Boolean(submitted && (is404 || manualResult));

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader title="Prevailing Wage Lookup" />

      {/* State / County / Construction Type search */}
      <form onSubmit={handleSearch} className="flex items-end gap-3 mb-8 flex-wrap">
        <Input
          label="State"
          value={stateInput}
          onChange={(e) => setStateInput(e.target.value.toUpperCase())}
          placeholder="CA"
          maxLength={2}
          className="w-20 uppercase"
        />
        <Input
          label="County"
          value={countyInput}
          onChange={(e) => setCountyInput(e.target.value)}
          placeholder="Los Angeles"
          className="w-56"
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700">Construction Type</label>
          <select
            className="text-sm border border-gray-300 rounded px-2 py-2 bg-white"
            value={constructionType}
            onChange={(e) => setConstructionType(e.target.value as ConstructionType | '')}
          >
            <option value="">Any</option>
            {CONSTRUCTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Button type="submit">Search</Button>
      </form>

      {isLoading && <p className="text-sm text-gray-500">Searching…</p>}

      {data && !manualResult && (
        <div className="mb-8">
          {data.wds.map((wd, i) => (
            <WdCard key={wd.id} wd={wd} classifications={data.classifications[i] ?? []} />
          ))}
        </div>
      )}

      {manualResult && (
        <div className="mb-8">
          <p className="text-sm text-green-700 mb-3">Manual entry saved successfully.</p>
          <WageClassificationsTable classifications={manualResult.classifications ?? []} />
        </div>
      )}

      {submitted && is404 && !manualResult && (
        <div className="mb-8">
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
        <p className="text-sm text-red-700 mb-8">Error: {error.message}</p>
      )}

      {/* Fetch by WD Number */}
      <div className="border-t pt-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Fetch by WD Number</h2>
        <form onSubmit={handleWdFetch} className="flex items-end gap-3 mb-4">
          <Input
            label="WD Number"
            value={wdNumberInput}
            onChange={(e) => setWdNumberInput(e.target.value.toUpperCase())}
            placeholder="CA20250001"
            className="w-48 uppercase"
          />
          <Button type="submit">Fetch</Button>
        </form>

        {wdFetchLoading && <p className="text-sm text-gray-500">Fetching…</p>}

        {wdFetchData && (
          <WdCard wd={wdFetchData.wd} classifications={wdFetchData.classifications} />
        )}

        {wdFetchError && (
          <p className="text-sm text-red-600">
            {(wdFetchError as any)?.status === 404
              ? `WD not found on SAM.gov. Enter rates manually.`
              : wdFetchError.message}
          </p>
        )}
      </div>
    </div>
  );
}
