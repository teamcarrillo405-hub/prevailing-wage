import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

interface Project {
  id: string;
  name: string;
  state: string;
  county: string;
  contractType: string;
  fundingType: string;
  awardDate: string;
  status: string;
}

interface ProjectCardProps {
  project: Project;
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

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['compliance-summary', project.id],
    queryFn: async () => {
      const res = await fetch(`/api/compliance/project/${project.id}`);
      if (!res.ok) throw new Error('Failed to fetch compliance summary');
      return res.json() as Promise<{ badge: string; weekCount: number; lastWeekNumber: number | null }>;
    },
    staleTime: 60_000,
  });

  return (
    <button
      onClick={() => navigate(`/projects/${project.id}`)}
      className="w-full text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-brand-gold hover:shadow-md transition-all group"
    >
      <h3 className="font-headline text-lg text-gray-900 mb-3 group-hover:text-gray-800 truncate">
        {project.name}
      </h3>

      <p className="text-sm text-gray-600 mb-3">
        {project.state} — {project.county}
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-block text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
          {CONTRACT_TYPE_LABELS[project.contractType] ?? project.contractType}
        </span>
        <span className="inline-block text-xs font-medium px-2 py-0.5 bg-[#F5C518] text-gray-900 rounded">
          {FUNDING_TYPE_LABELS[project.fundingType] ?? project.fundingType}
        </span>
      </div>

      {/* Compliance badge + week stats — DASH-01 / DASH-02 */}
      {!summaryLoading && (
        <div className="flex flex-wrap items-center gap-2 mt-2 mb-2">
          {summary?.badge === 'violations' && (
            <span className="inline-block text-xs font-medium px-2 py-0.5 bg-red-100 text-red-700 rounded">
              Violations
            </span>
          )}
          {summary?.badge === 'clean' && summary.weekCount > 0 && (
            <span className="inline-block text-xs font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded">
              Clean
            </span>
          )}
          {(!summary || summary.weekCount === 0) && (
            <span className="inline-block text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded">
              No payroll
            </span>
          )}
          {summary && summary.weekCount > 0 && (
            <span className="text-xs text-gray-500">
              {summary.weekCount} week{summary.weekCount !== 1 ? 's' : ''}
              {summary.lastWeekNumber != null ? `, Week ${summary.lastWeekNumber}` : ''}
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Award date: {project.awardDate}
      </p>
    </button>
  );
}
