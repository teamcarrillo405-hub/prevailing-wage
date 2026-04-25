import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

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
  className?: string;
  /** Optional pre-fetched violation count from batch summary (DASH-04). When provided,
   *  overrides the per-card compliance badge with a precise count badge. */
  violationCount?: number;
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

export function ProjectCard({ project, className, violationCount }: ProjectCardProps) {
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
      className={cn(
        'group w-full text-left bg-white rounded-2xl p-5 transition-all duration-200 relative overflow-hidden',
        'border border-border-default hover:border-brand-gold/40',
        'shadow-card hover:shadow-card-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2',
        project.status === 'closed' && 'opacity-60',
        className
      )}
    >
      {/* Gold top-bar reveal on hover */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 bg-brand-gold origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out rounded-t-2xl"
        aria-hidden="true"
      />

      {project.status === 'closed' && (
        <div className="mb-2">
          <Badge variant="neutral">Archived</Badge>
        </div>
      )}

      {/* Project name */}
      <h3 className="font-headline text-lg text-text-primary mb-1.5 truncate group-hover:text-brand-gold/90 transition-colors duration-200">
        {project.name}
      </h3>

      {/* Location */}
      <p className="text-sm text-text-secondary mb-3">
        {project.state} — {project.county}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="inline-block text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">
          {CONTRACT_TYPE_LABELS[project.contractType] ?? project.contractType}
        </span>
        <Badge variant="neutral">
          {FUNDING_TYPE_LABELS[project.fundingType] ?? project.fundingType}
        </Badge>
      </div>

      {/* Compliance status */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {summaryLoading ? (
          <div className="h-5 w-16 rounded-full bg-gray-100 animate-pulse" />
        ) : (
          <>
            {/* DASH-04: show violation count badge when batch data provides count */}
            {violationCount !== undefined ? (
              violationCount > 0 ? (
                <Badge variant="violation">
                  {violationCount} violation{violationCount !== 1 ? 's' : ''}
                </Badge>
              ) : (
                summary?.weekCount && summary.weekCount > 0
                  ? <Badge variant="compliant">Clean</Badge>
                  : <Badge variant="neutral">No payroll</Badge>
              )
            ) : (
              <>
                {summary?.badge === 'violations' && (
                  <Badge variant="violation">Violations</Badge>
                )}
                {summary?.badge === 'clean' && summary.weekCount > 0 && (
                  <Badge variant="compliant">Clean</Badge>
                )}
                {(!summary || summary.weekCount === 0) && (
                  <Badge variant="neutral">No payroll</Badge>
                )}
              </>
            )}
            {summary && summary.weekCount > 0 && (
              <span className="text-xs text-text-secondary">
                {summary.weekCount} week{summary.weekCount !== 1 ? 's' : ''}
                {summary.lastWeekNumber != null ? `, Week ${summary.lastWeekNumber}` : ''}
              </span>
            )}
          </>
        )}
      </div>

      {/* Award date */}
      <p className="text-xs text-text-secondary mt-auto">
        Award: {project.awardDate}
      </p>
    </button>
  );
}
