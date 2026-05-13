import { Link, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BriefcaseBusiness,
  Clock,
  Database,
  FileCheck,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { api } from '../../lib/api';

interface ProjectSummary {
  id: string;
  name: string;
  state: string;
  county: string;
  contractType: string;
  fundingType: string;
  status: string;
}

interface PayrollWeekSummary {
  id: string;
  submittedAt: string | null;
  workerCount?: number;
}

interface PinRow {
  isPrimary: boolean;
  wdNumber: string;
  revisionNumber: number;
}

interface ComplianceProjectSummary {
  id: string;
  status: string;
  violationCount: number;
}

interface SubcontractorQueueItem {
  status: 'overdue' | 'received-non-compliant' | 'not-received' | 'received-compliant';
}

function labelContractType(value: string | undefined) {
  const labels: Record<string, string> = {
    'federal-davis-bacon': 'Federal Davis-Bacon',
    'state-prevailing': 'State Prevailing',
    'gsa-schedule': 'GSA Schedule',
    private: 'Private',
  };
  return value ? labels[value] ?? value : 'Project';
}

function statusTone(status: string) {
  if (status === 'complete' || status === 'ready' || status === 'clean') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'blocked') return 'bg-red-50 text-red-800 border-red-200';
  if (status === 'warning') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function compactName(name: string | undefined) {
  if (!name) return 'Project';
  return name.length > 38 ? `${name.slice(0, 35)}...` : name;
}

export function ProjectWorkspaceNav({ projectId }: { projectId: string }) {
  const { pathname, hash } = useLocation();
  const base = `/projects/${projectId}`;

  const { data: projectData } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => api.get<{ data: { project: ProjectSummary } }>(`/projects/${projectId}`),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const { data: workersData } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: () => api.get<{ data: { workers: { id: string }[] } }>(`/projects/${projectId}/workers`),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const { data: weeksData } = useQuery({
    queryKey: ['payroll-weeks', projectId],
    queryFn: () => api.get<{ weeks: PayrollWeekSummary[] }>(`/payroll/projects/${projectId}/weeks`),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const { data: wdPinsData } = useQuery({
    queryKey: ['wd-pins', projectId],
    queryFn: () => api.get<{ pins: PinRow[] }>(`/projects/${projectId}/wage-determinations`),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const { data: complianceData } = useQuery({
    queryKey: ['compliance-summary-batch'],
    queryFn: () => api.get<{ projects: ComplianceProjectSummary[] }>('/compliance/projects/summary'),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const { data: cprQueueData } = useQuery({
    queryKey: ['subcontractor-cpr-queue', projectId],
    queryFn: () => api.get<{ data: { queue: SubcontractorQueueItem[] } }>(`/projects/${projectId}/subcontractor-cpr-queue`),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const project = projectData?.data.project;
  const workers = workersData?.data.workers ?? [];
  const weeks = weeksData?.weeks ?? [];
  const primaryWd = wdPinsData?.pins?.find((pin) => pin.isPrimary) ?? null;
  const projectCompliance = complianceData?.projects.find((item) => item.id === projectId);
  const violationCount = projectCompliance?.violationCount ?? 0;
  const cprQueue = cprQueueData?.data.queue ?? [];
  const submittedWeeks = weeks.filter((week) => week.submittedAt).length;
  const openPayrollWeeks = weeks.length - submittedWeeks;
  const openCprItems = cprQueue.filter((item) => item.status !== 'received-compliant').length;

  const setupComplete = Boolean(primaryWd && workers.length > 0);
  const payrollStarted = weeks.length > 0;
  const readyScore = [
    Boolean(project),
    Boolean(primaryWd),
    workers.length > 0,
    payrollStarted,
    openPayrollWeeks === 0 && payrollStarted,
    violationCount === 0,
    openCprItems === 0,
  ].filter(Boolean).length;
  const readinessPct = Math.round((readyScore / 7) * 100);
  const readinessStatus = violationCount > 0 || !primaryWd
    ? 'blocked'
    : openPayrollWeeks > 0 || openCprItems > 0
      ? 'warning'
      : setupComplete && payrollStarted
        ? 'ready'
        : 'in_progress';

  const workflowItems = [
    { step: 1, label: 'Project Home', helper: 'Next action', to: base, icon: LayoutDashboard, exact: true, status: readinessStatus === 'ready' ? 'ready' : 'warning' },
    { step: 2, label: 'Setup', helper: 'Agency, jobsite, required fields', to: `${base}/settings`, icon: BriefcaseBusiness, status: setupComplete ? 'complete' : 'warning' },
    { step: 3, label: 'Wage Rates', helper: 'Determinations and classifications', to: `${base}#wage-determinations`, icon: Database, hash: '#wage-determinations', status: primaryWd ? 'complete' : 'blocked' },
    { step: 4, label: 'Workers', helper: 'Roster and classifications', to: `${base}/workers`, icon: Users, status: workers.length > 0 ? 'complete' : 'warning' },
    { step: 5, label: 'Payroll', helper: 'Hours, deductions, compliance', to: `${base}/payroll`, icon: FileCheck, status: openPayrollWeeks > 0 ? 'warning' : payrollStarted ? 'complete' : 'warning' },
    { step: 6, label: 'Audit Packet', helper: 'Evidence and submission proof', to: `${base}/activity`, icon: Activity, status: violationCount > 0 ? 'warning' : 'clean' },
    { step: 7, label: 'Reports & Exports', helper: 'Final records', to: `${base}/reports`, icon: FileCheck, status: submittedWeeks > 0 ? 'complete' : 'warning' },
  ];

  const supportItems = [
    { label: 'Subcontractors', to: `${base}#subcontractors`, icon: ShieldCheck, hash: '#subcontractors', status: openCprItems > 0 ? 'warning' : 'clean' },
    { label: 'Field Clock', to: `${base}/field`, icon: Clock, status: 'in_progress' },
  ];

  function isHashActive(item: { hash?: string; to: string }) {
    return Boolean(item.hash && pathname === base && hash === item.hash);
  }

  function isRouteActive(item: { to: string; exact?: boolean; hash?: string }) {
    if (item.hash) return isHashActive(item);
    if (item.exact) return pathname === item.to && !hash;
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  }

  return (
    <aside className="lg:sticky lg:top-[92px]">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <Link to={base} className="block">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Project</p>
            <h2 className="mt-1 text-base font-semibold leading-snug text-gray-950" title={project?.name}>
              {compactName(project?.name)}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {project ? `${project.state} - ${project.county}` : 'Loading project...'}
            </p>
          </Link>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${statusTone(readinessStatus)}`}>
              {readinessPct}% ready
            </span>
            <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700">
              {labelContractType(project?.contractType)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px border-b border-gray-100 bg-gray-100 text-center">
          <div className="bg-white px-2 py-3">
            <p className="text-sm font-bold text-gray-950">{workers.length}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Workers</p>
          </div>
          <div className="bg-white px-2 py-3">
            <p className="text-sm font-bold text-gray-950">{openPayrollWeeks}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Open weeks</p>
          </div>
          <div className="bg-white px-2 py-3">
            <p className="text-sm font-bold text-gray-950">{violationCount + openCprItems}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Fixes</p>
          </div>
        </div>

        <nav className="max-h-[66vh] overflow-y-auto p-2" aria-label="Project workflow">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Client workflow
          </p>
          {workflowItems.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item);
            return item.hash ? (
              <Link
                key={item.label}
                to={item.to}
                className={`mb-1 flex min-h-[52px] items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-nav-dark text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  active ? 'bg-brand-gold text-nav-dark' : 'bg-gray-100 text-gray-700'
                }`}>
                  {item.step}
                </span>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block">{item.label}</span>
                  <span className={`block text-[11px] font-normal ${active ? 'text-gray-300' : 'text-gray-500'}`}>{item.helper}</span>
                </span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${item.status === 'blocked' ? 'bg-red-500' : item.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
              </Link>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.exact}
                className={() => `mb-1 flex min-h-[52px] items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-nav-dark text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  active ? 'bg-brand-gold text-nav-dark' : 'bg-gray-100 text-gray-700'
                }`}>
                  {item.step}
                </span>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block">{item.label}</span>
                  <span className={`block text-[11px] font-normal ${active ? 'text-gray-300' : 'text-gray-500'}`}>{item.helper}</span>
                </span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${item.status === 'blocked' ? 'bg-red-500' : item.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
              </NavLink>
            );
          })}
          <div className="my-2 border-t border-gray-100" />
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Supporting tools
          </p>
          {supportItems.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item);
            return item.hash ? (
              <Link
                key={item.label}
                to={item.to}
                className={`mb-1 flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-nav-dark text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{item.label}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${item.status === 'blocked' ? 'bg-red-500' : item.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
              </Link>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                className={() => `mb-1 flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-nav-dark text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{item.label}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${item.status === 'blocked' ? 'bg-red-500' : item.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
