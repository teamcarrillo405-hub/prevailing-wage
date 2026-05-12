import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import type { OnboardingAnswers, OnboardingResponse } from '../../types/onboarding';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Job name is required').max(200),
  state: z
    .string()
    .length(2, 'State must be a 2-letter code')
    .toUpperCase(),
  county: z.string().min(1, 'County is required'),
  contractType: z.enum(['federal-davis-bacon', 'state-prevailing', 'gsa-schedule', 'private'], {
    error: () => ({ message: 'Select a contract type' }),
  }),
  awardDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Award date must be YYYY-MM-DD'),
  fundingType: z.enum(['federal', 'state', 'mixed'], {
    error: () => ({ message: 'Select a funding type' }),
  }),
  cslbLicense: z.string().max(50).optional(),
  wcPolicyNumber: z.string().max(100).optional(),
  // Phase 25 — Washington-specific fields
  ubiNumber: z.string().max(20).optional(),
  lniCertificate: z.string().max(50).optional(),
  wcAccount: z.string().max(50).optional(),
  // Phase 40 — New York-specific fields
  nyprcNumber: z.string().max(100).optional(),
  nysContractorRegNumber: z.string().max(100).optional(),
  // Phase 47 — Texas-specific fields
  txdotProjectId: z.string().max(100).optional(),
  txContractorLicense: z.string().max(100).optional(),
  txAwardingAgency: z.string().max(200).optional(),
  // Phase 49 — Massachusetts-specific fields
  maDlsProjectId: z.string().max(100).optional(),
  maSicCode: z.string().max(50).optional(),
  // Phase 51 — New Jersey-specific fields
  njPwcNumber: z.string().max(50).optional(),
  njContractId: z.string().max(100).optional(),
  // Phase 70 — Apprenticeship enforcement (IRA/IIJA flag only; ratio table is managed separately)
  isIraIijaProject: z.boolean().optional(),
  projectSettings: z.string().optional(),
});

type ProjectFields = z.infer<typeof CreateProjectSchema>;

interface TradeRatioRow {
  trade: string;
  ratio: string;
}

interface ProjectFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function defaultsFromOnboarding(answers?: OnboardingAnswers): Partial<ProjectFields> {
  if (!answers) return {};

  const workTypes = new Set(answers.workTypes);
  const hasFederal = workTypes.has('federal_davis_bacon');
  const hasState = workTypes.has('state_prevailing_wage') || workTypes.has('dot') || workTypes.has('school_public_agency');
  const hasPrivateMix = workTypes.has('private_mixed');

  return {
    state: answers.primaryStates[0]?.toUpperCase() ?? undefined,
    contractType: hasFederal
      ? 'federal-davis-bacon'
      : hasState
        ? 'state-prevailing'
        : hasPrivateMix
          ? 'private'
          : undefined,
    fundingType: hasFederal && hasState ? 'mixed' : hasFederal ? 'federal' : hasState ? 'state' : undefined,
    isIraIijaProject: answers.usesApprentices && hasFederal ? false : undefined,
  };
}

function importPromptFromOnboarding(answers?: OnboardingAnswers): string | null {
  if (!answers) return null;
  if (answers.payrollProvider === 'quickbooks' || answers.accountingProvider === 'quickbooks') {
    return 'Your onboarding says QuickBooks is part of your workflow. After this project is created, connect QuickBooks from Integrations to import employees and sync time.';
  }
  if (answers.projectManagementProvider === 'procore') {
    return 'Your onboarding says Procore is part of your workflow. After this project is created, connect Procore from Integrations to import timesheets.';
  }
  if (['adp', 'gusto', 'paychex', 'sage_300', 'sage_100'].includes(answers.payrollProvider)) {
    return 'Your onboarding says payroll comes from a provider export. After this project is created, use the payroll CSV import path and save worker mappings.';
  }
  if (answers.fieldTrackingNeeded) {
    return 'Your onboarding says field proof matters. After this project is created, enable field clock and photo capture from project settings.';
  }
  return null;
}

