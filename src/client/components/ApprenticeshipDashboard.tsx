// src/client/components/ApprenticeshipDashboard.tsx
// Phase 117 (APP-01): Apprenticeship ratio dashboard — per-trade ratios,
// IRA/IIJA 15% banner, 12-week sparkline trend.
// Follows GrowthDashboardPage sparkline pattern and brand token conventions.

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

// ── API shapes ────────────────────────────────────────────────────────────────

interface TradeRow {
  trade: string;
  journeyHours: number;
  apprenticeHours: number;
  apprenticeCount: number;
  journeyCount: number;
  requiredRatio: string | null;
  actualRatio: string;
  compliant: boolean;
}

interface WeeklyPoint {
  weekStartDate: string;
  apprenticePct: number;
  iraCompliant: boolean;
}

interface DashboardData {
  projectId: string;
  isIraIijaProject: boolean;
  iraTarget: number;
  overall: {
    totalHours: number;
    apprenticeHours: number;
    apprenticePct: number;
    iraCompliant: boolean;
  };
  byTrade: TradeRow[];
  weeklyTrend: WeeklyPoint[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-brand-navy font-headline">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ compliant, noReq }: { compliant: boolean; noReq?: boolean }) {
  if (noReq) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
        No req.
      </span>
    );
  }
  if (compliant) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Compliant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
      Below ratio
    </span>
  );
}

