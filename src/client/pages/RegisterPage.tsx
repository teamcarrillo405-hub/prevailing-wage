import { Card } from '../components/ui/Card';
import { RegisterForm } from '../components/auth/RegisterForm';

export function RegisterPage() {
  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-headline text-3xl text-text-primary border-b-4 border-brand-gold inline-block pb-1">
            HCC Prevailing Wage
          </h1>
          <p className="text-sm text-text-secondary mt-3">Create a new account</p>
        </div>
        <Card>
          <RegisterForm />
        </Card>
      </div>
    </div>
  );
}
