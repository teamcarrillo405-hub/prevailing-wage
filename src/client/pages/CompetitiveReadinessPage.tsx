import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileText, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Layout } from '../components/shared/Layout';
import {
  COMPETITIVE_READINESS,
  readinessCounts,
  readinessScore,
  type CompetitiveStatus,
} from '../../shared/competitiveReadiness';

type SavedState = Record<string, { status: CompetitiveStatus; notes: string; updatedAt: string | null }>;

const STORAGE_KEY = 'prevwage.competitiveReadiness.v1';

const STATUS_LABEL: Record<CompetitiveStatus, string> = {
  proven: 'Proven',
  building: 'Building',
  gap: 'Gap',
};

const STATUS_CLASS: Record<CompetitiveStatus, string> = {
  proven: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  building: 'border-amber-200 bg-amber-50 text-amber-800',
  gap: 'border-red-200 bg-red-50 text-red-800',
};

function loadSavedState(): SavedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as SavedState : {};
  } catch {
    return {};
  }
}

export function CompetitiveReadinessPage() {
  const [saved, setSaved] = useState<SavedState>(() => loadSavedState());

  const items = useMemo(() => {
    return COMPETITIVE_READINESS.map((item) => ({
      ...item,
      status: saved[item.id]?.status ?? item.status,
      notes: saved[item.id]?.notes ?? '',
      updatedAt: saved[item.id]?.updatedAt ?? null,
    }));
  }, [saved]);

  const counts = readinessCounts(items);
  const score = readinessScore(items);
  const nextItems = items.filter((item) => item.status !== 'proven').slice(0, 3);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  function updateItem(id: string, patch: Partial<{ status: CompetitiveStatus; notes: string }>) {
    setSaved((current) => {
      const item = items.find((entry) => entry.id === id);
      return {
        ...current,
        [id]: {
          status: patch.status ?? item?.status ?? 'gap',
          notes: patch.notes ?? item?.notes ?? '',
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  return (
    <Layout>
      <div className="space-y-6">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Market Execution</p>
            <h1 className="mt-2 font-headline text-3xl font-semibold tracking-tight text-gray-950">
              Competitive Readiness
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
              Track the gaps that still separate PrevWage from mature certified payroll platforms. Mark an item proven
              only after the execution gate has evidence from a real workflow or tested artifact.
            </p>
          </div>

          <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Readiness Score</p>
                <p className="mt-2 font-mono text-4xl font-semibold text-gray-950">{score}%</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-brand-gold" />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${score}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded border border-emerald-100 bg-emerald-50 p-2 text-emerald-800">
                <p className="font-mono text-lg font-semibold">{counts.proven}</p>
                <p>Proven</p>
              </div>
              <div className="rounded border border-amber-100 bg-amber-50 p-2 text-amber-800">
                <p className="font-mono text-lg font-semibold">{counts.building}</p>
                <p>Building</p>
              </div>
              <div className="rounded border border-red-100 bg-red-50 p-2 text-red-800">
                <p className="font-mono text-lg font-semibold">{counts.gap}</p>
                <p>Gaps</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h2 className="font-headline text-base font-semibold text-gray-950">Current Bottom Line</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                PrevWage is strongest as a contractor-first CA and federal workflow. It becomes competitively superior
                after pilot evidence proves totals, imports, reviewer controls, subcontractor CPR, security exports, and
                audit packages work with real contractor data.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{item.category}</p>
                    <h2 className="mt-1 font-headline text-lg font-semibold text-gray-950">{item.id.replaceAll('-', ' ')}</h2>
                  </div>
                  <select
                    value={item.status}
                    onChange={(event) => updateItem(item.id, { status: event.target.value as CompetitiveStatus })}
                    className={`min-h-10 rounded border px-3 text-sm font-semibold ${STATUS_CLASS[item.status]}`}
                    aria-label={`Set ${item.category} status`}
                  >
                    {(['gap', 'building', 'proven'] as CompetitiveStatus[]).map((status) => (
                      <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 px-5 py-4 text-sm leading-6 text-gray-700 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Competitor Advantage</p>
                    <p className="mt-1">{item.competitorAdvantage}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Our Position</p>
                    <p className="mt-1">{item.currentPosition}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Execution Gate</p>
                    <p className="mt-1">{item.executionGate}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Test Plan</p>
                    <p className="mt-1">{item.testPlan}</p>
                  </div>
                </div>
                <div className="border-t border-gray-100 px-5 py-4">
                  <label htmlFor={`${item.id}-notes`} className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Evidence Notes
                  </label>
                  <textarea
                    id={`${item.id}-notes`}
                    value={item.notes}
                    onChange={(event) => updateItem(item.id, { notes: event.target.value })}
                    rows={2}
                    className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    placeholder="Record evidence references, pilot findings, or test run IDs."
                  />
                </div>
              </article>
            ))}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-brand-gold" />
                <h2 className="font-headline text-base font-semibold text-gray-950">Next Execution</h2>
              </div>
              <div className="mt-4 space-y-3">
                {nextItems.map((item) => (
                  <div key={item.id} className="rounded border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-950">{item.category}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-600">{item.executionGate}</p>
                  </div>
                ))}
                {nextItems.length === 0 && (
                  <div className="flex items-start gap-2 rounded border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    All readiness items are marked proven.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-gold" />
                <h2 className="font-headline text-base font-semibold text-gray-950">Evidence Rule</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Do not mark a gap proven from code alone. Use a real workflow result, test output, pilot artifact, or
                customer-approved evidence reference.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </Layout>
  );
}
