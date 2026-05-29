import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';
import { Button } from '../ui/Button';

const RegisterSchema = z.object({
  companyName: z.string().min(2, 'Enter your company name'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  inviteCode: z.string().optional(),
  acceptedTerms: z.boolean().refine(v => v === true, {
    message: 'You must accept the terms to continue',
  }),
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

        {/* ── Terms & Privacy acceptance ───────────────────────────────────── */}
        <div className="space-y-1">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0 accent-brand-gold"
              {...register('acceptedTerms')}
            />
            <span className="text-sm text-text-secondary">
              I agree to the{' '}
              <Link to="/terms" className="text-brand-gold hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-brand-gold hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.acceptedTerms && (
            <p className="text-xs text-red-400 pl-6">{errors.acceptedTerms.message}</p>
          )}
        </div>

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
