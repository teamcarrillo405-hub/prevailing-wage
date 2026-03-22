import { Link } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';

export function LoginPage() {
  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-headline text-3xl text-gray-900 border-b-4 border-brand-gold inline-block pb-1">
            HCC Prevailing Wage
          </h1>
          <p className="text-sm text-gray-500 mt-3">
            Sign in to your account
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <LoginForm />

          <div className="mt-4 text-center">
            <Link
              to="/register"
              className="text-sm text-gray-500 hover:text-gray-800 underline"
            >
              No account? Register instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
