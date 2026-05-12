import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, FolderOpen, AlertTriangle, TrendingUp, Download, FileText, ShieldAlert, ClipboardCheck, Grid2X2, List, ArrowRight } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  AreaChart, Area,
  PieChart, Pie,
} from 'recharts';
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
import type { OnboardingResponse } from '../types/onboarding';

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

interface ContractorAction {
  id: string;
  projectId: string;
  projectName: string;
  type: 'violation' | 'overdue_payroll' | 'due_payroll' | 'setup' | 'subcontractor_cpr';
  priority: 'critical' | 'high' | 'medium' | 'low';
  label: string;
  detail: string;
  to: string;
  dueDate: string | null;
}

const ACTION_PRIORITY_CLASS: Record<ContractorAction['priority'], string> = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  high: 'border-amber-200 bg-amber-50 text-amber-700',
  medium: 'border-blue-200 bg-blue-50 text-blue-700',
  low: 'border-gray-200 bg-gray-50 text-gray-700',
};

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

type SavedProjectView = 'all' | 'needs-action' | 'payroll-due' | 'missing-setup' | 'sub-cpr' | 'ready-export';
type ProjectDisplayMode = 'cards' | 'list';

const SAVED_PROJECT_VIEWS: Array<{ value: SavedProjectView; label: string; description: string }> = [
  { value: 'all', label: 'All active', description: 'Every visible project' },
  { value: 'needs-action', label: 'Needs action', description: 'Any open blocker or next step' },
  { value: 'payroll-due', label: 'Payroll due', description: 'Open or overdue CPR weeks' },
  { value: 'missing-setup', label: 'Missing setup', description: 'Workers, WD, or project setup gaps' },
  { value: 'sub-cpr', label: 'Sub CPR overdue', description: 'Subcontractor payroll packages needed' },
  { value: 'ready-export', label: 'Ready to export', description: 'No known blockers or open weeks' },
];

