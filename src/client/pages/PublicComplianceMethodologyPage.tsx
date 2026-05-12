import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

interface MethodologyResponse {
  data: {
    version: string;
    positioning: string;
    profiles: Array<{
      id: string;
      label: string;
      appliesWhen: string;
      checks: string[];
      humanReviewRequired: string[];
      primarySources: Array<{ label: string; url: string }>;
    }>;
    notAutomated: string[];
  };
}

export function PublicComplianceMethodologyPage() {
  const { data } = useQuery({
    queryKey: ['public-compliance-methodology'],
    queryFn: () => api.get<MethodologyResponse>('/compliance/methodology'),
  });
  const methodology = data?.data;

  return (
    <main className="min-h-screen bg-white text-gray-950">
      <header className="border-b border-gray-200">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-headline text-lg font-bold">HCC Prevailing Wage</Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-gray-700 hover:text-gray-950">Log in</Link>
            <Link to="/register" className="inline-flex min-h-10 items-center rounded-sm bg-brand-gold px-4 text-sm font-bold text-nav-dark">
              Create account
            </Link>
          </div>
        </nav>
      </header>

      <section className="bg-gray-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-gold">Compliance methodology</p>
          <h1 className="mt-4 max-w-4xl font-headline text-5xl font-bold leading-tight">
            How the system reviews prevailing wage payroll before export.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/75">
            {methodology?.positioning ?? 'Automated checks support certified payroll review, but final certification remains a human responsibility.'}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="inline-flex min-h-12 items-center justify-center rounded-sm bg-brand-gold px-5 text-sm font-bold text-nav-dark">
              Start setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link to="/security" className="inline-flex min-h-12 items-center justify-center rounded-sm border border-white/20 px-5 text-sm font-semibold text-white hover:bg-white/10">
              Review security
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-12 lg:grid-cols-2">
        {methodology?.profiles.map((profile) => (
          <article key={profile.id} className="rounded-sm border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-brand-gold" />
              <div>
                <h2 className="text-lg font-semibold">{profile.label}</h2>
                <p className="mt-1 text-sm text-gray-600">{profile.appliesWhen}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Automated checks</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {profile.checks.map((check) => <li key={check}>- {check}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Human review</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {profile.humanReviewRequired.map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.primarySources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:border-gray-400">
                  {source.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="rounded-sm border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">Certification boundary</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            The system flags payroll risk and prepares export packages. It does not replace attorney, payroll professional,
            agency, or certifying-official review.
          </p>
          {methodology && (
            <ul className="mt-3 space-y-1 text-sm text-amber-900">
              {methodology.notAutomated.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
