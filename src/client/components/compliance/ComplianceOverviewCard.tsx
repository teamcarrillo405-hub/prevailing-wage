import { useMemo } from 'react';
import { cn } from '../../lib/utils';

type ComplianceStatus = 'compliant' | 'violations' | 'no-payroll' | 'archived';

interface ComplianceOverviewCardProps {
  statusMap: Map<string, ComplianceStatus | string>;
  totalActiveProjects: number;
  isLoading?: boolean;
  className?: string;
}

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
      <div className={cn('rounded-2xl p-6 mb-6 animate-pulse', className)}
        style={{ background: 'linear-gradient(135deg, #111827 0%, #1a2235 100%)' }}>
        <div className="flex items-baseline justify-between mb-6">
          <div className="h-5 w-44 bg-white/10 rounded" />
          <div className="h-3.5 w-28 bg-white/10 rounded" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[0, 1, 2].map(i => <div key={i} className="h-[88px] bg-white/5 rounded-xl" />)}
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full" />
      </div>
    );
  }

  const healthScore = total > 0 ? Math.round((compliant / total) * 100) : null;

  return (
    <div
      className={cn('rounded-2xl p-6 mb-6 relative overflow-hidden', className)}
      style={{ background: 'linear-gradient(135deg, #111827 0%, #1a2235 60%, #0f1923 100%)' }}
    >
      {/* Subtle dot-grid texture */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
        aria-hidden="true"
      />
      {/* Gold glow accent */}
      <div
        className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,197,24,0.12) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-brand-gold uppercase tracking-widest mb-1">Compliance Overview</p>
            <p className="text-sm text-gray-400">
              {total} of {totalActiveProjects} active project{totalActiveProjects === 1 ? '' : 's'} tracked
            </p>
          </div>
          {healthScore !== null && (
            <div className="text-right">
              <div className="text-3xl font-bold text-white tabular-nums">{healthScore}<span className="text-lg text-gray-500">%</span></div>
              <div className="text-xs text-gray-500 mt-0.5">health score</div>
            </div>
          )}
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatTile
            label="Compliant"
            value={compliant}
            pct={compliantPct}
            color="emerald"
          />
          <StatTile
            label="Violations"
            value={violations}
            pct={violationPct}
            color={violations > 0 ? 'red' : 'neutral'}
          />
          <StatTile
            label="No Payroll"
            value={noPayroll}
            pct={noPayrollPct}
            color="neutral"
          />
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div>
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              {compliant > 0 && (
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${compliantPct}%` }}
                  aria-label={`${compliantPct}% compliant`}
                />
              )}
              {violations > 0 && (
                <div
                  className="bg-red-500 transition-all duration-500"
                  style={{ width: `${violationPct}%` }}
                  aria-label={`${violationPct}% with violations`}
                />
              )}
              {noPayroll > 0 && (
                <div
                  className="bg-white/20 transition-all duration-500"
                  style={{ width: `${noPayrollPct}%` }}
                  aria-label={`${noPayrollPct}% no payroll`}
                />
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {compliantPct}% compliant
              {violations > 0 && (
                <> · <span className="text-red-400 font-medium">{violations} need attention</span></>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  pct: number;
  color: 'emerald' | 'red' | 'neutral';
}

function StatTile({ label, value, pct, color }: StatTileProps) {
  const valueColor =
    color === 'emerald' ? 'text-emerald-400'
    : color === 'red' && value > 0 ? 'text-red-400'
    : 'text-gray-300';

  const bgColor =
    color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20'
    : color === 'red' && value > 0 ? 'bg-red-500/10 border-red-500/20'
    : 'bg-white/5 border-white/10';

  return (
    <div className={cn('rounded-xl border px-4 py-3.5', bgColor)}>
      <div className={cn('text-3xl font-bold tabular-nums leading-none mb-1', valueColor)}>
        {value}
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</div>
      {pct > 0 && (
        <div className="text-xs text-gray-600">{pct}%</div>
      )}
    </div>
  );
}
