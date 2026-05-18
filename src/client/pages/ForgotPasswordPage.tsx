import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      // Always show success — never reveal whether email exists
      setSubmitted(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#f6f4ef] text-gray-950">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 py-8">
        <div className="w-full">
          <Link
            to="/login"
            className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-950"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>

          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
              HCC Prevailing Wage
            </p>
            <h1 className="mt-3 font-headline text-4xl font-bold text-gray-950">
              Reset password
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Enter your account email and we'll send you a reset link.
            </p>
          </div>

          <div className="rounded-sm border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                  <Mail className="h-6 w-6 text-green-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Check your inbox</p>
                  <p className="mt-1 text-sm text-gray-600">
                    If that email exists, a reset link has been sent.
                  </p>
                </div>
                <Link
                  to="/login"
                  className="mt-2 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-brand-gold hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  label="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />

                {error && (
                  <div
                    role="alert"
                    className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="w-full"
                >
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
