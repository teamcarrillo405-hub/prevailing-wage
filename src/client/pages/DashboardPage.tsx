import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, FolderOpen } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { SkeletonGrid } from '../components/ui/SkeletonCard';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectForm } from '../components/projects/ProjectForm';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
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

  const { data: summaryData } = useQuery({
    queryKey: ['compliance-summary-batch'],
    queryFn: () => api.get<{ projects: Array<{ id: string; status: string }> }>(
      '/compliance/projects/summary'
    ),
    staleTime: 60_000,
  });

  const projects = data?.data?.projects ?? [];

  const summaryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of (summaryData?.projects ?? [])) {
      map.set(item.id, item.status);
    }
    return map;
  }, [summaryData]);

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

      {showOnboarding && !isLoading && (
        <OnboardingChecklist
          hasProjects={projects.length > 0}
          hasWorkers={false}
          hasPayroll={false}
          firstProjectId={projects[0]?.id}
          onDismiss={handleDismissOnboarding}
        />
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
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </Layout>
  );
}