function projectSettingsFromOnboarding(answers?: OnboardingAnswers): string | undefined {
  if (!answers) return undefined;

  return JSON.stringify({
    onboardingSetup: {
      source: 'onboarding',
      primaryStates: answers.primaryStates,
      workTypes: answers.workTypes,
      payrollProvider: answers.payrollProvider,
      accountingProvider: answers.accountingProvider,
      projectManagementProvider: answers.projectManagementProvider,
      usesSubcontractors: answers.usesSubcontractors,
      usesApprentices: answers.usesApprentices,
      fieldTrackingNeeded: answers.fieldTrackingNeeded,
      averageWeeklyWorkers: answers.averageWeeklyWorkers,
      appliedAt: new Date().toISOString(),
    },
  });
}

export function ProjectForm({ onSuccess, onCancel }: ProjectFormProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const [tradeRatios, setTradeRatios] = useState<TradeRatioRow[]>([]);

  const { data: onboardingData } = useQuery({
    queryKey: ['onboarding-profile'],
    queryFn: () => api.get<OnboardingResponse>('/onboarding'),
    staleTime: 5 * 60_000,
  });

  const onboardingAnswers = onboardingData?.data.profile?.onboardingAnswers;
  const onboardingDefaults = useMemo(() => defaultsFromOnboarding(onboardingAnswers), [onboardingAnswers]);
  const importPrompt = useMemo(() => importPromptFromOnboarding(onboardingAnswers), [onboardingAnswers]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFields>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: onboardingDefaults,
  });

  useEffect(() => {
    if (Object.keys(onboardingDefaults).length > 0) {
      reset(onboardingDefaults);
    }
  }, [onboardingDefaults, reset]);

  const stateValue = watch('state');
  const fundingTypeValue = watch('fundingType');
  const isCA = stateValue?.toUpperCase() === 'CA';
  const isWA = stateValue?.toUpperCase() === 'WA';
  const isNY = stateValue?.toUpperCase() === 'NY';
  const isIL = stateValue?.toUpperCase() === 'IL';
  const isTX = stateValue?.toUpperCase() === 'TX';
  const isFL = stateValue?.toUpperCase() === 'FL';
  const isMA = stateValue?.toUpperCase() === 'MA';
  const isNJ = stateValue?.toUpperCase() === 'NJ';
  const isFederalOrState = fundingTypeValue === 'federal' || fundingTypeValue === 'state';

  async function onSubmit(data: ProjectFields) {
    setApiError(null);
    try {
      // Serialize the trade ratio table into the apprenticeshipRequirements JSON field
      const apprenticeshipRequirements = tradeRatios.length > 0
        ? JSON.stringify(
            Object.fromEntries(
              tradeRatios
                .filter(r => r.trade.trim() && r.ratio.trim())
                .map(r => [r.trade.trim(), { maxRatio: r.ratio.trim() }]),
            ),
          )
        : undefined;

      const created = await api.post<{ data: { project: { id: string; state: string; county: string; contractType: string } } }>('/projects', {
        ...data,
        projectSettings: projectSettingsFromOnboarding(onboardingAnswers),
        apprenticeshipRequirements,
      });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      const project = created.data.project;
      if (project.contractType === 'federal-davis-bacon') {
        const params = new URLSearchParams({
          state: project.state,
          county: project.county,
          projectId: project.id,
        });
        navigate(`/wages?${params.toString()}`);
        return;
      }
      onSuccess();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to create project');
    }
  }

  function addTradeRatio() {
    setTradeRatios(prev => [...prev, { trade: '', ratio: '' }]);
  }

  function updateTradeRatio(idx: number, field: 'trade' | 'ratio', value: string) {
    setTradeRatios(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function removeTradeRatio(idx: number) {
    setTradeRatios(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {onboardingAnswers && (
        <div className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-sm text-gray-800">
          <p className="font-semibold text-gray-900">Pre-filled from onboarding</p>
          <p className="mt-1">
            State and contract defaults are based on your saved business profile. County, award date,
            and job identifiers still need to come from the contract documents.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="proj-name" className="block text-sm font-medium text-gray-700 mb-1">
          Job name
        </label>
        <input
          id="proj-name"
          type="text"
          required
          aria-required="true"
          {...register('name')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
        />
        {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="proj-state" className="block text-sm font-medium text-gray-700 mb-1">
            State (2-letter)
          </label>
          <input
            id="proj-state"
            type="text"
            maxLength={2}
            placeholder="CA"
            required
            aria-required="true"
            {...register('state')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm uppercase focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
          />
          {errors.state && <p className="text-red-600 text-xs mt-1">{errors.state.message}</p>}
        </div>

        <div>
          <label htmlFor="proj-county" className="block text-sm font-medium text-gray-700 mb-1">
            County
          </label>
          <input
            id="proj-county"
            type="text"
            required
            aria-required="true"
            {...register('county')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
          />
          {errors.county && <p className="text-red-600 text-xs mt-1">{errors.county.message}</p>}
        </div>
      </div>

      {fundingTypeValue === 'federal' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          After this project is created, the system will automatically search federal WDs for this county with this project already selected. Review the WD number/revision from the award documents, then lock it to the project.
        </div>
      )}

      <div>
        <label htmlFor="proj-contract-type" className="block text-sm font-medium text-gray-700 mb-1">
          Contract type
        </label>
        <select
          id="proj-contract-type"
          required
          aria-required="true"
          {...register('contractType')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
        >
          <option value="">Select contract type</option>
          <option value="federal-davis-bacon">Federal Davis-Bacon</option>
          <option value="state-prevailing">State Prevailing</option>
          <option value="gsa-schedule">GSA Schedule</option>
          <option value="private">Private</option>
        </select>
        {errors.contractType && (
          <p className="text-red-600 text-xs mt-1">{errors.contractType.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="proj-award-date" className="block text-sm font-medium text-gray-700 mb-1">
            Award date
          </label>
          <input
            id="proj-award-date"
            type="date"
            required
            aria-required="true"
            {...register('awardDate')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
          />
          {errors.awardDate && (
            <p className="text-red-600 text-xs mt-1">{errors.awardDate.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="proj-funding-type" className="block text-sm font-medium text-gray-700 mb-1">
            Funding type
          </label>
          <select
            id="proj-funding-type"
            required
            aria-required="true"
            {...register('fundingType')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
          >
            <option value="">Select funding type</option>
            <option value="federal">Federal</option>
            <option value="state">State</option>
            <option value="mixed">Mixed</option>
          </select>
          {errors.fundingType && (
            <p className="text-red-600 text-xs mt-1">{errors.fundingType.message}</p>
          )}
        </div>
      </div>

      {isCA && (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">California Project Fields</p>
          <div>
            <label htmlFor="cslbLicense" className="block text-sm font-medium text-gray-700">
              CSLB Contractor License #
            </label>
            <input
              id="cslbLicense"
              type="text"
              {...register('cslbLicense')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="e.g. 123456"
            />
          </div>
          <div>
            <label htmlFor="wcPolicyNumber" className="block text-sm font-medium text-gray-700">
              Workers' Compensation Policy #
            </label>
            <input
              id="wcPolicyNumber"
              type="text"
              {...register('wcPolicyNumber')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="e.g. WC-2026-789"
            />
          </div>
        </div>
      )}

      {isWA && (
        <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Washington Project Fields</p>
          <div>
            <label htmlFor="ubiNumber" className="block text-sm font-medium text-gray-700">
              UBI Number
            </label>
            <input
              id="ubiNumber"
              type="text"
              {...register('ubiNumber')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="9-digit UBI, e.g. 123456789"
            />
          </div>
          <div>
            <label htmlFor="lniCertificate" className="block text-sm font-medium text-gray-700">
              L&amp;I Contractor Certificate #
            </label>
            <input
              id="lniCertificate"
              type="text"
              {...register('lniCertificate')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="e.g. RAINIC*123AB"
            />
          </div>
          <div>
            <label htmlFor="wcAccount" className="block text-sm font-medium text-gray-700">
              Workers' Compensation Account #
            </label>
            <input
              id="wcAccount"
              type="text"
              {...register('wcAccount')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="L&I industrial insurance account number"
            />
          </div>
        </div>
      )}

      {isNY && (
        <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">New York Project Fields</p>
          <div>
            <label htmlFor="nyprcNumber" className="block text-sm font-medium text-gray-700">
              PRC Number
            </label>
            <input
              id="nyprcNumber"
              type="text"
              {...register('nyprcNumber')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="nysContractorRegNumber" className="block text-sm font-medium text-gray-700">
              NYS Contractor Registration Number
            </label>
            <input
              id="nysContractorRegNumber"
              type="text"
              {...register('nysContractorRegNumber')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
            />
          </div>
        </div>
      )}

      {isIL && (
        <div className="space-y-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <p className="text-sm font-medium text-purple-800">Illinois Project</p>
          <p className="text-xs text-purple-600">IL-specific certified payroll export and IDOL submission will be available on payroll weeks.</p>
        </div>
      )}

      {isTX && (
        <div className="space-y-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-medium text-orange-800">Texas Project Fields</p>
          <div>
            <label htmlFor="txdotProjectId" className="block text-sm font-medium text-gray-700">
              TxDOT Project ID
            </label>
            <input
              id="txdotProjectId"
              type="text"
              {...register('txdotProjectId')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="e.g. STP 2025(123)"
            />
          </div>
          <div>
            <label htmlFor="txContractorLicense" className="block text-sm font-medium text-gray-700">
              TX Contractor License #
            </label>
            <input
              id="txContractorLicense"
              type="text"
              {...register('txContractorLicense')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="TDLR license number"
            />
          </div>
          <div>
            <label htmlFor="txAwardingAgency" className="block text-sm font-medium text-gray-700">
              Awarding Agency Name
            </label>
            <input
              id="txAwardingAgency"
              type="text"
              {...register('txAwardingAgency')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="e.g. Texas Department of Transportation"
            />
          </div>
        </div>
      )}

      {isMA && (
        <div className="space-y-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-medium text-teal-800">Massachusetts Project Fields</p>
          <div>
            <label htmlFor="maDlsProjectId" className="block text-sm font-medium text-gray-700">
              MA DLS Project ID
            </label>
            <input id="maDlsProjectId" type="text" {...register('maDlsProjectId')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="DCAMM-assigned project ID" />
          </div>
          <div>
            <label htmlFor="maSicCode" className="block text-sm font-medium text-gray-700">
              SIC / Trade Code
            </label>
            <input id="maSicCode" type="text" {...register('maSicCode')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="e.g. 1731" />
          </div>
          <p className="text-xs text-teal-600">
            MA DLS certified payroll download will be available on payroll weeks.
          </p>
        </div>
      )}

      {isNJ && (
        <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-medium text-indigo-800">New Jersey Project Fields</p>
          <div>
            <label htmlFor="njPwcNumber" className="block text-sm font-medium text-gray-700">
              NJ Public Works Contractor Registration Number
            </label>
            <input
              id="njPwcNumber"
              type="text"
              {...register('njPwcNumber')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="e.g. 123456"
            />
          </div>
          <div>
            <label htmlFor="njContractId" className="block text-sm font-medium text-gray-700">
              NJ Contract ID
            </label>
            <input
              id="njContractId"
              type="text"
              {...register('njContractId')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand-gold focus:outline-none"
              placeholder="State contract identifier"
            />
          </div>
          <p className="text-xs text-indigo-600">
            NJ MW-562 certified payroll download will be available on payroll weeks.
          </p>
        </div>
      )}

      {isFederalOrState && (
        <div className="space-y-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">Apprenticeship Requirements</p>

          <div className="flex items-center gap-3">
            <input
              id="isIraIijaProject"
              type="checkbox"
              {...register('isIraIijaProject')}
              className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
            />
            <label htmlFor="isIraIijaProject" className="text-sm text-gray-700">
              IRA/IIJA Clean Energy Project — requires 15% apprenticeship hours
            </label>
          </div>

          <div>
            <p className="text-xs text-yellow-700 mb-2">
              Per-trade apprenticeship ratio limits (e.g., "1:2" = 1 apprentice per 2 journeyworkers)
            </p>
            {tradeRatios.map((row, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  placeholder="Trade (e.g. Electrician)"
                  value={row.trade}
                  onChange={e => updateTradeRatio(idx, 'trade', e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
                <input
                  type="text"
                  placeholder="Max ratio (e.g. 1:2)"
                  value={row.ratio}
                  onChange={e => updateTradeRatio(idx, 'ratio', e.target.value)}
                  className="w-28 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
                <button
                  type="button"
                  onClick={() => removeTradeRatio(idx)}
                  className="text-red-500 hover:text-red-700 text-sm px-1"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTradeRatio}
              className="text-sm text-brand-gold underline hover:opacity-80"
            >
              + Add Trade Ratio
            </button>
          </div>
        </div>
      )}

      {importPrompt && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {importPrompt}
        </div>
      )}

      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Creating...' : 'Create Project'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
