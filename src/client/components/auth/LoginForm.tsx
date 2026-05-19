import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';
import { Button } from '../ui/Button';
import { MfaChallenge } from './MfaChallenge';

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFields = z.infer<typeof LoginSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  // Phase 78 — when the server responds with requiresMfa we render the
  // MfaChallenge component inline instead of redirecting.
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ resolver: zodResolver(LoginSchema) });

  async function onSubmit(data: LoginFields) {
    setApiError(null);
    try {
      const result = await login(data.email, data.password);
      if (result.status === 'mfa_required') {
        setMfaUserId(result.userId);
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  if (mfaUserId) {
    return (
      <MfaChallenge
        userId={mfaUserId}
        onSuccess={() => navigate('/dashboard', { replace: true })}
        onCancel={() => { setMfaUserId(null); setApiError(null); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Google OAuth button ──────────────────────────────────────────── */}
      <a
        href="/api/auth/google"
        className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-lg border border-surface-card bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </a>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-surface-card" />
        <span className="text-xs text-text-secondary">or</span>
        <div className="flex-1 border-t border-surface-card" />
      </div>

      {/* ── Login form ───────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          label="Email address"
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          label="Password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex justify-end -mt-2 mb-4">
          <a href="/forgot-password" className="text-sm text-brand-gold hover:underline">
            Forgot password?
          </a>
        </div>

        {apiError && (
          <div role="alert" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
