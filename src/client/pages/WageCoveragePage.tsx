// src/client/pages/WageCoveragePage.tsx
//
// Admin view: federal Davis-Bacon wage determination coverage proof.
// Separates the known DOL/SAM.gov WD index from the local document/classification cache.

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '../components/ui/Table';
import { useToast } from '../contexts/ToastContext';

interface StateCoverage {
  state: string;
  seededWds: number;
  seededCountyKeys: number;
  wdCount: number;
  countyCount: number;
  cached: number;
  fresh: number;
  expired: number;
  classificationCount: number;
  uncachedSeededWds: number;
  percentCached: number;
}

interface SyncMeta {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  wdsFetched: number | null;
  wdsFailed: number | null;
  errorMessage?: string | null;
}

interface CoverageResponse {
  source: {
    label: string;
    federalScope: string;
    verifiedAt: string;
    syncModel: string;
  };
  byState: StateCoverage[];
  totalStates: number;
  totalSeededStates: number;
  totalSeededWds: number;
  totalSeededCountyKeys: number;
  totalWds: number;
  totalCounties: number;
  totalCachedDocuments: number;
  totalFreshWds: number;
  totalExpiredWds: number;
  totalClassifications: number;
  totalUncachedSeededWds: number;
  percentSeedCacheComplete: number;
  latestSync: SyncMeta | null;
}

interface CountyCoverageResponse {
  source: {
    label: string;
    url: string;
    retrievedAt: string;
    scope: string;
  };
  totals: {
    states: number;
    censusCountyEquivalents: number;
    explicitlyMatchedCounties: number;
    statewideFallbackCoveredCounties: number;
    missingCounties: number;
    coveragePercent: number;
    statesWithStatewideFallback: number;
  };
  byState: Array<{
    state: string;
    stateName: string;
    censusCountyEquivalents: number;
    namedWdCountyKeys: number;
    explicitCountyMatches: number;
    statewideWds: number;
    statewideFallbackCoveredCounties: number;
    missingCounties: number;
    coveragePercent: number;
  }>;
  missing: Array<{
    state: string;
    stateName: string;
    countyName: string;
    stateFips: string;
    countyFips: string;
  }>;
}

async function fetchCoverage(): Promise<CoverageResponse> {
  const res = await fetch('/api/wages/coverage', { credentials: 'include' });
  if (!res.ok) throw new Error(`Coverage fetch failed: ${res.status}`);
  return res.json();
}

async function fetchCountyCoverage(): Promise<CountyCoverageResponse> {
  const res = await fetch('/api/wages/county-coverage', { credentials: 'include' });
  if (!res.ok) throw new Error(`County coverage fetch failed: ${res.status}`);
  return res.json();
}

async function triggerSync(): Promise<void> {
  const res = await fetch('/api/wages/sync', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 202) throw new Error(`Sync trigger failed: ${res.status}`);
}

