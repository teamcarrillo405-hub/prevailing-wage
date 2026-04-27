// src/client/pages/GrowthDashboardPage.tsx
// Phase 105: Admin Growth Dashboard (OPS-01)
// Protected route + server-side 403 guard for non-admin users.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader';

// ── GrowthMetrics shape from 105-01 ──────────────────────────────────────────

interface GrowthMetrics {
  totalUsers: number;
  activeUsersLast30d: number;
  newUsersLast30d: number;
  totalPayrollWeeks: number;
  submittedWeeks: number;
  submissionRate: number;
  avgComplianceScore: number;
  totalViolations: number;
  totalProjects: number;
  activeProjects: number;
  mrrEstimate: number;
  weeklyNewUsers: Array<{ week: string; count: number }>;
  weeklySubmissions: Array<{ week: string; count: number }>;
}

// ── Sparkline (pure SVG — no chart library needed) ───────────────────────────

function Sparkline({ data, label }: { data: Array<{ week: string; count: number }>; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 300;
  const H = 60;
  const points = data
    .map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * W;
      const y = H - (d.count / max) * H;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{label}</p>
      {data.length < 2 ? (
        <p className="text-xs text-gray-400 py-4 text-center">Not enough data</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
            {/* brand-gold: SVG stroke cannot use Tailwind token */}
            <polyline points={points} fill="none" stroke="#F5C518" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{data[0]?.week ?? ''}</span>
            <span>{data[data.length - 1]?.week ?? ''}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub: string;
}

function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold text-nav-dark font-headline mb-1">{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GrowthDashboardPage() {
  const { data, isLoading, error } = useQuery<GrowthMetrics>({
    queryKey: ['adminGrowth'],
    queryFn: async () => {
      const res = await fetch('/api/admin/growth', { credentials: 'include' });
      if (res.status === 403) throw new Error('403');
      if (!res.ok) throw new Error('Failed to load metrics');
      return res.json() as Promise<GrowthMetrics>;
    },
    staleTime: 5 * 60_000, // 5 min — don't hammer the DB
  });

  // 403 guard — server is authoritative; show friendly message
  if (error instanceof Error && error.message === '403') {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl font-bold text-nav-dark font-headline mb-2">403</p>
            <p className="text-gray-600 mb-4">Admin access required.</p>
            <Link to="/dashboard" className="text-brand-gold hover:underline font-medium">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // Other error
  if (error) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <PageHeader title="Growth Dashboard" subtitle="Admin only — internal metrics" />
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            Failed to load growth metrics. {(error as Error).message}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-8 px-4">
        <PageHeader title="Growth Dashboard" subtitle="Admin only — internal metrics" />

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 animate-pulse rounded-2xl h-24" />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KpiCard
                label="Active Users (30d)"
                value={data.activeUsersLast30d}
                sub={`${data.newUsersLast30d} new this month`}
              />
              <KpiCard
                label="Submission Rate"
                value={`${(data.submissionRate * 100).toFixed(0)}%`}
                sub={`${data.submittedWeeks} of ${data.totalPayrollWeeks} weeks`}
              />
              <KpiCard
                label="Compliance Score"
                value={`${(data.avgComplianceScore * 100).toFixed(0)}%`}
                sub={`${data.totalViolations} total violations`}
              />
              <KpiCard
                label="MRR Estimate"
                value={`$${data.mrrEstimate.toLocaleString()}`}
                sub={`${data.totalUsers} total users`}
              />
            </div>

            {/* Sparklines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <Sparkline data={data.weeklyNewUsers} label="Weekly New Users (12 weeks)" />
              <Sparkline data={data.weeklySubmissions} label="Weekly Submissions (12 weeks)" />
            </div>

            {/* Projects summary */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Projects</p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-nav-dark font-headline">{data.activeProjects}</p>
                  <p className="text-xs text-gray-500">Active projects</p>
                </div>
                <div className="text-gray-300 text-2xl font-light">/</div>
                <div>
                  <p className="text-2xl font-bold text-gray-400 font-headline">{data.totalProjects}</p>
                  <p className="text-xs text-gray-500">Total projects</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
