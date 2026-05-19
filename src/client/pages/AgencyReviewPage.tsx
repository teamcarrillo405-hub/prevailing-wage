import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';

export function AgencyReviewPage() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [stamp, setStamp] = useState<'approved' | 'flagged' | 'pending'>('pending');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['agency-projects'],
    queryFn: () => api.get('/agency/projects').then((r: any) => r.data),
  });

  const { data: weeks = [] } = useQuery({
    queryKey: ['agency-weeks', selectedProject],
    queryFn: () =>
      selectedProject
        ? api.get(`/agency/projects/${selectedProject}/weeks`).then((r: any) => r.data)
        : [],
    enabled: !!selectedProject,
  });

  const submitReview = useMutation({
    mutationFn: () =>
      api.post(`/agency/weeks/${selectedWeek}/review`, { comment, review_stamp: stamp }),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['agency-weeks'] });
    },
  });

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <PageHeader title="Agency Review Portal" subtitle="Read-only access to assigned projects" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="space-y-2">
          <p className="text-xs text-surface-muted font-medium uppercase tracking-wide mb-3">Projects</p>
          {(projects as any[]).map((p: any) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                selectedProject === p.id
                  ? 'bg-brand-gold text-black font-medium'
                  : 'bg-surface-card text-white hover:bg-surface-card/80'
              }`}
            >
              {p.name}
            </button>
          ))}
          {(projects as any[]).length === 0 && (
            <p className="text-sm text-surface-muted">No projects assigned.</p>
          )}
        </div>
        <div className="md:col-span-2 space-y-3">
          {(weeks as any[]).map((w: any) => (
            <div
              key={w.id}
              className={`bg-surface-card rounded-xl p-4 border cursor-pointer ${
                selectedWeek === w.id ? 'border-brand-gold' : 'border-surface-card'
              }`}
              onClick={() => setSelectedWeek(w.id)}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Week ending {w.week_ending_date}</p>
                <Badge variant={w.submitted_at ? 'compliant' : 'neutral'}>
                  {w.submitted_at ? 'Submitted' : 'Not submitted'}
                </Badge>
              </div>
            </div>
          ))}
          {selectedWeek && (
            <div className="bg-surface-card rounded-xl p-4 mt-4">
              <p className="text-sm font-medium text-white mb-3">Leave Review</p>
              <select
                value={stamp}
                onChange={e => setStamp(e.target.value as 'approved' | 'flagged' | 'pending')}
                className="w-full bg-surface-page text-white text-sm rounded px-3 py-2 mb-3 border border-surface-card"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="flagged">Flagged</option>
              </select>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Review comments..."
                rows={3}
                className="w-full bg-surface-page text-white text-sm rounded px-3 py-2 mb-3 border border-surface-card outline-none focus:border-brand-gold resize-none"
              />
              <button
                onClick={() => submitReview.mutate()}
                disabled={!comment}
                className="px-4 py-2 bg-brand-gold text-black text-sm font-medium rounded hover:opacity-90 disabled:opacity-50"
              >
                Submit Review
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
