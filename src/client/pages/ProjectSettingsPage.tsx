// Phase 75 — Project Settings Page — GPS clock-in configuration (MOB-09)
// Phase 83 — Transfer Ownership section added
// Route: /projects/:projectId/settings
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { getStateSupport, validateStateProjectField } from '../../shared/stateSupport';

interface Project {
  id: string;
  name: string;
  state: string;
  county: string;
  contractType: string;
  fundingType: string;
  awardDate: string;
  gpsClockInEnabled: boolean;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsRadiusMeters: number | null;
  projectSettings: string | null;
  apprenticeshipRequirements: string | null;
  cslbLicense: string | null;
  wcPolicyNumber: string | null;
  ubiNumber: string | null;
  lniCertificate: string | null;
  wcAccount: string | null;
  contractorFein: string | null;
  dirProjectId: string | null;
  awardingAgency: string | null;
  contractNumber: string | null;
  pwiaIntentId: string | null;
  nyprcNumber: string | null;
  nysContractorRegNumber: string | null;
  txdotProjectId: string | null;
  txContractorLicense: string | null;
  txAwardingAgency: string | null;
  maDlsProjectId: string | null;
  maSicCode: string | null;
  njPwcNumber: string | null;
  njContractId: string | null;
  mnContractId: string | null;
  vaContractId: string | null;
}

interface SubcontractorSummary {
  id: string;
}