// SVG sparkline — same pattern as GrowthDashboardPage
function ApprenticeSparkline({
  data,
  showIraLine,
}: {
  data: WeeklyPoint[];
  showIraLine: boolean;
}) {
  const W = 400;
  const H = 80;
  const PAD = 4;

  if (data.length < 2) {
    return (
      <p className="text-xs text-gray-400 py-6 text-center">
        Not enough payroll weeks to show trend (need at least 2).
      </p>
    );
  }

  const maxPct = Math.max(...data.map((d) => d.apprenticePct), 20);

  const toX = (i: number) =>
    PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
  const toY = (pct: number) =>
    H - PAD - (pct / maxPct) * (H - PAD * 2);

  const points = data
    .map((d, i) => `${toX(i)},${toY(d.apprenticePct)}`)
    .join(' ');

  // 15% IRA reference line y-position
  const iraY = toY(15);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[260px]"
        preserveAspectRatio="none"
        aria-label="12-week apprenticeship percentage trend"
      >
        {/* 15% IRA reference line — only if isIraIijaProject */}
        {showIraLine && (
          <>
            {/* brand-gold: #F5C518 — SVG stroke cannot use Tailwind token */}
            <line
              x1={PAD}
              y1={iraY}
              x2={W - PAD}
              y2={iraY}
              stroke="#F5C518"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text x={W - PAD - 2} y={iraY - 4} fontSize="9" fill="#B45309" textAnchor="end">
              15% target
            </text>
          </>
        )}
        {/* Apprentice % line — brand-navy: #1B2A4A — SVG stroke cannot use Tailwind token */}
        <polyline
          points={points}
          fill="none"
          stroke="#1B2A4A"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Dots at each data point */}
        {data.map((d, i) => (
          <circle
            key={d.weekStartDate}
            cx={toX(i)}
            cy={toY(d.apprenticePct)}
            r="3"
            fill={d.iraCompliant || !showIraLine ? '#1B2A4A' : '#DC2626'}
          />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
        <span>{data[0]?.weekStartDate?.slice(0, 10) ?? ''}</span>
        <span>{data[data.length - 1]?.weekStartDate?.slice(0, 10) ?? ''}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ApprenticeshipDashboard({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['apprenticeship-dashboard', projectId],
    queryFn: () =>
      api.get<DashboardData>(
        `/apprenticeship/${projectId}/apprenticeship-dashboard`
      ),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        Loading apprenticeship data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-sm text-red-600 py-8 text-center">
        Failed to load apprenticeship dashboard. Please try again.
      </div>
    );
  }

  const nonCompliantTrades = data.byTrade.filter(
    (t) => t.requiredRatio !== null && !t.compliant
  );

  const iraStatusLabel = !data.isIraIijaProject
    ? 'Not required'
    : data.overall.iraCompliant
    ? 'Compliant'
    : 'Non-compliant';

  return (
    <div className="space-y-6">
      {/* ── IRA/IIJA Banner ─────────────────────────────────────────────── */}
      {data.isIraIijaProject && (
        data.overall.iraCompliant ? (
          <div className="flex items-start gap-3 bg-green-50 border border-green-300 text-green-800 rounded-lg px-4 py-3 text-sm">
            <span className="font-semibold shrink-0">IRA/IIJA</span>
            <span>
              15% apprentice-hours requirement met &mdash;{' '}
              <strong>{data.overall.apprenticePct.toFixed(1)}%</strong> of total hours are apprentice hours.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm">
            <span className="font-semibold shrink-0">IRA/IIJA</span>
            <span>
              Requires 15% apprentice hours &mdash; currently{' '}
              <strong>{data.overall.apprenticePct.toFixed(1)}%</strong>.{' '}
              {data.overall.totalHours > 0 && (
                <>
                  Approximately{' '}
                  <strong>
                    {Math.max(0, Math.ceil(
                      (0.15 * data.overall.totalHours - data.overall.apprenticeHours) / 0.85
                    )).toFixed(0)}{' '}
                    additional apprentice hours
                  </strong>{' '}
                  needed to reach the 15% threshold.
                </>
              )}
            </span>
          </div>
        )
      )}

      {/* ── Overall Stats Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Apprentice Hours"
          value={data.overall.apprenticeHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          sub={`of ${data.overall.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} total hours`}
        />
        <StatCard
          label="Apprentice %"
          value={`${data.overall.apprenticePct.toFixed(1)}%`}
          sub="journeyworker + apprentice hours"
        />
        <StatCard
          label="IRA/IIJA Status"
          value={iraStatusLabel}
          sub={data.isIraIijaProject ? '15% target' : 'Not an IRA/IIJA project'}
        />
      </div>

      {/* ── By-Trade Table ────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Apprenticeship Ratios by Trade</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Ratio computed from all payroll entries for this project.
          </p>
        </div>

        {data.byTrade.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No payroll entries recorded yet. Enter payroll data to see per-trade ratios.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trade</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Journey hrs</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Apprentice hrs</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Required ratio</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actual ratio</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.byTrade.map((row) => (
                  <tr key={row.trade} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{row.trade}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {row.journeyHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      <span className="text-gray-400 text-xs ml-1">({row.journeyCount}w)</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {row.apprenticeHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      <span className="text-gray-400 text-xs ml-1">({row.apprenticeCount}w)</span>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {row.requiredRatio ? (
                        <span className="text-gray-700">{row.requiredRatio}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">No ratio set</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                      {row.actualRatio}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge
                        compliant={row.compliant}
                        noReq={row.requiredRatio === null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 12-Week Trend ─────────────────────────────────────────────────── */}
      {data.weeklyTrend.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">
            12-Week Apprentice % Trend
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Weekly apprentice hours as a percentage of total project hours.
            {data.isIraIijaProject && ' Gold dashed line = 15% IRA/IIJA target.'}
          </p>
          <ApprenticeSparkline
            data={data.weeklyTrend}
            showIraLine={data.isIraIijaProject}
          />
        </div>
      )}

      {/* ── Action Card ────────────────────────────────────────────────────── */}
      {nonCompliantTrades.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-red-800 mb-1">
            {nonCompliantTrades.length}{' '}
            {nonCompliantTrades.length === 1 ? 'trade is' : 'trades are'} below the required apprenticeship ratio
          </p>
          <p className="text-sm text-red-700 mb-3">
            Non-compliant:{' '}
            {nonCompliantTrades.map((t) => t.trade).join(', ')}.
            Assign more apprentices or reduce journeyworker hours to reach the required ratio.
          </p>
          <Link
            to={`/projects/${projectId}/workers`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-800 underline underline-offset-2 hover:text-red-900"
          >
            Manage workers
          </Link>
        </div>
      )}
    </div>
  );
}
