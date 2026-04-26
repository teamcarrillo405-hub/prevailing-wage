import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

interface MfaStatus {
  data: { enabled: boolean; backupCodesRemaining: number };
}

interface SetupResponse {
  data: { qrUri: string; secret: string; backupCodes: string[] };
}

interface RegenResponse {
  data: { backupCodes: string[] };
}

/**
 * Phase 78 — MFA settings page (SOC 2 SEC-01..03).
 * Renders enrollment, verification, backup-code regeneration, and disable.
 */
export function MfaSetupPage() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery<MfaStatus>({
    queryKey: ['mfa-status'],
    queryFn: () => api.get<MfaStatus>('/mfa/status'),
  });

  // Local state for the enrollment flow.
  const [setup, setSetup] = useState<SetupResponse['data'] | null>(null);
  const [verifyToken, setVerifyToken] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);
  const [regenToken, setRegenToken] = useState('');
  const [regenCodes, setRegenCodes] = useState<string[] | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  const startSetup = useMutation({
    mutationFn: () => api.post<SetupResponse>('/mfa/setup', {}),
    onSuccess: (res) => { setSetup(res.data); setSetupError(null); },
    onError: (err: Error) => setSetupError(err.message),
  });

  const verifySetup = useMutation({
    mutationFn: () =>
      api.post<{ data: { enabled: boolean } }>('/mfa/verify-setup', { token: verifyToken }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
      // Keep `setup` in scope so the user can still see/download backup codes.
      setVerifyToken('');
      setSetupError(null);
    },
    onError: (err: Error) => setSetupError(err.message),
  });

  // Disable uses DELETE with a JSON body. Our api helper's delete() does
  // not accept a body, so we fall back to fetch directly to keep the api
  // surface narrow.
  const [disabling, setDisabling] = useState(false);
  async function handleDisable() {
    setDisableError(null);
    if (!disablePassword) { setDisableError('Enter your current password'); return; }
    setDisabling(true);
    try {
      const res = await fetch('/api/mfa/disable', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      setDisablePassword('');
      setSetup(null);
      void queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
    } catch (err) {
      setDisableError(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setDisabling(false);
    }
  }

  const regenerate = useMutation({
    mutationFn: () =>
      api.post<RegenResponse>('/mfa/regenerate-backup-codes', { token: regenToken }),
    onSuccess: (res) => {
      setRegenCodes(res.data.backupCodes);
      setRegenToken('');
      setRegenError(null);
      void queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
    },
    onError: (err: Error) => setRegenError(err.message),
  });

  function downloadBackupCodes(codes: string[]) {
    const csv = ['code', ...codes].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mfa-backup-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const enabled = status?.data.enabled === true;
  // Note: we intentionally do NOT call out to a third-party QR rendering
  // service — that would violate our CSP imgSrc 'self' policy and also
  // leaks the (about-to-be-secret) otpauth URI to a third party. Users
  // either (a) copy the otpauth:// link into their authenticator app or
  // (b) type in the manual entry secret. Both are universally supported.

  return (
    <Layout>
      <PageHeader
        title="Two-factor authentication"
        subtitle="Add a second login factor using an authenticator app such as 1Password, Authy, or Google Authenticator."
      />

      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Status</h2>
              <p className="text-sm text-gray-600 mt-1">
                Two-factor authentication adds a second step at sign-in to protect your account.
              </p>
            </div>
            {isLoading ? null : enabled ? (
              <Badge variant="compliant">Enabled</Badge>
            ) : (
              <Badge variant="neutral">Disabled</Badge>
            )}
          </div>

          {!isLoading && enabled && (
            <p className="text-xs text-gray-500">
              Backup codes remaining: {status?.data.backupCodesRemaining ?? 0}
            </p>
          )}
        </div>

        {!enabled && !setup && (
          <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Enable MFA</h3>
            <p className="text-sm text-gray-600 mb-4">
              Generate a TOTP secret and one-time backup codes. You will scan a QR code with
              your authenticator app and confirm a 6-digit code.
            </p>
            <Button onClick={() => startSetup.mutate()} disabled={startSetup.isPending}>
              {startSetup.isPending ? 'Generating…' : 'Begin enrollment'}
            </Button>
            {setupError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-sm px-3 py-2 text-sm text-red-700">
                {setupError}
              </div>
            )}
          </div>
        )}

        {setup && (
          <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Step 1 — Add the secret to your authenticator</h3>
              <p className="text-sm text-gray-600 mt-1">
                Open your authenticator app (1Password, Authy, Google Authenticator, etc.) and
                either tap the otpauth link below or paste the manual entry secret.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Manual entry secret</p>
                <code className="block bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-mono break-all select-all">
                  {setup.secret}
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">otpauth:// link</p>
                <a
                  href={setup.qrUri}
                  className="block bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono break-all text-blue-700 underline select-all"
                >
                  {setup.qrUri}
                </a>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-5">
              <h3 className="text-base font-semibold text-gray-900">Step 2 — Save your backup codes</h3>
              <p className="text-sm text-gray-600 mt-1 mb-3">
                Store these codes somewhere safe. Each code can be used once if you lose access to
                your authenticator app.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                {setup.backupCodes.map((code) => (
                  <code key={code} className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center">
                    {code}
                  </code>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={() => downloadBackupCodes(setup.backupCodes)}>
                Download as CSV
              </Button>
            </div>

            {!enabled && (
              <div className="border-t border-gray-200 pt-5">
                <h3 className="text-base font-semibold text-gray-900">Step 3 — Confirm a code</h3>
                <p className="text-sm text-gray-600 mt-1 mb-3">
                  Enter the 6-digit code from your authenticator app to finish enrollment.
                </p>
                <div className="flex items-end gap-3">
                  <Input
                    id="mfa-verify-token"
                    label="Verification code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    fieldClassName="flex-1"
                  />
                  <Button onClick={() => verifySetup.mutate()} disabled={verifySetup.isPending || verifyToken.length < 6}>
                    {verifySetup.isPending ? 'Verifying…' : 'Confirm'}
                  </Button>
                </div>
                {setupError && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-sm px-3 py-2 text-sm text-red-700">
                    {setupError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {enabled && (
          <>
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Regenerate backup codes</h3>
              <p className="text-sm text-gray-600 mb-3">
                Issuing new backup codes invalidates any previously generated codes. You'll need to
                confirm a current TOTP code first.
              </p>
              <div className="flex items-end gap-3">
                <Input
                  id="mfa-regen-token"
                  label="Current 6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={regenToken}
                  onChange={(e) => setRegenToken(e.target.value)}
                  fieldClassName="flex-1"
                />
                <Button onClick={() => regenerate.mutate()} disabled={regenerate.isPending || regenToken.length < 6}>
                  {regenerate.isPending ? 'Generating…' : 'Regenerate'}
                </Button>
              </div>
              {regenError && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-sm px-3 py-2 text-sm text-red-700">
                  {regenError}
                </div>
              )}
              {regenCodes && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    Save these new codes — they replace your previous backup codes:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                    {regenCodes.map((code) => (
                      <code key={code} className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center">
                        {code}
                      </code>
                    ))}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => downloadBackupCodes(regenCodes)}>
                    Download as CSV
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-red-200 shadow-sm bg-white p-6">
              <h3 className="text-base font-semibold text-red-700 mb-2">Disable MFA</h3>
              <p className="text-sm text-gray-600 mb-3">
                Removing MFA reduces account security. Confirm with your current password.
              </p>
              <div className="flex items-end gap-3">
                <Input
                  id="mfa-disable-password"
                  type="password"
                  label="Current password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  fieldClassName="flex-1"
                />
                <Button variant="secondary" onClick={handleDisable} disabled={disabling}>
                  {disabling ? 'Disabling…' : 'Disable MFA'}
                </Button>
              </div>
              {disableError && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-sm px-3 py-2 text-sm text-red-700">
                  {disableError}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