export function WageCoveragePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['wage-coverage'],
    queryFn: fetchCoverage,
    refetchInterval: 60_000,
  });
  const {
    data: countyCoverage,
    isLoading: countyCoverageLoading,
    error: countyCoverageError,
  } = useQuery({
    queryKey: ['wage-county-coverage'],
    queryFn: fetchCountyCoverage,
    staleTime: 60 * 60_000,
  });

  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerSync();
      toast.info('Sync started. Federal WD documents will populate in the background.');
      setTimeout(() => refetch(), 2000);
    } catch (e) {
      toast.error(`Sync failed: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      <PageHeader
        title="Federal WD Coverage Proof"
        subtitle="Davis-Bacon wage determinations sourced from DOL/SAM.gov, with cache freshness and classification depth."
        action={
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`size-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Triggering...' : 'Sync Now'}
          </Button>
        }
      />

      {isLoading && <p className="text-sm text-gray-500">Loading coverage...</p>}
      {error && <p className="text-sm text-red-600">Error: {(error as Error).message}</p>}

      {data && (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ShieldCheck className="size-4 text-green-700" />
                  Federal source of truth
                </div>
                <p className="mt-1 max-w-3xl text-sm text-gray-600">
                  {data.source.label} for {data.source.federalScope}. The platform keeps a known federal WD index and fetches cached documents and classifications for project use.
                </p>
                <p className="mt-2 text-xs text-gray-500">{data.source.syncModel}</p>
              </div>
              <div className="text-left md:text-right">
                <div className="text-xs uppercase tracking-wide text-gray-500">Verified</div>
                <div className="text-sm font-medium text-gray-900">{new Date(data.source.verifiedAt).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Known Federal WDs" value={data.totalSeededWds} hint={`${data.totalSeededStates} states, ${data.totalSeededCountyKeys} county keys`} />
            <StatCard label="Cached WD Records" value={data.totalWds} hint={`${data.percentSeedCacheComplete}% of known federal index`} />
            <StatCard label="Classifications" value={data.totalClassifications} hint="parsed wage rows ready for payroll validation" />
            <StatCard label="Fresh Documents" value={data.totalFreshWds} hint={`${data.totalExpiredWds} expired or stale`} />
          </div>

          <div className={`rounded-lg border p-4 ${data.totalUncachedSeededWds === 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-start gap-3">
              {data.totalUncachedSeededWds === 0 ? (
                <CheckCircle2 className="mt-0.5 size-5 text-green-700" />
              ) : (
                <AlertTriangle className="mt-0.5 size-5 text-amber-700" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Demo readiness</h3>
                <p className="mt-1 text-sm text-gray-700">
                  {data.totalUncachedSeededWds === 0
                    ? 'Every known federal WD in the local index has a cached record.'
                    : `${data.totalUncachedSeededWds.toLocaleString()} known federal WDs still need document fetch/cache before claiming full national cache completion. Project lookup can still fetch by WD number on demand.`}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-lg border p-4 ${countyCoverage?.totals.missingCounties === 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  {countyCoverage?.totals.missingCounties === 0 ? (
                    <CheckCircle2 className="size-4 text-green-700" />
                  ) : (
                    <AlertTriangle className="size-4 text-amber-700" />
                  )}
                  County coverage audit
                </div>
                {countyCoverageLoading && <p className="mt-1 text-sm text-gray-600">Auditing Census county coverage...</p>}
                {countyCoverageError && <p className="mt-1 text-sm text-red-700">{(countyCoverageError as Error).message}</p>}
                {countyCoverage && (
                  <>
                    <p className="mt-1 max-w-4xl text-sm text-gray-700">
                      {countyCoverage.totals.coveragePercent}% coverage across {countyCoverage.totals.censusCountyEquivalents.toLocaleString()} Census county and county-equivalent records. {countyCoverage.totals.explicitlyMatchedCounties.toLocaleString()} have explicit named-county WDs; {countyCoverage.totals.statewideFallbackCoveredCounties.toLocaleString()} are covered by statewide federal WD fallback.
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Source: {countyCoverage.source.label}, {countyCoverage.source.scope}. Retrieved {new Date(countyCoverage.source.retrievedAt).toLocaleString()}.
                    </p>
                  </>
                )}
              </div>
              {countyCoverage && (
                <div className="grid grid-cols-3 gap-2 text-center lg:min-w-[340px]">
                  <MiniStat label="Counties" value={countyCoverage.totals.censusCountyEquivalents} />
                  <MiniStat label="Explicit" value={countyCoverage.totals.explicitlyMatchedCounties} />
                  <MiniStat label="Missing" value={countyCoverage.totals.missingCounties} tone={countyCoverage.totals.missingCounties === 0 ? 'good' : 'warn'} />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Latest sync</h3>
            {data.latestSync ? (
              <dl className="grid gap-4 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase text-gray-500">Status</dt>
                  <dd className={
                    data.latestSync.status === 'success' || data.latestSync.status === 'partial'
                      ? 'text-green-700 font-medium'
                      : data.latestSync.status === 'running'
                        ? 'text-amber-700 font-medium'
                        : 'text-red-700 font-medium'
                  }>
                    {data.latestSync.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-gray-500">Started</dt>
                  <dd>{new Date(data.latestSync.startedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-gray-500">Fetched</dt>
                  <dd className="tabular-nums">{data.latestSync.wdsFetched ?? '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-gray-500">Failed</dt>
                  <dd className="tabular-nums">{data.latestSync.wdsFailed ?? '-'}</dd>
                </div>
                {data.latestSync.errorMessage && (
                  <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-xs text-red-700 md:col-span-4">
                    {data.latestSync.errorMessage}
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-gray-500">No sync has been run yet. Click "Sync Now" to populate classifications.</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Database className="size-4" /> Per-state federal coverage
              </h3>
              <span className="text-xs text-gray-500">{data.byState.length} states</span>
            </div>
            <Table>
              <THead>
                <Tr>
                  <Th>State</Th>
                  <Th align="right">Known WDs</Th>
                  <Th align="right">County Keys</Th>
                  <Th align="right">Cached WDs</Th>
                  <Th align="right">Classes</Th>
                  <Th align="right">Fresh</Th>
                  <Th align="right">Gaps</Th>
                  <Th align="right">Cached</Th>
                </Tr>
              </THead>
              <TBody>
                {data.byState.map((s) => (
                  <Tr key={s.state}>
                    <Td className="font-mono font-semibold">{s.state}</Td>
                    <Td numeric>{s.seededWds}</Td>
                    <Td numeric>{s.seededCountyKeys}</Td>
                    <Td numeric>{s.wdCount}</Td>
                    <Td numeric>{s.classificationCount}</Td>
                    <Td numeric>{s.fresh}</Td>
                    <Td numeric className={s.uncachedSeededWds > 0 ? 'text-amber-700' : 'text-green-700'}>
                      {s.uncachedSeededWds}
                    </Td>
                    <Td numeric className={s.percentCached === 100 ? 'text-green-700' : s.percentCached < 10 ? 'text-gray-400' : ''}>
                      {s.percentCached}%
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>

          {countyCoverage && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Database className="size-4" /> Census county audit
                </h3>
                <span className="text-xs text-gray-500">{countyCoverage.totals.states} states</span>
              </div>
              <Table>
                <THead>
                  <Tr>
                    <Th>State</Th>
                    <Th align="right">Census Counties</Th>
                    <Th align="right">Named WD Keys</Th>
                    <Th align="right">Explicit Matches</Th>
                    <Th align="right">Statewide WDs</Th>
                    <Th align="right">Fallback Covered</Th>
                    <Th align="right">Missing</Th>
                    <Th align="right">Coverage</Th>
                  </Tr>
                </THead>
                <TBody>
                  {countyCoverage.byState.map((s) => (
                    <Tr key={s.state}>
                      <Td>
                        <span className="font-mono font-semibold">{s.state}</span>
                        <span className="ml-2 text-xs text-gray-500">{s.stateName}</span>
                      </Td>
                      <Td numeric>{s.censusCountyEquivalents}</Td>
                      <Td numeric>{s.namedWdCountyKeys}</Td>
                      <Td numeric>{s.explicitCountyMatches}</Td>
                      <Td numeric>{s.statewideWds}</Td>
                      <Td numeric>{s.statewideFallbackCoveredCounties}</Td>
                      <Td numeric className={s.missingCounties === 0 ? 'text-green-700' : 'text-amber-700'}>
                        {s.missingCounties}
                      </Td>
                      <Td numeric className={s.coveragePercent === 100 ? 'text-green-700' : 'text-amber-700'}>
                        {s.coveragePercent}%
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-sm border border-white/70 bg-white/70 p-3">
      <div className={`text-xl font-bold tabular-nums ${tone === 'warn' ? 'text-amber-800' : tone === 'good' ? 'text-green-800' : 'text-gray-900'}`}>
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
        {value.toLocaleString()}
      </div>
      {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}
