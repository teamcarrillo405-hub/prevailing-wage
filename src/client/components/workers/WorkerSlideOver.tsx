// src/client/components/workers/WorkerSlideOver.tsx
// Slide-over panel for add/edit worker — 320px desktop, full-width mobile
import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

// ── Types ──────────────────────────────────────────────────────────────────

type LaborType = 'journeyworker' | 'apprentice' | 'foreman';

interface Classification {
  id: string;
  tradeCode: string;
  tradeDescription: string;
  laborType: string;
  apprenticePercent: number | null;
  programName: string | null;
  baseRate: number | null;
  fringeRate: number | null;
}

export interface Worker {
  id: string;
  name: string;
  ssnLast4: string | null;
  hasFullSsn: boolean;
  tradeUnion: string | null;
  address: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  unionLocal: string | null;
  unionBookNumber: string | null;
  apprenticeshipCommittee: string | null;
  apprenticeshipRegNumber: string | null;
  nysRegisteredApprentice: boolean | null;
  race: string | null;
  ethnicity: string | null;
  gender: string | null;
  veteranStatus: string | null;
  skillLevel: string | null;
  isWoman: boolean | null;
  isMinority: boolean | null;
  oshaTraining: boolean | null;
  workerSex: string | null;
  apprenticeshipProgramName: string | null;
  rapidsNumber: string | null;
  classifications: Classification[];
}

interface WageClassification {
  id: string;
  tradeCode: string;
  tradeDescription: string;
  laborType: string;
  baseRate: number;
  fringeRate: number;
  totalRate: number;
}

export interface WorkerSlideOverProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  worker?: Worker | null;
  projectState?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const LABOR_TYPES = [
  { value: 'journeyworker', label: 'Journeyworker' },
  { value: 'apprentice', label: 'Apprentice' },
  { value: 'foreman', label: 'Foreman' },
];

const WA_TRADE_CODES = [
  { value: 'BOIL', label: 'BOIL — Boilermakers' },
  { value: 'CARP', label: 'CARP — Carpenters' },
  { value: 'ELEC', label: 'ELEC — Electricians (Inside)' },
  { value: 'ELCO', label: 'ELCO — Electricians (Outside/Line)' },
  { value: 'GLAZ', label: 'GLAZ — Glaziers' },
  { value: 'IRON', label: 'IRON — Ironworkers' },
  { value: 'LABO', label: 'LABO — Laborers' },
  { value: 'MASO', label: 'MASO — Masons' },
  { value: 'OPER', label: 'OPER — Operating Engineers' },
  { value: 'PAIN', label: 'PAIN — Painters' },
  { value: 'PFRT', label: 'PFRT — Pile Drivers' },
  { value: 'PLAS', label: 'PLAS — Plasterers' },
  { value: 'PLUM', label: 'PLUM — Plumbers and Pipefitters' },
  { value: 'ROOF', label: 'ROOF — Roofers' },
  { value: 'SHEE', label: 'SHEE — Sheet Metal Workers' },
  { value: 'TEAM', label: 'TEAM — Teamsters' },
];

const RACE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'American Indian or Alaska Native', label: 'American Indian or Alaska Native' },
  { value: 'Asian', label: 'Asian' },
  { value: 'Black or African American', label: 'Black or African American' },
  { value: 'Native Hawaiian or Other Pacific Islander', label: 'Native Hawaiian or Other Pacific Islander' },
  { value: 'White', label: 'White' },
  { value: 'Two or more races', label: 'Two or more races' },
  { value: 'Declined to answer', label: 'Declined to answer' },
];

const ETHNICITY_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'Hispanic or Latino', label: 'Hispanic or Latino' },
  { value: 'Not Hispanic or Latino', label: 'Not Hispanic or Latino' },
  { value: 'Declined to answer', label: 'Declined to answer' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Non-binary', label: 'Non-binary' },
  { value: 'Declined to answer', label: 'Declined to answer' },
];

