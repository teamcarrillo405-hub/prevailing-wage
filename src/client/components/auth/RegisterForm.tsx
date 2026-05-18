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
  hccMembershipNumber: z.string().min(3, 'Enter your HCC membership number'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  inviteCode: z.string().optional(),
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
      await api.post('/auth/register', {
        companyName: data.companyName,
        hccMembershipNumber: data.hccMembershipNumber,
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
        label="HCC membership number"
        help="Used to verify member access. No subscription payment is collected during signup."
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
      <PasswordInput
        id="reg-password"
        autoComplete="new-password"
        label="Password"
        help="Use at least 8 characters."
        error={errors.password?.message}
        {...register('password')}
      />
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
  );
}
