import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { useToast } from '../contexts/ToastContext';

interface PinnedWd {
  wageDeterminationId: string;
  constructionType: string | null;
  isPrimary: boolean;
  pinnedAt: string;
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

export function ProjectWageDeterminationsPanel({ projectId, projectState, projectCounty }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['project-wds', projectId];

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Wage determination unpinned'); },
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Primary wage determination updated'); },
    onError: () => toast.error('Could not set primary wage determination'),
  });

  const wageLookupUrl = `/wages?state=${projectState}&county=${encodeURIComponent(projectCounty)}`;

  if (isLoading) return <div className="text-sm text-gray-500 mt-4">Loading wage determinations…</div>;
  if (error) return <div className="text-sm text-red-600 mt-4">Failed to load pinned WDs.</div>;

  const pins = data?.pins ?? [];

  return (
    <Card className="mt-4" padding="default">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Wage Determinations</h3>
        <a href={wageLookupUrl} className="text-xs text-brand-gold hover:underline">
          + Add WD
        </a>
      </div>

      {pins.length === 0 ? (
        <p className="text-sm text-gray-500">
          No wage determinations pinned.{' '}
          <a href={wageLookupUrl} className="text-brand-gold hover:underline">Look one up</a>.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="pb-1 font-medium">WD ID</th>
              <th className="pb-1 font-medium">Construction Type</th>
              <th className="pb-1 font-medium">Primary</th>
              <th className="pb-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {pins.map((pin) => (
              <tr key={pin.wageDeterminationId} className="border-b last:border-0">
                <td className="py-2 font-mono text-xs text-gray-800">{pin.wageDeterminationId}</td>
                <td className="py-2 text-gray-700">{pin.constructionType ?? '—'}</td>
                <td className="py-2">
                  {pin.isPrimary ? (
                    <Badge variant="compliant">Primary</Badge>
                  ) : (
                    <button
                      className="text-xs text-brand-gold hover:underline"
                      onClick={() => setPrimary.mutate(pin.wageDeterminationId)}
                      disabled={setPrimary.isPending}
                    >
                      Set primary
                    </button>
                  )}
                </td>
                <td className="py-2 text-right">
                  <button
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => unpin.mutate(pin.wageDeterminationId)}
                    disabled={unpin.isPending}
                  >
                    Unpin
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
