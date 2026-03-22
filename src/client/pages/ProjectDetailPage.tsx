import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

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

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<{ data: { project: Project } }>(`/projects/${id}`),
    enabled: !!id,
  });

  const project = data?.data?.project;

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
