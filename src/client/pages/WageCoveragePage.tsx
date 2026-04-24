// src/client/pages/WageCoveragePage.tsx
//
// Admin view: per-state prevailing-wage coverage dashboard.
// Shows how many WDs are seeded per state, how many counties have
// coverage, and the freshness of the last sync.

import { useQuery } from '@tanstack/react-query';
import { Database, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '../components/ui/Table';
import { useToast } from '../contexts/ToastContext';

interface StateCoverage {
  state: string;
  wdCount: number;
  countyCount: number;
  cached: number;
}

interface SyncMeta {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  wdsFetched: number | null;
  wdsFailed: number | null;
}

interface CoverageResponse {
  byState: StateCoverage[];
  totalStates: number;
  totalWds: number;
  totalCounties: number;
  latestSync: SyncMeta | null;
}

async function fetchCoverage(): Promise<CoverageResponse> {
  const res = await fetch('/api/wages/coverage', { credentials: 'include' });
  if (!res.ok) throw new Error(`Coverage fetch failed: ${res.status}`);
  return res.json();
}

async function triggerSync(): Promise<void> {
  const res = await fetch('/api/wages/sync', {
    method: 'POST', credentials: 'include',
  });
  if (!res.ok && res.status !== 202) throw new Error(`Sync trigger failed: ${res.status}`);
}

export function WageCoveragePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['wage-coverage'],
    queryFn: fetchCoverage,
    refetchInterval: 60_000,
  });

  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerSync();
      toast.info('Sync started — rates will populate in the background.');
      setTimeout(() => refetch(), 2000);
    } catch (e) {
      toast.error(`Sync failed: ${(e as Error).message}`);
    } finally { setSyncing(false); }
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <PageHeader
        title="Wage Determination Coverage"
        subtitle="National Davis-Bacon WD seed data + sync status"
        action={
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`size-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Triggering…' : 'Sync Now'}
          </Button>
        }
      />

      {isLoading && <p className="text-sm text-gray-500">Loading coverage…</p>}
      {error && <p className="text-sm text-red-600">Error: {(error as Error).message}</p>}

      {data && (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="States Covered"     value={data.totalStates}    hint={`of 51 (50 + DC)`} />
            <StatCard label="Wage Determinations" value={data.totalWds}        hint="active entries" />
            <StatCard label="Counties Identified" value={data.totalCounties}   hint="distinct (state, county) pairs" />
            <StatCard label="Documents Cached"    value={data.byState.reduce((s, r) => s + r.cached, 0)} hint={`of ${data.totalWds} seeded`} />
          </div>

          {/* Latest sync */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Latest sync</h3>
            {data.latestSync ? (
              <dl className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase text-gray-500">Status</dt>
                  <dd className={
                    data.latestSync.status === 'completed' ? 'text-green-700 font-medium' :
                    data.latestSync.status === 'running'   ? 'text-amber-700 font-medium' :
                    'text-red-700 font-medium'
                  }>{data.latestSync.status}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-gray-500">Started</dt>
                  <dd>{new Date(data.latestSync.startedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-gray-500">Fetched</dt>
                  <dd className="tabular-nums">{data.latestSync.wdsFetched ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-gray-500">Failed</dt>
                  <dd className="tabular-nums">{data.latestSync.wdsFailed ?? '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-500">No sync has been run yet. Click "Sync Now" to populate classifications.</p>
            )}
          </div>

          {/* Per-state table */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Database className="size-4" /> Per-state coverage
              </h3>
              <span className="text-xs text-gray-500">{data.byState.length} states</span>
            </div>
            <Table>
              <THead>
                <Tr>
                  <Th>State</Th>
                  <Th align="right">WDs</Th>
                  <Th align="right">Counties</Th>
                  <Th align="right">Cached</Th>
                  <Th align="right">% Cached</Th>
                </Tr>
              </THead>
              <TBody>
                {data.byState.map(s => {
                  const pctCached = s.wdCount > 0 ? Math.round((s.cached / s.wdCount) * 100) : 0;
                  return (
                    <Tr key={s.state}>
                      <Td className="font-mono font-semibold">{s.state}</Td>
                      <Td numeric>{s.wdCount}</Td>
                      <Td numeric>{s.countyCount}</Td>
                      <Td numeric>{s.cached}</Td>
                      <Td numeric className={pctCached === 100 ? 'text-green-700' : pctCached < 10 ? 'text-gray-400' : ''}>
                        {pctCached}%
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </>
      )}
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
