import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, ChevronRight, Building2, Shield, AlertTriangle, Pencil, MapPin, CalendarDays } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ProjectDetailSkeleton } from '../components/ui/Skeleton';
import { TermTooltip } from '../components/ui/TermTooltip';
import { Tooltip } from '../components/ui/Tooltip';
import { EmptyState } from '../components/ui/EmptyState';
import { getCprStatus, getSubcontractorOperationState, STATUS_BADGE } from '../lib/cprStatus';
import type { Subcontractor, CprWeek, SubcontractorCertification, SamGovEntity } from '../lib/cprStatus';

import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ProjectWageDeterminationsPanel } from '../components/ProjectWageDeterminationsPanel';
import { useToast } from '../contexts/ToastContext';
import { SignaturePad } from '../components/ui/SignaturePad';
import { PhotoGallery } from '../components/ui/PhotoGallery';
import { ApprenticeshipDashboard } from '../components/ApprenticeshipDashboard';
import { buildProjectWorkflowState } from '../lib/projectWorkflow';
import {
  assessProjectJurisdiction,
  deriveJurisdictionKind,
  jurisdictionExplanation,
  requiredFormsForProject,
  setupBlockersForProject,
} from '../lib/projectRequirements';
import type { RequiredFormItem, SetupBlocker } from '../lib/projectRequirements';

interface Project {
  id: string;
  name: string;
  state: string;
  county: string;
  contractType: string;
  fundingType: string;
  awardDate: string;
  status: string;
  createdAt: string;
  awardingAgency?: string | null;
  contractNumber?: string | null;
  dirProjectId?: string | null;
  wdIdentifier?: string | null;
  projectSettings: string | null;
  gpsClockInEnabled?: boolean;
  apprenticeshipRequirements: string | null;
  project_type?: string | null;
}

interface NotifSettings {
  notifyViolations: boolean;
  notifyDueSoon: boolean;
  dueSoonDays: number;
  notifyActivity: boolean;
  notifySubmission: boolean;
}

interface ProjectOnboardingSetup {
  source?: string;
  primaryStates?: string[];
  workTypes?: string[];
  payrollProvider?: string;
  accountingProvider?: string;
  projectManagementProvider?: string;
  usesSubcontractors?: boolean;
  usesApprentices?: boolean;
  fieldTrackingNeeded?: boolean;
  averageWeeklyWorkers?: number;
  appliedAt?: string;
  completedPromptKeys?: string[];
  lastAppliedAt?: string;
}

const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  notifyViolations: true,
  notifyDueSoon: true,
  dueSoonDays: 3,
  notifyActivity: true,
  notifySubmission: true,
};

function parseNotifSettings(raw: string | null | undefined): NotifSettings {
  if (!raw) return { ...DEFAULT_NOTIF_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NOTIF_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_NOTIF_SETTINGS };
  }
}

function parseProjectOnboardingSetup(raw: string | null | undefined): ProjectOnboardingSetup | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { onboardingSetup?: ProjectOnboardingSetup };
    return parsed.onboardingSetup ?? null;
  } catch {
    return null;
  }
}

function parseProjectSettings(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isSampleProject(raw: string | null | undefined): boolean {
  return parseProjectSettings(raw).sampleProject === true;
}

interface ReviewState {
  status?: 'draft' | 'ready_for_review' | 'approved' | 'rejected';
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

function parseReviewState(raw: string | null | undefined): ReviewState {
  const settings = parseProjectSettings(raw);
  return (settings.reviewState ?? {}) as ReviewState;
}

function buildProjectSettingsWithNotifications(raw: string | null | undefined, prefs: NotifSettings): string {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  return JSON.stringify({ ...parsed, ...prefs });
}

function providerName(value: string | undefined) {
  const labels: Record<string, string> = {
    quickbooks: 'QuickBooks',
    adp: 'ADP',
    gusto: 'Gusto',
    paychex: 'Paychex',
    sage_300: 'Sage 300 CRE',
    sage_100: 'Sage 100',
    procore: 'Procore',
    other: 'Other',
    none: 'None',
  };
  return value ? labels[value] ?? value.replaceAll('_', ' ') : 'None';
}

function hasApprenticeshipSetup(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(parsed).length > 0;
  } catch {
    return false;
  }
}

interface PinRow {
  wageDeterminationId: string;
  isPrimary: boolean;
  wdNumber: string;
  revisionNumber: number;
  lastFetchedAt: string | null;
  constructionType: string | null;
  pinnedAt: string;
}

function StaleWdBanner({ lastFetchedAt }: { lastFetchedAt: string | null }) {
  if (lastFetchedAt === null) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-400 text-amber-800 rounded-md px-4 py-3 mb-4 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Wage Determination has never been synced from SAM.gov &mdash; refresh recommended.</span>
      </div>
    );
  }
  const ageMs = Date.now() - new Date(lastFetchedAt).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  if (ageDays <= 7) return null;
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-400 text-amber-800 rounded-md px-4 py-3 mb-4 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Wage Determination last updated {ageDays} days ago &mdash; refresh recommended.</span>
    </div>
  );
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

/** Maximum DOL civil penalty per violation — 29 CFR Part 5.14 (2024 inflation adjustment). */
const CIVIL_PENALTY_PER_VIOLATION = 13_508;

