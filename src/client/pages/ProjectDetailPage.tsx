import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Workflow, Settings } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';
import { TermTooltip } from '../components/ui/TermTooltip';

const WH347_DEF = "The Department of Labor's official certified payroll form. Contractors must submit it weekly to the contracting officer as proof that workers were paid the correct prevailing wage.";
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

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
  projectSettings: string | null;
}

interface NotifSettings {
  notifyViolations: boolean;
  notifyDueSoon: boolean;
  dueSoonDays: number;
  notifyActivity: boolean;
  notifySubmission: boolean;
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

function WorkflowProgress({ steps }: { steps: { label: string; complete: boolean }[] }) {
  return (
    <div className="flex items-center gap-0 mb-6 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={
              step.complete
                ? 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold bg-status-compliant text-white'
                : 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 border-gray-300 text-gray-400 bg-white'
            }>
              {step.complete ? '\u2713' : i + 1}
            </div>
            <span className={
              step.complete
                ? 'text-sm font-medium text-status-compliant'
                : 'text-sm font-medium text-gray-400'
            }>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={
              step.complete
                ? 'mx-3 h-0.5 w-10 bg-status-compliant shrink-0'
                : 'mx-3 h-0.5 w-10 bg-gray-200 shrink-0'
            } />
          )}
        </div>
      ))}
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
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

  const { data: weeksData } = useQuery({
    queryKey: ['payroll-weeks', id],
    queryFn: () => api.get<{ weeks: { id: string; submittedAt: string | null }[] }>(`/payroll/projects/${id}/weeks`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [complianceWarning, setComplianceWarning] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS);

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
    },
  });

  const saveNotifMutation = useMutation({
    mutationFn: (prefs: NotifSettings) => {
      // Send the prefs as a JSON string in projectSettings
      // Server-side PATCH will merge with existing keys (46-04 Task 1)
      return api.patch(`/projects/${id}`, { projectSettings: JSON.stringify(prefs) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      setNotifPanelOpen(false);
    },
  });

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

  const workers = workersData?.data?.workers ?? [];
  const weeks = weeksData?.weeks ?? [];

  const steps = [
    { label: 'Create Project', complete: true },
    { label: 'Add Workers', complete: workers.length > 0 },
    { label: 'Enter Payroll', complete: weeks.length > 0 },
    { label: 'Download WH-347', complete: weeks.some(w => w.submittedAt !== null) },
  ];

  return (
    <Layout>
      {isLoading && <LoadingSpinner />}

      {isError && (
        <div className="text-center py-12 text-red-600 text-sm">
          Project not found or access denied.
        </div>
      )}

      {project && (
        <div>
          <PageHeader
            title={project.name}
            subtitle={`${project.state} — ${project.county}`}
          />

          <HelpCallout
            icon={Workflow}
            title="Your Project Workflow"
            body={<>Complete all four steps before generating your <TermTooltip term="WH-347" definition={WH347_DEF} />. Submitting an incomplete certified payroll can trigger a DOL audit.</>}
          />

          <WorkflowProgress steps={steps} />

          <Card className="max-w-lg">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Contract type</dt>
                <dd className="text-gray-900 font-medium">
                  {CONTRACT_TYPE_LABELS[project.contractType] ?? project.contractType}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Funding type</dt>
                <dd>
                  <Badge variant="neutral">
                    {FUNDING_TYPE_LABELS[project.fundingType] ?? project.fundingType}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Award date</dt>
                <dd className="text-gray-900 font-medium">{project.awardDate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="text-gray-900 font-medium capitalize">{project.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{new Date(project.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </Card>

          <div className="mt-4 flex gap-3">
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
          </div>

          {notifPanelOpen && (
            <Card className="mt-4 max-w-lg">
              <h3 className="font-headline text-base text-gray-900 mb-4">Notification Preferences</h3>
              <div className="space-y-4 text-sm font-body">

                <label className="flex items-center justify-between gap-4">
                  <span className="text-gray-700">Compliance violation alerts</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-gold"
                    checked={notifPrefs.notifyViolations}
                    onChange={e => setNotifPrefs(p => ({ ...p, notifyViolations: e.target.checked }))}
                  />
                </label>

                <label className="flex items-center justify-between gap-4">
                  <span className="text-gray-700">Team activity alerts (non-owner edits)</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-gold"
                    checked={notifPrefs.notifyActivity}
                    onChange={e => setNotifPrefs(p => ({ ...p, notifyActivity: e.target.checked }))}
                  />
                </label>

                <label className="flex items-center justify-between gap-4">
                  <span className="text-gray-700">Submission confirmation emails</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-gold"
                    checked={notifPrefs.notifySubmission}
                    onChange={e => setNotifPrefs(p => ({ ...p, notifySubmission: e.target.checked }))}
                  />
                </label>

                <div className="flex items-center justify-between gap-4">
                  <label className="flex items-center gap-2 text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-gold"
                      checked={notifPrefs.notifyDueSoon}
                      onChange={e => setNotifPrefs(p => ({ ...p, notifyDueSoon: e.target.checked }))}
                    />
                    Payroll due-soon reminders
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={notifPrefs.dueSoonDays}
                      disabled={!notifPrefs.notifyDueSoon}
                      className="w-16 border border-border-default rounded px-2 py-1 text-sm disabled:opacity-50 bg-surface-page"
                      onChange={e => setNotifPrefs(p => ({ ...p, dueSoonDays: Math.max(1, Math.min(30, Number(e.target.value))) }))}
                    />
                    <span className="text-gray-500">days before</span>
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

          {archiveModalOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="font-headline text-lg text-gray-900 mb-3">
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

          {/* Project sub-page navigation */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={`/projects/${project.id}/workers`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              Workers
            </Link>
            <Link
              to={`/projects/${project.id}/payroll`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              Payroll Weeks
            </Link>
            <Link
              to={`/projects/${project.id}/ot-scenarios`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              OT Scenario Planner
            </Link>
            <Link
              to={`/projects/${project.id}/variance`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              Variance
            </Link>
            <Link
              to={`/projects/${project.id}/reports`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              Reports
            </Link>
            <Link
              to={`/projects/${project.id}/activity`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
            >
              Activity
            </Link>
          </div>
        </div>
      )}
    </Layout>
  );
}
