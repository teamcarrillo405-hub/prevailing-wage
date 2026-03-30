import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

type TokenState = 'loading' | 'valid' | 'expired' | 'invalid' | 'error';

interface InviteData {
  email: string;
  inviterEmail: string;
}

export function AcceptInvitePage() {
  const [tokenState, setTokenState] = useState<TokenState>('loading');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setTokenState('invalid');
      return;
    }
    fetch(`/api/team/invite/${token}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 200) {
          const body = await res.json();
          setInviteData(body.data);
          setTokenState('valid');
        } else if (res.status === 410) {
          setTokenState('expired');
        } else {
          setTokenState('invalid');
        }
      })
      .catch(() => setTokenState('error'));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token')!;
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Could not create account');
      }
      window.location.href = '/dashboard';
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-page flex flex-col items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <h1 className="font-headline text-2xl text-center mb-2">Join HCC Prevailing Wage</h1>
        {tokenState === 'valid' && inviteData && (
          <p className="text-sm text-gray-500 text-center mb-6">
            You have been invited by {inviteData.inviterEmail}
          </p>
        )}
        <Card padding="default">
          {tokenState === 'loading' && (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          )}
          {tokenState === 'invalid' && (
            <EmptyState
              heading="Invite Not Found"
              message="This link is not valid. Contact the person who invited you."
            />
          )}
          {tokenState === 'expired' && (
            <EmptyState
              heading="Link Expired"
              message="This invite link has expired or has already been used. Ask the account owner to send a new invite."
            />
          )}
          {tokenState === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
              Could not verify invite link. Check your connection and try again.
            </div>
          )}
          {tokenState === 'valid' && inviteData && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="accept-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email address
                </label>
                <input
                  id="accept-email"
                  type="email"
                  value={inviteData.email}
                  disabled
                  aria-readonly="true"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">
                  This is the email address the invite was sent to.
                </p>
              </div>
              <div>
                <label
                  htmlFor="accept-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Create a password
                </label>
                <input
                  id="accept-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-brand-gold focus:outline-none"
                />
              </div>
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}
              <Button
                variant="primary"
                type="submit"
                className="w-full"
                disabled={isSubmitting || password.length < 8}
              >
                {isSubmitting ? 'Joining...' : 'Create Account & Join'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
