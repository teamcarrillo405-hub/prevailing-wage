import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';
import { Button } from '../ui/Button';

const RegisterSchema = z.object({
  companyName: z.string().min(2, 'Enter your company name'),
  hccMembershipNumber: z.string().optional(),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  inviteCode: z.string().optional(),
});

type RegisterFields = z.infer<typeof RegisterSchema>;

// ── Password strength scorer (0–5) ────────────────────────────────────────
function scorePassword(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return score;
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
const STRENGTH_COLORS = [
  'bg-surface-muted',
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-400',
  'bg-green-500',
];

export function RegisterForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFields>({ resolver: zodResolver(RegisterSchema) });

  const password = watch('password') ?? '';
  const strength = scorePassword(password);

  async function onSubmit(data: RegisterFields) {
    setApiError(null);
    try {
      await api.post('/auth/register', {
        companyName: data.companyName,
        hccMembershipNumber: data.hccMembershipNumber || undefined,
        email: data.email,
        password: data.password,
        inviteCode: data.inviteCode || undefined,
      });
      await login(data.email, data.password);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Registration failed');
    }
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

      {/* ── Registration form ────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          id="reg-company"
          type="text"
          autoComplete="organization"
          label="Company name"
          error={errors.companyName?.message}
          {...register('companyName')}
        />
        <Input
          id="reg-hcc"
          type="text"
          autoComplete="off"
          label="HCC Member # (optional)"
          help="Leave blank if not an HCC member — you can link your membership later in Settings."
          error={errors.hccMembershipNumber?.message}
          {...register('hccMembershipNumber')}
        />
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          label="Email address"
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <PasswordInput
            id="reg-password"
            autoComplete="new-password"
            label="Password"
            help={password.length === 0 ? 'Use at least 8 characters.' : undefined}
            error={errors.password?.message}
            {...register('password')}
          />

          {/* ── Password strength meter ──────────────────────────────────── */}
          {password.length > 0 && (
            <div className="mt-2 space-y-2">
              {/* 5-segment bar */}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= strength ? STRENGTH_COLORS[strength] : 'bg-surface-muted'
                    }`}
                  />
                ))}
              </div>

              {/* Strength label */}
              {strength > 0 && (
                <p
                  className={`text-xs ${
                    strength >= 4
                      ? 'text-green-400'
                      : strength >= 2
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {STRENGTH_LABELS[strength]}
                </p>
              )}

              {/* Requirements checklist */}
              <div className="space-y-1 text-xs">
                {[
                  { label: '8+ characters', met: password.length >= 8 },
                  { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
                  {
                    label: 'Number or symbol',
                    met: /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password),
                  },
                ].map(r => (
                  <div
                    key={r.label}
                    className={`flex items-center gap-1.5 ${
                      r.met ? 'text-green-400' : 'text-text-secondary'
                    }`}
                  >
                    <span>{r.met ? '✓' : '○'}</span>
                    <span>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Input
          id="reg-invite"
          type="text"
          autoComplete="off"
          label="Invitation code"
          help="Optional unless your organization issued one."
          error={errors.inviteCode?.message}
          {...register('inviteCode')}
        />

        {apiError && (
          <div role="alert" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </div>
  );
}
