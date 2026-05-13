import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, FileCheck2, RotateCcw, ShieldAlert } from 'lucide-react';
import { Layout } from '../components/shared/Layout';

type PilotStatus = 'pending' | 'ready' | 'blocked';

interface ChecklistItem {
  id: string;
  group: string;
  label: string;
  detail: string;
  required: boolean;
}

interface StoredPilotIntake {
  checked: Record<string, boolean>;
  notes: string;
  status: PilotStatus;
  updatedAt: string | null;
}

const STORAGE_KEY = 'prevwage.caPilotIntake.v1';

const CHECKLIST: ChecklistItem[] = [
  {
    id: 'contractor-identity',
    group: 'Inputs',
    label: 'Contractor identity',
    detail: 'Legal name, FEIN, CSLB license, workers comp policy, and certifying official.',
    required: true,
  },
  {
    id: 'project-fields',
    group: 'Inputs',
    label: 'CA project fields',
    detail: 'Project name, county, jobsite, awarding agency, contract number, DIR project ID, award date, and funding type.',
    required: true,
  },
  {
    id: 'wage-source',
    group: 'Inputs',
    label: 'Wage source pinned',
    detail: 'Contract wage determination or DIR prevailing wage source is available and matches project documents.',
    required: true,
  },
  {
    id: 'payroll-weeks',
    group: 'Payroll',
    label: 'Two payroll weeks',
    detail: 'Two real payroll exports from QuickBooks, ADP, Gusto, Paychex, Sage 300, or Sage 100.',
    required: true,
  },
  {
    id: 'workers',
    group: 'Payroll',
    label: 'Worker roster',
    detail: 'At least five workers with addresses, last-four identifiers, classifications, and apprentice data when applicable.',
    required: true,
  },
  {
    id: 'fringe-breakdown',
    group: 'Payroll',
    label: 'Fringe breakdown',
    detail: 'Health/welfare, pension, vacation, training, and credited fringe values are available for comparison.',
    required: true,
  },
  {
    id: 'subcontractor-cpr',
    group: 'Workflow',
    label: 'Subcontractor CPR sample',
    detail: 'At least one subcontractor CPR request or upload sample is ready for the pilot.',
    required: true,
  },
  {
    id: 'reviewer',
    group: 'Workflow',
    label: 'Reviewer account',
    detail: 'Prime, agency, or compliance reviewer is identified and can approve/reject without payroll edits.',
    required: true,
  },
  {
    id: 'evidence-folder',
    group: 'Evidence',
    label: 'Evidence folder prepared',
    detail: 'Source payroll exports, agency references, screenshots, and generated files will be stored outside the repo.',
    required: true,
  },
  {
    id: 'stop-conditions',
    group: 'Evidence',
    label: 'Stop conditions reviewed',
    detail: 'Pilot lead understands when to stop for wrong totals, missing required fields, missing Fix actions, or SSN exposure.',
    required: true,
  },
];

const DEFAULT_INTAKE: StoredPilotIntake = {
  checked: {},
  notes: '',
  status: 'pending',
  updatedAt: null,
};

function loadIntake(): StoredPilotIntake {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INTAKE;
    return { ...DEFAULT_INTAKE, ...JSON.parse(raw) } as StoredPilotIntake;
  } catch {
    return DEFAULT_INTAKE;
  }
}

function statusLabel(status: PilotStatus) {
  if (status === 'ready') return 'Ready to Run';
  if (status === 'blocked') return 'Blocked';
  return 'Intake Open';
}

function statusClass(status: PilotStatus) {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'blocked') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export function PilotIntakePage() {
  const [intake, setIntake] = useState<StoredPilotIntake>(() => loadIntake());

  const completeCount = CHECKLIST.filter((item) => intake.checked[item.id]).length;
  const requiredCount = CHECKLIST.filter((item) => item.required).length;
  const percent = Math.round((completeCount / CHECKLIST.length) * 100);
  const allRequiredComplete = CHECKLIST.every((item) => !item.required || intake.checked[item.id]);

  const grouped = useMemo(() => {
    return CHECKLIST.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
      acc[item.group] = [...(acc[item.group] ?? []), item];
      return acc;
    }, {});
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(intake));
  }, [intake]);

  function updateChecked(id: string, checked: boolean) {
    setIntake((current) => ({
      ...current,
      checked: { ...current.checked, [id]: checked },
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateStatus(status: PilotStatus) {
    setIntake((current) => ({ ...current, status, updatedAt: new Date().toISOString() }));
  }

  function resetIntake() {
    setIntake({ ...DEFAULT_INTAKE, updatedAt: new Date().toISOString() });
  }

  return (
    <Layout>
      <div className="space-y-6">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">California Pilot</p>
            <h1 className="mt-2 font-headline text-3xl font-semibold tracking-tight text-gray-950">
              Pilot Intake Checklist
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
              Track readiness before running the CA production pilot. Store payroll files, worker records, and screenshots
              in the secure evidence folder, not in this checklist.
            </p>
          </div>

          <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</p>
                <span className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(intake.status)}`}>
                  <ClipboardCheck className="h-4 w-4" />
                  {statusLabel(intake.status)}
                </span>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-semibold text-gray-950">{percent}%</p>
                <p className="text-xs text-gray-500">{completeCount}/{CHECKLIST.length} complete</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(['pending', 'ready', 'blocked'] as PilotStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateStatus(status)}
                  className={`min-h-10 rounded border px-2 text-xs font-semibold transition-colors ${
                    intake.status === status
                      ? 'border-brand-gold bg-brand-gold/15 text-black'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {statusLabel(status)}
                </button>
              ))}
            </div>
          </aside>
        </section>

        {!allRequiredComplete && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Required intake is incomplete. Do not run agency-facing pilot exports until every required item is checked.
            </p>
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-3">
                  <h2 className="font-headline text-base font-semibold text-gray-950">{group}</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {items.map((item) => {
                    const checked = Boolean(intake.checked[item.id]);
                    return (
                      <label key={item.id} className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)] gap-3 px-5 py-4 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => updateChecked(item.id, event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                        />
                        <span>
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-950">{item.label}</span>
                            {item.required && (
                              <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Required
                              </span>
                            )}
                            {checked && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-gray-600">{item.detail}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-headline text-base font-semibold text-gray-950">Pilot Notes</h2>
              <label htmlFor="pilot-notes" className="mt-4 block text-xs font-medium text-gray-700">
                Internal notes
              </label>
              <textarea
                id="pilot-notes"
                value={intake.notes}
                onChange={(event) =>
                  setIntake((current) => ({ ...current, notes: event.target.value, updatedAt: new Date().toISOString() }))
                }
                rows={8}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                placeholder="Record intake status only. Do not paste payroll records, SSNs, or source files here."
              />
              <p className="mt-2 text-xs text-gray-500">
                Last updated: {intake.updatedAt ? new Date(intake.updatedAt).toLocaleString() : 'Not started'}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-headline text-base font-semibold text-gray-950">Runbook</h2>
              <div className="mt-3 space-y-2">
                <Link to="/state-support" className="flex min-h-11 items-center gap-2 rounded border border-gray-200 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  <FileCheck2 className="h-4 w-4 text-brand-gold" />
                  State Support
                </Link>
                <a
                  href="https://github.com/teamcarrillo405-hub/prevailing-wage/blob/main/docs/CA_PILOT_RUNBOOK.md"
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center gap-2 rounded border border-gray-200 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  <FileCheck2 className="h-4 w-4 text-brand-gold" />
                  CA Runbook
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={resetIntake}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Checklist
            </button>
          </aside>
        </section>
      </div>
    </Layout>
  );
}