interface TeamMember {
  id: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface ProjectOnboardingSetup {
  payrollProvider?: string;
  accountingProvider?: string;
  projectManagementProvider?: string;
  usesSubcontractors?: boolean;
  usesApprentices?: boolean;
  fieldTrackingNeeded?: boolean;
  averageWeeklyWorkers?: number;
  completedPromptKeys?: string[];
  appliedAt?: string;
  lastAppliedAt?: string;
}

interface StoredProjectSettings {
  onboardingSetup?: ProjectOnboardingSetup;
  gpsJobsiteAddress?: string;
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

function parseStoredProjectSettings(raw: string | null | undefined): StoredProjectSettings {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredProjectSettings;
  } catch {
    return {};
  }
}

function buildUpdatedProjectSettings(raw: string | null | undefined, setup: ProjectOnboardingSetup): string {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  return JSON.stringify({ ...parsed, onboardingSetup: setup });
}

function metersToFeet(meters: number) {
  return Math.round(meters * 3.281);
}

const RADIUS_PRESETS = [
  { label: '250 ft', meters: 76 },
  { label: '500 ft', meters: 152 },
  { label: '1,000 ft', meters: 305 },
  { label: '1 mile', meters: 1609 },
];

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

// ── Phase 86: Report schedule settings ─────────────────────────────────────
// Defined locally (not imported from server emailService) to avoid pulling
// server code into the client bundle — same pattern as parseNotifSettings
// in ProjectDetailPage.tsx.

type ReportSchedule = 'daily' | 'weekly' | 'monthly' | 'off';

interface ReportSettings {
  reportSchedule: ReportSchedule;
  reportEmail: string;
}

export function parseReportSettings(raw: string | null | undefined): ReportSettings {
  const DEFAULT: ReportSettings = { reportSchedule: 'off', reportEmail: '' };
  if (!raw) return DEFAULT;
  try {
    const parsed = JSON.parse(raw);
    const sched = parsed.reportSchedule;
    const validSched: ReportSchedule =
      sched === 'daily' || sched === 'weekly' || sched === 'monthly' ? sched : 'off';
    return {
      reportSchedule: validSched,
      reportEmail: typeof parsed.reportEmail === 'string' ? parsed.reportEmail : '',
    };
  } catch {
    return DEFAULT;
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

function ProjectFactsSection({
  project,
  projectId,
  focusField,
}: {
  project: Project;
  projectId: string;
  focusField: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [awardingAgency, setAwardingAgency] = useState(project.awardingAgency ?? '');
  const [contractNumber, setContractNumber] = useState(project.contractNumber ?? '');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const projectState = (project.state ?? '').toUpperCase();
  const contractType = project.contractType ?? 'private';
  const requiresPublicAgency = contractType !== 'private';
  const requiresContractNumber = requiresPublicAgency && projectState === 'CA';

  useEffect(() => {
    setAwardingAgency(project.awardingAgency ?? '');
    setContractNumber(project.contractNumber ?? '');
  }, [project.awardingAgency, project.contractNumber]);

  useEffect(() => {
    if (!focusField || !['awardingAgency', 'contractNumber'].includes(focusField)) return;
    const input = document.getElementById(`project-fact-${focusField}`) as HTMLInputElement | null;
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => input.focus(), 250);
  }, [focusField]);

  const errors: Record<string, string> = {
    awardingAgency: requiresPublicAgency && !awardingAgency.trim()
      ? 'Awarding agency is required because public works exports and evidence packets must identify the agency controlling the project. Enter the agency named in the award or contract.'
      : '',
    contractNumber: requiresContractNumber && !contractNumber.trim()
      ? 'Contract number is required for California public works forms so generated packages match the award record. Enter the contract or project number from the award document.'
      : '',
  };

  const saveFactsMutation = useMutation({
    mutationFn: () =>
      api.patch<{ data: { project: Project } }>(`/projects/${projectId}`, {
        awardingAgency: awardingAgency.trim(),
        contractNumber: contractNumber.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Project facts saved');
    },
    onError: () => {
      toast.error('Failed to save project facts');
    },
  });

  function handleSaveFacts() {
    setTouched({ awardingAgency: true, contractNumber: true });
    const firstError = (['awardingAgency', 'contractNumber'] as const).find((field) => errors[field]);
    if (firstError) {
      const input = document.getElementById(`project-fact-${firstError}`) as HTMLInputElement | null;
      toast.error(errors[firstError]);
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => input?.focus(), 250);
      return;
    }
    saveFactsMutation.mutate();
  }

  return (
    <div id="project-facts" className="scroll-mt-24 bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="font-headline text-base font-semibold text-gray-900">Project Facts</h2>
        <p className="mt-1 text-sm text-gray-600">
          Confirm the controlling agency and identifiers used by payroll forms, evidence packets, and reviewer language.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded border border-gray-100 bg-gray-50 px-3 py-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Jurisdiction inputs</dt>
          <dd className="mt-1 text-gray-900">{CONTRACT_TYPE_LABELS[contractType] ?? contractType}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Funding</dt>
          <dd className="mt-1 text-gray-900">{FUNDING_TYPE_LABELS[project.fundingType] ?? project.fundingType ?? 'Not set'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Location</dt>
          <dd className="mt-1 text-gray-900">{[project.county, project.state].filter(Boolean).join(', ') || 'Not set'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Award date</dt>
          <dd className="mt-1 text-gray-900">{project.awardDate ?? 'Not set'}</dd>
        </div>
      </dl>

      <div className="grid gap-3">
        <div>
          <label htmlFor="project-fact-awardingAgency" className="block text-xs font-medium text-gray-700 mb-1">
            Awarding agency
          </label>
          <input
            id="project-fact-awardingAgency"
            type="text"
            value={awardingAgency}
            onChange={(event) => setAwardingAgency(event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, awardingAgency: true }))}
            aria-invalid={Boolean(touched.awardingAgency && errors.awardingAgency)}
            aria-describedby={errors.awardingAgency ? 'project-fact-awardingAgency-error' : undefined}
            className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              touched.awardingAgency && errors.awardingAgency
                ? 'border-red-300 bg-red-50 focus:ring-red-200'
                : 'border-gray-300 focus:ring-brand-gold'
            }`}
          />
          {touched.awardingAgency && errors.awardingAgency && (
            <p id="project-fact-awardingAgency-error" className="mt-1 text-xs font-medium leading-5 text-red-700">
              {errors.awardingAgency}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="project-fact-contractNumber" className="block text-xs font-medium text-gray-700 mb-1">
            Contract number
          </label>
          <input
            id="project-fact-contractNumber"
            type="text"
            value={contractNumber}
            onChange={(event) => setContractNumber(event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, contractNumber: true }))}
            aria-invalid={Boolean(touched.contractNumber && errors.contractNumber)}
            aria-describedby={errors.contractNumber ? 'project-fact-contractNumber-error' : undefined}
            className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              touched.contractNumber && errors.contractNumber
                ? 'border-red-300 bg-red-50 focus:ring-red-200'
                : 'border-gray-300 focus:ring-brand-gold'
            }`}
          />
          {touched.contractNumber && errors.contractNumber && (
            <p id="project-fact-contractNumber-error" className="mt-1 text-xs font-medium leading-5 text-red-700">
              {errors.contractNumber}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSaveFacts}
        disabled={saveFactsMutation.isPending}
        className="px-5 py-2 rounded font-semibold text-sm text-white bg-nav-dark hover:bg-nav-dark/90 transition-colors disabled:opacity-50"
      >
        {saveFactsMutation.isPending ? 'Saving...' : 'Save Project Facts'}
      </button>
    </div>
  );
}

function ReportScheduleSection({ projectId, projectSettings }: { projectId: string; projectSettings: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initial = parseReportSettings(projectSettings);
  const [schedule, setSchedule] = useState<ReportSchedule>(initial.reportSchedule);
  const [email, setEmail] = useState<string>(initial.reportEmail);

  // Re-sync when projectSettings prop changes (e.g., after PATCH refetch)
  useEffect(() => {
    const next = parseReportSettings(projectSettings);
    setSchedule(next.reportSchedule);
    setEmail(next.reportEmail);
  }, [projectSettings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch<{ data: { project: Project } }>(`/projects/${projectId}`, {
        projectSettings: JSON.stringify({ reportSchedule: schedule, reportEmail: email }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Report schedule saved');
    },
    onError: () => {
      toast.error('Failed to save report schedule');
    },
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
      <h2 className="font-headline text-base font-semibold text-gray-900">
        Compliance Report Schedule
      </h2>
      <p className="text-sm text-gray-600">
        Receive an automated compliance summary email — compliance rate, open violations, and
        payroll weeks due in the next 7 days.
      </p>

      {/* Schedule selector */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Frequency
        </label>
        <select
          value={schedule}
          onChange={(e) => setSchedule(e.target.value as ReportSchedule)}
          aria-label="Report schedule frequency"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        >
          <option value="off">Off</option>
          <option value="daily">Daily (every day at 08:00 UTC)</option>
          <option value="weekly">Weekly (Mondays at 08:00 UTC)</option>
          <option value="monthly">Monthly (1st of the month at 08:00 UTC)</option>
        </select>
      </div>

      {/* Email input */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Send to email (optional)
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="leave blank to use project owner's email"
          aria-label="Report email recipient"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
        <p className="text-xs text-gray-500 mt-1">
          If blank, reports go to the project owner's account email.
        </p>
      </div>

      <div className="pt-2">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-5 py-2 rounded font-semibold text-sm text-white bg-nav-dark hover:bg-nav-dark/90 transition-colors disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Report Schedule'}
        </button>
      </div>
    </div>
  );
}

// ── Transfer Ownership section ─────────────────────────────────────────────
function StateProjectFieldsSection({
  project,
  projectId,
  focusField,
}: {
  project: Project;
  projectId: string;
  focusField: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const support = useMemo(() => getStateSupport(project.state), [project.state]);
  const fields = useMemo(
    () => support.requiredProjectFields.filter((field) => !['awardingAgency', 'contractNumber'].includes(field.key)),
    [support.requiredProjectFields],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of fields) {
      const value = project[field.key as keyof Project];
      next[field.key] = typeof value === 'string' ? value : '';
    }
    setValues(next);
  }, [project, fields]);

  useEffect(() => {
    if (!focusField) return;
    const input = document.getElementById(`state-field-${focusField}`) as HTMLInputElement | null;
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => input.focus(), 250);
  }, [focusField, fields]);

  const fieldErrors = useMemo(() => {
    const next: Record<string, string> = {};
    for (const field of fields) {
      const error = validateStateProjectField(project.state, field.key, values[field.key]);
      if (error) next[field.key] = error;
    }
    return next;
  }, [fields, project.state, values]);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  function focusStateField(key: string) {
    const input = document.getElementById(`state-field-${key}`) as HTMLInputElement | null;
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => input?.focus(), 250);
  }

  function handleSaveStateFields() {
    const nextTouched = Object.fromEntries(fields.map((field) => [field.key, true]));
    setTouched(nextTouched);
    const firstErrorKey = fields.find((field) => fieldErrors[field.key])?.key;
    if (firstErrorKey) {
      toast.error(fieldErrors[firstErrorKey]);
      focusStateField(firstErrorKey);
      return;
    }
    saveStateFields.mutate();
  }

  const saveStateFields = useMutation({
    mutationFn: () =>
      api.patch<{ data: { project: Project } }>(`/projects/${projectId}`, Object.fromEntries(
        fields.map((field) => [field.key, values[field.key]?.trim() ?? '']),
      )),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('State fields saved');
    },
    onError: () => {
      toast.error('Failed to save state fields');
    },
  });

  return (
    <div id="state-fields" className="scroll-mt-24 bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-headline text-base font-semibold text-gray-900">
            State Export Fields
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {support.name}: {support.statusLabel}. {support.launchDecision}
          </p>
        </div>
        <Link to="/state-support" className="inline-flex min-h-11 items-center text-sm font-semibold text-black hover:underline">
          View support
        </Link>
      </div>

      {fields.length === 0 ? (
        <p className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          No additional state project fields are required by the current support profile.
        </p>
      ) : (
        <div className="grid gap-3">
          {fields.map((field) => (
            <div
              key={field.key}
              className={focusField === field.key ? 'rounded border border-brand-gold bg-brand-gold/10 p-3' : ''}
            >
              <label htmlFor={`state-field-${field.key}`} className="block text-xs font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <input
                id={`state-field-${field.key}`}
                type="text"
                value={values[field.key] ?? ''}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                onBlur={() => setTouched((current) => ({ ...current, [field.key]: true }))}
                aria-invalid={Boolean(touched[field.key] && fieldErrors[field.key])}
                aria-describedby={fieldErrors[field.key] ? `state-field-${field.key}-error` : undefined}
                className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  touched[field.key] && fieldErrors[field.key]
                    ? 'border-red-300 bg-red-50 focus:ring-red-200'
                    : 'border-gray-300 focus:ring-brand-gold'
                }`}
              />
              {touched[field.key] && fieldErrors[field.key] && (
                <p id={`state-field-${field.key}-error`} className="mt-1 text-xs font-medium text-red-700">
                  {fieldErrors[field.key]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
        Next gate: {support.nextGate}
      </div>

      {fields.length > 0 && (
        <button
          type="button"
          onClick={handleSaveStateFields}
          disabled={saveStateFields.isPending}
          className="px-5 py-2 rounded font-semibold text-sm text-white bg-nav-dark hover:bg-nav-dark/90 transition-colors disabled:opacity-50"
        >
          {saveStateFields.isPending ? 'Saving...' : 'Save State Fields'}
        </button>
      )}
    </div>
  );
}

function TransferOwnershipSection({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { toast } = useToast();

  // Load team members for this project via /api/team
  const { data: teamData } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get<{ data: { members: TeamMember[]; isOwner: boolean } }>('/team'),
  });

  const members: TeamMember[] = teamData?.data?.members ?? [];
  const isOwner: boolean = teamData?.data?.isOwner ?? false;

  // Only show this section to owners
  if (!isOwner) return null;

  const eligibleMembers = members.filter((m) => m.role !== 'owner');

  const { data: mfaStatus } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: () =>
      api.get<{ data: { enabled: boolean; backupCodesRemaining: number } }>('/mfa/status'),
    staleTime: 60_000,
  });
  const mfaEnabled = mfaStatus?.data?.enabled === true;

  const [newOwnerId, setNewOwnerId] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalConfirmName, setModalConfirmName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const transferMutation = useMutation({
    mutationFn: (body: { newOwnerId: string; confirmPassword: string; totpToken?: string }) =>
      api.post<{ data: { message: string } }>(`/team/${projectId}/transfer-ownership`, body),
    onSuccess: () => {
      toast.success('Ownership transferred. You are now a member of this project.');
      setShowModal(false);
      setNewOwnerId('');
      setConfirmPassword('');
      setModalConfirmName('');
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error ?? err?.message ?? 'Transfer failed';
      setFormError(message);
      setShowModal(false);
    },
  });

  function handleOpenModal() {
    setFormError(null);
    if (!newOwnerId) {
      setFormError('Select a team member to transfer ownership to.');
      return;
    }
    if (!confirmPassword) {
      setFormError('Enter your password to confirm this action.');
      return;
    }
    if (mfaEnabled && !totpToken) {
      setFormError('Enter your authenticator code to confirm this action.');
      return;
    }
    setModalConfirmName('');
    setShowModal(true);
  }

  function handleConfirmTransfer() {
    if (modalConfirmName.trim() !== projectName.trim()) {
      setFormError('Project name does not match. Transfer cancelled.');
      setShowModal(false);
      return;
    }
    transferMutation.mutate({ newOwnerId, confirmPassword, totpToken: mfaEnabled ? totpToken : undefined });
  }

  const selectedMember = members.find((m) => m.id === newOwnerId);

  return (
    <>
      <div className="bg-white rounded-lg border border-red-200 shadow-sm p-5 space-y-4">
        <h2 className="font-headline text-base font-semibold text-gray-900">
          Transfer Ownership
        </h2>

        {/* Warning banner */}
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-800 font-medium">
            This action cannot be undone. You will permanently lose owner privileges for this project.
          </p>
        </div>

        <p className="text-sm text-gray-600">
          Transfer ownership to a current project member. After transfer, you will become a regular member.
        </p>

        {/* Member select */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Transfer ownership to
          </label>
          {eligibleMembers.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No eligible team members. Invite someone first.
            </p>
          ) : (
            <select
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <option value="">Select a member...</option>
              {eligibleMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.email} ({m.role})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Password confirmation */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Confirm your password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Your current password"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        {/* TOTP input — only shown when caller has MFA enabled */}
        {mfaEnabled && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Authenticator code
            </label>
            <input
              id="totpToken"
              name="totpToken"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totpToken}
              onChange={(e) => setTotpToken(e.target.value)}
              placeholder="6-digit code"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        )}

        {formError && (
          <p className="text-sm text-red-600">{formError}</p>
        )}

        <button
          onClick={handleOpenModal}
          disabled={eligibleMembers.length === 0 || transferMutation.isPending}
          className="px-5 py-2 rounded font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          Transfer Ownership
        </button>
      </div>

      {/* Confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4">
            <h3 className="font-headline text-lg font-bold text-gray-900">
              Confirm Ownership Transfer
            </h3>
            <p className="text-sm text-gray-600">
              You are transferring ownership of <strong>{projectName}</strong> to{' '}
              <strong>{selectedMember?.email}</strong>.
            </p>
            <p className="text-sm text-gray-600">
              Type the project name to confirm:
            </p>
            <p className="font-mono text-sm bg-gray-100 rounded px-3 py-2 text-gray-800">
              {projectName}
            </p>
            <input
              type="text"
              value={modalConfirmName}
              onChange={(e) => setModalConfirmName(e.target.value)}
              placeholder="Type project name here"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              autoFocus
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 rounded font-semibold text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                disabled={transferMutation.isPending || modalConfirmName.trim() !== projectName.trim()}
                className="flex-1 px-4 py-2 rounded font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {transferMutation.isPending ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const focusField = new URLSearchParams(location.search).get('field');

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<{ data: { project: Project } }>(`/projects/${projectId}`),
    enabled: !!projectId,
  });

  const { data: subcontractorsData } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: () => api.get<{ data: { subcontractors: SubcontractorSummary[] } }>(`/projects/${projectId}/subcontractors`),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const project = projectData?.data?.project;
  const onboardingSetup = parseProjectOnboardingSetup(project?.projectSettings);
  const completedPromptKeys = new Set(onboardingSetup?.completedPromptKeys ?? []);
  const hasSubcontractorSetup = (subcontractorsData?.data?.subcontractors?.length ?? 0) > 0;
  const hasApprenticeshipRatioSetup = hasApprenticeshipSetup(project?.apprenticeshipRequirements);
  const fieldProofApplied = Boolean(project?.gpsClockInEnabled || completedPromptKeys.has('field-proof'));
  const hasRecommendedSetup =
    Boolean(onboardingSetup?.fieldTrackingNeeded || onboardingSetup?.usesSubcontractors || onboardingSetup?.usesApprentices);
  const allRecommendedSetupApplied =
    (!onboardingSetup?.fieldTrackingNeeded || fieldProofApplied) &&
    (!onboardingSetup?.usesSubcontractors || hasSubcontractorSetup) &&
    (!onboardingSetup?.usesApprentices || hasApprenticeshipRatioSetup);

  // Local form state — synced from project on load
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [jobsiteAddress, setJobsiteAddress] = useState('');
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [formError, setFormError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);

  useEffect(() => {
    if (!project) return;
    const settings = parseStoredProjectSettings(project.projectSettings);
    setGpsEnabled(project.gpsClockInEnabled ?? false);
    setJobsiteAddress(settings.gpsJobsiteAddress ?? '');
    setLatStr(project.gpsLatitude != null ? String(project.gpsLatitude) : '');
    setLngStr(project.gpsLongitude != null ? String(project.gpsLongitude) : '');
    setRadiusMeters(project.gpsRadiusMeters ?? 500);
  }, [project]);

  const saveMutation = useMutation({
    mutationFn: (body: {
      gpsClockInEnabled: boolean;
      gpsLatitude?: number | null;
      gpsLongitude?: number | null;
      gpsRadiusMeters?: number;
      projectSettings?: string;
    }) => api.patch<{ data: { project: Project } }>(`/projects/${projectId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('GPS settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  function useCurrentJobsiteLocation() {
    setFormError(null);
    setLocationStatus(null);

    if (!navigator.geolocation) {
      setFormError('This device does not support current-location capture.');
      return;
    }

    setLocationBusy(true);
    setLocationStatus('Asking this device for its current location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatStr(String(position.coords.latitude));
        setLngStr(String(position.coords.longitude));
        setLocationStatus(`Current location saved for jobsite center. Accuracy: about ${Math.round(position.coords.accuracy)}m.`);
        setLocationBusy(false);
      },
      (error) => {
        setLocationBusy(false);
        if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
          setFormError('Location permission was denied. Allow location access or use the address lookup.');
        } else {
          setFormError('Could not get current location. Try again outside or use the address lookup.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async function findJobsiteFromAddress() {
    setFormError(null);
    setLocationStatus(null);

    const address = jobsiteAddress.trim();
    if (!address) {
      setFormError('Enter a jobsite address first.');
      return;
    }

    setLocationBusy(true);
    setLocationStatus('Looking up the jobsite address...');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
      const rows = await res.json() as Array<{ lat: string; lon: string; display_name?: string }>;
      const match = rows[0];
      if (!match) {
        setFormError('No location was found for that address. Try a more complete street address.');
        setLocationStatus(null);
        return;
      }

      setLatStr(match.lat);
      setLngStr(match.lon);
      setLocationStatus(match.display_name ? `Location found: ${match.display_name}` : 'Location found and saved for the jobsite center.');
    } catch {
      setFormError('Address lookup failed. Use current location or paste coordinates in Advanced.');
      setLocationStatus(null);
    } finally {
      setLocationBusy(false);
    }
  }

  const applyRecommendedMutation = useMutation({
    mutationFn: () => {
      const now = new Date().toISOString();
      const completedPromptKeys = new Set(onboardingSetup?.completedPromptKeys ?? []);

      if (onboardingSetup?.fieldTrackingNeeded) completedPromptKeys.add('field-proof');

      const nextSetup: ProjectOnboardingSetup = {
        ...(onboardingSetup ?? {}),
        completedPromptKeys: Array.from(completedPromptKeys),
        lastAppliedAt: now,
      };

      return api.patch<{ data: { project: Project } }>(`/projects/${projectId}`, {
        ...(onboardingSetup?.fieldTrackingNeeded && {
          gpsClockInEnabled: true,
          gpsRadiusMeters: project?.gpsRadiusMeters ?? 500,
        }),
        projectSettings: buildUpdatedProjectSettings(project?.projectSettings, nextSetup),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      if (onboardingSetup?.fieldTrackingNeeded) {
        setGpsEnabled(true);
        setRadiusMeters(project?.gpsRadiusMeters ?? 500);
      }
      toast.success(onboardingSetup?.fieldTrackingNeeded ? 'Field proof settings applied' : 'Setup recommendations refreshed');
    },
    onError: () => {
      toast.error('Failed to apply recommended setup');
    },
  });

  function handleSave() {
    setFormError(null);

    if (gpsEnabled) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (latStr && (isNaN(lat) || lat < -90 || lat > 90)) {
        setFormError('Latitude must be between -90 and 90.');
        return;
      }
      if (lngStr && (isNaN(lng) || lng < -180 || lng > 180)) {
        setFormError('Longitude must be between -180 and 180.');
        return;
      }
      const nextProjectSettings = parseStoredProjectSettings(project?.projectSettings);
      nextProjectSettings.gpsJobsiteAddress = jobsiteAddress.trim() || undefined;
      if (onboardingSetup?.fieldTrackingNeeded) {
        nextProjectSettings.onboardingSetup = {
          ...onboardingSetup,
          completedPromptKeys: Array.from(new Set([...(onboardingSetup.completedPromptKeys ?? []), 'field-proof'])),
          lastAppliedAt: new Date().toISOString(),
        };
      }

      saveMutation.mutate({
        gpsClockInEnabled: true,
        gpsLatitude: latStr ? lat : null,
        gpsLongitude: lngStr ? lng : null,
        gpsRadiusMeters: radiusMeters,
        projectSettings: JSON.stringify(nextProjectSettings),
      });
    } else {
      saveMutation.mutate({ gpsClockInEnabled: false });
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-64">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <p className="text-center text-gray-500 mt-8">Project not found.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-gray-600 transition-colors hover:text-brand-gold"
          >
            &larr; Back to project
          </Link>
          <h1 className="font-headline text-xl font-bold text-nav-dark mt-1">
            Project Setup
          </h1>
          <p className="text-sm text-gray-500">{project.name}</p>
        </div>

        {onboardingSetup && (
          <div className="bg-brand-gold/10 rounded-lg border border-brand-gold/40 shadow-sm p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-headline text-base font-semibold text-gray-900">
                  Onboarding-Based Setup
                </h2>
                <p className="mt-1 text-sm text-gray-700">
                  This project inherited your contractor profile: {providerName(onboardingSetup.payrollProvider)} payroll,
                  {' '}{providerName(onboardingSetup.projectManagementProvider)} project system,
                  {' '}{onboardingSetup.averageWeeklyWorkers ?? 0} average weekly workers.
                </p>
              </div>
              <Link to="/onboarding" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-sm font-semibold text-black hover:underline">
                Edit
              </Link>
            </div>
            <div className="grid gap-2 text-sm">
              {onboardingSetup.fieldTrackingNeeded && (
                <div className="rounded border border-white/70 bg-white px-3 py-2 text-gray-700">
                  {fieldProofApplied
                    ? 'Field proof applied. GPS clock-in is enabled for this project.'
                    : 'Field proof is recommended. Enable GPS clock-in below and use project photos for audit evidence.'}
                </div>
              )}
              {onboardingSetup.usesSubcontractors && (
                <div className="rounded border border-white/70 bg-white px-3 py-2 text-gray-700">
                  {hasSubcontractorSetup
                    ? 'Subcontractor CPR tracking is active. At least one subcontractor exists on this project.'
                    : 'Subcontractor CPR tracking should be active for this project.'}
                </div>
              )}
              {onboardingSetup.usesApprentices && (
                <div className="rounded border border-white/70 bg-white px-3 py-2 text-gray-700">
                  {hasApprenticeshipRatioSetup
                    ? 'Apprenticeship ratio setup is active for this project.'
                    : 'Apprenticeship ratios should be reviewed before the first certified payroll.'}
                </div>
              )}
            </div>
            {hasRecommendedSetup && (
              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-600">
                  {allRecommendedSetupApplied
                    ? 'Recommended setup has been applied for this project.'
                    : fieldProofApplied
                    ? 'Field proof is applied. Subcontractor and apprenticeship prompts complete automatically when those records exist.'
                    : 'Apply will enable field proof defaults. Subcontractor and apprenticeship prompts complete automatically when those records exist.'}
                </p>
                <button
                  type="button"
                  onClick={() => applyRecommendedMutation.mutate()}
                  disabled={applyRecommendedMutation.isPending || allRecommendedSetupApplied || !onboardingSetup.fieldTrackingNeeded || fieldProofApplied}
                  className="inline-flex min-h-11 items-center justify-center rounded bg-black px-4 text-sm font-semibold text-white hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {applyRecommendedMutation.isPending
                    ? 'Applying...'
                    : allRecommendedSetupApplied
                      ? 'Applied'
                      : fieldProofApplied
                        ? 'Field proof applied'
                      : onboardingSetup.fieldTrackingNeeded
                        ? 'Apply field proof settings'
                        : 'Complete records to apply'}
                </button>
              </div>
            )}
          </div>
        )}

        <ProjectFactsSection project={project} projectId={projectId!} focusField={focusField} />

        <StateProjectFieldsSection project={project} projectId={projectId!} focusField={focusField} />

        {/* GPS Settings Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="font-headline text-base font-semibold text-gray-900">
            GPS Clock-In
          </h2>

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Enable GPS clock-in for this project
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Workers will be prompted for location when clocking in or out.
              </p>
            </div>
            <button
              role="switch"
              aria-label="Enable GPS clock-in for this project"
              aria-checked={gpsEnabled}
              onClick={() => setGpsEnabled((v) => !v)}
              className={`relative inline-flex h-11 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-1 ${
                gpsEnabled ? 'bg-nav-dark' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform ${
                  gpsEnabled ? 'translate-x-8' : 'translate-x-1.5'
                }`}
              />
            </button>
          </div>

          {/* CA AB 1355 notice */}
          {gpsEnabled && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs text-blue-800">
                <strong>CA AB 1355 Notice:</strong> Location is collected only for job site
                verification and is not used for continuous tracking. Workers will see this
                disclosure before clocking in.
              </p>
            </div>
          )}

          {/* Jobsite location section */}
          {gpsEnabled && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-gray-600">
                Set the jobsite center with a normal address or the current device location. The system saves
                the GPS coordinates in the background for on-site checks.
              </p>

              <div>
                <label htmlFor="jobsite-address" className="block text-xs font-medium text-gray-700 mb-1">
                  Jobsite address
                </label>
                <input
                  id="jobsite-address"
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  placeholder="123 Main St, Los Angeles, CA"
                  value={jobsiteAddress}
                  onChange={(e) => setJobsiteAddress(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={findJobsiteFromAddress}
                    disabled={locationBusy}
                    className="inline-flex min-h-11 items-center justify-center rounded-sm border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Find location from address
                  </button>
                  <button
                    type="button"
                    onClick={useCurrentJobsiteLocation}
                    disabled={locationBusy}
                    className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-gold bg-brand-gold/10 px-3 py-2 text-sm font-semibold text-black hover:bg-brand-gold/20 disabled:opacity-50"
                  >
                    Use my current location
                  </button>
                </div>
                {locationStatus && (
                  <p className="mt-2 text-xs text-emerald-700">{locationStatus}</p>
                )}
                {latStr && lngStr && (
                  <p className="mt-2 text-xs text-gray-500">
                    Jobsite geofence is set. Workers outside the selected radius will see a warning.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Jobsite radius
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RADIUS_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setRadiusMeters(preset.meters)}
                      className={`inline-flex min-h-11 items-center justify-center rounded-sm border px-3 py-2 text-sm font-semibold transition-colors ${
                        radiusMeters === preset.meters
                          ? 'border-brand-gold bg-brand-gold/15 text-black'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Current radius: <span className="font-semibold">{metersToFeet(radiusMeters)} ft</span>.
                  Workers are warned, not blocked, when outside the radius.
                </p>
              </div>

              <details className="rounded border border-gray-200 bg-gray-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                  Advanced: GPS coordinates
                </summary>
                <p className="mt-2 text-xs text-gray-500">
                  Use this only when a jobsite has no reliable street address or you already have a map pin.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="jobsite-latitude" className="block text-xs font-medium text-gray-700 mb-1">
                    Latitude
                  </label>
                  <input
                    id="jobsite-latitude"
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    placeholder="e.g. 34.0522"
                    value={latStr}
                    onChange={(e) => setLatStr(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="jobsite-longitude" className="block text-xs font-medium text-gray-700 mb-1">
                    Longitude
                  </label>
                  <input
                    id="jobsite-longitude"
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    placeholder="e.g. -118.2437"
                    value={lngStr}
                    onChange={(e) => setLngStr(e.target.value)}
                  />
                </div>
              </div>
              </details>

              <div>
                <label htmlFor="gps-radius-slider" className="block text-xs font-medium text-gray-700 mb-2">
                  Custom geofence radius: <span className="font-semibold">{radiusMeters}m</span>
                  <span className="text-gray-400 ml-1">({metersToFeet(radiusMeters)}ft)</span>
                </label>
                <input
                  id="gps-radius-slider"
                  aria-label="Custom geofence radius"
                  type="range"
                  min="50"
                  max="2000"
                  step="50"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="min-h-11 w-full accent-brand-gold"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>50m</span>
                  <span>2,000m</span>
                </div>
              </div>
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-5 py-2 rounded font-semibold text-sm text-white bg-nav-dark hover:bg-nav-dark/90 transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Phase 86: Compliance Report Schedule */}
        <ReportScheduleSection projectId={projectId!} projectSettings={project.projectSettings} />

        {/* Field clock link */}
        <div className="text-center">
          <Link
            to={`/projects/${projectId}/field`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-black hover:underline"
          >
            Open Field Clock for this project
          </Link>
        </div>

        {/* Transfer Ownership — owners only */}
        <TransferOwnershipSection projectId={projectId!} projectName={project.name} />
      </div>
    </Layout>
  );
}
