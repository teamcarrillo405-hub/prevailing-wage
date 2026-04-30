// Phase 75 — Project Settings Page — GPS clock-in configuration (MOB-09)
// Phase 83 — Transfer Ownership section added
// Route: /projects/:projectId/settings
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';

interface Project {
  id: string;
  name: string;
  gpsClockInEnabled: boolean;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsRadiusMeters: number | null;
  projectSettings: string | null;
}

interface TeamMember {
  id: string;
  email: string;
  role: string;
  joinedAt: string;
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
          className="px-5 py-2 rounded font-semibold text-sm text-white bg-brand-navy hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Report Schedule'}
        </button>
      </div>
    </div>
  );
}

// ── Transfer Ownership section ─────────────────────────────────────────────
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<{ data: { project: Project } }>(`/projects/${projectId}`),
    enabled: !!projectId,
  });

  const project = projectData?.data?.project;

  // Local form state — synced from project on load
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setGpsEnabled(project.gpsClockInEnabled ?? false);
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
    }) => api.patch<{ data: { project: Project } }>(`/projects/${projectId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('GPS settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
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
      saveMutation.mutate({
        gpsClockInEnabled: true,
        gpsLatitude: latStr ? lat : null,
        gpsLongitude: lngStr ? lng : null,
        gpsRadiusMeters: radiusMeters,
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
            className="text-xs text-gray-500 hover:text-brand-gold transition-colors"
          >
            &larr; Back to project
          </Link>
          <h1 className="font-headline text-xl font-bold text-brand-navy mt-1">
            Project Settings
          </h1>
          <p className="text-sm text-gray-500">{project.name}</p>
        </div>

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
              aria-checked={gpsEnabled}
              onClick={() => setGpsEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-1 ${
                gpsEnabled ? 'bg-brand-navy' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  gpsEnabled ? 'translate-x-6' : 'translate-x-1'
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

          {/* GPS coordinates section */}
          {gpsEnabled && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-gray-600">
                Set the job site center coordinates to check if workers are on-site. Leave blank
                to skip distance checking (location will still be recorded).
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Latitude
                  </label>
                  <input
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Longitude
                  </label>
                  <input
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

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Geofence Radius: <span className="font-semibold">{radiusMeters}m</span>
                  <span className="text-gray-400 ml-1">({Math.round(radiusMeters * 3.281)}ft)</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="2000"
                  step="50"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="w-full accent-brand-gold"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>50m</span>
                  <span>2,000m</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Workers outside this radius will see a warning but are not blocked from clocking in.
                </p>
              </div>
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-5 py-2 rounded font-semibold text-sm text-white bg-brand-navy hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
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
            className="text-sm text-brand-gold hover:underline"
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
