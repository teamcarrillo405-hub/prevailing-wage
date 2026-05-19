import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';

export function SupervisorApprovalsPage() {
  const qc = useQueryClient();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pending = [] } = useQuery({
    queryKey: ['pending-time-punches'],
    queryFn: () => api.get('/time-punches/pending').then(r => r.data),
    refetchInterval: 30000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/time-punches/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-time-punches'] }),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/time-punches/${id}/reject`, { reason }),
    onSuccess: () => {
      setRejectId(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['pending-time-punches'] });
    },
  });

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <PageHeader
        title="Time Approval"
        subtitle={`${pending.length} punch${pending.length !== 1 ? 'es' : ''} awaiting review`}
      />
      <div className="mt-6 space-y-3">
        {pending.length === 0 && (
          <p className="text-sm text-surface-muted text-center py-12">
            All caught up — no pending punches.
          </p>
        )}
        {pending.map((e: any) => (
          <div key={e.id} className="bg-surface-card rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-white text-sm">{e.workerName ?? 'Unknown Worker'}</p>
              <p className="text-xs text-surface-muted mt-0.5">
                {e.punchedAt} &mdash; {e.punchType === 'in' ? 'Clock In' : 'Clock Out'}
              </p>
              {e.rejectionReason && (
                <p className="text-xs text-red-400 mt-1">{e.rejectionReason}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => approve.mutate(e.id)}
                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded font-medium hover:bg-green-500"
              >
                Approve
              </button>
              <button
                onClick={() => setRejectId(e.id)}
                className="px-3 py-1.5 bg-red-600/20 text-red-400 text-xs rounded font-medium hover:bg-red-600/30"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {rejectId && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setRejectId(null)}
        >
          <div
            className="bg-nav-dark rounded-xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-headline text-white mb-3">Rejection Reason</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Explain why this punch is rejected..."
              rows={3}
              className="w-full bg-surface-card text-white text-sm rounded px-3 py-2 border border-surface-card outline-none focus:border-brand-gold resize-none mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => reject.mutate({ id: rejectId, reason: rejectReason })}
                disabled={!rejectReason}
                className="flex-1 py-2 bg-red-600 text-white text-sm rounded font-medium disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 py-2 bg-surface-card text-surface-muted text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
