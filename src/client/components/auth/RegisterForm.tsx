import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

const RegisterSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  inviteCode: z.string().min(1, 'Invitation code is required'),
});

type RegisterFields = z.infer<typeof RegisterSchema>;

export function RegisterForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFields>({ resolver: zodResolver(RegisterSchema) });

  async function onSubmit(data: RegisterFields) {
    setApiError(null);
    try {
      await api.post('/auth/register', { email: data.email, password: data.password, inviteCode: data.inviteCode });
      await login(data.email, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Input
        id="reg-email"
        type="email"
        autoComplete="email"
        label="Email address"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        id="reg-password"
        type="password"
        autoComplete="new-password"
        label="Password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        id="reg-invite"
        type="text"
        autoComplete="off"
        label="Invitation Code"
        error={errors.inviteCode?.message}
        {...register('inviteCode')}
      />

      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-sm px-3 py-2 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Creating account…' : 'Create Account'}
      </Button>
    </form>
  );
}
