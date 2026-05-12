import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import { Layout } from '../components/shared/Layout';
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

export function ComplianceMethodologyPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['compliance-methodology'],
    queryFn: () => api.get<MethodologyResponse>('/compliance/methodology'),
  });

  const methodology = data?.data;

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Compliance Methodology</p>
            <h1 className="mt-1 text-3xl font-semibold text-gray-950">Prevailing wage review logic</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              {methodology?.positioning ?? 'Automated compliance review and certified payroll preparation.'}
            </p>
          </div>
          {methodology && (
            <span className="rounded border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600">
              Version {methodology.version}
            </span>
          )}
        </header>

        {isLoading && <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">Loading methodology...</div>}
        {isError && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">Unable to load methodology.</div>}

        {methodology && (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              {methodology.profiles.map((profile) => (
                <article key={profile.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-gold" />
                    <div>
                      <h2 className="text-base font-semibold text-gray-950">{profile.label}</h2>
                      <p className="mt-1 text-sm text-gray-600">{profile.appliesWhen}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Automated Checks</h3>
                      <ul className="mt-2 space-y-1 text-sm text-gray-700">
                        {profile.checks.map((check) => <li key={check}>- {check}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Human Review</h3>
                      <ul className="mt-2 space-y-1 text-sm text-gray-700">
                        {profile.humanReviewRequired.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                    {profile.primarySources.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {profile.primarySources.map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-950"
                          >
                            {source.label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </section>

            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
                <div>
                  <h2 className="text-base font-semibold text-amber-950">Not Fully Automated</h2>
                  <ul className="mt-2 space-y-1 text-sm text-amber-900">
                    {methodology.notAutomated.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
