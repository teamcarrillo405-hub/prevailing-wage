import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileCheck2 } from 'lucide-react';
import { RegisterForm } from '../components/auth/RegisterForm';

export function RegisterPage() {
  return (
    <main className="min-h-[100dvh] bg-[#f6f4ef] text-gray-950">
      <div className="mx-auto grid min-h-[100dvh] max-w-7xl gap-0 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-stretch">
        <section className="hidden rounded-sm bg-gray-950 p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to public site
            </Link>
            <div className="mt-14 max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-gold">
                <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                Member account setup
              </p>
              <h1 className="mt-5 font-headline text-5xl font-bold leading-tight">
                Start with company context, then build your first compliant project.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/70">
                Signup creates the account and sends you directly into onboarding. Payment is not collected during this step.
              </p>
            </div>
          </div>

          <div className="grid max-w-2xl gap-3">
            {[
              'Company and HCC membership details',
              'Payroll, accounting, and project system preferences',
              'State coverage and public work types',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 border-t border-white/10 pt-3 text-sm text-white/80">
                <CheckCircle2 className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-[calc(100dvh-2.5rem)] items-center justify-center py-8 lg:bg-white lg:px-10">
          <div className="w-full max-w-md">
            <Link to="/" className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-950 lg:hidden">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Link>

            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">HCC Prevailing Wage</p>
              <h2 className="mt-3 font-headline text-4xl font-bold text-gray-950">
                Create account
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Create your member account. No subscription payment is required.
              </p>
            </div>

            <div className="rounded-sm border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <RegisterForm />
              <div className="mt-5 border-t border-gray-100 pt-4 text-center">
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-gray-700 underline underline-offset-4 hover:text-gray-950"
                >
                  Already have an account? Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
