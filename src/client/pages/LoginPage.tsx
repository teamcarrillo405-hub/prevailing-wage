import { useState } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-headline text-3xl text-gray-900 border-b-4 border-[#F5C518] inline-block pb-1">
            HCC Prevailing Wage
          </h1>
          <p className="text-sm text-gray-500 mt-3">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}

          <div className="mt-4 text-center">
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-sm text-gray-500 hover:text-gray-800 underline"
              >
                No account? Register instead
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm text-gray-500 hover:text-gray-800 underline"
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
