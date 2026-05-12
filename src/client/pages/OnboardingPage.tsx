import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, CheckCircle2, ClipboardList, FileSpreadsheet, HardHat, Link2, PlugZap } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import type { AccountingProvider, CompanySize, ContractorRole, OnboardingAnswers, OnboardingResponse, PayrollProvider, ProjectManagementProvider } from '../types/onboarding';

const STATES = ['CA', 'TX', 'WA', 'NY', 'IL', 'MA', 'NJ', 'MN', 'VA', 'AZ', 'CO', 'FL', 'GA', 'NC', 'NV', 'OR'];

const WORK_TYPES = [
  { value: 'federal_davis_bacon', label: 'Federal Davis-Bacon' },
  { value: 'state_prevailing_wage', label: 'State prevailing wage' },
  { value: 'dot', label: 'DOT / transportation' },
  { value: 'school_public_agency', label: 'School or public agency' },
  { value: 'private_mixed', label: 'Private and public mix' },
];

const DEFAULT_FORM: OnboardingAnswers = {
  companyName: '',
  hccMembershipNumber: '',
  contractorRole: 'general_contractor',
  companySize: '11_50',
  primaryStates: ['CA'],
  workTypes: ['federal_davis_bacon'],
  payrollProvider: 'quickbooks',
  accountingProvider: 'quickbooks',
  projectManagementProvider: 'none',
  averageWeeklyWorkers: 12,
  usesSubcontractors: true,
  usesApprentices: false,
  fieldTrackingNeeded: true,
};

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function providerSummary(form: OnboardingAnswers) {
  const items = [];
  if (form.payrollProvider === 'quickbooks' || form.accountingProvider === 'quickbooks') {
    items.push({ title: 'QuickBooks', detail: 'Connect OAuth, import employees, and sync time records.' });
  }
  if (form.projectManagementProvider === 'procore') {
    items.push({ title: 'Procore', detail: 'Import project timesheets into weekly payroll.' });
  }
  if (['adp', 'gusto', 'paychex', 'sage_300', 'sage_100'].includes(form.payrollProvider)) {
    items.push({ title: 'Payroll CSV import', detail: 'Use provider exports with saved worker mappings.' });
  }
  if (items.length === 0) {
    items.push({ title: 'Manual setup', detail: 'Start with manual worker and payroll entry.' });
  }
  return items;
}

