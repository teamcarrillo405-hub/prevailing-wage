import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';

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
    <main className="min-h-[100dvh] bg-[#f6f4ef] px-5 py-5 text-gray-950">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-sm border border-gray-200 bg-white shadow-sm lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1fr)]">
          <div className="bg-gray-950 p-6 text-white sm:p-8">
            <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to public site
            </Link>
            <div className="mt-12">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-sm bg-brand-gold text-black">
                <MailCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-5 font-headline text-4xl font-bold leading-tight">
                Join your company workspace.
              </h1>
              <p className="mt-4 text-sm leading-6 text-white/70">
                Accept the invite, create your password, and continue into the project dashboard tied to your organization.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <h2 className="font-headline text-3xl font-bold text-gray-950">Accept invite</h2>
        {tokenState === 'valid' && inviteData && (
          <p className="mt-2 text-sm text-gray-600">
            You have been invited by {inviteData.inviterEmail}
          </p>
        )}
            <div className="mt-6">
          {tokenState === 'loading' && (
            <div className="rounded-sm border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">Checking invite link...</div>
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
            <div role="alert" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Could not verify invite link. Check your connection and try again.
            </div>
          )}
          {tokenState === 'valid' && inviteData && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="accept-email"
                type="email"
                label="Email address"
                value={inviteData.email}
                disabled
                aria-readonly="true"
                help="This is the email address the invite was sent to."
              />
              <PasswordInput
                id="accept-password"
                label="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                help="Use at least 8 characters."
              />
              {submitError && (
                <div role="alert" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
