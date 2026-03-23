import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

interface Project {
  id: string;
  name: string;
  state: string;
  county: string;
  contractType: string;
  fundingType: string;
  awardDate: string;
  status: string;
  createdAt: string;
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  'federal-davis-bacon': 'Federal Davis-Bacon',
  'state-prevailing': 'State Prevailing',
  'gsa-schedule': 'GSA Schedule',
  private: 'Private',
};

const FUNDING_TYPE_LABELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  mixed: 'Mixed',
};

function WorkflowProgress({ steps }: { steps: { label: string; complete: boolean }[] }) {
  return (
    <div className="flex items-center gap-0 mb-6 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={
              step.complete
                ? 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold bg-status-compliant text-white'
                : 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 border-gray-300 text-gray-400 bg-white'
            }>
              {step.complete ? '\u2713' : i + 1}
            </div>
            <span className={
              step.complete
                ? 'text-sm font-medium text-status-compliant'
                : 'text-sm font-medium text-gray-400'
            }>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={
              step.complete
                ? 'mx-3 h-0.5 w-10 bg-status-compliant shrink-0'
                : 'mx-3 h-0.5 w-10 bg-gray-200 shrink-0'
            } />
          )}
        </div>
      ))}
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<{ data: { project: Project } }>(`/projects/${id}`),
    enabled: !!id,
  });

  const { data: workersData } = useQuery({
    queryKey: ['workers', id],
    queryFn: () => api.get<{ data: { workers: { id: string }[] } }>(`/projects/${id}/workers`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: weeksData } = useQuery({
    queryKey: ['payroll-weeks', id],
    queryFn: () => api.get<{ weeks: { id: string; isFinal: boolean }[] }>(`/payroll/projects/${id}/weeks`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [complianceWarning, setComplianceWarning] = useState(false);

  const archiveMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => api.patch(`/projects/${id}`, { status: 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
    },
  });

  async function handleArchiveClick() {
    const summary = await queryClient.fetchQuery({
      queryKey: ['compliance-summary', id],
      queryFn: async () => {
        const res = await fetch(`/api/compliance/project/${id}`);
        if (!res.ok) return null;
        return res.json() as Promise<{ badge: string; weekCount: number; lastWeekNumber: number | null }>;
      },
      staleTime: 60_000,
    });
    setComplianceWarning(summary?.badge === 'violations');
    setArchiveModalOpen(true);
  }

  const project = data?.data?.project;

  const workers = workersData?.data?.workers ?? [];
  const weeks = weeksData?.weeks ?? [];

  const steps = [
    { label: 'Create Project', complete: true },
    { label: 'Add Workers', complete: workers.length > 0 },
    { label: 'Enter Payroll', complete: weeks.length > 0 },
    // Step 4 uses isFinal as proxy for WH-347 download — accurate when users mark weeks final.
    // Phase 16 may add proper download tracking when WH-347 UX is reworked.
    { label: 'Download WH-347', complete: weeks.some(w => w.isFinal) },
  ];

  return (
    <Layout>
      {isLoading && <LoadingSpinner />}

      {isError && (
        <div className="text-center py-12 text-red-600 text-sm">
          Project not found or access denied.
        </div>
      )}

      {project && (
        <div>
          <PageHeader
            title={project.name}
            subtitle={`${project.state} — ${project.county}`}
          />

          <WorkflowProgress steps={steps} />

          <Card className="max-w-lg">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Contract type</dt>
                <dd className="text-gray-900 font-medium">
                  {CONTRACT_TYPE_LABELS[project.contractType] ?? project.contractType}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Funding type</dt>
                <dd>
                  <Badge variant="neutral">
                    {FUNDING_TYPE_LABELS[project.fundingType] ?? project.fundingType}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Award date</dt>
                <dd className="text-gray-900 font-medium">{project.awardDate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="text-gray-900 font-medium capitalize">{project.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{new Date(project.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </Card>

          <div className="mt-4 flex gap-3">
            {project.status === 'active' ? (
              <Button variant="secondary" onClick={handleArchiveClick}>
                Archive Project
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => restoreMutation.mutate()}
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending ? 'Restoring...' : 'Restore Project'}
              </Button>
            )}
          </div>

          {archiveModalOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="font-headline text-lg text-gray-900 mb-3">
                  Archive Project
                </h3>
                {complianceWarning && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    This project has open compliance violations. Archiving will not resolve them. You can restore the project later if needed.
                  </div>
                )}
                <p className="text-sm text-gray-600 mb-5">
                  {complianceWarning
                    ? 'Are you sure you want to archive this project despite open violations?'
                    : 'Are you sure you want to archive this project? It will be hidden from your active dashboard.'}
                </p>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setArchiveModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => archiveMutation.mutate()}
                    disabled={archiveMutation.isPending}
                  >
                    {archiveMutation.isPending ? 'Archiving...' : (complianceWarning ? 'Archive Anyway' : 'Archive')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Project sub-page navigation */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={`/projects/${project.id}/workers`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              Workers
            </Link>
            <Link
              to={`/projects/${project.id}/payroll`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              Payroll Weeks
            </Link>
            <Link
              to={`/projects/${project.id}/ot-scenarios`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              OT Scenario Planner
            </Link>
            <Link
              to={`/projects/${project.id}/variance`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              Variance
            </Link>
            <Link
              to={`/projects/${project.id}/reports`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              Reports
            </Link>
          </div>
        </div>
      )}
    </Layout>
  );
}
