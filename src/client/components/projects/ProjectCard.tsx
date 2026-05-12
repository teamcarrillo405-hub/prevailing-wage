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
  unsubmittedWeekCount?: number;
  nextAction?: {
    label: string;
    detail: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  };
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

const ACTION_TONE: Record<NonNullable<ProjectCardProps['nextAction']>['priority'], string> = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  high: 'border-amber-200 bg-amber-50 text-amber-700',
  medium: 'border-blue-200 bg-blue-50 text-blue-700',
  low: 'border-gray-200 bg-gray-50 text-gray-700',
};

export function ProjectCard({ project, className, violationCount, unsubmittedWeekCount = 0, nextAction }: ProjectCardProps) {
  const navigate = useNavigate();
  const hasViolations = (violationCount ?? 0) > 0;
  const hasOpenPayroll = unsubmittedWeekCount > 0;

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
              hasViolations ? (
                <Badge variant="violation">
                  {violationCount} violation{violationCount !== 1 ? 's' : ''}
                </Badge>
              ) : hasOpenPayroll ? (
                <Badge variant="neutral">Open payroll</Badge>
              ) : (
                summary?.weekCount && summary.weekCount > 0
                  ? <Badge variant="compliant">No violations</Badge>
                  : <Badge variant="neutral">No payroll</Badge>
              )
            ) : (
              <>
                {summary?.badge === 'violations' && (
                  <Badge variant="violation">Violations</Badge>
                )}
                {summary?.badge === 'clean' && summary.weekCount > 0 && (
                  <Badge variant="compliant">No violations</Badge>
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

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center">
        <div>
          <p className={`text-sm font-bold ${violationCount && violationCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {violationCount ?? 0}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Issues</p>
        </div>
        <div>
          <p className={`text-sm font-bold ${unsubmittedWeekCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {unsubmittedWeekCount}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Open weeks</p>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{summary?.lastWeekNumber ?? '-'}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Last CPR</p>
        </div>
      </div>

      {nextAction && (
        <div className={`mt-4 rounded-lg border px-3 py-2 ${ACTION_TONE[nextAction.priority]}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{nextAction.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug opacity-80">{nextAction.detail}</p>
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase">{nextAction.priority}</span>
          </div>
        </div>
      )}

      {/* Award date */}
      <p className="text-xs text-text-secondary mt-auto">
        Award: {project.awardDate}
      </p>
    </button>
  );
}