const VETERAN_STATUS_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'Veteran', label: 'Veteran' },
  { value: 'Not a veteran', label: 'Not a veteran' },
  { value: 'Declined to answer', label: 'Declined to answer' },
];

const SKILL_LEVEL_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'journeyman', label: 'Journeyman' },
  { value: 'apprentice', label: 'Apprentice' },
];

// ── Blank form factory ─────────────────────────────────────────────────────

function blankForm() {
  return {
    name: '',
    ssn: '',
    tradeUnion: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    unionLocal: '',
    unionBookNumber: '',
    apprenticeshipCommittee: '',
    apprenticeshipRegNumber: '',
    nysRegisteredApprentice: false,
    race: '',
    ethnicity: '',
    gender: '',
    veteranStatus: '',
    skillLevel: '',
    isWoman: null as boolean | null,
    isMinority: null as boolean | null,
    oshaTraining: null as boolean | null,
    workerSex: null as string | null,
    apprenticeshipProgramName: '',
    rapidsNumber: '',
    // Classification fields (add mode only)
    classificationId: '',
    tradeCode: '',
    tradeDescription: '',
    laborType: 'journeyworker' as LaborType,
    apprenticePercent: '',
    programName: '',
    waManualRate: '',
    waTradeCode: '',
  };
}

