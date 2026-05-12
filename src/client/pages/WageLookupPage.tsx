// src/client/pages/WageLookupPage.tsx
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

interface WdCardProps {
  wd: WageDetermination;
  classifications: WageClassification[];
  defaultProjectId?: string;
}

function buildWdClipboardText(wd: WageDetermination): string {
  return [
    `WD Number: ${wd.wdNumber}`,
    `Revision/Modification: ${wd.revisionNumber}`,
    `State: ${wd.state}`,
    `County: ${wd.county ?? 'Statewide'}`,
    `Construction Type: ${wd.constructionType ?? 'All types'}`,
    `Published: ${wd.publishDate ?? 'Unknown date'}`,
  ].join('\n');
}

function WdCard({ wd, classifications, defaultProjectId }: WdCardProps) {
  const navigate = useNavigate();
  const [pinProjectId, setPinProjectId] = useState(defaultProjectId ?? '');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const { data: projectsData } = useQuery<{ data: { projects: { id: string; name: string }[] } }>({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects', { credentials: 'include' }).then((r) => r.json()),
  });
  const projects = projectsData?.data?.projects ?? [];
  const selectedProjectName = projects.find((project) => project.id === pinProjectId)?.name;

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
      window.setTimeout(() => {
        navigate(`/projects/${pinProjectId}#wage-determinations`);
      }, 650);
    } catch {
      setPinStatus('error');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildWdClipboardText(wd));
    setCopyStatus('copied');
    window.setTimeout(() => setCopyStatus('idle'), 2000);
  };

  return (
    <div className="mb-3 rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Use this number to lock the project WD</p>
          <p className="mt-1 font-mono text-base font-semibold text-gray-900">{wd.wdNumber}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {wd.constructionType ?? 'All types'} - {wd.county ?? 'Statewide'} - Rev {wd.revisionNumber} - {wd.publishDate ?? 'Unknown date'}
          </p>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Confirm this WD matches the award documents, county, construction type, and contract date. After it is locked to a project, worker trade codes use these rates automatically.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          {projects.length > 0 && (
            <select
              aria-label="Project to lock this wage determination to"
              className="min-h-[44px] rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm"
              value={pinProjectId}
              onChange={(e) => { setPinProjectId(e.target.value); setPinStatus('idle'); }}
            >
              <option value="">Choose project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <Button size="sm" variant="secondary" onClick={handleCopy}>
            {copyStatus === 'copied' ? 'Copied' : 'Copy WD details'}
          </Button>
          {pinProjectId && (
            <Button size="sm" onClick={handlePin} disabled={pinStatus === 'loading' || pinStatus === 'done'}>
              {pinStatus === 'loading'
                ? 'Locking...'
                : pinStatus === 'done'
                  ? 'Locked'
                  : selectedProjectName
                    ? `Lock to ${selectedProjectName}`
                    : 'Lock to project'}
            </Button>
          )}
        </div>
      </div>
      {pinStatus === 'done' && (
        <p className="mt-3 rounded-sm border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          WD locked. Returning to the project wage determination panel.
        </p>
      )}
      {pinStatus === 'error' && (
        <p className="mt-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not lock this WD. It may already be pinned to that project.
        </p>
      )}
      {classifications.length > 0 && (
        <div className="mt-3">
          <WageClassificationsTable classifications={classifications} />
        </div>
      )}
    </div>
  );
}

function getInitialParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

export function WageLookupPage() {
  const navigate = useNavigate();
  const [stateInput, setStateInput] = useState(() => getInitialParam('state').toUpperCase());
  const [countyInput, setCountyInput] = useState(() => getInitialParam('county'));
  const defaultProjectId = getInitialParam('projectId');
  const [constructionType, setConstructionType] = useState<ConstructionType | ''>('');
  const [submitted, setSubmitted] = useState<{ state: string; county: string; constructionType?: string } | null>(null);
  const [manualResult, setManualResult] = useState<WageDetermination | null>(null);

  const [wdNumberInput, setWdNumberInput] = useState('');
  const [submittedWdNumber, setSubmittedWdNumber] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<LookupResult, Error & { status?: number }>({
    queryKey: ['wages', 'lookup', submitted?.state, submitted?.county, submitted?.constructionType],
    queryFn: () => fetchWageLookup(submitted!.state, submitted!.county, submitted!.constructionType),
    enabled: Boolean(submitted),
    retry: false,
  });

  const { data: wdFetchData, isLoading: wdFetchLoading, error: wdFetchError } = useQuery<FetchResult, Error & { status?: number }>({
    queryKey: ['wages', 'fetch', submittedWdNumber],
    queryFn: () => fetchByWdNumber(submittedWdNumber!),
    enabled: Boolean(submittedWdNumber),
    retry: false,
  });

  useEffect(() => {
    if (!stateInput.trim() || !countyInput.trim()) return;
    setSubmitted({
      state: stateInput.trim().toUpperCase(),
      county: countyInput.trim(),
      constructionType: constructionType || undefined,
    });
  // Run once for project setup deep links so the contractor does not need a second Search click.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-[44px] items-center rounded-sm border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex min-h-[44px] items-center rounded-sm border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
        >
          Dashboard
        </button>
        {defaultProjectId && (
          <button
            type="button"
            onClick={() => navigate(`/projects/${defaultProjectId}#wage-determinations`)}
            className="inline-flex min-h-[44px] items-center rounded-sm border border-brand-gold px-3 py-2 font-medium text-brand-gold hover:bg-brand-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
          >
            Project WD panel
          </button>
        )}
      </div>

      <PageHeader title="Prevailing Wage Lookup" />

      <section className="mb-6 rounded-sm border border-blue-200 bg-blue-50 p-4">
        <h2 className="text-sm font-semibold text-blue-950">What you are looking for</h2>
        <p className="mt-1 text-sm text-blue-900">
          The main number is the federal WD number, plus its revision/modification. Match it to the award location, construction type, and contract date. Then click Lock to project.
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-sm border border-blue-100 bg-white/70 p-3">
            <p className="font-semibold text-gray-900">1. WD number</p>
            <p className="text-gray-600">Example: CA20260001. This locks the source document.</p>
          </div>
          <div className="rounded-sm border border-blue-100 bg-white/70 p-3">
            <p className="font-semibold text-gray-900">2. Revision</p>
            <p className="text-gray-600">Use the modification required by the contract award documents.</p>
          </div>
          <div className="rounded-sm border border-blue-100 bg-white/70 p-3">
            <p className="font-semibold text-gray-900">3. Trade row</p>
            <p className="text-gray-600">Worker classification pulls base, fringe, and total rate from the locked WD.</p>
          </div>
        </div>
      </section>

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

      {isLoading && <p className="text-sm text-gray-500">Searching...</p>}

      {data && !manualResult && (
        <div className="mb-8">
          {data.wds.map((wd, i) => (
            <WdCard
              key={wd.id}
              wd={wd}
              classifications={data.classifications[i] ?? []}
              defaultProjectId={defaultProjectId}
            />
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

      <div className="border-t pt-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Fetch by WD Number</h2>
        <form onSubmit={handleWdFetch} className="flex items-end gap-3 mb-4">
          <Input
            label="WD Number"
            value={wdNumberInput}
            onChange={(e) => setWdNumberInput(e.target.value.toUpperCase())}
            placeholder="CA20260001"
            className="w-48 uppercase"
          />
          <Button type="submit">Fetch</Button>
        </form>

        {wdFetchLoading && <p className="text-sm text-gray-500">Fetching...</p>}

        {wdFetchData && (
          <WdCard
            wd={wdFetchData.wd}
            classifications={wdFetchData.classifications}
            defaultProjectId={defaultProjectId}
          />
        )}

        {wdFetchError && (
          <p className="text-sm text-red-600">
            {(wdFetchError as any)?.status === 404
              ? 'WD not found on SAM.gov. Enter rates manually.'
              : wdFetchError.message}
          </p>
        )}
      </div>
    </div>
  );
}
