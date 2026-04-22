import { useMemo } from 'react';
import { cn } from '../../lib/utils';

type ComplianceStatus = 'compliant' | 'violations' | 'no-payroll' | 'archived';

interface ComplianceOverviewCardProps {
  statusMap: Map<string, ComplianceStatus | string>;
  totalActiveProjects: number;
  isLoading?: boolean;
  className?: string;
}

// At-a-glance compliance card. Sits above the project grid on DashboardPage.
// Computes all metrics from the status map already fetched by the page —
// no additional queries.
export function ComplianceOverviewCard({
  statusMap,
  totalActiveProjects,
  isLoading,
  className,
}: ComplianceOverviewCardProps) {
  const { compliant, violations, noPayroll, total } = useMemo(() => {
    let compliant = 0, violations = 0, noPayroll = 0;
    for (const status of statusMap.values()) {
      if (status === 'compliant') compliant++;
      else if (status === 'violations') violations++;
      else if (status === 'no-payroll') noPayroll++;
    }
    const total = compliant + violations + noPayroll;
    return { compliant, violations, noPayroll, total };
  }, [statusMap]);

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const compliantPct = pct(compliant);
  const violationPct = pct(violations);
  const noPayrollPct = 100 - compliantPct - violationPct;

  if (isLoading) {
    return (
      <div className={cn('rounded-lg border border-gray-200 bg-white p-6 mb-6 animate-pulse', className)}>
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[0, 1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded" />)}
        </div>
        <div className="h-8 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white p-6 mb-6 shadow-sm', className)}>
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="text-base font-semibold text-gray-900">Compliance Overview</h3>
        <span className="text-xs text-gray-500">
          {total} of {totalActiveProjects} active project{totalActiveProjects === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatBadge
          label="Compliant"
          value={compliant}
          tone="good"
        />
        <StatBadge
          label="With Violations"
          value={violations}
          tone={violations > 0 ? 'bad' : 'neutral'}
        />
        <StatBadge
          label="No Payroll Yet"
          value={noPayroll}
          tone="neutral"
        />
      </div>

      {total > 0 && (
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
            {compliant > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${compliantPct}%` }}
                aria-label={`${compliantPct}% compliant`}
              />
            )}
            {violations > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${violationPct}%` }}
                aria-label={`${violationPct}% with violations`}
              />
            )}
            {noPayroll > 0 && (
              <div
                className="bg-gray-300 transition-all"
                style={{ width: `${noPayrollPct}%` }}
                aria-label={`${noPayrollPct}% no payroll yet`}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {compliantPct}% compliant
            {violations > 0 && <> · <span className="text-red-600 font-medium">{violations} need attention</span></>}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Internal ──────────────────────────────────────────────────────────────

interface StatBadgeProps {
  label: string;
  value: number;
  tone: 'good' | 'bad' | 'neutral';
}

function StatBadge({ label, value, tone }: StatBadgeProps) {
  const toneClass =
    tone === 'good' ? 'text-green-700 bg-green-50 border-green-100'
    : tone === 'bad' ? 'text-red-700 bg-red-50 border-red-100'
    : 'text-gray-700 bg-gray-50 border-gray-200';

  return (
    <div className={cn('rounded-md border px-3 py-3', toneClass)}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs mt-0.5 uppercase tracking-wide">{label}</div>
    </div>
  );
}
