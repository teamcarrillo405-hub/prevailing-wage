import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../hooks/useAuth';

/**
 * Phase 82 (Gap-2) — SOC 2 user-facing security dashboard.
 *
 * Surfaces:
 *  - MFA enrollment status (links to /settings/mfa)
 *  - Active session count (last 30d distinct IP+UA)
 *  - Last 20 security events (login_success, mfa_*, sessions_revoked, ...)
 *  - Last 10 login attempts (success/fail) for the operator's email
 *  - "Revoke all sessions" — bumps users.sessionVersion, invalidates every JWT
 *  - "Download access log" — CSV/JSON export for the user's own evidence file
 */

interface SecurityOverview {
  data: {
    user: {
      id: string;
      email: string;
      mfaEnabled: boolean;
      sessionVersion: number;
      memberSince: string;
    };
    activeSessionCount: number;
    events: Array<{
      id: string;
      eventType: string;
      ipAddress: string | null;
      userAgent: string | null;
      metadata: string | null;
      createdAt: string;
    }>;
    loginAttempts: Array<{
      id: string;
      success: boolean;
      ipAddress: string | null;
      failureReason: string | null;
      createdAt: string;
    }>;
  };
}

const EVENT_LABELS: Record<string, string> = {
  login_success: 'Sign-in succeeded',
  login_failure: 'Sign-in failed',
  login_password_ok_mfa_required: 'Password OK, MFA required',
  logout: 'Signed out',
  register: 'Account created',
  mfa_setup_started: 'MFA setup started',
  mfa_enabled: 'MFA enabled',
  mfa_disabled: 'MFA disabled',
  mfa_disable_failure: 'MFA disable attempt failed',
  mfa_verify_success: 'MFA verified',
  mfa_verify_failure: 'MFA verification failed',
  mfa_login_failure: 'MFA login failed',
  mfa_setup_verify_failure: 'MFA setup verify failed',
  mfa_backup_codes_regenerated: 'Backup codes regenerated',
  mfa_regen_backup_failure: 'Backup code regeneration failed',
  invite_accepted: 'Team invite accepted',
  sessions_revoked: 'All sessions revoked',
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function eventBadgeVariant(eventType: string): 'compliant' | 'warning' | 'violation' | 'neutral' {
  if (eventType.endsWith('_failure') || eventType === 'sessions_revoked') return 'violation';
  if (eventType.includes('mfa_disable') || eventType.includes('mfa_disabled')) return 'warning';
  if (eventType.includes('success') || eventType === 'mfa_enabled' || eventType === 'login_success') return 'compliant';
  return 'neutral';
}

export function SecurityDashboardPage() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const { data, isLoading, error } = useQuery<SecurityOverview>({
    queryKey: ['security-overview'],
    queryFn: () => api.get<SecurityOverview>('/security/overview'),
  });

  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const revokeMutation = useMutation({
    mutationFn: () => api.post<{ data: { revoked: boolean; newSessionVersion: number } }>('/security/revoke-sessions', {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['security-overview'] });
      // The current cookie was cleared server-side; force a sign-out flow
      // so the user gets a clean re-login.
      await logout();
      window.location.assign('/login');
    },
    onError: (err: Error) => setRevokeError(err.message),
  });

  function downloadAccessLog(format: 'csv' | 'json') {
    // Use a direct anchor click so the browser handles content-disposition
    const url = `/api/audit/export-security-events?format=${format}&days=90`;
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (isLoading) {
    return (
      <Layout>
        <PageHeader title="Security" subtitle="Account security overview" />
        <p className="text-sm text-gray-500">Loading...</p>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <PageHeader title="Security" subtitle="Account security overview" />
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
          Could not load security overview. {error instanceof Error ? error.message : ''}
        </div>
      </Layout>
    );
  }

  const { user, activeSessionCount, events, loginAttempts } = data.data;

  return (
    <Layout>
      <PageHeader
        title="Security"
        subtitle="Review your access history, manage sessions, and download SOC 2 evidence."
      />

      <div className="max-w-4xl space-y-6">
        {/* MFA + Session summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Two-factor</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {user.mfaEnabled ? 'On' : 'Off'}
                </p>
              </div>
              {user.mfaEnabled
                ? <Badge variant="compliant">Enabled</Badge>
                : <Badge variant="warning">Disabled</Badge>}
            </div>
            <Link to="/settings/mfa" className="mt-3 inline-block text-xs text-brand-gold hover:underline">
              {user.mfaEnabled ? 'Manage MFA settings' : 'Set up two-factor'}
            </Link>
          </div>

          <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active sessions</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{activeSessionCount}</p>
            <p className="mt-1 text-xs text-gray-500">
              Distinct browsers / IPs in the last 30 days.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Session version</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{user.sessionVersion}</p>
            <p className="mt-1 text-xs text-gray-500">
              Bumps when you revoke all sessions.
            </p>
          </div>
        </div>

        {/* Revoke sessions card */}
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Revoke all sessions</h3>
              <p className="text-sm text-gray-600 mt-1">
                Immediately invalidates every signed-in session, including this browser. Use this if a
                device was lost or you suspect your password was compromised.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => { setRevokeError(null); setRevokeConfirmOpen(true); }}
            >
              Revoke
            </Button>
          </div>
          {revokeConfirmOpen && (
            <div className="mt-4 border border-red-200 bg-red-50 rounded-md p-3">
              <p className="text-sm text-red-800 font-medium">
                Confirm: sign out of every device, including this one?
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="secondary"
                  onClick={() => setRevokeConfirmOpen(false)}
                  disabled={revokeMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => revokeMutation.mutate()}
                  disabled={revokeMutation.isPending}
                >
                  {revokeMutation.isPending ? 'Revoking...' : 'Yes, revoke everywhere'}
                </Button>
              </div>
              {revokeError && (
                <p className="mt-2 text-xs text-red-700">{revokeError}</p>
              )}
            </div>
          )}
        </div>

        {/* Access log export */}
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
          <h3 className="text-base font-semibold text-gray-900">Access log export</h3>
          <p className="text-sm text-gray-600 mt-1 mb-3">
            Download your last 90 days of security events. SOC 2 auditors accept these CSV exports
            as evidence of user-side access monitoring.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => downloadAccessLog('csv')}>
              Download CSV
            </Button>
            <Button variant="secondary" onClick={() => downloadAccessLog('json')}>
              Download JSON
            </Button>
          </div>
        </div>

        {/* Recent security events */}
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Recent security events</h3>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">No events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                    <th className="py-2 pr-4 font-medium">When</th>
                    <th className="py-2 pr-4 font-medium">Event</th>
                    <th className="py-2 pr-4 font-medium">IP</th>
                    <th className="py-2 pr-4 font-medium">Browser</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{formatTimestamp(e.createdAt)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={eventBadgeVariant(e.eventType)}>
                          {EVENT_LABELS[e.eventType] ?? e.eventType}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-gray-600 font-mono text-xs">{e.ipAddress ?? '\u2014'}</td>
                      <td className="py-2 pr-4 text-gray-600">{e.userAgent ?? '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent login attempts */}
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Recent login attempts</h3>
          {loginAttempts.length === 0 ? (
            <p className="text-sm text-gray-500">No login attempts on file.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                    <th className="py-2 pr-4 font-medium">When</th>
                    <th className="py-2 pr-4 font-medium">Result</th>
                    <th className="py-2 pr-4 font-medium">IP</th>
                    <th className="py-2 pr-4 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {loginAttempts.map(a => (
                    <tr key={a.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{formatTimestamp(a.createdAt)}</td>
                      <td className="py-2 pr-4">
                        {a.success
                          ? <Badge variant="compliant">Success</Badge>
                          : <Badge variant="violation">Failed</Badge>}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 font-mono text-xs">{a.ipAddress ?? '\u2014'}</td>
                      <td className="py-2 pr-4 text-gray-600">{a.failureReason ?? '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
