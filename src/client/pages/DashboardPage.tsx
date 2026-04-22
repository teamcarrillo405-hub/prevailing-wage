import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectForm } from '../components/projects/ProjectForm';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { HelpCallout } from '../components/ui/HelpCallout';
import { ComplianceOverviewCard } from '../components/compliance/ComplianceOverviewCard';

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

  const [searchParams, setSearchParams] = useSearchParams();

  // URL-persisted filter state — back button restores these automatically
  const searchQuery = searchParams.get('q') ?? '';
  const fundingFilter = searchParams.get('funding') ?? '';
  const complianceFilter = searchParams.get('compliance') ?? '';

  // Local controlled-input state initialized from URL (avoids useSearchParams lag on keystroke)
  const [inputValue, setInputValue] = useState(() => searchParams.get('q') ?? '');

  const { data, isLoading, isError } = useQuery({
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

  return (
    <Layout>

      {/* Dashboard photo background strip — DES-02 D-04 */}
      <div
        className="dashboard-bg relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 -mt-8 pt-8 pb-6 mb-6"
        style={{
          backgroundImage: "url('/images/dashboard-bg.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-nav-dark/85" aria-hidden="true" />
        <div className="relative z-10">
          <PageHeader
            title="Projects"
            className="mb-0 text-white [&_h1]:text-white"
            action={
              <Button onClick={() => setShowForm(true)}>
                New Project
              </Button>
            }
          />
        </div>
      </div>

      {/* Compliance summary download — Phase 59 */}
      <div className="flex justify-end mb-4">
        <a
          href="/api/export/compliance-summary"
          download="compliance-summary.pdf"
          className="inline-flex items-center gap-1.5 text-sm border border-border-default rounded-sm px-3 py-1.5 bg-surface-card text-text-primary hover:border-brand-gold hover:text-brand-gold transition-colors"
        >
          Download Compliance Summary
        </a>
      </div>

      <HelpCallout
        icon={LayoutDashboard}
        title="Your Active Projects"
        body="Each project tracks a separate federal job. Add workers and enter payroll weekly to keep your certified payroll current and DOL-ready."
      />

      {/* At-a-glance compliance summary — shows counts + status bar before the grid. */}
      {projects.length > 0 && (
        <ComplianceOverviewCard
          statusMap={summaryMap}
          totalActiveProjects={projects.filter(p => p.status === 'active').length}
          isLoading={!summaryData && projects.length > 0}
        />
      )}

      <div className="flex items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
          />
          Show Archived
        </label>
      </div>

      {/* Search + funding filter bar — DASH-03 / DASH-04 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={handleSearchChange}
          placeholder="Search projects..."
          className="text-sm border border-border-default rounded-sm px-3 py-1.5 bg-surface-card text-text-primary placeholder:text-text-secondary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold w-56"
        />
        <select
          value={fundingFilter}
          onChange={handleFundingChange}
          className="text-sm border border-border-default rounded-sm px-3 py-1.5 bg-surface-card text-text-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold"
        >
          {FUNDING_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Compliance filter chips — DASH-05 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {COMPLIANCE_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleComplianceFilterChange(opt.value)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              complianceFilter === opt.value
                ? 'bg-brand-gold text-white border-brand-gold'
                : 'bg-surface-card text-text-primary border-border-default hover:border-brand-gold'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h3 className="font-headline text-xl text-gray-900 mb-5">New Project</h3>
            <ProjectForm
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {isLoading && <LoadingSpinner />}

      {isError && (
        <div className="text-center py-12 text-red-600 text-sm">
          Failed to load projects. Please refresh.
        </div>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} className="shadow-card-elevated" />
          ))}
        </div>
      )}
    </Layout>
  );
}
