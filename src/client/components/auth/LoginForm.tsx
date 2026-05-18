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

      {apiError && (
        <div role="alert" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  );
}