function ProjectsCommandPanel({
  activeProjectCount,
  urgentFixes,
  payrollDue,
  setupGaps,
  subCprGaps,
  onNewProject,
}: {
  activeProjectCount: number;
  urgentFixes: number;
  payrollDue: number;
  setupGaps: number;
  subCprGaps: number;
  onNewProject: () => void;
}) {
  const totalFixes = urgentFixes + payrollDue + setupGaps + subCprGaps;
  const links = [
    { label: 'Today', href: '#today', value: totalFixes },
    { label: 'Projects', href: '#project-list', value: activeProjectCount },
    { label: 'Action Queue', href: '#action-queue', value: totalFixes },
    { label: 'Analytics', href: '#management-reports', value: null },
  ];

  return (
    <aside className="lg:sticky lg:top-[92px]">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Workspace</p>
          <h2 className="mt-1 text-base font-semibold text-gray-950">Command Center</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Start with the next fix, then open the project that needs work.
          </p>
          <button
            type="button"
            onClick={onNewProject}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand-gold px-4 text-sm font-semibold text-nav-dark hover:opacity-90"
          >
            New Project
          </button>
        </div>
        <nav className="p-2" aria-label="Dashboard sections">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="mb-1 flex min-h-[44px] items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-950"
            >
              <span>{link.label}</span>
              {link.value !== null && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{link.value}</span>
              )}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function AnalyticsActionCard({
  label,
  value,
  detail,
  to,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  detail: string;
  to: string;
  tone?: 'red' | 'amber' | 'emerald' | 'neutral';
}) {
  const toneClass = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-700'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-gray-200 bg-gray-50 text-gray-700';

  return (
    <Link
      to={to}
      className={`group flex min-h-[104px] flex-col justify-between rounded-xl border p-4 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 text-xs leading-relaxed opacity-80">{detail}</p>
    </Link>
  );
}

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
  const savedView = (searchParams.get('view') as SavedProjectView | null) ?? 'all';
  const displayMode = (searchParams.get('display') as ProjectDisplayMode | null) ?? 'cards';

  // Local controlled-input state initialized from URL (avoids useSearchParams lag on keystroke)
  const [inputValue, setInputValue] = useState(() => searchParams.get('q') ?? '');

  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data: mfaStatus } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: () => api.get<{ data: { enabled: boolean; backupCodesRemaining: number } }>('/mfa/status'),
    staleTime: 60_000,
  });

  const { data: teamData } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get<{ data: { isOwner: boolean } }>('/team'),
    staleTime: 60_000,
  });

  const isOwner = teamData?.data?.isOwner === true;

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

  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<{ activeProjects: number; openViolations: number; weeksDueThisWeek: number }>(
      '/dashboard/stats'
    ),
    staleTime: 60_000,
  });

  const { data: contractorActionsData } = useQuery({
    queryKey: ['dashboard-contractor-actions'],
    queryFn: () => api.get<{ actions: ContractorAction[] }>('/dashboard/contractor-actions'),
    staleTime: 60_000,
  });

  const { data: onboardingData } = useQuery({
    queryKey: ['onboarding-profile'],
    queryFn: () => api.get<OnboardingResponse>('/onboarding'),
    staleTime: 5 * 60_000,
  });

  const { data: trendResp } = useQuery({
    queryKey: ['dashboard-compliance-trend'],
    queryFn: () => api.get<{ weeks: Array<{ weekLabel: string; violationCount: number }> }>(
      '/dashboard/compliance-trend'
    ),
    staleTime: 60_000,
  });

  interface EconomicImpactData {
    totalWagesByCraft: { trade: string; totalWages: number; workerCount: number; projectCount: number }[];
    localHirePercent: number;
    apprenticePercent: number;
    stateBreakdown: { state: string; projectCount: number; workerCount: number; totalWages: number }[];
    totalWagesPaid: number;
    complianceTrend: { weekLabel: string; violations: number; compliant: number }[];
    topViolatingProjects: { projectId: string; projectName: string; violations: number; lastViolation: string }[];
    wageVarianceByTrade: { trade: string; avgRate: number; minRate: number; maxRate: number; deviation: number }[];
    overtimeExposure: { projectId: string; projectName: string; dtHours: number; otHours: number; estimatedPremium: number }[];
    apprenticeshipProgress: { trade: string; required: number; actual: number; gap: number }[];
    submissionPunctuality: { onTime: number; late: number; missing: number; percentOnTime: number };
    weeklyWageBurn: { weekLabel: string; wages: number; workers: number }[];
    fringeVsBaseWage: { fringe: number; base: number; fringePercent: number };
    projectRankings: { projectId: string; projectName: string; totalWages: number; workers: number; compliance: number }[];
  }

  // Sortable table types
  type SortDir = 'asc' | 'desc';
  type RankingRow = { projectId: string; projectName: string; totalWages: number; workers: number; compliance: number };

  const PUNCTUALITY_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

  const { data: economicData } = useQuery({
    queryKey: ['economic-impact'],
    queryFn: () => api.get<{ data: EconomicImpactData }>('/dashboard/economic-impact'),
    staleTime: 5 * 60_000,
  });

  // Sortable project rankings state
  const [rankSortKey, setRankSortKey] = useState<keyof RankingRow>('totalWages');
  const [rankSortDir, setRankSortDir] = useState<SortDir>('desc');

  function handleRankSort(key: keyof RankingRow) {
    if (key === rankSortKey) {
      setRankSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setRankSortKey(key);
      setRankSortDir('desc');
    }
  }

  const sortedRankings = useMemo(() => {
    const rows = economicData?.data?.projectRankings ?? [];
    return [...rows].sort((a, b) => {
      const av = a[rankSortKey];
      const bv = b[rankSortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return rankSortDir === 'asc' ? av - bv : bv - av;
      }
      return rankSortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [economicData?.data?.projectRankings, rankSortKey, rankSortDir]);

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

  // DASH-01 hero stats — sourced from server (replaces client-side useMemos)
  const visibleActiveProjectCount = projects.filter(p => p.status === 'active').length;
  const activeProjectCount = Math.max(statsData?.activeProjects ?? 0, visibleActiveProjectCount);
  const totalViolations = statsData?.openViolations ?? 0;
  const dueSoonCount = statsData?.weeksDueThisWeek ?? 0;

  // DASH-02 12-week trend — sourced from server (replaces client-side bucket approximation)
  const trendData = trendResp?.weeks ?? [];

  // DASH-03 at-risk projects — sourced from server endpoint (replaces legacy /violations polling)
  interface AtRiskProject {
    id: string;
    name: string;
    openViolationCount: number;
    oldestViolationDays: number;
  }

  const { data: atRiskResp } = useQuery({
    queryKey: ['dashboard-at-risk'],
    queryFn: () => api.get<{ projects: AtRiskProject[] }>('/dashboard/at-risk'),
    staleTime: 60_000,
  });

  const atRiskProjects: AtRiskProject[] = atRiskResp?.projects ?? [];

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
  const contractorActions = contractorActionsData?.actions ?? [];
  const actionByProjectId = useMemo(() => {
    const map = new Map<string, ContractorAction>();
    const priorityRank: Record<ContractorAction['priority'], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    for (const action of contractorActions) {
      const current = map.get(action.projectId);
      if (!current || priorityRank[action.priority] < priorityRank[current.priority]) {
        map.set(action.projectId, action);
      }
    }
    return map;
  }, [contractorActions]);
  const urgentContractorActions = contractorActions.filter(
    (action) => action.priority === 'critical' || action.priority === 'high',
  );
  const duePayrollActions = contractorActions.filter(
    (action) => action.type === 'overdue_payroll' || action.type === 'due_payroll',
  );
  const setupActions = contractorActions.filter((action) => action.type === 'setup');
  const subcontractorActions = contractorActions.filter((action) => action.type === 'subcontractor_cpr');
  const actionTypeByProjectId = useMemo(() => {
    const map = new Map<string, Set<ContractorAction['type']>>();
    for (const action of contractorActions) {
      const existing = map.get(action.projectId) ?? new Set<ContractorAction['type']>();
      existing.add(action.type);
      map.set(action.projectId, existing);
    }
    return map;
  }, [contractorActions]);
  const savedViewCounts = useMemo(() => {
    const counts: Record<SavedProjectView, number> = {
      all: projects.length,
      'needs-action': 0,
      'payroll-due': 0,
      'missing-setup': 0,
      'sub-cpr': 0,
      'ready-export': 0,
    };
    for (const project of projects) {
      const summary = summaryItemMap.get(project.id);
      const actionTypes = actionTypeByProjectId.get(project.id);
      const hasViolations = (summary?.violationCount ?? 0) > 0;
      const hasOpenWeeks = (summary?.unsubmittedWeekEndingDates.length ?? 0) > 0;
      const hasActions = Boolean(actionTypes?.size);
      if (hasActions || hasViolations || hasOpenWeeks) counts['needs-action'] += 1;
      if (hasOpenWeeks || actionTypes?.has('due_payroll') || actionTypes?.has('overdue_payroll')) counts['payroll-due'] += 1;
      if (actionTypes?.has('setup')) counts['missing-setup'] += 1;
      if (actionTypes?.has('subcontractor_cpr')) counts['sub-cpr'] += 1;
      if (!hasActions && !hasViolations && !hasOpenWeeks && project.status !== 'closed') counts['ready-export'] += 1;
    }
    return counts;
  }, [actionTypeByProjectId, projects, summaryItemMap]);
  const filteredProjects = useMemo(() => {
    let result = projects;
    if (savedView !== 'all') {
      result = result.filter((project) => {
        const summary = summaryItemMap.get(project.id);
        const actionTypes = actionTypeByProjectId.get(project.id);
        const hasViolations = (summary?.violationCount ?? 0) > 0;
        const hasOpenWeeks = (summary?.unsubmittedWeekEndingDates.length ?? 0) > 0;
        const hasActions = Boolean(actionTypes?.size);
        if (savedView === 'needs-action') return hasActions || hasViolations || hasOpenWeeks;
        if (savedView === 'payroll-due') return hasOpenWeeks || actionTypes?.has('due_payroll') || actionTypes?.has('overdue_payroll');
        if (savedView === 'missing-setup') return actionTypes?.has('setup');
        if (savedView === 'sub-cpr') return actionTypes?.has('subcontractor_cpr');
        if (savedView === 'ready-export') return !hasActions && !hasViolations && !hasOpenWeeks && project.status !== 'closed';
        return true;
      });
    }
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
  }, [projects, savedView, searchQuery, fundingFilter, complianceFilter, summaryMap, summaryItemMap, actionTypeByProjectId]);
  function handleSavedViewChange(val: SavedProjectView) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val === 'all') {
        next.delete('view');
      } else {
        next.set('view', val);
      }
      return next;
    });
  }

  function handleDisplayModeChange(val: ProjectDisplayMode) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val === 'cards') {
        next.delete('display');
      } else {
        next.set('display', val);
      }
      return next;
    });
  }
  const primaryTodayAction = urgentContractorActions[0] ?? contractorActions[0] ?? null;
  const readyProjectCount = projects.filter((project) => summaryMap.get(project.id) === 'compliant').length;
  const highVarianceTradeCount = economicData?.data.wageVarianceByTrade.filter((row) => row.deviation > 5).length ?? 0;
  const apprenticeGapCount = economicData?.data.apprenticeshipProgress.filter((row) => row.gap > 0).length ?? 0;
  const overtimeProjectCount = economicData?.data.overtimeExposure.length ?? 0;
  const topOvertimeProject = economicData?.data.overtimeExposure[0] ?? null;
  const onboardingAnswers = onboardingData?.data.profile?.onboardingAnswers;
  const recommendedNextSteps = onboardingData?.data.profile?.recommendedNextSteps ?? [];
  const onboardingHasWorkers = projects.length > 0 && !contractorActions.some(
    (action) => action.type === 'setup' && action.label === 'Add workers and classifications',
  );
  const onboardingHasPayroll = projects.length > 0 && !contractorActions.some(
    (action) => action.type === 'setup' && action.label === 'Create the first payroll week',
  );

  useEffect(() => {
    if (!showForm) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showForm]);

  return (
    <Layout>

      {/* MFA enrollment nag banner — owners only, dismissible, advisory only */}
      {isOwner && mfaStatus?.data?.enabled === false && !bannerDismissed && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-4 flex items-center justify-between text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Protect your account — enable two-factor authentication for owner operations.</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/settings/mfa" className="font-medium underline">Enable MFA</Link>
            <button onClick={() => setBannerDismissed(true)} aria-label="Dismiss" className="text-amber-700 hover:text-amber-900">
              ×
            </button>
          </div>
        </div>
      )}

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
              Dashboard
            </h1>
            <p className="text-sm text-gray-400 max-w-xs">
              Certified payroll tracking &amp; DOL compliance
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ProjectsCommandPanel
          activeProjectCount={activeProjectCount}
          urgentFixes={urgentContractorActions.length}
          payrollDue={duePayrollActions.length || dueSoonCount}
          setupGaps={setupActions.length}
          subCprGaps={subcontractorActions.length}
          onNewProject={() => setShowForm(true)}
        />
        <div className="min-w-0">

      {projects.length > 0 && (
        <section id="today" className="mb-8 scroll-mt-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Today</p>
              <h2 className="mt-1 font-headline text-2xl text-gray-950">
                {primaryTodayAction ? primaryTodayAction.label : 'All active projects are clean right now'}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {primaryTodayAction
                  ? `${primaryTodayAction.projectName}: ${primaryTodayAction.detail}`
                  : 'No blocking payroll, wage determination, or subcontractor CPR actions are open.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
              {primaryTodayAction ? (
                <Link
                  to={primaryTodayAction.to}
                  className="inline-flex min-h-11 items-center justify-center rounded-sm bg-brand-gold px-5 text-sm font-semibold text-nav-dark hover:opacity-90"
                >
                  Open next fix
                </Link>
              ) : (
                <Link
                  to="/reports"
                  className="inline-flex min-h-11 items-center justify-center rounded-sm bg-brand-gold px-5 text-sm font-semibold text-nav-dark hover:opacity-90"
                >
                  Review reports
                </Link>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Urgent fixes', value: urgentContractorActions.length, tone: urgentContractorActions.length ? 'text-red-600' : 'text-emerald-600' },
              { label: 'Payroll due', value: duePayrollActions.length || dueSoonCount, tone: (duePayrollActions.length || dueSoonCount) ? 'text-amber-600' : 'text-emerald-600' },
              { label: 'Setup gaps', value: setupActions.length, tone: setupActions.length ? 'text-amber-600' : 'text-emerald-600' },
              { label: 'Sub CPR gaps', value: subcontractorActions.length, tone: subcontractorActions.length ? 'text-red-600' : 'text-emerald-600' },
              { label: 'No violations', value: readyProjectCount, tone: 'text-gray-900' },
            ].map(({ label, value, tone }) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
                <div className="mt-1 text-xs font-medium text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </section>
      )}


      <HelpCallout
        icon={LayoutDashboard}
        title="Your Project Dashboard"
        body="Each project tracks a separate federal job. Add workers and enter payroll weekly to keep your certified payroll current and DOL-ready."
      />

      {onboardingAnswers && (
        <details className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">
            Setup profile
            <span className="ml-2 text-xs font-normal text-gray-500">
              Payroll, project system, states, and onboarding checklist
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Defaults and import prompts are using your onboarding answers for {onboardingAnswers.primaryStates.join(', ') || 'your selected states'}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                    {onboardingAnswers.payrollProvider.replaceAll('_', ' ')} payroll
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                    {onboardingAnswers.projectManagementProvider.replaceAll('_', ' ')} project system
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                    {onboardingAnswers.usesSubcontractors ? 'Subcontractor CPR tracking' : 'Prime CPR only'}
                  </span>
                </div>
                {recommendedNextSteps.length > 0 && (
                  <p className="mt-3 text-xs text-gray-500">
                    Next setup focus: {recommendedNextSteps.slice(0, 2).join(' · ')}
                  </p>
                )}
              </div>
              <Link
                to="/onboarding"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Edit onboarding
              </Link>
            </div>
            {showOnboarding && !isLoading && projects.length > 0 && (
              <OnboardingChecklist
                hasProjects
                hasWorkers={onboardingHasWorkers}
                hasPayroll={onboardingHasPayroll}
                hasWageDetermination
                hasReport={onboardingHasPayroll}
                firstProjectId={projects[0]?.id}
                onDismiss={handleDismissOnboarding}
              />
            )}
          </div>
        </details>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <div className="bg-brand-navy text-white rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-2">Welcome to PrevailingWage</h2>
          <p className="text-white/80 mb-6">Get your first certified payroll report in under 10 minutes.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

      {showOnboarding && !isLoading && projects.length === 0 && (
        <OnboardingChecklist
          hasProjects={false}
          hasWorkers={onboardingHasWorkers}
          hasPayroll={onboardingHasPayroll}
          hasWageDetermination={false}
          hasReport={onboardingHasPayroll}
          firstProjectId={projects[0]?.id}
          onDismiss={handleDismissOnboarding}
        />
      )}

      <details id="management-reports" className="mb-8 scroll-mt-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">
          Management reports and analytics
          <span className="ml-2 text-xs font-normal text-gray-500">
            Compliance trend, due weeks, economic impact, and reporting detail
          </span>
        </summary>
        <div className="mt-5 space-y-6">

      {/* DASH-01: Hero stat row — active projects, open violations, due this week */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {projects.length > 0 && (
        <div id="action-queue" className="scroll-mt-24 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-brand-gold" />
                Contractor Action Queue
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                The next payroll, compliance, and subcontractor items that can block certification.
              </p>
            </div>
            <span className="text-xs text-gray-500">{contractorActions.length} open</span>
          </div>
          {contractorActions.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {contractorActions.slice(0, 6).map((action) => (
                <div key={action.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-semibold uppercase px-2 py-1 rounded border ${ACTION_PRIORITY_CLASS[action.priority]}`}>
                        {action.priority}
                      </span>
                      <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-medium text-gray-700">{action.projectName}</span>
                      {' - '}
                      {action.detail}
                    </p>
                  </div>
                  <Link
                    to={action.to}
                    className="inline-flex items-center justify-center text-xs font-semibold text-brand-gold hover:underline shrink-0"
                  >
                    Open
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              No blocking payroll, compliance, or subcontractor actions are open right now.
            </div>
          )}
        </div>
      )}

      {/* DASH-02: 12-week violation trend chart */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Compliance Trend - Last 12 Weeks</h3>
            <p className="mt-1 text-xs text-gray-500">Use the action view to open the projects behind the trend.</p>
          </div>
          <Link
            to="/dashboard?display=list&view=needs-action#project-list"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:border-brand-gold hover:text-gray-950"
          >
            Open source projects
          </Link>
        </div>
        {(trendData.length > 0 && projects.length > 0) ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData}>
              <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="violationCount"
                stroke="#DC2626"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-500 py-4 text-center">No violation data yet</p>
        )}
      </div>

      {/* DASH-03: Projects-at-risk panel — sourced from /api/dashboard/at-risk */}
      {atRiskProjects.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 md:max-w-lg">
          <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Projects Needing Attention ({atRiskProjects.length})
          </h3>
          <div className="space-y-2">
            {atRiskProjects.slice(0, 5).map(project => (
              <div key={project.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-900">{project.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-red-600 font-medium">
                    {project.openViolationCount} violation{project.openViolationCount !== 1 ? 's' : ''}
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
          statusLinks={{
            compliant: '/dashboard?display=list&compliance=compliant#project-list',
            violations: '/dashboard?display=list&compliance=violations#project-list',
            'no-payroll': '/dashboard?display=list&compliance=no-payroll#project-list',
          }}
          isLoading={!summaryData && projects.length > 0}
        />
      )}

      {/* Due-soon / overdue payroll weeks across all projects */}
      <DueSoonPanel />
        </div>
      </details>

      {/* Filter bar */}
      {(!isLoading && (projects.length > 0 || showArchived)) && (
        <div id="project-list" className="scroll-mt-24 space-y-3 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Saved views</p>
                <h2 className="mt-1 text-lg font-semibold text-gray-950">Projects</h2>
              </div>
              <div className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-1 sm:w-auto" aria-label="Project display mode">
                <button
                  type="button"
                  onClick={() => handleDisplayModeChange('cards')}
                  aria-pressed={displayMode === 'cards'}
                  className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold sm:flex-none ${
                    displayMode === 'cards' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600 hover:text-gray-950'
                  }`}
                >
                  <Grid2X2 className="h-4 w-4" />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => handleDisplayModeChange('list')}
                  aria-pressed={displayMode === 'list'}
                  className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold sm:flex-none ${
                    displayMode === 'list' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600 hover:text-gray-950'
                  }`}
                >
                  <List className="h-4 w-4" />
                  List
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {SAVED_PROJECT_VIEWS.map((view) => (
                <button
                  key={view.value}
                  type="button"
                  onClick={() => handleSavedViewChange(view.value)}
                  aria-pressed={savedView === view.value}
                  className={`min-h-[72px] rounded-lg border px-3 py-2 text-left transition-colors ${
                    savedView === view.value
                      ? 'border-brand-gold bg-brand-gold/10 text-gray-950'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-brand-gold/60 hover:bg-white'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                    {view.label}
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 shadow-sm">
                      {savedViewCounts[view.value]}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-gray-500">{view.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={handleSearchChange}
              placeholder="Search projects..."
              className="text-base border border-border-default rounded-xl px-3.5 py-3 bg-white text-text-primary placeholder:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold w-full sm:w-56 shadow-card min-h-[44px]"
            />
            <select
              value={fundingFilter}
              onChange={handleFundingChange}
              className="text-base border border-border-default rounded-xl px-3.5 py-3 bg-white text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold shadow-card min-h-[44px] w-full sm:w-auto"
            >
              {FUNDING_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none ml-auto min-h-[44px]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
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
                className={`text-sm px-3.5 py-2.5 rounded-xl border transition-all duration-150 active:scale-95 min-h-[44px] ${
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto px-4 py-6 sm:py-10">
          <div
            className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg p-7 mx-auto max-h-[calc(100dvh-3rem)] overflow-y-auto"
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
            className="inline-flex items-center justify-center font-semibold rounded-sm text-sm px-4 py-3 min-h-[44px] bg-transparent text-brand-gold border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
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

      {!isLoading && !isError && filteredProjects.length > 0 && displayMode === 'list' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(220px,1.5fr)_120px_120px_120px_minmax(180px,1fr)_96px] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:grid">
            <span>Project</span>
            <span>Issues</span>
            <span>Open weeks</span>
            <span>Status</span>
            <span>Next action</span>
            <span className="text-right">Open</span>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredProjects.map((project) => {
              const summary = summaryItemMap.get(project.id);
              const action = actionByProjectId.get(project.id);
              const violationCount = summary?.violationCount ?? 0;
              const openWeekCount = summary?.unsubmittedWeekEndingDates.length ?? 0;
              const statusLabel = violationCount > 0
                ? `${violationCount} violation${violationCount !== 1 ? 's' : ''}`
                : openWeekCount > 0
                  ? 'Open payroll'
                  : summary?.status === 'no-payroll'
                    ? 'No payroll'
                    : 'Ready';
              const statusClass = violationCount > 0
                ? 'border-red-200 bg-red-50 text-red-700'
                : openWeekCount > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : summary?.status === 'no-payroll'
                    ? 'border-gray-200 bg-gray-50 text-gray-600'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="grid gap-3 px-4 py-4 transition-colors hover:bg-gray-50 lg:grid-cols-[minmax(220px,1.5fr)_120px_120px_120px_minmax(180px,1fr)_96px] lg:items-center lg:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-950">{project.name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {project.state} - {project.county} - {FUNDING_LABELS[project.fundingType] ?? project.fundingType}
                    </p>
                  </div>
                  <div className="flex items-center justify-between lg:block">
                    <span className="text-xs font-medium text-gray-500 lg:hidden">Issues</span>
                    <span className={`text-sm font-bold tabular-nums ${violationCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {violationCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between lg:block">
                    <span className="text-xs font-medium text-gray-500 lg:hidden">Open weeks</span>
                    <span className={`text-sm font-bold tabular-nums ${openWeekCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {openWeekCount}
                    </span>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="min-w-0">
                    {action ? (
                      <>
                        <p className="truncate text-sm font-semibold text-gray-900">{action.label}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{action.detail}</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">No known blocker</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-sm font-semibold text-brand-gold">
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && !isError && filteredProjects.length > 0 && displayMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              violationCount={summaryItemMap.get(project.id)?.violationCount}
              unsubmittedWeekCount={summaryItemMap.get(project.id)?.unsubmittedWeekEndingDates.length ?? 0}
              nextAction={actionByProjectId.get(project.id)}
            />
          ))}
        </div>
      )}

      {/* DASH-04 / TRUST-02: Economic Impact Section */}
      {economicData?.data && (
        <details className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">
            Economic impact reports
            <span className="ml-2 text-xs font-normal text-gray-500">
              wages, apprenticeships, punctuality, and trade analytics
            </span>
          </summary>
        <div className="mt-6">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-gold" />
              <h2 className="text-lg font-bold text-gray-900">Economic Impact</h2>
            </div>
            <a
              href="/api/reports/export-csv?report=economic-impact"
              download="economic-impact.csv"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Economic Impact Report
            </a>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <AnalyticsActionCard
              label="Payroll source"
              value={savedViewCounts['payroll-due']}
              detail="Open every project behind due or overdue certified payroll."
              to="/dashboard?display=list&view=payroll-due#project-list"
              tone={savedViewCounts['payroll-due'] > 0 ? 'amber' : 'emerald'}
            />
            <AnalyticsActionCard
              label="Sub CPR source"
              value={savedViewCounts['sub-cpr']}
              detail="Jump to projects waiting on subcontractor payroll packages."
              to="/dashboard?display=list&view=sub-cpr#project-list"
              tone={savedViewCounts['sub-cpr'] > 0 ? 'red' : 'emerald'}
            />
            <AnalyticsActionCard
              label="Rate variance"
              value={highVarianceTradeCount}
              detail="Review trades with large pay-rate spread before export."
              to="/reports"
              tone={highVarianceTradeCount > 0 ? 'amber' : 'neutral'}
            />
            <AnalyticsActionCard
              label="OT exposure"
              value={overtimeProjectCount}
              detail="Open project payroll where premium labor cost is concentrated."
              to={topOvertimeProject ? `/projects/${topOvertimeProject.projectId}/payroll` : '/reports'}
              tone={overtimeProjectCount > 0 ? 'amber' : 'neutral'}
            />
            <AnalyticsActionCard
              label="Apprentice gaps"
              value={apprenticeGapCount}
              detail="Open apprenticeship reporting when ratios need attention."
              to="/reports"
              tone={apprenticeGapCount > 0 ? 'red' : 'neutral'}
            />
          </div>

          {/* Stat tiles — 4 across */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {economicData.data.localHirePercent}%
              </p>
              <p className="text-sm text-gray-500">Local Hire Rate</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {economicData.data.apprenticePercent}%
              </p>
              <p className="text-sm text-gray-500">Apprentice Share</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900 mb-1">
                ${economicData.data.totalWagesPaid.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-gray-500">Total Wages Paid</p>
            </div>
            {/* NEW: Fringe benefit rate tile */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {economicData.data.fringeVsBaseWage.fringePercent}%
              </p>
              <p className="text-sm text-gray-500">Fringe Benefit Rate</p>
              <p className="text-xs text-gray-400 mt-1">
                ${economicData.data.fringeVsBaseWage.fringe.toLocaleString('en-US', { maximumFractionDigits: 0 })} fringe
              </p>
            </div>
          </div>

          {/* NEW: Submission Punctuality donut + Top Violating Projects */}
          {(economicData.data.submissionPunctuality.onTime > 0 ||
            economicData.data.submissionPunctuality.late > 0 ||
            economicData.data.submissionPunctuality.missing > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">CPR Submission Punctuality</h3>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'On Time', value: economicData.data.submissionPunctuality.onTime },
                          { name: 'Late', value: economicData.data.submissionPunctuality.late },
                          { name: 'Missing', value: economicData.data.submissionPunctuality.missing },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                      >
                        {PUNCTUALITY_COLORS.map((color, idx) => (
                          <Cell key={idx} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-gray-900">
                      {economicData.data.submissionPunctuality.percentOnTime}%
                    </div>
                    <p className="text-xs text-gray-500">On-time rate</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                        <span className="text-gray-600">On Time: {economicData.data.submissionPunctuality.onTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                        <span className="text-gray-600">Late: {economicData.data.submissionPunctuality.late}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                        <span className="text-gray-600">Missing: {economicData.data.submissionPunctuality.missing}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {economicData.data.topViolatingProjects.length > 0 && (
                <div className="bg-white border border-red-100 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Top Projects by Past-Due Weeks
                  </h3>
                  <div className="space-y-2">
                    {economicData.data.topViolatingProjects.map(p => (
                      <div key={p.projectId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate max-w-[180px]">{p.projectName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-red-600 font-semibold">{p.violations} wks</span>
                          <Link to={`/projects/${p.projectId}`} className="text-xs text-brand-gold hover:underline">
                            Fix &rarr;
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wages by craft bar chart — enhanced with worker count tooltip */}
          {economicData.data.totalWagesByCraft.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Wages by Craft</h3>
                  <p className="mt-1 text-xs text-gray-500">Hover for wage, worker, and project count. Use reports for export-ready source rows.</p>
                </div>
                <Link to="/reports" className="text-xs font-semibold text-brand-gold hover:underline">
                  Open reports
                </Link>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={economicData.data.totalWagesByCraft.slice(0, 8)}>
                  <XAxis dataKey="trade" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as { trade: string; totalWages: number; workerCount: number; projectCount: number };
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1">
                          <p className="font-semibold text-gray-800">{d.trade}</p>
                          <p className="text-gray-600">Wages: <span className="font-medium text-gray-900">${d.totalWages.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></p>
                          <p className="text-gray-600">Workers: <span className="font-medium text-gray-900">{d.workerCount}</span></p>
                          <p className="text-gray-600">Projects: <span className="font-medium text-gray-900">{d.projectCount}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="totalWages" fill="#F5C518" radius={[4, 4, 0, 0]}>
                    {economicData.data.totalWagesByCraft.slice(0, 8).map((_entry, idx) => (
                      <Cell key={idx} fill={idx === 0 ? '#B8940E' : '#F5C518'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* NEW: Weekly Wage Burn AreaChart */}
          {economicData.data.weeklyWageBurn.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Weekly Wage Burn - Last 12 Weeks</h3>
                  <p className="mt-1 text-xs text-gray-500">Open the project ranking table below to trace wage movement back to jobs.</p>
                </div>
                <a href="#project-rankings" className="text-xs font-semibold text-brand-gold hover:underline">
                  View source projects
                </a>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={economicData.data.weeklyWageBurn}>
                  <defs>
                    <linearGradient id="wageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5C518" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F5C518" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: unknown) => {
                      const num = typeof value === 'number' ? value : 0;
                      return [`$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, 'Wages'];
                    }}
                  />
                  <Area type="monotone" dataKey="wages" stroke="#F5C518" strokeWidth={2} fill="url(#wageGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* NEW: Wage Variance by Trade table */}
          {economicData.data.wageVarianceByTrade.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Wage Rate Variance by Trade</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Per-trade spread between min and max base rates across all payroll entries</p>
                </div>
                <Link to="/reports" className="text-xs font-semibold text-brand-gold hover:underline">
                  Investigate rates
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trade</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Rate</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Rate</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Rate</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Std Dev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {economicData.data.wageVarianceByTrade.map(row => (
                    <tr key={row.trade} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{row.trade}</td>
                      <td className="px-5 py-3 text-right text-gray-700">${row.avgRate.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-gray-600">${row.minRate.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-gray-600">${row.maxRate.toFixed(2)}</td>
                      <td className={`px-5 py-3 text-right font-medium ${row.deviation > 5 ? 'text-red-600' : row.deviation > 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                        &plusmn;${row.deviation.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* NEW: Overtime Exposure panel */}
          {economicData.data.overtimeExposure.length > 0 && (
            <div className="bg-white border border-amber-100 rounded-xl overflow-hidden shadow-sm mb-6">
              <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-amber-800">Overtime Exposure</h3>
                  <p className="text-xs text-amber-600 mt-0.5">Estimated premium labor cost from OT and DT hours per project</p>
                </div>
                {topOvertimeProject && (
                  <Link to={`/projects/${topOvertimeProject.projectId}/payroll`} className="text-xs font-semibold text-amber-800 hover:underline">
                    Open top project
                  </Link>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">OT Hours</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">DT Hours</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Est. Premium</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {economicData.data.overtimeExposure.map(row => (
                    <tr key={row.projectId} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        <Link to={`/projects/${row.projectId}`} className="hover:text-brand-gold transition-colors">
                          {row.projectName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">{row.otHours.toFixed(1)}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{row.dtHours.toFixed(1)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-amber-700">
                        ${row.estimatedPremium.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* NEW: Apprenticeship Progress table */}
          {economicData.data.apprenticeshipProgress.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Apprenticeship Ratio Progress</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Actual apprentice hour % vs required threshold per trade (IRA/IIJA default: 25%)</p>
                </div>
                <Link to="/reports" className="text-xs font-semibold text-brand-gold hover:underline">
                  Open apprenticeship report
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trade</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Required</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actual</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Gap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {economicData.data.apprenticeshipProgress.map(row => (
                    <tr key={row.trade} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{row.trade}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{row.required}%</td>
                      <td className={`px-5 py-3 text-right font-semibold ${row.actual >= row.required ? 'text-emerald-600' : 'text-red-600'}`}>
                        {row.actual}%
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${row.gap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {row.gap > 0 ? `-${row.gap}%` : 'Met'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* NEW: Project Rankings sortable table */}
          {sortedRankings.length > 0 && (
            <div id="project-rankings" className="scroll-mt-24 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Project Rankings</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Click column headers to sort</p>
                </div>
                <a
                  href="/api/reports/export-csv?report=compliance"
                  download="compliance-summary.csv"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {(
                        [
                          { label: 'Project', col: 'projectName' },
                          { label: 'Total Wages', col: 'totalWages' },
                          { label: 'Workers', col: 'workers' },
                          { label: 'Compliance %', col: 'compliance' },
                        ] as { label: string; col: keyof RankingRow }[]
                      ).map(({ label, col }) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 transition-colors"
                          onClick={() => handleRankSort(col)}
                        >
                          {label}
                          {rankSortKey === col && (
                            <span className="ml-1 text-brand-gold">{rankSortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedRankings.map(row => (
                      <tr key={row.projectId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <Link to={`/projects/${row.projectId}`} className="hover:text-brand-gold transition-colors">
                            {row.projectName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          ${row.totalWages.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.workers}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${row.compliance >= 90 ? 'text-emerald-600' : row.compliance >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {row.compliance}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* State breakdown table + totalWages column */}
          {economicData.data.stateBreakdown.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Coverage by State</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">State</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Projects</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Workers</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Wages</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {economicData.data.stateBreakdown.map(row => (
                    <tr key={row.state}>
                      <td className="px-5 py-3 font-medium text-gray-900">{row.state}</td>
                      <td className="px-5 py-3 text-gray-600">{row.projectCount}</td>
                      <td className="px-5 py-3 text-gray-600">{row.workerCount}</td>
                      <td className="px-5 py-3 text-gray-600">
                        ${(row.totalWages ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Link to full Reports hub */}
          <div className="mt-6 text-center">
            <Link
              to="/reports"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-gold hover:text-brand-gold/80 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View All Reports &rarr;
            </Link>
          </div>
        </div>
        </details>
      )}

        </div>
      </div>

    </Layout>
  );
}