function workerToForm(w: Worker) {
  return {
    ...blankForm(),
    name: w.name,
    ssn: '', // Never pre-populate — encrypted server-side
    tradeUnion: w.tradeUnion ?? '',
    addressStreet: w.addressStreet ?? '',
    addressCity: w.addressCity ?? '',
    addressState: w.addressState ?? '',
    addressZip: w.addressZip ?? '',
    unionLocal: w.unionLocal ?? '',
    unionBookNumber: w.unionBookNumber ?? '',
    apprenticeshipCommittee: w.apprenticeshipCommittee ?? '',
    apprenticeshipRegNumber: w.apprenticeshipRegNumber ?? '',
    nysRegisteredApprentice: w.nysRegisteredApprentice ?? false,
    race: w.race ?? '',
    ethnicity: w.ethnicity ?? '',
    gender: w.gender ?? '',
    veteranStatus: w.veteranStatus ?? '',
    skillLevel: w.skillLevel ?? '',
    isWoman: w.isWoman ?? null,
    isMinority: w.isMinority ?? null,
    oshaTraining: w.oshaTraining ?? null,
    workerSex: w.workerSex ?? null,
    apprenticeshipProgramName: w.apprenticeshipProgramName ?? '',
    rapidsNumber: w.rapidsNumber ?? '',
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function SlideInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  maxLength,
  autoComplete,
  hasError,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  autoComplete?: string;
  hasError?: boolean;
  id?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      maxLength={maxLength}
      autoComplete={autoComplete}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded border px-3 py-2 text-sm text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-gold ${
        hasError ? 'border-red-500 bg-red-900/20' : 'border-gray-600'
      }`}
    />
  );
}

function DeleteConfirm({
  workerName,
  onConfirm,
  onCancel,
  isPending,
}: {
  workerName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-4">
      <p className="text-sm text-white mb-3">
        Remove <span className="font-semibold">{workerName}</span> and all their trade assignments?
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="inline-flex min-h-10 items-center rounded bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? 'Removing...' : 'Yes, Remove'}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex min-h-10 items-center px-4 text-sm font-semibold text-gray-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function WorkerSlideOver({ open, onClose, projectId, worker, projectState }: WorkerSlideOverProps) {
  const qc = useQueryClient();
  const isEdit = !!worker;

  const isWA = projectState?.toUpperCase() === 'WA';
  const isIL = projectState?.toUpperCase() === 'IL';
  const isMA = projectState?.toUpperCase() === 'MA';
  const isNJ = projectState?.toUpperCase() === 'NJ';

  // ── Local state ────────────────────────────────────────────────────────
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Wage classifications query ─────────────────────────────────────────
  const { data: wdData } = useQuery({
    queryKey: ['wage-classifications', projectId],
    queryFn: () =>
      api.get<{
        data: { classifications: WageClassification[]; hasWd: boolean; wdNumber?: string };
      }>(`/projects/${projectId}/wage-classifications`),
    enabled: !!projectId && open,
    staleTime: 60_000,
  });

  const wageClassifications = wdData?.data?.classifications ?? [];
  const hasWd = wdData?.data?.hasWd ?? false;
  const selectedTrade = wageClassifications.find(wc => wc.id === form.classificationId);

  // ── Reset form when worker changes ─────────────────────────────────────
  useEffect(() => {
    if (open) {
      setForm(worker ? workerToForm(worker) : blankForm());
      setError('');
      setShowDeleteConfirm(false);
    }
  }, [open, worker]);

  // ── Escape key handler ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // ── Mutations ──────────────────────────────────────────────────────────
  const createWorker = useMutation({
    mutationFn: async (f: ReturnType<typeof blankForm>) => {
      const workerRes = await api.post<{ data: { worker: Worker } }>(`/projects/${projectId}/workers`, {
        name: f.name.trim(),
        ...(f.ssn ? { ssn: f.ssn } : {}),
        ...(f.tradeUnion.trim() ? { tradeUnion: f.tradeUnion.trim() } : {}),
        ...(f.addressStreet.trim() ? { addressStreet: f.addressStreet.trim() } : {}),
        ...(f.addressCity.trim() ? { addressCity: f.addressCity.trim() } : {}),
        ...(f.addressState.trim() ? { addressState: f.addressState.trim() } : {}),
        ...(f.addressZip.trim() ? { addressZip: f.addressZip.trim() } : {}),
        ...(f.unionLocal.trim() ? { unionLocal: f.unionLocal.trim() } : {}),
        ...(f.unionBookNumber.trim() ? { unionBookNumber: f.unionBookNumber.trim() } : {}),
        ...(f.apprenticeshipCommittee.trim() ? { apprenticeshipCommittee: f.apprenticeshipCommittee.trim() } : {}),
        ...(f.apprenticeshipRegNumber.trim() ? { apprenticeshipRegNumber: f.apprenticeshipRegNumber.trim() } : {}),
        nysRegisteredApprentice: f.nysRegisteredApprentice,
        ...(f.laborType === 'apprentice' && f.apprenticeshipProgramName?.trim() ? { apprenticeshipProgramName: f.apprenticeshipProgramName.trim() } : {}),
        ...(f.laborType === 'apprentice' && f.rapidsNumber?.trim() ? { rapidsNumber: f.rapidsNumber.trim() } : {}),
        ...(isIL ? {
          race: f.race || undefined,
          ethnicity: f.ethnicity || undefined,
          gender: f.gender || undefined,
          veteranStatus: f.veteranStatus || undefined,
          skillLevel: f.skillLevel || undefined,
        } : {}),
      });
      const workerId = workerRes.data.worker.id;
      const canAddClass = isWA
        ? f.tradeCode.trim() && f.tradeDescription.trim()
        : f.classificationId && selectedTrade;
      if (canAddClass) {
        const waRate = parseFloat(f.waManualRate);
        await api.post(`/projects/${projectId}/workers/${workerId}/classifications`, {
          tradeCode: isWA ? f.tradeCode.trim() : selectedTrade!.tradeCode,
          tradeDescription: isWA ? f.tradeDescription.trim() : selectedTrade!.tradeDescription,
          laborType: f.laborType,
          ...(f.laborType === 'apprentice' ? { apprenticePercent: parseInt(f.apprenticePercent, 10) } : {}),
          ...(f.laborType === 'apprentice' && f.programName.trim() ? { programName: f.programName.trim() } : {}),
          ...(isWA && waRate > 0 ? { waManualRate: waRate } : {}),
          ...(isWA && f.waTradeCode ? { waTradeCode: f.waTradeCode } : {}),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      onClose();
    },
    onError: () => setError('Could not save worker — check all required fields and try again.'),
  });

  const updateWorker = useMutation({
    mutationFn: (f: ReturnType<typeof blankForm>) =>
      api.put<{ data: { worker: Worker } }>(`/projects/${projectId}/workers/${worker!.id}`, {
        name: f.name.trim(),
        ...(f.ssn ? { ssn: f.ssn } : {}),
        tradeUnion: f.tradeUnion.trim() || undefined,
        addressStreet: f.addressStreet.trim() || undefined,
        addressCity: f.addressCity.trim() || undefined,
        addressState: f.addressState.trim() || undefined,
        addressZip: f.addressZip.trim() || undefined,
        unionLocal: f.unionLocal.trim() || undefined,
        unionBookNumber: f.unionBookNumber.trim() || undefined,
        apprenticeshipCommittee: f.apprenticeshipCommittee.trim() || undefined,
        apprenticeshipRegNumber: f.apprenticeshipRegNumber.trim() || undefined,
        nysRegisteredApprentice: f.nysRegisteredApprentice,
        apprenticeshipProgramName: f.apprenticeshipProgramName?.trim() || null,
        rapidsNumber: f.rapidsNumber?.trim() || null,
        ...(isIL ? {
          race: f.race || null,
          ethnicity: f.ethnicity || null,
          gender: f.gender || null,
          veteranStatus: f.veteranStatus || null,
          skillLevel: f.skillLevel || null,
        } : {}),
        ...(isMA || isNJ ? {
          isWoman: f.isWoman ?? null,
          isMinority: f.isMinority ?? null,
          oshaTraining: f.oshaTraining ?? null,
        } : {}),
        ...(isNJ ? { workerSex: f.workerSex } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      onClose();
    },
    onError: () => setError('Could not save worker — check all required fields and try again.'),
  });

  const deleteWorker = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}/workers/${worker!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      onClose();
    },
    onError: () => setError('Could not remove worker — they may have payroll entries that must be deleted first.'),
  });

  // ── Validation & submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    setError('');
    if (!form.name.trim()) { setError('Worker name is required'); return; }
    if (form.ssn && !/^\d+$/.test(form.ssn)) { setError('SSN must contain only digits.'); return; }
    if (form.ssn && form.ssn.length !== 9) { setError('SSN must be exactly 9 digits.'); return; }
    if (!isEdit) {
      if (!isWA && hasWd && !form.classificationId) { setError('Select a trade classification before saving.'); return; }
      if (form.laborType === 'apprentice' && !form.apprenticePercent) { setError('Apprentice % is required'); return; }
      if (form.laborType === 'apprentice' && !form.programName.trim()) { setError('Registered apprenticeship program is required'); return; }
    }
    if (isEdit) {
      updateWorker.mutate(form);
    } else {
      createWorker.mutate(form);
    }
  }, [form, isEdit, isWA, hasWd, createWorker, updateWorker]);

  const isPending = createWorker.isPending || updateWorker.isPending;

  // ── Shared input classes ───────────────────────────────────────────────
  const inputCls = 'w-full rounded border border-gray-600 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-gold';
  const selectCls = 'w-full rounded border border-gray-600 bg-nav-dark px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-gold';

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-80 bg-nav-dark shadow-2xl z-50 flex flex-col transform transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-modal="true"
        role="dialog"
        aria-label={isEdit ? `Edit ${worker?.name}` : 'Add Worker'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <h2 className="font-headline text-lg text-white">
            {isEdit ? 'Edit Worker' : 'Add Worker'}
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Identity */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold mb-3">Identity</p>
            <div className="space-y-3">
              <FieldRow label="Full Name *">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Elena Rivera"
                  className={`${inputCls} ${error.includes('name') ? 'border-red-500' : ''}`}
                  autoFocus={open}
                />
              </FieldRow>
              <FieldRow label="SSN (optional — leave blank to keep current)">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={9}
                  autoComplete="off"
                  value={form.ssn}
                  onChange={e => setForm(p => ({ ...p, ssn: e.target.value.replace(/\D/g, '') }))}
                  placeholder="123456789"
                  className={`${inputCls} ${error.includes('SSN') ? 'border-red-500' : ''}`}
                />
                {isEdit && worker?.ssnLast4 && (
                  <p className="text-xs text-gray-500 mt-1">
                    On file: ***-**-{worker.ssnLast4}
                    {!worker.hasFullSsn && <span className="ml-2 text-amber-500">(last 4 only)</span>}
                  </p>
                )}
              </FieldRow>
              <FieldRow label="Trade Union">
                <input
                  type="text"
                  value={form.tradeUnion}
                  onChange={e => setForm(p => ({ ...p, tradeUnion: e.target.value }))}
                  placeholder="e.g. Carpenters Local 150"
                  className={inputCls}
                />
              </FieldRow>
            </div>
          </section>

          {/* Address */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold mb-3">Address <span className="font-normal normal-case text-gray-500">(required for WH-347)</span></p>
            <div className="space-y-2">
              <input
                type="text"
                value={form.addressStreet}
                onChange={e => setForm(p => ({ ...p, addressStreet: e.target.value }))}
                placeholder="Street"
                className={inputCls}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.addressCity}
                  onChange={e => setForm(p => ({ ...p, addressCity: e.target.value }))}
                  placeholder="City"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={form.addressState}
                  onChange={e => setForm(p => ({ ...p, addressState: e.target.value }))}
                  placeholder="State"
                  className={`${inputCls} uppercase`}
                  maxLength={2}
                />
                <input
                  type="text"
                  value={form.addressZip}
                  onChange={e => setForm(p => ({ ...p, addressZip: e.target.value }))}
                  placeholder="Zip"
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* Classification — only shown in add mode */}
          {!isEdit && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold mb-3">Classification</p>
              <div className="space-y-3">
                <FieldRow label="Labor Type">
                  <select
                    value={form.laborType}
                    onChange={e => setForm(p => ({ ...p, laborType: e.target.value as LaborType }))}
                    className={selectCls}
                  >
                    {LABOR_TYPES.map(lt => (
                      <option key={lt.value} value={lt.value}>{lt.label}</option>
                    ))}
                  </select>
                </FieldRow>

                {form.laborType === 'apprentice' && (
                  <>
                    <FieldRow label="Program Wage %">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={form.apprenticePercent}
                        onChange={e => setForm(p => ({ ...p, apprenticePercent: e.target.value }))}
                        placeholder="From approved program"
                        className={`${inputCls} ${error.includes('Apprentice %') ? 'border-red-500' : ''}`}
                      />
                    </FieldRow>
                    <FieldRow label="Registered Apprenticeship Program">
                      <input
                        type="text"
                        value={form.programName}
                        onChange={e => setForm(p => ({ ...p, programName: e.target.value }))}
                        placeholder="Approved program name"
                        className={`${inputCls} ${error.includes('apprenticeship program') ? 'border-red-500' : ''}`}
                      />
                    </FieldRow>
                  </>
                )}

                {isWA ? (
                  <>
                    <FieldRow label="Trade Code">
                      <input
                        type="text"
                        value={form.tradeCode}
                        onChange={e => setForm(p => ({ ...p, tradeCode: e.target.value.toUpperCase() }))}
                        placeholder="e.g. CARP"
                        className={inputCls}
                      />
                    </FieldRow>
                    <FieldRow label="Trade Description">
                      <input
                        type="text"
                        value={form.tradeDescription}
                        onChange={e => setForm(p => ({ ...p, tradeDescription: e.target.value }))}
                        placeholder="e.g. Carpenter"
                        className={inputCls}
                      />
                    </FieldRow>
                    <FieldRow label="WA Prevailing Rate ($/hr)">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.waManualRate}
                        onChange={e => setForm(p => ({ ...p, waManualRate: e.target.value }))}
                        placeholder="e.g. 58.25"
                        className={inputCls}
                      />
                    </FieldRow>
                    <FieldRow label="WA Trade Code">
                      <select
                        value={form.waTradeCode}
                        onChange={e => setForm(p => ({ ...p, waTradeCode: e.target.value }))}
                        className={selectCls}
                      >
                        <option value="">Select WA trade code</option>
                        {WA_TRADE_CODES.map(tc => (
                          <option key={tc.value} value={tc.value}>{tc.label}</option>
                        ))}
                      </select>
                    </FieldRow>
                  </>
                ) : hasWd ? (
                  <FieldRow label="Trade Classification">
                    <select
                      value={form.classificationId}
                      onChange={e => setForm(p => ({ ...p, classificationId: e.target.value }))}
                      className={`${selectCls} ${error.includes('trade') ? 'border-red-500' : ''}`}
                    >
                      <option value="">— Select a trade —</option>
                      {wageClassifications.map(wc => (
                        <option key={wc.id} value={wc.id}>
                          {wc.tradeDescription} — {fmt(wc.baseRate)} + {fmt(wc.fringeRate)}/hr
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                ) : (
                  <p className="text-xs text-amber-400">
                    No wage determination for this project — worker will be saved without a trade.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Apprenticeship program (edit mode, when worker has apprentice classification) */}
          {isEdit && worker?.classifications?.some(c => c.laborType === 'apprentice') && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold mb-3">Apprenticeship</p>
              <div className="space-y-3">
                <FieldRow label="Apprenticeship Committee">
                  <input
                    type="text"
                    value={form.apprenticeshipCommittee}
                    onChange={e => setForm(p => ({ ...p, apprenticeshipCommittee: e.target.value }))}
                    placeholder="Committee"
                    className={inputCls}
                  />
                </FieldRow>
                <FieldRow label="Registration Number">
                  <input
                    type="text"
                    value={form.apprenticeshipRegNumber}
                    onChange={e => setForm(p => ({ ...p, apprenticeshipRegNumber: e.target.value }))}
                    placeholder="Registration Number"
                    className={inputCls}
                  />
                </FieldRow>
                <FieldRow label="Program Name">
                  <input
                    type="text"
                    value={form.apprenticeshipProgramName ?? ''}
                    onChange={e => setForm(p => ({ ...p, apprenticeshipProgramName: e.target.value }))}
                    placeholder="e.g. IBEW Apprenticeship Training"
                    className={inputCls}
                  />
                </FieldRow>
                <FieldRow label="RAPIDS Number">
                  <input
                    type="text"
                    value={form.rapidsNumber ?? ''}
                    onChange={e => setForm(p => ({ ...p, rapidsNumber: e.target.value }))}
                    placeholder="DOL RAPIDS registration number"
                    className={inputCls}
                  />
                </FieldRow>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.nysRegisteredApprentice ?? false}
                    onChange={e => setForm(p => ({ ...p, nysRegisteredApprentice: e.target.checked }))}
                    className="rounded border-gray-600 text-brand-gold focus:ring-brand-gold"
                  />
                  NYS Registered Apprentice
                </label>
              </div>
            </section>
          )}

          {/* Union info */}
          <details className="group border-t border-gray-700 pt-4">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-200">
              Union Info <span className="font-normal normal-case">(optional)</span>
            </summary>
            <div className="mt-3 space-y-3">
              <FieldRow label="Union Local">
                <input
                  type="text"
                  value={form.unionLocal}
                  onChange={e => setForm(p => ({ ...p, unionLocal: e.target.value }))}
                  placeholder="Local number"
                  className={inputCls}
                />
              </FieldRow>
              <FieldRow label="Book Number">
                <input
                  type="text"
                  value={form.unionBookNumber}
                  onChange={e => setForm(p => ({ ...p, unionBookNumber: e.target.value }))}
                  placeholder="Book number"
                  className={inputCls}
                />
              </FieldRow>
            </div>
          </details>

          {/* IL compliance demographics */}
          {isIL && (
            <details className="group border-t border-gray-700 pt-4" open>
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
                IL Compliance Demographics
              </summary>
              <div className="mt-3 space-y-3">
                <FieldRow label="Race">
                  <select
                    value={form.race}
                    onChange={e => setForm(p => ({ ...p, race: e.target.value }))}
                    className={selectCls}
                  >
                    {RACE_OPTIONS.map(o => <option key={o.value || 'ns'} value={o.value}>{o.label}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Ethnicity">
                  <select
                    value={form.ethnicity}
                    onChange={e => setForm(p => ({ ...p, ethnicity: e.target.value }))}
                    className={selectCls}
                  >
                    {ETHNICITY_OPTIONS.map(o => <option key={o.value || 'ns'} value={o.value}>{o.label}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Gender">
                  <select
                    value={form.gender}
                    onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                    className={selectCls}
                  >
                    {GENDER_OPTIONS.map(o => <option key={o.value || 'ns'} value={o.value}>{o.label}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Veteran Status">
                  <select
                    value={form.veteranStatus}
                    onChange={e => setForm(p => ({ ...p, veteranStatus: e.target.value }))}
                    className={selectCls}
                  >
                    {VETERAN_STATUS_OPTIONS.map(o => <option key={o.value || 'ns'} value={o.value}>{o.label}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Skill Level">
                  <select
                    value={form.skillLevel}
                    onChange={e => setForm(p => ({ ...p, skillLevel: e.target.value }))}
                    className={selectCls}
                  >
                    {SKILL_LEVEL_OPTIONS.map(o => <option key={o.value || 'ns'} value={o.value}>{o.label}</option>)}
                  </select>
                </FieldRow>
              </div>
            </details>
          )}

          {/* MA/NJ workforce participation */}
          {(isMA || isNJ) && (
            <details className="group border-t border-gray-700 pt-4" open>
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold uppercase tracking-wide text-teal-400">
                MA/NJ Workforce Participation
              </summary>
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isWoman ?? false}
                    onChange={e => setForm(p => ({ ...p, isWoman: e.target.checked }))}
                    className="rounded border-gray-600 text-brand-gold focus:ring-brand-gold"
                  />
                  Woman (self-identified)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isMinority ?? false}
                    onChange={e => setForm(p => ({ ...p, isMinority: e.target.checked }))}
                    className="rounded border-gray-600 text-brand-gold focus:ring-brand-gold"
                  />
                  Minority (self-identified)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.oshaTraining ?? false}
                    onChange={e => setForm(p => ({ ...p, oshaTraining: e.target.checked }))}
                    className="rounded border-gray-600 text-brand-gold focus:ring-brand-gold"
                  />
                  OSHA 10 Certified
                </label>
                <p className="text-xs text-gray-500">All fields are optional.</p>
              </div>
            </details>
          )}

          {/* NJ EEO */}
          {isNJ && (
            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-2">NJ EEO — Sex</p>
              <select
                value={form.workerSex ?? ''}
                onChange={e => setForm(p => ({ ...p, workerSex: e.target.value || null }))}
                className={selectCls}
              >
                <option value="">Not reported</option>
                <option value="M">M — Male</option>
                <option value="F">F — Female</option>
                <option value="N">N — Non-binary / Decline to state</option>
              </select>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Delete confirm (edit mode) */}
          {isEdit && showDeleteConfirm && (
            <DeleteConfirm
              workerName={worker!.name}
              onConfirm={() => deleteWorker.mutate()}
              onCancel={() => setShowDeleteConfirm(false)}
              isPending={deleteWorker.isPending}
            />
          )}

          {/* Classifications read-only (edit mode) */}
          {isEdit && worker?.classifications && worker.classifications.length > 0 && (
            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Current Classifications</p>
              <div className="space-y-1">
                {worker.classifications.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs text-gray-400 py-1 border-b border-gray-800 last:border-0">
                    <span>{c.tradeDescription}</span>
                    <Badge variant="neutral">{c.laborType}</Badge>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">To add or remove trades, use the worker card on the roster.</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 border-t border-gray-700 p-4 space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? 'Saving...' : isEdit ? 'Save Changes' : '+ Add Worker'}
          </Button>
          {isEdit && !showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full rounded border border-red-500/20 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Remove Worker
            </button>
          )}
        </div>
      </div>
    </>
  );
}
