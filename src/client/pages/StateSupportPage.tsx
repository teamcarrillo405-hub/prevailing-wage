import { AlertTriangle, CheckCircle2, FlaskConical, LockKeyhole, MapPinned } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/shared/Layout';
import { STATE_SUPPORT, type StateLaunchStatus } from '../../shared/stateSupport';

const STATUS_STYLES: Record<StateLaunchStatus, string> = {
  production_pilot: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  controlled_pilot: 'border-blue-200 bg-blue-50 text-blue-800',
  federal_first: 'border-amber-200 bg-amber-50 text-amber-800',
  internal_validation: 'border-gray-200 bg-gray-100 text-gray-700',
  not_supported: 'border-red-200 bg-red-50 text-red-800',
};

const STATUS_ICON: Record<StateLaunchStatus, typeof CheckCircle2> = {
  production_pilot: CheckCircle2,
  controlled_pilot: MapPinned,
  federal_first: AlertTriangle,
  internal_validation: FlaskConical,
  not_supported: LockKeyhole,
};

const visibleStates = STATE_SUPPORT.filter((state) => state.status !== 'not_supported');

export function StateSupportPage() {
  return (
    <Layout>
      <div className="space-y-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Expansion Readiness</p>
            <h1 className="mt-2 font-headline text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
              State Support
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
              PrevWage is expanding through controlled state pilots. State-specific exports are offered only after
              field mapping, agency package review, and pilot payroll validation are complete.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Launch rule</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              If a state is not listed as production or controlled pilot, use the federal WH-347 path only when the
              project is federally covered. Do not treat state-specific output as certified until the pilot gate passes.
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleStates.map((state) => {
            const Icon = STATUS_ICON[state.status];
            return (
              <article key={state.state} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-500">{state.state}</span>
                      <h2 className="font-headline text-lg font-semibold text-gray-950">{state.name}</h2>
                    </div>
                    <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[state.status]}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {state.statusLabel}
                    </span>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-gray-600">{state.posture}</p>

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Exports</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {state.supportedExports.map((format) => (
                      <span key={format} className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                        {format}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Next Gate</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{state.nextGate}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div>
              <h2 className="font-headline text-lg font-semibold text-gray-950">Readiness Checklist</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                A state is customer-ready only when every gate is documented.
              </p>
            </div>
            <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
              {[
                'Official source reviewed and dated',
                'Required fields mapped and preflighted',
                'State export generated from pilot payroll',
                'Payroll totals match source records',
                'Overtime and apprentice rules validated',
                'Subcontractor CPR workflow tested',
                'Reviewer approval works without edit access',
                'Legal/compliance signoff recorded',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to="/pilot-intake" className="inline-flex min-h-11 items-center rounded bg-brand-gold px-4 py-2 text-sm font-semibold text-black hover:bg-brand-gold/90">
            Open Pilot Intake
          </Link>
          <Link to="/methodology" className="inline-flex min-h-11 items-center rounded bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy/90">
            Methodology
          </Link>
          <Link to="/contact" className="inline-flex min-h-11 items-center rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            Request State Review
          </Link>
        </div>
      </div>
    </Layout>
  );
}