function WorkZone({
  eyebrow,
  title,
  description,
  children,
  actions,
  className = '',
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-8 scroll-mt-24 ${className}`}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">{eyebrow}</p>
          <h2 className="mt-1 font-headline text-xl text-text-primary">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">{description}</p>
        </div>
        {actions}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

interface SubcontractorCprQueueItem {
  subcontractorId: string;
  subcontractorName: string;
  contactEmail: string | null;
  weekId: string | null;
  payrollWeekId: string | null;
  payrollNumber: number | null;
  weekEndingDate: string;
  receivedDate: string | null;
  isCompliant: number | null;
  status: 'overdue' | 'received-non-compliant' | 'not-received' | 'received-compliant';
  daysLate: number;
  notes: string | null;
  uploadTokenExpiresAt: string | null;
  uploadToken?: string | null;
  uploadedAt: string | null;
  nextAction: string;
}

interface SubcontractorCprQueueSummary {
  total: number;
  overdue: number;
  notReceived: number;
  nonCompliant: number;
  readyToRequest: number;
}

function ProjectCommandCenter({
  project,
  workersCount,
  weeks,
  violationCount,
  openCprItems,
  hasPrimaryWageDetermination,
  primaryPin,
  controls,
}: {
  project: Project;
  workersCount: number;
  weeks: { id: string; submittedAt: string | null; weekEndingDate?: string; payrollNumber?: number }[];
  violationCount: number;
  openCprItems: number;
  hasPrimaryWageDetermination: boolean;
  primaryPin: PinRow | null;
  controls: React.ReactNode;
}) {
  const workflow = buildProjectWorkflowState({
    projectId: project.id,
    hasProject: true,
    hasPrimaryWageDetermination,
    workerCount: workersCount,
    weeks,
    violationCount,
    openCprItems,
  });
  const openPayrollWeeks = workflow.openPayrollWeeks;
  const totalFixes = violationCount + openCprItems;
  const primaryAction = workflow.primaryAction;

  return (
    <section className="mb-8 rounded-lg border border-gray-200 bg-white shadow-card-elevated">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={project.status === 'active' ? 'compliant' : project.status === 'archived' ? 'neutral' : 'warning'}>
                  {project.status}
                </Badge>
                <Badge variant={hasPrimaryWageDetermination ? 'compliant' : 'warning'}>
                  {hasPrimaryWageDetermination ? 'WD locked' : 'WD needed'}
                </Badge>
                {totalFixes > 0 ? <Badge variant="violation">{totalFixes} open fix{totalFixes === 1 ? '' : 'es'}</Badge> : <Badge variant="compliant">No open fixes</Badge>}
              </div>
              {project.project_type !== 'davis-bacon' && project.project_type != null && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                  {project.project_type === 'both' ? 'Davis-Bacon + SCA' : 'SCA'}
                </span>
              )}
              <h2 className="mt-3 font-headline text-2xl leading-tight text-gray-950">{project.name}</h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  {project.county}, {project.state}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  Award {project.awardDate}
                </span>
                <span>{CONTRACT_TYPE_LABELS[project.contractType] ?? project.contractType}</span>
                <span>{FUNDING_TYPE_LABELS[project.fundingType] ?? project.fundingType} funding</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {controls}
            </div>
          </div>

          {primaryAction && (
            <Link
              to={primaryAction.to}
              className="mt-5 flex flex-col gap-3 rounded-md border border-brand-gold/60 bg-brand-gold/10 p-4 transition-colors hover:border-brand-gold sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Next best action</p>
                <p className="mt-1 text-base font-semibold text-gray-950">{primaryAction.label}</p>
                <p className="mt-1 text-sm leading-6 text-gray-700">{primaryAction.detail}</p>
              </div>
              <span className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm bg-brand-gold px-5 text-sm font-semibold text-black">
                Start
              </span>
            </Link>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ProjectMetric label="Workers" value={workersCount.toString()} detail="Roster records" />
            <ProjectMetric label="Open Weeks" value={openPayrollWeeks.toString()} detail="Payroll still in progress" />
            <ProjectMetric label="CPR Queue" value={openCprItems.toString()} detail="Subcontractor items" tone={openCprItems > 0 ? 'warning' : 'good'} />
            <ProjectMetric label="Compliance Fixes" value={violationCount.toString()} detail="Payroll violations" tone={violationCount > 0 ? 'bad' : 'good'} />
          </div>
        </div>

        <aside className="border-t border-gray-200 bg-gray-50 p-5 sm:p-6 xl:border-l xl:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Project facts</p>
          <dl className="mt-3 space-y-3 text-sm">
            <FactRow label="Primary WD" value={primaryPin ? `${primaryPin.wdNumber} Rev ${primaryPin.revisionNumber}` : 'Not locked'} />
            <FactRow label="Construction type" value={primaryPin?.constructionType ?? 'Confirm in wage rates'} />
            <FactRow label="Created" value={new Date(project.createdAt).toLocaleDateString()} />
          </dl>
          {workflow.actions.length > 0 && (
            <div className="mt-5 border-t border-gray-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next queue</p>
              <div className="mt-3 space-y-2">
                {workflow.actions.slice(0, 3).map((action) => (
                  <Link
                    key={`${action.priority}-${action.label}`}
                    to={action.to}
                    className="block rounded-md border border-gray-200 bg-white p-3 transition-colors hover:border-brand-gold hover:bg-brand-gold/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                      <span className="shrink-0 text-xs font-semibold uppercase text-brand-gold">{action.priority}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{action.detail}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ProjectMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'good' | 'warning' | 'bad';
}) {
  const valueClass =
    tone === 'bad' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-gray-950';
  return (
    <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="max-w-[220px] text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function projectFixTarget(projectId: string, fixTo: string) {
  if (fixTo.startsWith('/settings')) return `/projects/${projectId}${fixTo}`;
  if (fixTo.startsWith('#')) return `/projects/${projectId}${fixTo}`;
  return fixTo;
}

function requirementBadgeVariant(status: RequiredFormItem['status']) {
  if (status === 'required') return 'warning';
  if (status === 'not_applicable') return 'neutral';
  return 'neutral';
}

function ProjectRequirementsPanel({ project }: { project: Project }) {
  const kind = deriveJurisdictionKind(project);
  const assessment = assessProjectJurisdiction(project);
  const forms = requiredFormsForProject(project);
  const blockers = setupBlockersForProject(project);
  const kindLabel = kind === 'layered' ? 'Layered' : kind.charAt(0).toUpperCase() + kind.slice(1);

  return (
    <div id="required-forms" className="scroll-mt-24">
    <Card className="mb-6 shadow-card-elevated">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={blockers.length > 0 ? 'warning' : 'compliant'}>{kindLabel} jurisdiction</Badge>
            <Badge variant={blockers.length > 0 ? 'violation' : 'compliant'}>
              {blockers.length > 0 ? `${blockers.length} setup blocker${blockers.length === 1 ? '' : 's'}` : 'Setup fields ready'}
            </Badge>
          </div>
          <h2 className="mt-3 font-headline text-base text-text-primary">Required Forms & Setup Rules</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">{jurisdictionExplanation(project)}</p>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500">{assessment.precedence}</p>
        </div>
        <Link
          to={`/projects/${project.id}/settings#project-facts`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm border border-brand-gold px-4 text-sm font-semibold text-black hover:bg-brand-gold/10"
        >
          Edit setup
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div>
          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Wage source prompt</p>
            <p className="mt-1 text-sm leading-6 text-gray-700">{assessment.wageSourcePrompt}</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Forms and submission package</p>
          <div className="mt-3 grid gap-3">
            {forms.map((form) => (
              <Link
                key={form.id}
                to={projectFixTarget(project.id, form.fixTo ?? '#required-forms')}
                className="block rounded-md border border-gray-200 bg-white p-4 transition-colors hover:border-brand-gold hover:bg-brand-gold/5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{form.label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{form.reason}</p>
                  </div>
                  <Badge variant={requirementBadgeVariant(form.status)}>{form.status.replace('_', ' ')}</Badge>
                </div>
              </Link>
            ))}
          </div>
          {assessment.exportPackage.length > 0 && (
            <div className="mt-4 rounded-md border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Export package</p>
              <ul className="mt-2 space-y-2 text-sm text-gray-700">
                {assessment.exportPackage.map((item) => (
                  <li key={item.id}>
                    <span className="font-semibold text-gray-900">{item.label}</span>
                    <span className="block text-xs leading-5 text-gray-500">{item.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Setup blockers</p>
          {blockers.length === 0 ? (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Required jurisdiction fields are present for the current project facts.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {blockers.map((blocker: SetupBlocker) => (
                <Link
                  key={blocker.field}
                  to={projectFixTarget(project.id, blocker.fixTo)}
                  className="block rounded-md border border-amber-200 bg-white p-3 transition-colors hover:border-brand-gold hover:bg-brand-gold/5"
                >
                  <p className="text-sm font-semibold text-gray-900">{blocker.title}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">{blocker.detail}</p>
                  <span className="mt-2 inline-flex text-xs font-semibold text-brand-gold">Fix field</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
    </div>
  );
}

function ProjectAuditDefensePanel({ projectId }: { projectId: string }) {
  return (
    <Card className="shadow-card-elevated">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="font-headline text-base text-text-primary mb-1">Audit Defense</h2>
          <p className="text-sm text-gray-500">
            One place to prove payroll submissions, field evidence, GPS activity, and user changes.
          </p>
        </div>
        <Badge variant="neutral">Export Ready</Badge>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          to={`/projects/${projectId}/activity`}
          className="rounded-lg border border-gray-200 p-4 hover:border-brand-gold hover:shadow-sm transition-colors"
        >
          <p className="text-sm font-semibold text-gray-900">Evidence Dashboard</p>
          <p className="mt-1 text-xs text-gray-500">Review missing proof before an agency or GC asks.</p>
        </Link>
        <a
          href={`/api/audit/${projectId}/evidence-packet?format=csv`}
          className="rounded-lg border border-gray-200 p-4 hover:border-brand-gold hover:shadow-sm transition-colors"
        >
          <p className="text-sm font-semibold text-gray-900">CSV Evidence Packet</p>
          <p className="mt-1 text-xs text-gray-500">Payroll, photos, GPS punches, and audit events.</p>
        </a>
        <a
          href={`/api/audit-export/${projectId}`}
          className="rounded-lg border border-gray-200 p-4 hover:border-brand-gold hover:shadow-sm transition-colors"
        >
          <p className="text-sm font-semibold text-gray-900">Full Audit ZIP</p>
          <p className="mt-1 text-xs text-gray-500">Includes WH-347 PDFs, compliance JSON, and audit-manifest.json.</p>
        </a>
      </div>
    </Card>
  );
}

function SampleProjectPanel({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Sample project closed');
      navigate('/dashboard');
    },
    onError: () => toast.error('Could not close sample project'),
  });

  return (
    <Card className="mb-6 border-brand-gold/40 bg-brand-gold/5 shadow-card-elevated">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="warning">Sample</Badge>
            <h2 className="font-headline text-base text-text-primary">Demo project data</h2>
          </div>
          <p className="mt-1 text-sm text-gray-600">Use this project to test preflight, exports, audit ZIPs, and review workflows. It can be closed any time.</p>
        </div>
        <Button variant="ghost" size="sm" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
          Close Sample
        </Button>
      </div>
    </Card>
  );
}

function ProjectReviewPanel({
  projectId,
  projectSettings,
}: {
  projectId: string;
  projectSettings: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const reviewState = parseReviewState(projectSettings);
  const status = reviewState.status ?? 'draft';

  const mutation = useMutation({
    mutationFn: (body: { status: ReviewState['status']; note?: string }) => api.post(`/projects/${projectId}/review`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast.success('Review status saved');
      setNote('');
    },
    onError: () => toast.error('Could not save review status'),
  });

  const labels: Record<string, string> = {
    draft: 'Draft',
    ready_for_review: 'Ready for Review',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  return (
    <Card className="mb-6 shadow-card-elevated">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-headline text-base text-text-primary mb-1">Agency / Prime Review</h2>
          <p className="text-sm text-gray-500">Track internal reviewer status before certifying or submitting payroll packages.</p>
          {reviewState.note && <p className="mt-2 text-xs text-gray-600">Last note: {reviewState.note}</p>}
        </div>
        <Badge variant={status === 'approved' ? 'compliant' : status === 'rejected' ? 'violation' : status === 'ready_for_review' ? 'warning' : 'neutral'}>
          {labels[status]}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          placeholder="Optional review note"
          aria-label="Optional review note"
          className="rounded-sm border border-border-default px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={mutation.isPending} onClick={() => mutation.mutate({ status: 'ready_for_review', note })}>Ready</Button>
          <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate({ status: 'approved', note })}>Approve</Button>
          <Button size="sm" variant="ghost" loading={mutation.isPending} onClick={() => mutation.mutate({ status: 'rejected', note })}>Reject</Button>
        </div>
      </div>
    </Card>
  );
}

function ProjectSetupGuidancePanel({
  projectId,
  setup,
  gpsClockInEnabled,
  hasSubcontractorSetup,
  hasApprenticeshipRatioSetup,
}: {
  projectId: string;
  setup: ProjectOnboardingSetup | null;
  gpsClockInEnabled?: boolean;
  hasSubcontractorSetup: boolean;
  hasApprenticeshipRatioSetup: boolean;
}) {
  if (!setup) return null;
  const completed = new Set(setup.completedPromptKeys ?? []);

  const items = [
    setup.fieldTrackingNeeded && !gpsClockInEnabled && !completed.has('field-proof')
      ? {
          title: 'Enable field proof',
          detail: 'Turn on GPS clock-in and use project photos for audit evidence.',
          to: `/projects/${projectId}/settings`,
          priority: 'Recommended',
        }
      : null,
    setup.usesSubcontractors && !hasSubcontractorSetup
      ? {
          title: 'Set up subcontractor CPR tracking',
          detail: 'Add subcontractors and track weekly CPR receipt before payment review.',
          to: `/projects/${projectId}`,
          priority: 'Recommended',
        }
      : null,
    setup.usesApprentices && !hasApprenticeshipRatioSetup
      ? {
          title: 'Confirm apprenticeship ratios',
          detail: 'Enter program details and ratio rules before certifying payroll.',
          to: `/projects/${projectId}`,
          priority: 'Recommended',
        }
      : null,
    setup.payrollProvider === 'quickbooks' || setup.accountingProvider === 'quickbooks'
      ? {
          title: 'Connect QuickBooks',
          detail: 'Import employees and sync time records for this project.',
          to: '/settings/integrations',
          priority: 'Import',
        }
      : null,
    setup.projectManagementProvider === 'procore'
      ? {
          title: 'Connect Procore',
          detail: 'Import project timesheets into weekly payroll.',
          to: '/settings/integrations',
          priority: 'Import',
        }
      : null,
    setup.payrollProvider && ['adp', 'gusto', 'paychex', 'sage_300', 'sage_100'].includes(setup.payrollProvider)
      ? {
          title: `Prepare ${providerName(setup.payrollProvider)} export`,
          detail: 'Use the CSV import path and save worker mappings for repeat weeks.',
          to: `/projects/${projectId}/payroll`,
          priority: 'Import',
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; to: string; priority: string }>;

  if (items.length === 0) return null;
  const profileSummary = [
    setup.payrollProvider ? `${providerName(setup.payrollProvider)} payroll` : null,
    setup.projectManagementProvider ? `${providerName(setup.projectManagementProvider)} project system` : null,
    `${setup.averageWeeklyWorkers ?? 0} average weekly workers`,
  ].filter(Boolean).join(', ');

  return (
    <Card className="mb-6 border-brand-gold/40 bg-brand-gold/5 shadow-card-elevated">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-headline text-base text-text-primary mb-1">Setup From Onboarding</h2>
          <p className="text-sm text-gray-600">
            This project was created with your business profile: {profileSummary}.
          </p>
        </div>
        <Link to="/onboarding" className="inline-flex min-h-11 items-center text-sm font-semibold text-black hover:underline">
          Edit profile
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => (
          <Link key={item.title} to={item.to} className="rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-gold hover:shadow-sm transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-1 text-xs text-gray-500">{item.detail}</p>
              </div>
              <span className="text-[11px] font-semibold uppercase text-brand-gold shrink-0">{item.priority}</span>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// Phase 107 (DBE-07): DBE classification options and badge color map
type DbeClass = 'none' | 'dbe' | 'mbe' | 'wbe' | 'sdvosb';

const DBE_CLASS_OPTIONS: Array<{ value: DbeClass; label: string }> = [
  { value: 'none',   label: 'None' },
  { value: 'dbe',    label: 'DBE' },
  { value: 'mbe',    label: 'MBE' },
  { value: 'wbe',    label: 'WBE' },
  { value: 'sdvosb', label: 'SDVOSB' },
];

const DBE_BADGE_CLASSES: Record<Exclude<DbeClass, 'none'>, string> = {
  dbe:    'bg-brand-gold text-black',
  mbe:    'bg-emerald-600 text-white',
  wbe:    'bg-blue-600 text-white',
  sdvosb: 'bg-purple-600 text-white',
};

const EMPTY_SUB_FORM = {
  name: '',
  licenseNumber: '',
  contactName: '',
  contactEmail: '',
  address: '',
  dbeClassification: 'none' as DbeClass,
};

const EMPTY_CPR_FORM = {
  weekEndingDate: '',
  receivedDate: '',
  isCompliant: '' as '' | '0' | '1',
  notes: '',
};

function CprWeekTable({ projectId, subId }: { projectId: string; subId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cprForm, setCprForm] = useState({ ...EMPTY_CPR_FORM });
  const [cprError, setCprError] = useState<string | null>(null);
  const [receivingRowId, setReceivingRowId] = useState<string | null>(null);
  const [receivedDate, setReceivedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [cprFilter, setCprFilter] = useState<'all' | 'received-compliant' | 'received-non-compliant' | 'not-received' | 'overdue'>('all');
  const [undoNonCompliant, setUndoNonCompliant] = useState<{ weekId: string; weekLabel: string } | null>(null);

  const { data: cprData, isLoading: cprLoading } = useQuery({
    queryKey: ['cpr-weeks', projectId, subId],
    queryFn: () => api.get<{ data: { cprWeeks: CprWeek[] } }>(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks`),
    enabled: !!subId,
  });

  const addCprWeekMutation = useMutation({
    mutationFn: (body: { weekEndingDate: string; receivedDate?: string; isCompliant?: 0 | 1; notes?: string }) =>
      api.post<{ data: { cprWeek: CprWeek } }>(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpr-weeks', projectId, subId] });
      toast.success('CPR week added');
      setCprForm({ ...EMPTY_CPR_FORM });
      setCprError(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { status?: number })?.status === 409
        ? 'A record for this week ending date already exists.'
        : 'Failed to save CPR week record.';
      setCprError(msg);
    },
  });

  const updateCprWeekMutation = useMutation({
    mutationFn: ({ weekId, body }: { weekId: string; body: Partial<{ receivedDate: string; isCompliant: 0 | 1 | null; notes: string }> }) =>
      api.patch(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks/${weekId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpr-weeks', projectId, subId] });
      toast.success('CPR week updated');
    },
    onError: () => toast.error('Could not update CPR week'),
  });

  const revertNonCompliantMutation = useMutation({
    mutationFn: (weekId: string) =>
      api.patch(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks/${weekId}`, { isCompliant: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpr-weeks', projectId, subId] });
      toast.success('Non-compliant mark reverted');
    },
    onError: () => toast.error('Could not revert non-compliant mark'),
  });

  const weeks = cprData?.data?.cprWeeks ?? [];

  const filteredWeeks = weeks.filter(week => {
    if (cprFilter === 'all') return true;
    return getCprStatus(week) === cprFilter;
  });

  function handleAddCprWeek() {
    if (!cprForm.weekEndingDate) return;
    const body: { weekEndingDate: string; receivedDate?: string; isCompliant?: 0 | 1; notes?: string } = {
      weekEndingDate: cprForm.weekEndingDate,
    };
    if (cprForm.receivedDate) body.receivedDate = cprForm.receivedDate;
    if (cprForm.isCompliant === '0') body.isCompliant = 0;
    if (cprForm.isCompliant === '1') body.isCompliant = 1;
    if (cprForm.notes.trim()) body.notes = cprForm.notes.trim();
    addCprWeekMutation.mutate(body);
  }

  return (
    <div className="mt-3 border-t border-border-default pt-3">
      <h4 className="font-headline text-sm text-gray-700 mb-2">
        <TermTooltip
          term="CPR Weeks"
          definition="Certified Payroll Report weeks — each subcontractor must submit a weekly WH-347 form to the prime contractor. Track receipt and compliance status here."
        />
      </h4>

      {cprLoading && <p className="text-xs text-gray-500">Loading...</p>}

      {!cprLoading && weeks.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">No CPR weeks recorded yet.</p>
      )}

      {weeks.length > 0 && (
        <>
          {undoNonCompliant && (
            <div className="mb-3 flex items-center justify-between rounded-sm border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span>Marked as non-compliant.</span>
              <button
                type="button"
                onClick={() => { revertNonCompliantMutation.mutate(undoNonCompliant.weekId); setUndoNonCompliant(null); }}
                className="ml-4 font-semibold underline hover:no-underline"
              >
                Undo
              </button>
            </div>
          )}
          <div className="mb-2 flex items-center gap-2">
            <label className="text-xs text-gray-500 shrink-0">Filter:</label>
            <select
              value={cprFilter}
              onChange={e => setCprFilter(e.target.value as typeof cprFilter)}
              className="border border-border-default rounded-sm px-3 py-2 text-base min-h-[44px] bg-surface-card text-text-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              <option value="all">All</option>
              <option value="received-compliant">Compliant</option>
              <option value="received-non-compliant">Non-Compliant</option>
              <option value="not-received">Not Received</option>
              <option value="overdue">Overdue</option>
            </select>
            {cprFilter !== 'all' && (
              <span className="text-xs text-gray-400">
                {filteredWeeks.length} of {weeks.length} weeks
              </span>
            )}
          </div>
          <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-border-default">
                <th className="pb-1 pr-3 font-medium">Week Ending</th>
                <th className="pb-1 pr-3 font-medium">Status</th>
                <th className="pb-1 pr-3 font-medium">Received</th>
                <th className="pb-1 pr-3 font-medium">Notes</th>
                <th className="pb-1 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWeeks.map(week => {
                const status = getCprStatus(week);
                const badge = STATUS_BADGE[status];
                return (
                  <tr key={week.id} className="border-b border-border-default/50 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-700">{week.weekEndingDate}</td>
                    <td className="py-1.5 pr-3">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className="py-1.5 pr-3">
                      {week.uploadedAt
                        ? (
                          <a
                            href={`/api/projects/${projectId}/subcontractors/${subId}/cpr-weeks/${week.id}/file`}
                            className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            PDF Uploaded
                          </a>
                        )
                        : week.uploadToken
                          ? <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Awaiting upload</span>
                          : null
                      }
                    </td>
                    <td className="py-1.5 pr-3 text-gray-600">{week.receivedDate ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-gray-500 max-w-xs truncate">{week.notes ?? '—'}</td>
                    <td className="py-1.5">
                      <div className="flex gap-2 flex-wrap items-center">
                        {!week.receivedDate && receivingRowId !== week.id && (
                          <button
                            className="text-xs font-medium text-brand-gold hover:underline"
                            onClick={() => {
                              setReceivedDate(new Date().toISOString().slice(0, 10));
                              setReceivingRowId(week.id);
                            }}
                            disabled={updateCprWeekMutation.isPending}
                          >
                            Mark Received
                          </button>
                        )}
                        {!week.receivedDate && receivingRowId === week.id && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              className="border border-border-default rounded px-1.5 py-0.5 text-xs bg-surface-page"
                              value={receivedDate}
                              onChange={e => setReceivedDate(e.target.value)}
                            />
                            <button
                              className="text-xs font-medium text-brand-gold hover:underline"
                              onClick={() => {
                                if (!receivedDate) return;
                                updateCprWeekMutation.mutate(
                                  { weekId: week.id, body: { receivedDate, isCompliant: null } },
                                  { onSettled: () => setReceivingRowId(null) }
                                );
                              }}
                              disabled={!receivedDate || updateCprWeekMutation.isPending}
                            >
                              Confirm
                            </button>
                            <button
                              className="text-xs text-gray-500 hover:underline"
                              onClick={() => setReceivingRowId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {week.receivedDate && week.isCompliant !== 1 && (
                          <button
                            className="text-xs font-medium text-brand-gold hover:underline"
                            onClick={() => updateCprWeekMutation.mutate({ weekId: week.id, body: { isCompliant: 1 } })}
                            disabled={updateCprWeekMutation.isPending}
                          >
                            Mark Compliant
                          </button>
                        )}
                        {week.receivedDate && week.isCompliant === 1 && (
                          <button
                            className="text-xs font-medium text-status-violation hover:underline"
                            onClick={() => {
                              if (window.confirm('Mark this week as non-compliant? This will be recorded in the audit log.')) {
                                updateCprWeekMutation.mutate(
                                  { weekId: week.id, body: { isCompliant: 0 } },
                                  {
                                    onSuccess: () => {
                                      const label = `Week ending ${week.weekEndingDate}`;
                                      setUndoNonCompliant({ weekId: week.id, weekLabel: label });
                                      setTimeout(() => setUndoNonCompliant(null), 8000);
                                    },
                                  }
                                );
                              }
                            }}
                            disabled={updateCprWeekMutation.isPending}
                          >
                            Mark Non-Compliant
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Add CPR Week inline form */}
      <div className="bg-surface-page border border-border-default rounded p-3 space-y-2">
        <p className="text-xs font-medium text-gray-700 mb-1">Add CPR Week</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Week Ending Date *</label>
            <input
              type="date"
              className="border border-border-default rounded px-2 py-1 text-sm bg-surface-page"
              value={cprForm.weekEndingDate}
              onChange={e => setCprForm(f => ({ ...f, weekEndingDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Received Date</label>
            <input
              type="date"
              className="border border-border-default rounded px-2 py-1 text-sm bg-surface-page"
              value={cprForm.receivedDate}
              onChange={e => setCprForm(f => ({ ...f, receivedDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Compliance</label>
            <select
              className="border border-border-default rounded px-2 py-1 text-sm bg-surface-page"
              value={cprForm.isCompliant}
              onChange={e => setCprForm(f => ({ ...f, isCompliant: e.target.value as '' | '0' | '1' }))}
            >
              <option value="">— (unassessed)</option>
              <option value="1">Compliant</option>
              <option value="0">Non-Compliant</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
            <input
              type="text"
              className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-page"
              placeholder="Optional"
              value={cprForm.notes}
              onChange={e => setCprForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <Button
            onClick={handleAddCprWeek}
            disabled={!cprForm.weekEndingDate || addCprWeekMutation.isPending}
          >
            {addCprWeekMutation.isPending ? 'Saving...' : 'Add Week'}
          </Button>
        </div>
        {cprError && <p className="text-xs text-status-violation mt-1">{cprError}</p>}
      </div>
    </div>
  );
}

const CERT_TYPE_OPTIONS = ['DBE', 'MBE', 'WBE', 'SBE', 'ACDBE', '8(a)', 'HUBZone'];

const REEVAL_OPTIONS: { value: SubcontractorCertification['reevaluationStatus']; label: string }[] = [
  { value: 'not_required', label: 'Not subject to IFR review' },
  { value: 'pending',      label: 'Under DOT Oct 2025 IFR review' },
  { value: 'cleared',      label: 'Cleared by DOT' },
  { value: 'suspended',    label: 'Suspended — contact DOT' },
];

const EMPTY_CERT_FORM = {
  certTypes: '',
  certifyingAgency: '',
  certNumber: '',
  naicsCodes: '',
  issueDate: '',
  expiresDate: '',
  reevaluationStatus: 'not_required' as SubcontractorCertification['reevaluationStatus'],
  selfCertified: false,
  // Phase 82 (Gap-2): SAM.gov-derived fields
  uei: '',
  cageCode: '',
  samRegistrationStatus: '',
};

function CertificationsSection({ projectId, subId }: { projectId: string; subId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addCertOpen, setAddCertOpen] = useState(false);
  const [certForm, setCertForm] = useState({ ...EMPTY_CERT_FORM });
  const [certError, setCertError] = useState<string | null>(null);

  // Phase 122 (DBE-02): inline edit state
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [editCertForm, setEditCertForm] = useState<typeof EMPTY_CERT_FORM>({ ...EMPTY_CERT_FORM });
  const [editCertError, setEditCertError] = useState<string | null>(null);

  // Phase 82 (Gap-2) — SAM.gov verification state
  const [samQuery, setSamQuery] = useState('');
  const [samResults, setSamResults] = useState<SamGovEntity[]>([]);
  const [samError, setSamError] = useState<string | null>(null);
  const [samLoading, setSamLoading] = useState(false);
  const [samNotice, setSamNotice] = useState<string | null>(null);

  async function handleSamSearch() {
    setSamError(null);
    setSamNotice(null);
    const trimmed = samQuery.trim();
    if (!trimmed) { setSamError('Enter a company name or UEI.'); return; }
    setSamLoading(true);
    try {
      const looksLikeUei = /^[A-Z0-9]{12}$/i.test(trimmed);
      const params = looksLikeUei
        ? `uei=${encodeURIComponent(trimmed)}`
        : `name=${encodeURIComponent(trimmed)}`;
      const res = await api.get<{ data: { results: SamGovEntity[]; cached: boolean } }>(`/sam-gov/search?${params}`);
      setSamResults(res.data.results);
      if (res.data.results.length === 0) {
        setSamNotice('No matching SAM.gov entities. Try the company\u2019s legal name.');
      }
    } catch (err) {
      setSamError(err instanceof Error ? err.message : 'SAM.gov lookup failed');
      setSamResults([]);
    } finally {
      setSamLoading(false);
    }
  }

  function importFromSam(entity: SamGovEntity) {
    const certCsv = entity.certifications.length > 0
      ? entity.certifications.join(',')
      : certForm.certTypes;
    const naicsCsv = entity.naicsCodes.length > 0 ? entity.naicsCodes.join(',') : '';
    setCertForm(f => ({
      ...f,
      certTypes: certCsv,
      certifyingAgency: 'SAM.gov',
      certNumber: entity.uei ?? f.certNumber,
      uei: entity.uei ?? '',
      cageCode: entity.cage ?? '',
      samRegistrationStatus: entity.registrationStatus ?? '',
    }));
    setAddCertOpen(true);
    if (naicsCsv) {
      // Surface NAICS via certNumber field tail when present — keeps schema flat.
    }
    toast.success(`Imported ${entity.entityName} from SAM.gov`);
  }

  const { data: certData, isLoading: certLoading } = useQuery({
    queryKey: ['certifications', projectId, subId],
    queryFn: () => api.get<{ data: { certifications: SubcontractorCertification[] } }>(
      `/projects/${projectId}/subcontractors/${subId}/certifications`
    ),
    enabled: !!subId,
  });

  const addCertMutation = useMutation({
    mutationFn: (body: Omit<typeof EMPTY_CERT_FORM, ''>) =>
      api.post<{ data: { certification: SubcontractorCertification } }>(
        `/projects/${projectId}/subcontractors/${subId}/certifications`,
        body
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', projectId, subId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Certification added');
      setAddCertOpen(false);
      setCertForm({ ...EMPTY_CERT_FORM });
      setCertError(null);
    },
    onError: () => setCertError('Failed to save certification.'),
  });

  const deleteCertMutation = useMutation({
    mutationFn: (certId: string) =>
      api.delete(`/projects/${projectId}/subcontractors/${subId}/certifications/${certId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', projectId, subId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Certification removed');
    },
    onError: () => toast.error('Could not remove certification'),
  });

  // Phase 122 (DBE-02): edit cert mutation — PATCH to server, double-invalidate both caches
  const editCertMutation = useMutation({
    mutationFn: ({ certId, body }: { certId: string; body: Partial<typeof EMPTY_CERT_FORM> }) =>
      api.patch<{ data: { certification: SubcontractorCertification } }>(
        `/projects/${projectId}/subcontractors/${subId}/certifications/${certId}`,
        body
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', projectId, subId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Certification updated');
      setEditingCertId(null);
      setEditCertForm({ ...EMPTY_CERT_FORM });
      setEditCertError(null);
    },
    onError: () => setEditCertError('Failed to update certification.'),
  });

  const certs = certData?.data?.certifications ?? [];

  function handleAddCert() {
    if (!certForm.certTypes.trim()) { setCertError('Cert types are required.'); return; }
    addCertMutation.mutate({
      certTypes: certForm.certTypes.trim(),
      certifyingAgency: certForm.certifyingAgency || undefined,
      certNumber: certForm.certNumber || undefined,
      expiresDate: certForm.expiresDate || undefined,
      reevaluationStatus: certForm.reevaluationStatus,
      // Phase 82 (Gap-2)
      uei: certForm.uei.trim() || undefined,
      cageCode: certForm.cageCode.trim() || undefined,
      samRegistrationStatus: certForm.samRegistrationStatus.trim() || undefined,
    } as any);
  }

  const INPUT_CLASSES = 'border border-border-default rounded px-2 py-1 text-sm bg-surface-page';

  return (
    <div className="mt-3 border-t border-border-default pt-3">
      <h4 className="font-headline text-sm text-gray-700 mb-2 inline-flex items-center">
        DBE / MBE / WBE Certifications
        <Tooltip content="Disadvantaged/Minority/Women Business Enterprise — federal diversity contracting designations. Required tracking on federal-aid contracts." />
      </h4>

      {certLoading && <p className="text-xs text-gray-500">Loading...</p>}

      {/* Cert badges */}
      {certs.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {certs.map(cert => (
            <span
              key={cert.id}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                cert.reevaluationStatus === 'suspended'
                  ? 'bg-red-100 text-red-700'
                  : cert.reevaluationStatus === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {cert.certTypes}
              {cert.reevaluationStatus === 'suspended' && ' (Suspended)'}
              {cert.reevaluationStatus === 'pending' && ' (DOT Review)'}
            </span>
          ))}
        </div>
      )}

      {/* Cert table */}
      {certs.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-border-default">
                <th className="pb-1 pr-3 font-medium">Cert Types</th>
                <th className="pb-1 pr-3 font-medium">Agency</th>
                <th className="pb-1 pr-3 font-medium">Expires</th>
                <th className="pb-1 pr-3 font-medium">DOT IFR Status</th>
                <th className="pb-1 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map(cert => (
                editingCertId === cert.id ? (
                  <tr key={cert.id} className="border-b border-border-default/50 last:border-0 bg-amber-50">
                    <td colSpan={5} className="p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={editCertForm.certTypes}
                          onChange={e => setEditCertForm(f => ({ ...f, certTypes: e.target.value }))}
                          placeholder="Cert types (DBE,WBE,...)"
                          className={INPUT_CLASSES + ' col-span-2'}
                        />
                        <input
                          value={editCertForm.certifyingAgency ?? ''}
                          onChange={e => setEditCertForm(f => ({ ...f, certifyingAgency: e.target.value }))}
                          placeholder="Certifying agency"
                          className={INPUT_CLASSES}
                        />
                        <input
                          value={editCertForm.certNumber ?? ''}
                          onChange={e => setEditCertForm(f => ({ ...f, certNumber: e.target.value }))}
                          placeholder="Cert number"
                          className={INPUT_CLASSES}
                        />
                        <input
                          type="date"
                          value={editCertForm.issueDate ?? ''}
                          onChange={e => setEditCertForm(f => ({ ...f, issueDate: e.target.value }))}
                          className={INPUT_CLASSES}
                          title="Issue date"
                        />
                        <input
                          type="date"
                          value={editCertForm.expiresDate ?? ''}
                          onChange={e => setEditCertForm(f => ({ ...f, expiresDate: e.target.value }))}
                          className={INPUT_CLASSES}
                          title="Expiry date"
                        />
                        <select
                          value={editCertForm.reevaluationStatus}
                          onChange={e => setEditCertForm(f => ({ ...f, reevaluationStatus: e.target.value as SubcontractorCertification['reevaluationStatus'] }))}
                          className={INPUT_CLASSES + ' col-span-2'}
                        >
                          {REEVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      {editCertError && <p className="text-red-600 text-xs mt-2">{editCertError}</p>}
                      <div className="mt-2 flex gap-2 justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => { setEditingCertId(null); setEditCertForm({ ...EMPTY_CERT_FORM }); setEditCertError(null); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            if (editCertForm.issueDate && editCertForm.expiresDate &&
                                editCertForm.expiresDate <= editCertForm.issueDate) {
                              setEditCertError('Expires date must be after issue date.');
                              return;
                            }
                            editCertMutation.mutate({ certId: cert.id, body: editCertForm });
                          }}
                          disabled={!editCertForm.certTypes.trim() || editCertMutation.isPending}
                        >
                          {editCertMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={cert.id} className="border-b border-border-default/50 last:border-0">
                    <td className="py-1.5 pr-3 font-medium text-gray-900">{cert.certTypes}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{cert.certifyingAgency ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{cert.expiresDate ?? '—'}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        cert.reevaluationStatus === 'suspended' ? 'bg-red-100 text-red-700' :
                        cert.reevaluationStatus === 'pending'   ? 'bg-amber-100 text-amber-700' :
                        cert.reevaluationStatus === 'cleared'   ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {REEVAL_OPTIONS.find(o => o.value === cert.reevaluationStatus)?.label ?? cert.reevaluationStatus}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <button
                        className="text-gray-500 hover:text-brand-gold mr-2"
                        aria-label="Edit certification"
                        title="Edit"
                        onClick={() => {
                          setEditingCertId(cert.id);
                          setEditCertForm({
                            certTypes: cert.certTypes,
                            certifyingAgency: cert.certifyingAgency ?? '',
                            certNumber: cert.certNumber ?? '',
                            naicsCodes: cert.naicsCodes ?? '',
                            issueDate: cert.issueDate ?? '',
                            expiresDate: cert.expiresDate ?? '',
                            reevaluationStatus: cert.reevaluationStatus,
                            selfCertified: cert.selfCertified,
                            uei: cert.uei ?? '',
                            cageCode: cert.cageCode ?? '',
                            samRegistrationStatus: cert.samRegistrationStatus ?? '',
                          });
                          setEditCertError(null);
                        }}
                      >
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-status-violation hover:underline"
                        onClick={() => {
                          if (window.confirm('Remove this certification?')) {
                            deleteCertMutation.mutate(cert.id);
                          }
                        }}
                        disabled={deleteCertMutation.isPending}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!certs.length && !certLoading && (
        <p className="text-xs text-gray-400 mb-2">No certifications on file.</p>
      )}

      {/* Phase 82 (Gap-2) — SAM.gov verification panel */}
      <div className="bg-surface-page border border-border-default rounded-md p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700">Verify via SAM.gov</p>
          <span
            className="text-[10px] text-gray-400"
            title="Searches the federal System for Award Management (SAM.gov) entity registry. Returns the legal business name, UEI, CAGE code, registration status, and any socio-economic certifications on file."
          >
            What is this?
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className={INPUT_CLASSES + ' flex-1'}
            placeholder="Company legal name or 12-character UEI"
            value={samQuery}
            onChange={e => setSamQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSamSearch(); } }}
          />
          <Button
            variant="secondary"
            onClick={() => void handleSamSearch()}
            disabled={samLoading || !samQuery.trim()}
          >
            {samLoading ? 'Searching...' : 'Search SAM.gov'}
          </Button>
        </div>
        {samError && <p className="text-xs text-status-violation mt-1.5">{samError}</p>}
        {samNotice && <p className="text-xs text-gray-500 mt-1.5">{samNotice}</p>}
        {samResults.length > 0 && (
          <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
            {samResults.slice(0, 5).map((entity, idx) => (
              <div
                key={`${entity.uei ?? idx}-${idx}`}
                className="border border-border-default bg-white rounded-md p-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{entity.entityName}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-gray-500">
                      <span>UEI: <code className="text-gray-700">{entity.uei ?? '\u2014'}</code></span>
                      <span>CAGE: <code className="text-gray-700">{entity.cage ?? '\u2014'}</code></span>
                      <span>
                        Status:
                        <span className={`ml-1 font-medium ${
                          entity.registrationStatus === 'Active' ? 'text-emerald-700'
                          : entity.registrationStatus === 'Inactive' ? 'text-red-700'
                          : 'text-amber-700'
                        }`}>
                          {entity.registrationStatus ?? 'Unknown'}
                        </span>
                      </span>
                    </div>
                    {entity.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entity.certifications.map(c => (
                          <span key={c} className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => importFromSam(entity)}
                  >
                    Import
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add cert button / form */}
      {!addCertOpen ? (
        <button
          onClick={() => setAddCertOpen(true)}
          className="text-xs text-brand-gold hover:underline"
        >
          + Add Certification
        </button>
      ) : (
        <div className="bg-surface-page border border-border-default rounded p-3 space-y-2">
          <p className="text-xs font-medium text-gray-700 mb-1">Add Certification</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-0.5">Cert Types * (comma-separated)</label>
              <div className="flex flex-wrap gap-1 mb-1">
                {CERT_TYPE_OPTIONS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const current = certForm.certTypes
                        .split(',').map(s => s.trim()).filter(Boolean);
                      const next = current.includes(t)
                        ? current.filter(s => s !== t)
                        : [...current, t];
                      setCertForm(f => ({ ...f, certTypes: next.join(',') }));
                    }}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      certForm.certTypes.split(',').map(s => s.trim()).includes(t)
                        ? 'bg-brand-gold/90 text-black border-brand-gold'
                        : 'border-border-default text-gray-600 hover:border-brand-gold'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className={INPUT_CLASSES + ' w-full'}
                placeholder="e.g. DBE,MBE"
                value={certForm.certTypes}
                onChange={e => setCertForm(f => ({ ...f, certTypes: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Certifying Agency</label>
              <input
                type="text"
                className={INPUT_CLASSES + ' w-full'}
                placeholder="Optional"
                value={certForm.certifyingAgency}
                onChange={e => setCertForm(f => ({ ...f, certifyingAgency: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Cert Number</label>
              <input
                type="text"
                className={INPUT_CLASSES + ' w-full'}
                placeholder="Optional"
                value={certForm.certNumber}
                onChange={e => setCertForm(f => ({ ...f, certNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Expiration Date</label>
              <input
                type="date"
                className={INPUT_CLASSES + ' w-full'}
                value={certForm.expiresDate}
                onChange={e => setCertForm(f => ({ ...f, expiresDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                DOT IFR Status
                <span
                  title="The DOT Interim Final Rule (Oct 3, 2025) requires individual reevaluation of all DBE certifications. Suspended status means DBE goals cannot be counted on federal projects."
                  className="cursor-help text-gray-400 hover:text-gray-600 text-xs border border-gray-300 rounded-full w-4 h-4 inline-flex items-center justify-center font-bold"
                >
                  ?
                </span>
              </label>
              <select
                className={INPUT_CLASSES + ' w-full'}
                value={certForm.reevaluationStatus}
                onChange={e => setCertForm(f => ({ ...f, reevaluationStatus: e.target.value as SubcontractorCertification['reevaluationStatus'] }))}
              >
                {REEVAL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          {certError && <p className="text-xs text-status-violation">{certError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => { setAddCertOpen(false); setCertForm({ ...EMPTY_CERT_FORM }); setCertError(null); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCert}
              disabled={!certForm.certTypes.trim() || addCertMutation.isPending}
            >
              {addCertMutation.isPending ? 'Saving...' : 'Save Certification'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubcontractorsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_SUB_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_SUB_FORM });

  // DBE-05: ref for scroll-to-panel behavior from participation card click
  const subsHeaderRef = useRef<HTMLDivElement>(null);

  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: () => api.get<{ data: { subcontractors: Subcontractor[] } }>(`/projects/${projectId}/subcontractors`),
    enabled: !!projectId,
  });

  const { data: cprQueueData } = useQuery({
    queryKey: ['subcontractor-cpr-queue', projectId],
    queryFn: () => api.get<{ data: { queue: SubcontractorCprQueueItem[]; summary: SubcontractorCprQueueSummary } }>(`/projects/${projectId}/subcontractor-cpr-queue`),
    enabled: !!projectId,
  });

  const addSubMutation = useMutation({
    mutationFn: (body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string; dbeClassification?: DbeClass }) =>
      api.post<{ data: { subcontractor: Subcontractor } }>(`/projects/${projectId}/subcontractors`, body),
    onSuccess: (_, body) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success(`Subcontractor "${body.name}" added`);
      setAddingNew(false);
      setAddForm({ ...EMPTY_SUB_FORM });
    },
    onError: () => toast.error('Could not add subcontractor'),
  });

  const editSubMutation = useMutation({
    mutationFn: ({ subId, body }: { subId: string; body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string; dbeClassification?: DbeClass } }) =>
      api.patch(`/projects/${projectId}/subcontractors/${subId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Subcontractor updated');
      setEditingSubId(null);
    },
    onError: () => toast.error('Could not update subcontractor'),
  });

  const deleteSubMutation = useMutation({
    mutationFn: (subId: string) => api.delete(`/projects/${projectId}/subcontractors/${subId}`),
    onSuccess: (_data, subId) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Subcontractor removed');
      setDeletingSubId(null);
      setExpandedSubId(prev => prev === subId ? null : prev);
    },
    onError: () => toast.error('Could not remove subcontractor'),
  });

  const requestCprMutation = useMutation({
    mutationFn: (body: { subcontractorId: string; weekEndingDate: string }) =>
      api.post<{ data: { uploadUrl: string; emailed: boolean } }>(`/projects/${projectId}/subcontractor-cpr-queue/request`, body),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-cpr-queue', projectId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success(response.data.emailed ? 'CPR upload request sent' : 'CPR upload link created');
    },
    onError: () => toast.error('Could not create CPR request'),
  });

  const requestBulkCprMutation = useMutation({
    mutationFn: () =>
      api.post<{ data: { created: number; emailed: number } }>(
        `/projects/${projectId}/subcontractor-cpr-queue/request-bulk`,
        {},
      ),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-cpr-queue', projectId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      const { created, emailed } = response.data;
      toast.success(
        emailed > 0
          ? `Sent ${emailed} CPR upload request${emailed === 1 ? '' : 's'}`
          : `Created ${created} CPR upload link${created === 1 ? '' : 's'}`,
      );
    },
    onError: () => toast.error('Could not send CPR requests'),
  });

  function handleAddSub() {
    if (!addForm.name.trim()) return;
    const body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string; dbeClassification?: DbeClass } = {
      name: addForm.name.trim(),
      dbeClassification: addForm.dbeClassification,
    };
    if (addForm.licenseNumber.trim()) body.licenseNumber = addForm.licenseNumber.trim();
    if (addForm.contactName.trim()) body.contactName = addForm.contactName.trim();
    if (addForm.contactEmail.trim()) body.contactEmail = addForm.contactEmail.trim();
    if (addForm.address.trim()) body.address = addForm.address.trim();
    addSubMutation.mutate(body);
  }

  function handleEditSub(subId: string) {
    if (!editForm.name.trim()) return;
    const body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string; dbeClassification?: DbeClass } = {
      name: editForm.name.trim(),
      dbeClassification: editForm.dbeClassification,
    };
    if (editForm.licenseNumber.trim()) body.licenseNumber = editForm.licenseNumber.trim();
    if (editForm.contactName.trim()) body.contactName = editForm.contactName.trim();
    if (editForm.contactEmail.trim()) body.contactEmail = editForm.contactEmail.trim();
    if (editForm.address.trim()) body.address = editForm.address.trim();
    editSubMutation.mutate({ subId, body });
  }

  function startEdit(sub: Subcontractor) {
    setEditingSubId(sub.id);
    setEditForm({
      name: sub.name,
      licenseNumber: sub.licenseNumber ?? '',
      contactName: sub.contactName ?? '',
      contactEmail: sub.contactEmail ?? '',
      address: sub.address ?? '',
      dbeClassification: sub.dbeClassification ?? 'none',
    });
  }

  const subs = subsData?.data?.subcontractors ?? [];
  const cprQueue = cprQueueData?.data?.queue ?? [];
  const cprSummary = cprQueueData?.data?.summary;
  const subsById = new Map(subs.map((sub) => [sub.id, sub]));

  // DBE-05: derive participation counts from server-attached certSummary
  const activeCertifiedCount = subs.filter(
    s => s.certSummary?.isCertified && !s.certSummary.hasSuspendedCert,
  ).length;
  const expiredCount = subs.filter(s => s.certSummary?.hasExpiredCert).length;
  const pendingCount = subs.filter(s => s.certSummary?.hasPendingCert).length;

  // DBE-05: Branch A — expandedSubId state exists; click scrolls to panel and expands first certified sub.
  // If no certified sub exists, the participation card is conditionally hidden (see render gate below),
  // so this state is unreachable in practice — still guarded with early return for safety.
  function handleParticipationCardClick() {
    subsHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstCertified = subs.find(s => s.certSummary?.isCertified);
    if (!firstCertified) return;
    setExpandedSubId(firstCertified.id);
  }

  const INPUT_CLASSES = 'border border-border-default rounded px-2 py-1 text-sm bg-surface-page';

  return (
    <div>
      <div ref={subsHeaderRef} className="flex items-center justify-between mb-3">
        {!addingNew && (
          <Button variant="secondary" onClick={() => setAddingNew(true)}>
            Add Subcontractor
          </Button>
        )}
      </div>

      {/* DBE-05: DBE Participation Summary card — shown only when there are certified subs */}
      {subs.length > 0 && subs.some(s => s.certSummary?.isCertified) && (
        <div
          className="rounded-xl border border-gray-200 shadow-sm p-5 mb-5 cursor-pointer hover:bg-gray-50 transition-colors"
          role="button"
          tabIndex={0}
          onClick={handleParticipationCardClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleParticipationCardClick();
            }
          }}
          aria-label="Open subcontractor certifications panel"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-gold" />
            DBE/MBE/WBE Participation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{activeCertifiedCount}</p>
              <p className="text-xs text-gray-500">Active Certified</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${expiredCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {expiredCount}
              </p>
              <p className="text-xs text-gray-500">Expired Certs</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {pendingCount}
              </p>
              <p className="text-xs text-gray-500">DOT IFR Review</p>
            </div>
          </div>
          {(expiredCount > 0 || pendingCount > 0) && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mt-3">
              Resolve certification issues before the next CPR submission deadline.
            </p>
          )}
        </div>
      )}

      {cprQueue.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Subcontractor CPR Follow-Up
              </h3>
              {cprSummary && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-sm bg-white/70 px-2 py-1 text-amber-900">{cprSummary.total} open</span>
                  <span className="rounded-sm bg-white/70 px-2 py-1 text-amber-900">{cprSummary.overdue} overdue</span>
                  <span className="rounded-sm bg-white/70 px-2 py-1 text-amber-900">{cprSummary.nonCompliant} non-compliant</span>
                </div>
              )}
              <p className="mt-2 max-w-2xl text-xs leading-5 text-amber-800">
                Upload requests create internal links first. Email delivery only happens when outbound email is configured; otherwise copy the generated link from the request response.
              </p>
            </div>
            {cprSummary && cprSummary.readyToRequest > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => requestBulkCprMutation.mutate()}
                disabled={requestBulkCprMutation.isPending}
              >
                {requestBulkCprMutation.isPending
                  ? 'Sending...'
                  : `Send ${cprSummary.readyToRequest} Request${cprSummary.readyToRequest === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {cprQueue.slice(0, 5).map((item, index) => {
              const sub = subsById.get(item.subcontractorId);
              const contactEmail = item.contactEmail?.trim() || sub?.contactEmail?.trim();
              const operation = getSubcontractorOperationState(item);
              return (
              <div key={`${item.subcontractorId}-${item.weekEndingDate}-${item.status}-${index}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium text-amber-950">{item.subcontractorName}</span>
                  <span className="text-amber-800"> - week ending {item.weekEndingDate}</span>
                  {item.daysLate > 0 && (
                    <span className="ml-1 text-xs text-amber-800">({item.daysLate} days late)</span>
                  )}
                  <p className="text-xs text-amber-800">{operation.nextAction}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={operation.badgeVariant}>
                    {operation.label}
                  </Badge>
                  {contactEmail ? (
                    <button
                      type="button"
                      disabled={requestCprMutation.isPending}
                      onClick={() => requestCprMutation.mutate({
                        subcontractorId: item.subcontractorId,
                        weekEndingDate: item.weekEndingDate,
                      })}
                      className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-amber-950 underline underline-offset-2 hover:text-black"
                    >
                      Send upload request
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-amber-950 underline underline-offset-2 hover:text-black"
                      onClick={() => startEdit(sub ?? { id: item.subcontractorId, name: item.subcontractorName } as Subcontractor)}
                    >
                      Add contact email
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
          {cprQueue.length > 5 && (
            <p className="text-xs text-amber-800 mt-2">{cprQueue.length - 5} more subcontractor CPR items need review.</p>
          )}
        </div>
      )}

      {/* Add form */}
      {addingNew && (
        <Card className="mb-4">
          <h3 className="font-headline text-sm text-gray-900 mb-3">Add Subcontractor</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Name *</label>
              <input
                type="text"
                className={INPUT_CLASSES + ' w-full'}
                placeholder="Company name"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">License Number</label>
                <input
                  type="text"
                  className={INPUT_CLASSES + ' w-full'}
                  placeholder="Optional"
                  value={addForm.licenseNumber}
                  onChange={e => setAddForm(f => ({ ...f, licenseNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Contact Name</label>
                <input
                  type="text"
                  className={INPUT_CLASSES + ' w-full'}
                  placeholder="Optional"
                  value={addForm.contactName}
                  onChange={e => setAddForm(f => ({ ...f, contactName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Contact Email</label>
                <input
                  type="email"
                  className={INPUT_CLASSES + ' w-full'}
                  placeholder="Optional"
                  value={addForm.contactEmail}
                  onChange={e => setAddForm(f => ({ ...f, contactEmail: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Address</label>
                <input
                  type="text"
                  className={INPUT_CLASSES + ' w-full'}
                  placeholder="Optional"
                  value={addForm.address}
                  onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">DBE Classification</label>
              <select
                className={INPUT_CLASSES + ' w-full'}
                value={addForm.dbeClassification}
                onChange={e => setAddForm(f => ({ ...f, dbeClassification: e.target.value as DbeClass }))}
              >
                {DBE_CLASS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setAddingNew(false); setAddForm({ ...EMPTY_SUB_FORM }); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSub}
              disabled={!addForm.name.trim() || addSubMutation.isPending}
            >
              {addSubMutation.isPending ? 'Saving...' : 'Add Subcontractor'}
            </Button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!subsLoading && subs.length === 0 && !addingNew && (
        <EmptyState
          icon={Building2}
          heading="No subcontractors"
          message="Track CPR receipt and compliance status for each subcontractor on this project."
        />
      )}

      {/* Sub list */}
      {subs.map(sub => (
        <Card key={sub.id} className="mb-3">
          {editingSubId === sub.id ? (
            /* Edit form inline */
            <div>
              <h3 className="font-headline text-sm text-gray-900 mb-3">Edit Subcontractor</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Name *</label>
                  <input
                    type="text"
                    className={INPUT_CLASSES + ' w-full'}
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">License Number</label>
                    <input
                      type="text"
                      className={INPUT_CLASSES + ' w-full'}
                      value={editForm.licenseNumber}
                      onChange={e => setEditForm(f => ({ ...f, licenseNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Contact Name</label>
                    <input
                      type="text"
                      className={INPUT_CLASSES + ' w-full'}
                      value={editForm.contactName}
                      onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Contact Email</label>
                    <input
                      type="email"
                      className={INPUT_CLASSES + ' w-full'}
                      value={editForm.contactEmail}
                      onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Address</label>
                    <input
                      type="text"
                      className={INPUT_CLASSES + ' w-full'}
                      value={editForm.address}
                      onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">DBE Classification</label>
                  <select
                    className={INPUT_CLASSES + ' w-full'}
                    value={editForm.dbeClassification}
                    onChange={e => setEditForm(f => ({ ...f, dbeClassification: e.target.value as DbeClass }))}
                  >
                    {DBE_CLASS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEditingSubId(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleEditSub(sub.id)}
                  disabled={!editForm.name.trim() || editSubMutation.isPending}
                >
                  {editSubMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            /* Normal row */
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 font-body">{sub.name}</span>
                    {sub.dbeClassification && sub.dbeClassification !== 'none' && (
                      <span className={`px-1.5 py-0.5 text-xs font-semibold rounded uppercase ${DBE_BADGE_CLASSES[sub.dbeClassification as Exclude<DbeClass, 'none'>]}`}>
                        {sub.dbeClassification.toUpperCase()}
                      </span>
                    )}
                    {sub.licenseNumber && (
                      <span className="text-xs text-gray-500">Lic: {sub.licenseNumber}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                    {sub.contactName && <span>{sub.contactName}</span>}
                    {sub.contactEmail && <span>{sub.contactEmail}</span>}
                    {sub.address && <span>{sub.address}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {deletingSubId === sub.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Confirm remove?</span>
                      <button
                        className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-status-violation hover:underline"
                        onClick={() => deleteSubMutation.mutate(sub.id)}
                        disabled={deleteSubMutation.isPending}
                      >
                        {deleteSubMutation.isPending ? 'Removing...' : 'Confirm'}
                      </button>
                      <button
                        className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-gray-600 hover:text-gray-950 hover:underline"
                        onClick={() => setDeletingSubId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-semibold text-gray-700 transition-colors hover:text-black"
                        onClick={() => startEdit(sub)}
                      >
                        Edit
                      </button>
                      <button
                        className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-gray-700 transition-colors hover:text-status-violation"
                        onClick={() => setDeletingSubId(sub.id)}
                      >
                        Remove
                      </button>
                      <button
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:text-black"
                        onClick={() => setExpandedSubId(prev => prev === sub.id ? null : sub.id)}
                        aria-expanded={expandedSubId === sub.id}
                        aria-label={expandedSubId === sub.id ? 'Collapse CPR weeks' : 'Expand CPR weeks'}
                      >
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${expandedSubId === sub.id ? 'rotate-90' : ''}`}
                        />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {expandedSubId === sub.id && (
                <>
                  <CertificationsSection projectId={projectId} subId={sub.id} />
                  <CprWeekTable projectId={projectId} subId={sub.id} />
                </>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Phase 117: Apprenticeship Ratios collapsible section ─────────────────────

function ApprenticeshipSection({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-sm px-1 text-sm font-semibold text-gray-700 transition-colors hover:text-nav-dark"
        aria-expanded={open}
      >
        <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        Apprenticeship Ratios
      </button>
      {open && (
        <div className="mt-2">
          <ApprenticeshipDashboard projectId={projectId} />
        </div>
      )}
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<{ data: { project: Project } }>(`/projects/${id}`),
    enabled: !!id,
  });

  const { data: workersData } = useQuery({
    queryKey: ['workers', id],
    queryFn: () => api.get<{ data: { workers: { id: string }[] } }>(`/projects/${id}/workers`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: subcontractorsData } = useQuery({
    queryKey: ['subcontractors', id],
    queryFn: () => api.get<{ data: { subcontractors: { id: string }[] } }>(`/projects/${id}/subcontractors`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: cprQueueData } = useQuery({
    queryKey: ['subcontractor-cpr-queue', id],
    queryFn: () => api.get<{ data: { queue: SubcontractorCprQueueItem[]; summary: SubcontractorCprQueueSummary } }>(`/projects/${id}/subcontractor-cpr-queue`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: weeksData } = useQuery({
    queryKey: ['payroll-weeks', id],
    queryFn: () => api.get<{ weeks: { id: string; submittedAt: string | null; weekEndingDate: string; payrollNumber: number }[] }>(`/payroll/projects/${id}/weeks`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: wdPinsData } = useQuery({
    queryKey: ['wd-pins', id],
    queryFn: () => api.get<{ pins: PinRow[] }>(`/projects/${id}/wage-determinations`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: complianceSummaryData } = useQuery({
    queryKey: ['compliance-summary-batch'],
    queryFn: () => api.get<{ projects: Array<{ id: string; status: string; violationCount: number }> }>(
      '/compliance/projects/summary'
    ),
    enabled: !!id && data?.data?.project?.status === 'active',
    staleTime: 60_000,
  });

  const primaryPin = wdPinsData?.pins?.find((p) => p.isPrimary) ?? null;
  const showStaleBanner =
    primaryPin !== null &&
    (primaryPin.lastFetchedAt === null ||
      Date.now() - new Date(primaryPin.lastFetchedAt).getTime() > 7 * 24 * 60 * 60 * 1000);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [complianceWarning, setComplianceWarning] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS);

  useEffect(() => {
    if (isLoading || !data?.data?.project || !location.hash) return;
    const targetId = decodeURIComponent(location.hash.slice(1));
    if (!targetId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [data?.data?.project, isLoading, location.hash]);

  const archiveMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => api.patch(`/projects/${id}`, { status: 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      toast.success('Project restored');
    },
    onError: () => toast.error('Could not restore project'),
  });

  const saveNotifMutation = useMutation({
    mutationFn: (prefs: NotifSettings) => {
      return api.patch(`/projects/${id}`, {
        projectSettings: buildProjectSettingsWithNotifications(project?.projectSettings, prefs),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      toast.success('Notification preferences saved');
      setNotifPanelOpen(false);
    },
    onError: () => toast.error('Could not save notification preferences'),
  });

  useEffect(() => {
    if (!archiveModalOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setArchiveModalOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [archiveModalOpen]);

  async function handleArchiveClick() {
    const summary = await queryClient.fetchQuery({
      queryKey: ['compliance-summary', id],
      queryFn: async () => {
        const res = await fetch(`/api/compliance/project/${id}`);
        if (!res.ok) return null;
        return res.json() as Promise<{ badge: string; weekCount: number; lastWeekNumber: number | null }>;
      },
      staleTime: 60_000,
    });
    setComplianceWarning(summary?.badge === 'violations');
    setArchiveModalOpen(true);
  }

  function handleOpenNotifPanel() {
    setNotifPrefs(parseNotifSettings(project?.projectSettings));
    setNotifPanelOpen(true);
  }

  const project = data?.data?.project;
  const onboardingSetup = parseProjectOnboardingSetup(project?.projectSettings);
  const sampleProject = isSampleProject(project?.projectSettings);
  const hasSubcontractorSetup = (subcontractorsData?.data.subcontractors.length ?? 0) > 0;
  const hasApprenticeshipRatioSetup = hasApprenticeshipSetup(project?.apprenticeshipRequirements);

  const workers = workersData?.data?.workers ?? [];
  const weeks = weeksData?.weeks ?? [];

  // Civil penalty exposure — COMP-08 / DOL 2024
  const projectCompliance = complianceSummaryData?.projects?.find(p => p.id === id);
  const violationCount = projectCompliance?.violationCount ?? 0;
  const maxCivilPenalty = violationCount * CIVIL_PENALTY_PER_VIOLATION;

  const openCprItems = cprQueueData?.data.summary.total ?? 0;
  return (
    <Layout>
      {isLoading && <ProjectDetailSkeleton />}

      {isError && (
        <div className="text-center py-12">
          <p className="text-red-600 text-sm mb-4">Project not found or access denied.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center justify-center font-semibold rounded-sm text-sm px-4 py-3 min-h-[44px] bg-transparent text-black border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
          >
            Try Again
          </button>
        </div>
      )}

      {project && (
        <div className="flex flex-col">
          <h1 className="sr-only">{sampleProject ? `${project.name} sample workspace` : `${project.name} workspace`}</h1>

          {sampleProject && <SampleProjectPanel projectId={project.id} />}

          <ProjectCommandCenter
            project={project}
            workersCount={workers.length}
            weeks={weeks}
            violationCount={violationCount}
            openCprItems={openCprItems}
            hasPrimaryWageDetermination={primaryPin !== null}
            primaryPin={primaryPin}
            controls={
              <>
                {project.status === 'active' ? (
                  <Button variant="secondary" onClick={handleArchiveClick}>
                    Archive Project
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => restoreMutation.mutate()}
                    disabled={restoreMutation.isPending}
                  >
                    {restoreMutation.isPending ? 'Restoring...' : 'Restore Project'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={handleOpenNotifPanel}
                  aria-label="Notification preferences"
                >
                  <Settings className="w-4 h-4 mr-1.5" />
                  Notifications
                </Button>
              </>
            }
          />

          <ProjectRequirementsPanel project={project} />

          <ProjectSetupGuidancePanel
            projectId={project.id}
            setup={onboardingSetup}
            gpsClockInEnabled={project.gpsClockInEnabled}
            hasSubcontractorSetup={hasSubcontractorSetup}
            hasApprenticeshipRatioSetup={hasApprenticeshipRatioSetup}
          />

          {notifPanelOpen && (
            <Card className="order-last mt-4 shadow-card-elevated">
              <h2 className="font-headline text-base text-text-primary mb-3 pb-2 border-b border-border-subtle">Notification Preferences</h2>
              <div className="space-y-5 text-sm font-body">

                {/* Alerts group — instant notifications */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Alerts</h4>
                  <div className="space-y-3">

                    <label
                      className="flex items-center justify-between gap-4 cursor-pointer"
                      title="Fires immediately when a worker's wages fall below the required prevailing wage rate"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">Compliance violation detected</span>
                        <p className="text-xs text-gray-500 mt-0.5">Instant alert when a worker's wages fall below the required prevailing wage</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-gold shrink-0"
                        checked={notifPrefs.notifyViolations}
                        onChange={e => setNotifPrefs(p => ({ ...p, notifyViolations: e.target.checked }))}
                        title="Fires immediately when a compliance violation is detected"
                      />
                    </label>

                    <label
                      className="flex items-center justify-between gap-4 cursor-pointer"
                      title="Fires when any team member (other than you) edits or updates this project"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">Team activity</span>
                        <p className="text-xs text-gray-500 mt-0.5">Instant alert when another team member edits this project</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-gold shrink-0"
                        checked={notifPrefs.notifyActivity}
                        onChange={e => setNotifPrefs(p => ({ ...p, notifyActivity: e.target.checked }))}
                        title="Fires when any team member other than you edits this project"
                      />
                    </label>

                    <label
                      className="flex items-center justify-between gap-4 cursor-pointer"
                      title="Fires when a certified payroll report (WH-347) is successfully submitted"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">Payroll submission confirmed</span>
                        <p className="text-xs text-gray-500 mt-0.5">Instant email confirmation when a WH-347 is submitted</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-gold shrink-0"
                        checked={notifPrefs.notifySubmission}
                        onChange={e => setNotifPrefs(p => ({ ...p, notifySubmission: e.target.checked }))}
                        title="Fires when a certified payroll report is successfully submitted"
                      />
                    </label>

                  </div>
                </div>

                {/* Reminders group — scheduled/upcoming */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Reminders</h4>
                  <div className="space-y-3">

                    <div className="flex items-start justify-between gap-4">
                      <label
                        className="flex items-start gap-2 cursor-pointer"
                        title="Sends a scheduled reminder email N days before each weekly payroll deadline"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-gold mt-0.5 shrink-0"
                          checked={notifPrefs.notifyDueSoon}
                          onChange={e => setNotifPrefs(p => ({ ...p, notifyDueSoon: e.target.checked }))}
                          title="Enable scheduled reminders before each weekly payroll deadline"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Payroll due-date reminder</span>
                          <p className="text-xs text-gray-500 mt-0.5">Scheduled email before each weekly payroll deadline</p>
                        </div>
                      </label>
                      <div
                        className="flex items-center gap-2 shrink-0"
                        title="Number of days before the payroll deadline to send the reminder"
                      >
                        <span className="text-xs text-gray-500 whitespace-nowrap">Notify me</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={notifPrefs.dueSoonDays}
                          disabled={!notifPrefs.notifyDueSoon}
                          className="w-16 border border-border-default rounded px-2 py-2 text-base min-h-[44px] disabled:opacity-40 bg-surface-page text-center"
                          onChange={e => setNotifPrefs(p => ({ ...p, dueSoonDays: Math.max(1, Math.min(30, Number(e.target.value))) }))}
                          title="Days before the payroll deadline to send the reminder (1–30)"
                          aria-label="Days before payroll is due"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">days before payroll is due</span>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              <div className="mt-5 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setNotifPanelOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => saveNotifMutation.mutate(notifPrefs)}
                  disabled={saveNotifMutation.isPending}
                >
                  {saveNotifMutation.isPending ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </Card>
          )}

          {/* Civil penalty exposure — COMP-08 / DOL 2024 */}
          {project.status === 'active' && violationCount > 0 && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 max-w-lg">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-status-violation">
                    Civil Penalty Exposure
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {violationCount} active violation{violationCount !== 1 ? 's' : ''} detected
                    across payroll weeks for this project.
                  </p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
                    <div className="rounded bg-white border border-red-100 px-3 py-2">
                      <p className="text-lg font-bold text-status-violation">{violationCount}</p>
                      <p className="text-xs text-gray-500">Violations</p>
                    </div>
                    <div className="rounded bg-white border border-red-100 px-3 py-2">
                      <p className="text-lg font-bold text-status-violation">
                        ${maxCivilPenalty.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Max Exposure</p>
                    </div>
                  </div>
                  <p className="text-xs text-red-600 mt-2">
                    Max penalty: ${CIVIL_PENALTY_PER_VIOLATION.toLocaleString()} per violation (29 CFR Part 5.14, 2024).
                    Resolve violations on the Payroll Weeks page before submission.
                  </p>
                </div>
              </div>
            </div>
          )}

          {archiveModalOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div
                className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby="archive-modal-title"
              >
                <h3 id="archive-modal-title" className="font-headline text-lg text-gray-900 mb-3">
                  Archive Project
                </h3>
                {complianceWarning && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    This project has open compliance violations. Archiving will not resolve them. You can restore the project later if needed.
                  </div>
                )}
                <p className="text-sm text-gray-600 mb-5">
                  {complianceWarning
                    ? 'Are you sure you want to archive this project despite open violations?'
                    : 'Are you sure you want to archive this project? It will be hidden from your active dashboard.'}
                </p>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setArchiveModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => archiveMutation.mutate()}
                    disabled={archiveMutation.isPending}
                  >
                    {archiveMutation.isPending ? 'Archiving...' : (complianceWarning ? 'Archive Anyway' : 'Archive')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <WorkZone
            eyebrow="People"
            title="People & Field Inputs"
            description="Keep subcontractor CPR, apprenticeship ratios, and field proof in one operational zone."
            className="order-[30]"
          >
          {/* Subcontractors panel */}
          <div id="subcontractors" className="scroll-mt-24">
            <Card className="shadow-card-elevated">
              <h2 className="font-headline text-base text-text-primary mb-3 pb-2 border-b border-border-subtle">Subcontractors</h2>
              <SubcontractorsPanel projectId={project.id} />
            </Card>
          </div>

          {/* Apprenticeship Ratios — Phase 117 (APP-01) */}
          <Card padding="none" className="shadow-card-elevated overflow-hidden">
            <ApprenticeshipSection projectId={project.id} />
          </Card>
          </WorkZone>

          <WorkZone
            eyebrow="Setup"
            title="Setup & Rates"
            description="Confirm the wage source and contractor signature before certified payroll is submitted."
            className="order-[20]"
          >
          {/* Wage determinations panel */}
          <div id="wage-determinations" className="scroll-mt-24">
          <Card className="shadow-card-elevated">
            <h2 className="font-headline text-base text-text-primary mb-3 pb-2 border-b border-border-subtle">Wage Rates</h2>
            {/* Stale WD banner — COMP-06 Phase 88 */}
            {showStaleBanner && primaryPin && (
              <StaleWdBanner lastFetchedAt={primaryPin.lastFetchedAt} />
            )}
            <ProjectWageDeterminationsPanel
              projectId={project.id}
              projectState={project.state}
              projectCounty={project.county}
            />
          </Card>
          </div>

          {/* Phase 96: Contractor Signature */}
          <div id="contractor-signature" className="scroll-mt-24">
            <SignaturePad projectId={project.id} />
          </div>
          </WorkZone>

          <WorkZone
            eyebrow="Evidence"
            title="Field Evidence"
            description="Attach job-site photos and field proof that support payroll and audit review."
            className="order-[40]"
          >
          {/* Phase 96: Site Photo Gallery */}
          <div>
            <PhotoGallery projectId={project.id} />
          </div>
          </WorkZone>

          <WorkZone
            eyebrow="Review"
            title="Review & Audit Packet"
            description="Track reviewer status, export audit evidence, and prove the payroll file after submission."
            className="order-[50]"
          >
            <ProjectReviewPanel projectId={project.id} projectSettings={project.projectSettings} />
            <ProjectAuditDefensePanel projectId={project.id} />
          </WorkZone>
        </div>
      )}
    </Layout>
  );
}
