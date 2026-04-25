import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, FolderOpen, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { SkeletonGrid } from '../components/ui/SkeletonCard';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectForm } from '../components/projects/ProjectForm';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ProjectsEmptyIllustration } from '../components/illustrations/EmptyIllustrations';
import { HelpCallout } from '../components/ui/HelpCallout';
import { ComplianceOverviewCard } from '../components/compliance/ComplianceOverviewCard';
import { DueSoonPanel } from '../components/dashboard/DueSoonPanel';
import { OnboardingChecklist } from '../components/ui/OnboardingChecklist';

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

const FUNDING_OPTIONS = [
  { value: '', label: 'All Funding Types' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'mixed', label: 'Mixed' },
];

const FUNDING_LABELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  mixed: 'Mixed',
};

const COMPLIANCE_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'compliant', label: 'Compliant' },
  { value: 'violations', label: 'Has Violations' },
  { value: 'no-payroll', label: 'No Payroll' },
  { value: 'archived', label: 'Archived' },
];

export function DashboardPage() {
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('onboarding-dismissed') !== 'true'
  );

  function handleDismissOnboarding() {
    localStorage.setItem('onboarding-dismissed', 'true');
    setShowOnboarding(false);
  }

  const [searchParams, setSearchParams] = useSearchParams();

  // URL-persisted filter state — back button restores these automatically
  const searchQuery = searchParams.get('q') ?? '';
  const fundingFilter = searchParams.get('funding') ?? '';
  const complianceFilter = searchParams.get('compliance') ?? '';

  // Local controlled-input state initialized from URL (avoids useSearchParams lag on keystroke)
  const [inputValue, setInputValue] = useState(() => searchParams.get('q') ?? '');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects', showArchived ? 'all' : 'active'],
    queryFn: () => api.get<{ data: { projects: Project[] } }>(
      showArchived ? '/projects?status=all' : '/projects'
    ),
  });

  interface ProjectSummaryItem {
    id: string;
    status: string;
    violationCount: number;
    unsubmittedWeekEndingDates: string[];
  }

  const { data: summaryData } = useQuery({
    queryKey: ['compliance-summary-batch'],
    queryFn: () => api.get<{ projects: ProjectSummaryItem[] }>(
      '/compliance/projects/summary'
    ),
    staleTime: 60_000,
  });

  const projects = data?.data?.projects ?? [];

  // Map from project id → full summary item (status + violationCount + unsubmitted dates)
  const summaryItemMap = useMemo(() => {
    const map = new Map<string, ProjectSummaryItem>();
    for (const item of (summaryData?.projects ?? [])) {
      map.set(item.id, item);
    }
    return map;
  }, [summaryData]);

  // Legacy map of id → status string (still needed by ComplianceOverviewCard)
  const summaryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, item] of summaryItemMap.entries()) {
      map.set(id, item.status);
    }
    return map;
  }, [summaryItemMap]);

  // ── DASH-01 hero stat computations ──────────────────────────────────────
  const activeProjectCount = useMemo(
    () => projects.filter(p => p.status === 'active').length,
    [projects],
  );

  const totalViolations = useMemo(() => {
    let total = 0;
    for (const item of summaryItemMap.values()) {
      total += item.violationCount;
    }
    return total;
  }, [summaryItemMap]);

  const dueSoonCount = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().slice(0, 10);
    const limitStr = sevenDaysFromNow.toISOString().slice(0, 10);
    let count = 0;
    for (const item of summaryItemMap.values()) {
      const hasWeekDueSoon = item.unsubmittedWeekEndingDates.some(
        date => date >= todayStr && date <= limitStr,
      );
      if (hasWeekDueSoon) count++;
    }
    return count;
  }, [summaryItemMap]);

  // ── DASH-02 trend data: violation counts for last 12 weeks ───────────────
  const trendData = useMemo(() => {
    // Build a map of week-ending-date → weekly violation label
    // We use the unsubmittedWeekEndingDates as a proxy for week boundaries,
    // plus derive approximate week labels from current date
    const now = new Date();
    const weeks: { week: string; weekEnd: string; violations: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const weekEnd = d.toISOString().slice(0, 10);
      const weekStart = new Date(d.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weeks.push({ week: label, weekEnd, violations: 0 });
    }

    // For each project's violations status, attribute violations to the most recent
    // applicable week bucket based on available data.
    // Since we don't have per-week violation timestamps from the batch endpoint,
    // we distribute violation counts evenly across weeks that have unsubmitted dates
    // that fall within the 12-week window — this is an approximation.
    // Projects with violations contribute their total count to their most recent week bucket.
    for (const item of summaryItemMap.values()) {
      if (item.violationCount === 0) continue;
      // Find the latest unsubmitted week date within our 12-week window
      const windowStart = weeks[0]?.weekEnd ?? '';
      const relevantDates = item.unsubmittedWeekEndingDates.filter(d => d >= windowStart);
      const latestDate = relevantDates.sort().pop() ?? '';
      if (!latestDate) continue;
      // Find the closest week bucket
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < weeks.length; i++) {
        const diff = Math.abs(
          new Date(latestDate).getTime() - new Date(weeks[i].weekEnd).getTime()
        );
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }
      weeks[bestIdx].violations += item.violationCount;
    }

    return weeks.map(({ week, violations }) => ({ week, violations }));
  }, [summaryItemMap]);

  // ── DASH-03 at-risk projects ─────────────────────────────────────────────
  const atRiskProjects = useMemo(() => {
    return projects
      .map(p => ({
        id: p.id,
        name: p.name,
        violationCount: summaryItemMap.get(p.id)?.violationCount ?? 0,
      }))
      .filter(p => p.violationCount > 0)
      .sort((a, b) => b.violationCount - a.violationCount);
  }, [projects, summaryItemMap]);

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }
    if (fundingFilter) {
      result = result.filter(p => p.fundingType === fundingFilter);
    }
    if (complianceFilter) {
      result = result.filter(p => summaryMap.get(p.id) === complianceFilter);
    }
    return result;
  }, [projects, searchQuery, fundingFilter, complianceFilter, summaryMap]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val.trim()) {
        next.set('q', val);
      } else {
        next.delete('q');
      }
      return next;
    });
  }

  function handleFundingChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('funding', val);
      } else {
        next.delete('funding');
      }
      return next;
    });
  }

  function handleComplianceFilterChange(val: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('compliance', val);
      } else {
        next.delete('compliance');
      }
      return next;
    });
  }

  const complianceFilterLabel = COMPLIANCE_FILTER_OPTIONS.find(o => o.value === complianceFilter)?.label;

  useEffect(() => {
    if (!showForm) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showForm]);

  return (
    <Layout>

      {/* Premium dark hero — replaces photo background strip */}
      <div
        className="dashboard-bg relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 -mt-8 pt-10 pb-10 mb-8 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a2235 55%, #111827 100%)' }}
      >
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />
        {/* Gold ambient glow */}
        <div
          className="absolute -top-20 right-1/3 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,197,24,0.08) 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-brand-gold uppercase tracking-widest mb-3">
              HCC Prevailing Wage
            </p>
            <h1 className="font-headline text-4xl sm:text-5xl text-white mb-2 leading-tight">
              Projects
            </h1>
            <p className="text-sm text-gray-400 max-w-xs">
              Certified payroll tracking &amp; DOL compliance
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3">
            <Button onClick={() => setShowForm(true)}>
              New Project
            </Button>
            {!isLoading && projects.length > 0 && (
              <a
                href="/api/export/compliance-summary"
                download="compliance-summary.pdf"
                className="text-xs text-gray-400 hover:text-brand-gold transition-colors"
              >
                Download Summary PDF
              </a>
            )}
          </div>
        </div>
      </div>


      <HelpCallout
        icon={LayoutDashboard}
        title="Your Active Projects"
        body="Each project tracks a separate federal job. Add workers and enter payroll weekly to keep your certified payroll current and DOL-ready."
      />

      {!isLoading && !isError && projects.length === 0 && (
        <div className="bg-brand-navy text-white rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-2">Welcome to PrevailingWage</h2>
          <p className="text-white/80 mb-6">Get your first certified payroll report in under 10 minutes.</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            {[
              { n: '1', label: 'Create a Project', desc: 'Enter project name, state, and funding type' },
              { n: '2', label: 'Add Workers', desc: 'Add workers with trade classifications' },
              { n: '3', label: 'Enter Payroll', desc: 'Enter weekly hours — import from QuickBooks or CSV' },
              { n: '4', label: 'Download CPR', desc: 'State-certified WH-347 or state-specific form' },
            ].map(({ n, label, desc }) => (
              <div key={n} className="bg-white/10 rounded-lg p-4">
                <div className="w-8 h-8 bg-brand-gold text-brand-navy font-bold rounded-full flex items-center justify-center mb-3 text-sm">{n}</div>
                <p className="font-semibold text-sm mb-1">{label}</p>
                <p className="text-white/70 text-xs">{desc}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand-gold text-brand-navy font-bold px-6 py-3 rounded-lg hover:bg-brand-gold/90 transition-colors"
          >
            Create Your First Project &rarr;
          </button>
        </div>
      )}

      {showOnboarding && !isLoading && (
        <OnboardingChecklist
          hasProjects={projects.length > 0}
          hasWorkers={false}
          hasPayroll={false}
          firstProjectId={projects[0]?.id}
          onDismiss={handleDismissOnboarding}
        />
      )}

      {/* DASH-01: Hero stat row — active projects, open violations, due this week */}
      {projects.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Active Projects', value: activeProjectCount, color: 'text-gray-900' },
            { label: 'Open Violations', value: totalViolations, color: totalViolations > 0 ? 'text-red-600' : 'text-emerald-600' },
            { label: 'Due This Week', value: dueSoonCount, color: dueSoonCount > 0 ? 'text-amber-600' : 'text-gray-900' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
              <p className={`text-3xl font-bold mb-1 ${color}`}>{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* DASH-02: 12-week violation trend chart */}
      {trendData.length > 0 && projects.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Compliance Trend — Last 12 Weeks</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData}>
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="violations"
                stroke="#DC2626"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* DASH-03: Projects-at-risk panel */}
      {atRiskProjects.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 mb-8">
          <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Projects Needing Attention ({atRiskProjects.length})
          </h3>
          <div className="space-y-2">
            {atRiskProjects.slice(0, 5).map(project => (
              <div key={project.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-900">{project.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-red-600 font-medium">
                    {project.violationCount} violation{project.violationCount !== 1 ? 's' : ''}
                  </span>
                  <Link to={`/projects/${project.id}`} className="text-xs text-brand-gold hover:underline">
                    Resolve &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-a-glance compliance summary — shows counts + status bar before the grid. */}
      {projects.length > 0 && (
        <ComplianceOverviewCard
          statusMap={summaryMap}
          totalActiveProjects={projects.filter(p => p.status === 'active').length}
          isLoading={!summaryData && projects.length > 0}
        />
      )}

      {/* Due-soon / overdue payroll weeks across all projects */}
      <DueSoonPanel />

      {/* Filter bar */}
      {(!isLoading && (projects.length > 0 || showArchived)) && (
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={handleSearchChange}
              placeholder="Search projects..."
              className="text-sm border border-border-default rounded-xl px-3.5 py-2 bg-white text-text-primary placeholder:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold w-56 shadow-card"
            />
            <select
              value={fundingFilter}
              onChange={handleFundingChange}
              className="text-sm border border-border-default rounded-xl px-3.5 py-2 bg-white text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold shadow-card"
            >
              {FUNDING_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none ml-auto">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
              />
              Show Archived
            </label>
          </div>

          {/* Compliance filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            {COMPLIANCE_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleComplianceFilterChange(opt.value)}
                aria-pressed={complianceFilter === opt.value}
                className={`text-sm px-3.5 py-1.5 rounded-xl border transition-all duration-150 active:scale-95 ${
                  complianceFilter === opt.value
                    ? 'bg-brand-gold text-nav-dark border-brand-gold font-medium shadow-sm'
                    : 'bg-white text-text-secondary border-border-default hover:border-brand-gold hover:text-text-primary shadow-card'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div
            className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-modal-title"
          >
            <h3 id="new-project-modal-title" className="font-headline text-2xl text-text-primary mb-6">New Project</h3>
            <ProjectForm
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {isLoading && <SkeletonGrid count={6} />}

      {isError && (
        <div className="text-center py-12">
          <p className="text-red-600 text-sm mb-4">Failed to load projects. Please refresh.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center justify-center font-semibold rounded-sm text-sm px-4 py-2.5 bg-transparent text-brand-gold border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
          >
            Try Again
          </button>
        </div>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState
          illustration={<ProjectsEmptyIllustration />}
          icon={FolderOpen}
          heading="No projects yet"
          message="Create your first project to start tracking certified payroll. You'll need your project location to pull prevailing wage rates from SAM.gov."
          action={
            <Button onClick={() => setShowForm(true)}>Create Your First Project</Button>
          }
        />
      )}

      {!isLoading && !isError && projects.length > 0 && filteredProjects.length === 0 && (
        <EmptyState
          heading="No projects match this filter"
          message="Try clearing the filter or searching by a different name."
          action={
            <Button variant="secondary" onClick={() => { setInputValue(''); setSearchParams({}); }}>Clear Filters</Button>
          }
        />
      )}

      {!isLoading && !isError && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              violationCount={summaryItemMap.get(project.id)?.violationCount}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
