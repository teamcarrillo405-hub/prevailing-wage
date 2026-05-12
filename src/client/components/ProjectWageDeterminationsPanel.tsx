import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { Tooltip } from './ui/Tooltip';
import { useToast } from '../contexts/ToastContext';

interface PinnedWd {
  wageDeterminationId: string;
  constructionType: string | null;
  isPrimary: boolean;
  pinnedAt: string;
  pinnedByUserId?: string | null;
  source: string;
  wdNumber: string;
  revisionNumber: number;
  state: string;
  county: string | null;
  wdConstructionType: string | null;
  publishDate: string | null;
  cachedAt: string;
  cacheExpiresAt: string;
  lastFetchedAt: string | null;
}

interface Props {
  projectId: string;
  projectState: string;
  projectCounty: string;
}

async function fetchPins(projectId: string): Promise<{ pins: PinnedWd[] }> {
  const res = await fetch(`/api/projects/${projectId}/wage-determinations`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load pinned WDs');
  return res.json();
}

async function fetchWdByNumber(wdNumber: string): Promise<{ wd: { id: string; constructionType?: string | null } }> {
  const res = await fetch(`/api/wages/fetch?wdNumber=${encodeURIComponent(wdNumber)}`, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `WD fetch failed: ${res.status}`);
  }
  return res.json();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

export function ProjectWageDeterminationsPanel({ projectId, projectState, projectCounty }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['project-wds', projectId];
  const [wdNumber, setWdNumber] = useState('');

  const { data, isLoading, error } = useQuery<{ pins: PinnedWd[] }, Error>({
    queryKey,
    queryFn: () => fetchPins(projectId),
  });

  const unpin = useMutation({
    mutationFn: (wdId: string) =>
      fetch(`/api/projects/${projectId}/wage-determinations/${wdId}`, {
        method: 'DELETE',
        credentials: 'include',
      }).then((r) => { if (!r.ok) throw new Error('Unpin failed'); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Wage determination unpinned');
    },
    onError: () => toast.error('Could not unpin wage determination'),
  });

  const setPrimary = useMutation({
    mutationFn: (wdId: string) =>
      fetch(`/api/projects/${projectId}/wage-determinations/${wdId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true }),
      }).then((r) => { if (!r.ok) throw new Error('Set primary failed'); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Project WD lock updated');
    },
    onError: () => toast.error('Could not set primary wage determination'),
  });

  const fetchAndPin = useMutation({
    mutationFn: async () => {
      const normalizedWdNumber = wdNumber.trim().toUpperCase();
      if (!normalizedWdNumber) throw new Error('Enter a WD number');
      const fetched = await fetchWdByNumber(normalizedWdNumber);
      const pinRes = await fetch(`/api/projects/${projectId}/wage-determinations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wageDeterminationId: fetched.wd.id,
          constructionType: fetched.wd.constructionType ?? null,
        }),
      });
      if (!pinRes.ok) {
        const body = await pinRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Pin failed: ${pinRes.status}`);
      }
    },
    onSuccess: () => {
      setWdNumber('');
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Federal WD fetched and locked to project');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const wageLookupParams = new URLSearchParams({
    state: projectState,
    county: projectCounty,
    projectId,
  });
  const wageLookupUrl = `/wages?${wageLookupParams.toString()}`;

  if (isLoading) return <div className="text-sm text-gray-500 mt-4">Loading wage determinations...</div>;
  if (error) return <div className="text-sm text-red-600 mt-4">Failed to load pinned WDs.</div>;

  const pins = data?.pins ?? [];
  const primary = pins.find((pin) => pin.isPrimary);

  return (
    <Card className="mt-4" padding="default">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 inline-flex items-center">
            Federal Wage Determination Lock
            <Tooltip content="The project should be locked to the DOL/SAM.gov wage determination that applies to the award location, construction type, and contract date." />
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {projectCounty}, {projectState}. Pin one primary WD before validating payroll rates.
          </p>
        </div>
        <a href={wageLookupUrl} className="text-xs font-medium text-brand-gold hover:underline">
          Open lookup
        </a>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          {primary ? (
            <div className="rounded-sm border border-green-200 bg-green-50 p-4">
              <div className="mb-3 rounded border border-green-200 bg-white/70 px-3 py-2 text-sm text-green-900">
                This WD is the project wage source. Worker trade selections and payroll rate checks can use it automatically.
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="compliant">Locked primary</Badge>
                    <span className="font-mono text-sm font-semibold text-gray-900">{primary.wdNumber}</span>
                    <span className="text-xs text-gray-600">Rev {primary.revisionNumber}</span>
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <Info label="Source" value={primary.source} />
                    <Info label="County" value={primary.county ?? 'Statewide'} />
                    <Info label="Type" value={primary.wdConstructionType ?? primary.constructionType ?? '-'} />
                    <Info label="Published" value={formatDate(primary.publishDate)} />
                    <Info label="Cached" value={formatDate(primary.cachedAt)} />
                    <Info label="Expires" value={formatDate(primary.cacheExpiresAt)} />
                  </dl>
                </div>
                <button
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                  onClick={() => unpin.mutate(primary.wageDeterminationId)}
                  disabled={unpin.isPending}
                >
                  Unpin
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-sm border border-amber-200 bg-amber-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">No primary WD locked</h4>
              <p className="mt-1 text-sm text-gray-700">
                Select the WD from the award documents. After it is pinned, the system uses it for worker trade rates and certified payroll readiness.
              </p>
            </div>
          )}

          {pins.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-sm border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                    <th className="px-3 py-2 font-medium">WD</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Pinned</th>
                    <th className="px-3 py-2 font-medium">Primary</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {pins.map((pin) => (
                    <tr key={pin.wageDeterminationId} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-gray-800">{pin.wdNumber}</td>
                      <td className="px-3 py-2 text-gray-700">{pin.wdConstructionType ?? pin.constructionType ?? '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{formatDate(pin.pinnedAt)}</td>
                      <td className="px-3 py-2">
                        {pin.isPrimary ? (
                          <Badge variant="compliant">Primary</Badge>
                        ) : (
                          <button
                            className="text-xs font-medium text-brand-gold hover:underline disabled:opacity-60"
                            onClick={() => setPrimary.mutate(pin.wageDeterminationId)}
                            disabled={setPrimary.isPending}
                          >
                            Set primary
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!pin.isPrimary && (
                          <button
                            className="text-xs text-red-600 hover:underline disabled:opacity-60"
                            onClick={() => unpin.mutate(pin.wageDeterminationId)}
                            disabled={unpin.isPending}
                          >
                            Unpin
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form
          className="rounded-sm border border-gray-200 bg-gray-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            fetchAndPin.mutate();
          }}
        >
          <label htmlFor="wd-number" className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Fetch by WD number
          </label>
          <input
            id="wd-number"
            value={wdNumber}
            onChange={(event) => setWdNumber(event.target.value)}
            placeholder="CA20260001"
            className="mt-2 w-full rounded-sm border border-gray-300 px-3 py-2 font-mono text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
          />
          <p className="mt-2 text-xs text-gray-500">
            Use this when the award documents list a WD number. The system fetches from SAM.gov, caches classifications, pins it, and locks the project if this is the first WD.
          </p>
          <button
            type="submit"
            disabled={fetchAndPin.isPending}
            className="mt-3 w-full rounded-sm bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition active:translate-y-px disabled:opacity-60"
          >
            {fetchAndPin.isPending ? 'Fetching...' : 'Fetch and lock'}
          </button>
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Missing classification?</h4>
            <p className="mt-1 text-xs text-gray-500">
              If the WD does not list the needed trade, create an audited classification suggestion before preparing a conformance request.
            </p>
            <a
              href={`/classification-assist?projectId=${encodeURIComponent(projectId)}`}
              className="mt-2 inline-flex text-xs font-medium text-brand-gold hover:underline"
            >
              Open classification assist
            </a>
          </div>
        </form>
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-gray-900">{value}</dd>
    </div>
  );
}