export function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OnboardingAnswers>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [creatingSample, setCreatingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<OnboardingResponse>('/onboarding')
      .then((res) => {
        if (res.data.profile?.onboardingAnswers) {
          setForm(res.data.profile.onboardingAnswers);
          return;
        }
        setForm((current) => ({
          ...current,
          companyName: res.data.user.companyName ?? user?.companyName ?? '',
          hccMembershipNumber: res.data.user.hccMembershipNumber ?? user?.hccMembershipNumber ?? '',
        }));
      })
      .catch(() => {
        setForm((current) => ({
          ...current,
          companyName: user?.companyName ?? '',
          hccMembershipNumber: user?.hccMembershipNumber ?? '',
        }));
      });
  }, [user?.companyName, user?.hccMembershipNumber]);

  const setupRecommendations = useMemo(() => providerSummary(form), [form]);

  async function saveOnboarding() {
    setError(null);
    if (!form.companyName.trim() || !form.hccMembershipNumber.trim()) {
      setError('Company name and HCC membership number are required.');
      return;
    }
    if (form.primaryStates.length === 0 || form.workTypes.length === 0) {
      setError('Choose at least one state and one public work type.');
      return;
    }

    setSaving(true);
    try {
      await api.put('/onboarding', {
        ...form,
        companyName: form.companyName.trim(),
        hccMembershipNumber: form.hccMembershipNumber.trim(),
        primaryStates: form.primaryStates.map((state) => state.toUpperCase()),
        averageWeeklyWorkers: Number(form.averageWeeklyWorkers) || 0,
      });
      await queryClient.invalidateQueries({ queryKey: ['onboarding-profile'] });
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save onboarding.');
    } finally {
      setSaving(false);
    }
  }

  async function createSampleProject() {
    setError(null);
    setCreatingSample(true);
    try {
      const res = await api.post<{ data: { projectId: string; weekId: string } }>('/onboarding/sample-project', {});
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${res.data.projectId}/payroll/${res.data.weekId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create sample project.');
    } finally {
      setCreatingSample(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#f6f4ef] text-gray-950">
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-headline text-lg font-bold text-gray-950">
            HCC Prevailing Wage
          </Link>
          <span className="text-sm text-gray-600">Member onboarding</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="space-y-6">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
              <HardHat className="h-3.5 w-3.5" />
              Construction contractor setup
            </p>
            <h1 className="max-w-3xl font-headline text-4xl font-bold leading-tight text-gray-950 md:text-5xl">
              Tell the system how your prevailing wage work actually runs.
            </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              This creates your setup path: forms, payroll import options, subcontractor tracking, field proof, and first-project guidance. No subscription payment is collected here.
            </p>
          </div>

          <div className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2">
            <Input
              id="companyName"
              label="Company name"
              value={form.companyName}
              onChange={(event) => setForm({ ...form, companyName: event.target.value })}
            />
            <Input
              id="hccMembershipNumber"
              label="HCC membership number"
              help="Used as the access credential for the initial program."
              value={form.hccMembershipNumber}
              onChange={(event) => setForm({ ...form, hccMembershipNumber: event.target.value })}
            />
            <Select
              id="contractorRole"
              label="Your role"
              value={form.contractorRole}
              onChange={(event) => setForm({ ...form, contractorRole: event.target.value as ContractorRole })}
              options={[
                { value: 'general_contractor', label: 'General contractor / prime' },
                { value: 'subcontractor', label: 'Subcontractor' },
                { value: 'both', label: 'Both prime and sub' },
              ]}
            />
            <Select
              id="companySize"
              label="Company size"
              value={form.companySize}
              onChange={(event) => setForm({ ...form, companySize: event.target.value as CompanySize })}
              options={[
                { value: '1_10', label: '1-10 employees' },
                { value: '11_50', label: '11-50 employees' },
                { value: '51_200', label: '51-200 employees' },
                { value: '201_plus', label: '201+ employees' },
              ]}
            />
            <Input
              id="averageWeeklyWorkers"
              type="number"
              min={0}
              label="Average weekly field workers"
              value={form.averageWeeklyWorkers}
              onChange={(event) => setForm({ ...form, averageWeeklyWorkers: Number(event.target.value) })}
            />
          </div>

          <div className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-headline text-xl font-semibold text-gray-950">Where and what you build</h2>
              <p className="mt-1 text-sm text-gray-600">This drives wage coverage, state forms, and compliance warnings.</p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700">Primary states</label>
              <div className="flex flex-wrap gap-2">
                {STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => setForm({ ...form, primaryStates: toggleValue(form.primaryStates, state) })}
                    className={`rounded-sm border px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                      form.primaryStates.includes(state)
                        ? 'border-gray-950 bg-gray-950 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700">Public work types</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {WORK_TYPES.map((workType) => (
                  <label key={workType.value} className="flex items-center gap-3 rounded-sm border border-gray-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.workTypes.includes(workType.value)}
                      onChange={() => setForm({ ...form, workTypes: toggleValue(form.workTypes, workType.value) })}
                      className="accent-brand-gold"
                    />
                    {workType.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-3">
            <Select
              id="payrollProvider"
              label="Payroll system"
              value={form.payrollProvider}
              onChange={(event) => setForm({ ...form, payrollProvider: event.target.value as PayrollProvider })}
              options={[
                { value: 'quickbooks', label: 'QuickBooks' },
                { value: 'adp', label: 'ADP' },
                { value: 'gusto', label: 'Gusto' },
                { value: 'paychex', label: 'Paychex' },
                { value: 'sage_300', label: 'Sage 300 CRE' },
                { value: 'sage_100', label: 'Sage 100' },
                { value: 'other', label: 'Other' },
                { value: 'none', label: 'None yet' },
              ]}
            />
            <Select
              id="accountingProvider"
              label="Accounting system"
              value={form.accountingProvider}
              onChange={(event) => setForm({ ...form, accountingProvider: event.target.value as AccountingProvider })}
              options={[
                { value: 'quickbooks', label: 'QuickBooks' },
                { value: 'sage_300', label: 'Sage 300 CRE' },
                { value: 'other', label: 'Other' },
                { value: 'none', label: 'None yet' },
              ]}
            />
            <Select
              id="projectManagementProvider"
              label="Project system"
              value={form.projectManagementProvider}
              onChange={(event) => setForm({ ...form, projectManagementProvider: event.target.value as ProjectManagementProvider })}
              options={[
                { value: 'procore', label: 'Procore' },
                { value: 'other', label: 'Other' },
                { value: 'none', label: 'None yet' },
              ]}
            />
          </div>

          <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-3">
            {[
              ['usesSubcontractors', 'We manage subcontractor CPRs'],
              ['usesApprentices', 'We use apprentices'],
              ['fieldTrackingNeeded', 'We need field proof capture'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 rounded-sm border border-gray-200 px-3 py-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(form[key as keyof OnboardingAnswers])}
                  onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                  className="accent-brand-gold"
                />
                {label}
              </label>
            ))}
          </div>

          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={saveOnboarding} loading={saving} className="min-h-11 px-5">
              Finish onboarding
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" onClick={createSampleProject} loading={creatingSample} className="min-h-11 px-5">
              Open sample project
            </Button>
            <Link to="/settings/integrations" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-gray-300 px-5 text-sm font-semibold text-gray-700 hover:bg-white">
              Review integrations
            </Link>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-gray-900 bg-gray-950 p-5 text-white shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-gold">
              <ClipboardList className="h-4 w-4" />
              Setup logic
            </div>
            <div className="space-y-4">
              {[
                ['Wage coverage', `${form.primaryStates.length} state${form.primaryStates.length === 1 ? '' : 's'} selected`],
                ['Worker volume', `${form.averageWeeklyWorkers || 0} average weekly workers`],
                ['Subcontractor tracking', form.usesSubcontractors ? 'CPR queue recommended' : 'Can stay hidden until needed'],
                ['Field evidence', form.fieldTrackingNeeded ? 'GPS/photos recommended' : 'Evidence remains optional'],
              ].map(([label, value]) => (
                <div key={label} className="border-t border-white/10 pt-3">
                  <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
                  <p className="mt-1 text-sm text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-semibold text-gray-950">
              <PlugZap className="h-4 w-4" />
              Recommended software path
            </div>
            <div className="space-y-3">
              {setupRecommendations.map((item) => (
                <div key={item.title} className="flex gap-3 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                  <div>
                    <p className="text-sm font-semibold text-gray-950">{item.title}</p>
                    <p className="text-sm text-gray-600">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              [Building2, 'Projects'],
              [FileSpreadsheet, 'Payroll'],
              [Link2, 'Plugins'],
            ].map(([Icon, label]) => {
              const TypedIcon = Icon as typeof Building2;
              return (
                <div key={label as string} className="rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm">
                  <TypedIcon className="mx-auto mb-2 h-5 w-5 text-gray-700" />
                  <p className="text-xs font-semibold text-gray-700">{label as string}</p>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </main>
  );
}
