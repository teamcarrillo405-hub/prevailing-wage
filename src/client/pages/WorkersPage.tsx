// src/client/pages/WorkersPage.tsx
// Route: /projects/:projectId/workers
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../hooks/useDebounce';
import { Users } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { WorkersSkeleton } from '../components/ui/Skeleton';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';
import { EmptyState } from '../components/ui/EmptyState';
import { WorkersEmptyIllustration } from '../components/illustrations/EmptyIllustrations';
import { TermTooltip } from '../components/ui/TermTooltip';

const DB_DEF = "A federal law requiring contractors on federal or federally funded construction projects to pay workers the locally prevailing wage for their trade. Wages are set by the Department of Labor and published on SAM.gov.";

interface WageClassification {
  id: string;
  tradeCode: string;
  tradeDescription: string;
  laborType: string;
  baseRate: number;
  fringeRate: number;
  totalRate: number;
}

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

interface Worker {
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

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const LABOR_TYPES = [
  { value: 'journeyworker', label: 'Journeyworker' },
  { value: 'apprentice', label: 'Apprentice' },
  { value: 'foreman', label: 'Foreman' },
];

interface ProjectInfo {
  id: string;
  state: string;
  name: string;
}

function blankWorkerForm() {
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
    apprenticeshipProgramName: '',
    rapidsNumber: '',
    tradeCode: '',
    tradeDescription: '',
    laborType: 'journeyworker' as 'journeyworker' | 'apprentice' | 'foreman',
    apprenticePercent: '',
    programName: '',
    waManualRate: '',
    waTradeCode: '',
  };
}

function workerToEditForm(w: Worker) {
  return {
    name: w.name,
    ssn: '',  // Never pre-populate SSN — it is encrypted server-side; client never has the raw value
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

function workerInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const LABOR_TYPE_LABELS: Record<string, { short: string; color: string }> = {
  journeyworker: { short: 'JW', color: 'bg-blue-100 text-blue-800' },
  apprentice: { short: 'APP', color: 'bg-amber-100 text-amber-800' },
  foreman: { short: 'FM', color: 'bg-green-100 text-green-800' },
};

const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'journeyworker', label: 'Journeyman' },
  { key: 'apprentice', label: 'Apprentice' },
];

export function WorkersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState(blankWorkerForm);
  const [formError, setFormError] = useState('');
  const [laborFilter, setLaborFilter] = useState<'all' | 'journeyworker' | 'apprentice'>('all');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', ssn: '', tradeUnion: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '', unionLocal: '', unionBookNumber: '', apprenticeshipCommittee: '', apprenticeshipRegNumber: '', nysRegisteredApprentice: false, race: '', ethnicity: '', gender: '', veteranStatus: '', skillLevel: '', isWoman: null as boolean | null, isMinority: null as boolean | null, oshaTraining: null as boolean | null, workerSex: null as string | null, apprenticeshipProgramName: '', rapidsNumber: '' });
  const [editError, setEditError] = useState('');

  // Add-extra-classification state
  const [addingClassFor, setAddingClassFor] = useState<string | null>(null);
  const [extraClass, setExtraClass] = useState({ tradeCode: '', tradeDescription: '', laborType: 'journeyworker' as 'journeyworker' | 'apprentice' | 'foreman', apprenticePercent: '', programName: '', waManualRate: '', waTradeCode: '' });
  const [extraError, setExtraError] = useState('');

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Delete-classification error state (displayed inline near the affected worker)
  const [deleteClassError, setDeleteClassError] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: () => api.get<{ data: { workers: Worker[] } }>(`/projects/${projectId}/workers`),
    enabled: !!projectId,
  });

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<{ data: { project: ProjectInfo } }>(`/projects/${projectId}`),
    enabled: !!projectId,
  });

  const { data: wdData, isLoading: wdLoading } = useQuery({
    queryKey: ['wage-classifications', projectId],
    queryFn: () => api.get<{
      data: { classifications: WageClassification[]; hasWd: boolean; wdNumber?: string; state?: string; county?: string };
    }>(`/projects/${projectId}/wage-classifications`),
    enabled: !!projectId,
  });

  // Phase 85 PERF-02 — debounced FTS5 search
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 200);

  type WorkerSearchHit = { worker_id: string; name: string; trade_union: string | null };
  const { data: searchData, isFetching: searchFetching } = useQuery({
    queryKey: ['workers-search', projectId, debouncedQuery],
    queryFn: () =>
      api.get<{ data: { workers: WorkerSearchHit[] } }>(
        `/projects/${projectId}/workers/search?q=${encodeURIComponent(debouncedQuery)}`,
      ),
    enabled: !!projectId && debouncedQuery.trim().length > 0,
    staleTime: 30_000,
  });

  const wageClassifications = wdData?.data?.classifications ?? [];
  const hasWd = wdData?.data?.hasWd ?? false;
  const wdNumber = wdData?.data?.wdNumber;
  const allWorkers = data?.data?.workers ?? [];
  const workers = laborFilter === 'all'
    ? allWorkers
    : allWorkers.filter(w =>
        w.classifications.some(c => c.laborType === laborFilter)
      );

  // When user is searching, render search hits; when input is empty, render full list.
  const isSearching = debouncedQuery.trim().length > 0;
  const fullWorkers = workers;
  const searchHits = searchData?.data?.workers ?? [];
  // Re-shape search hits to the existing Worker render contract (other fields shown as null/em-dash).
  const displayedWorkers = isSearching
    ? searchHits.map((h) => {
        const full = fullWorkers.find((w) => w.id === h.worker_id);
        return full ?? {
          id: h.worker_id,
          name: h.name,
          ssnLast4: null,
          hasFullSsn: false,
          tradeUnion: h.trade_union,
          address: null,
          addressStreet: null,
          addressCity: null,
          addressState: null,
          addressZip: null,
          unionLocal: null,
          unionBookNumber: null,
          apprenticeshipCommittee: null,
          apprenticeshipRegNumber: null,
          nysRegisteredApprentice: null,
          race: null,
          ethnicity: null,
          gender: null,
          veteranStatus: null,
          skillLevel: null,
          isWoman: null,
          isMinority: null,
          oshaTraining: null,
          workerSex: null,
          apprenticeshipProgramName: null,
          rapidsNumber: null,
          classifications: [],
        } as Worker;
      })
    : fullWorkers;
  const selectedTrade = wageClassifications.find(wc => wc.tradeCode === form.tradeCode);
  const selectedExtraTrade = wageClassifications.find(wc => wc.tradeCode === extraClass.tradeCode);
  const isWA = projectData?.data?.project?.state?.toUpperCase() === 'WA';
  const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL';
  const isMA = projectData?.data?.project?.state?.toUpperCase() === 'MA';
  const isNJ = projectData?.data?.project?.state?.toUpperCase() === 'NJ';

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addWorker = useMutation({
    mutationFn: async (f: typeof form) => {
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
        : f.tradeCode && selectedTrade;
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
      setForm(blankWorkerForm());
      setFormError('');
    },
    onError: () => setFormError('Could not save worker — check that all required fields are filled in and try again.'),
  });

  const updateWorker = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      api.put<{ data: { worker: Worker } }>(`/projects/${projectId}/workers/${id}`, {
        name: data.name.trim(),
        ...(data.ssn ? { ssn: data.ssn } : {}),
        tradeUnion: data.tradeUnion.trim() || undefined,
        addressStreet: data.addressStreet.trim() || undefined,
        addressCity: data.addressCity.trim() || undefined,
        addressState: data.addressState.trim() || undefined,
        addressZip: data.addressZip.trim() || undefined,
        unionLocal: data.unionLocal.trim() || undefined,
        unionBookNumber: data.unionBookNumber.trim() || undefined,
        apprenticeshipCommittee: data.apprenticeshipCommittee.trim() || undefined,
        apprenticeshipRegNumber: data.apprenticeshipRegNumber.trim() || undefined,
        nysRegisteredApprentice: data.nysRegisteredApprentice,
        apprenticeshipProgramName: data.apprenticeshipProgramName?.trim() || null,
        rapidsNumber: data.rapidsNumber?.trim() || null,
        ...(isIL ? {
          race: data.race || null,
          ethnicity: data.ethnicity || null,
          gender: data.gender || null,
          veteranStatus: data.veteranStatus || null,
          skillLevel: data.skillLevel || null,
        } : {}),
        ...(isMA || isNJ ? {
          isWoman: data.isWoman ?? null,
          isMinority: data.isMinority ?? null,
          oshaTraining: data.oshaTraining ?? null,
        } : {}),
        ...(isNJ ? { workerSex: data.workerSex } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      setEditingId(null);
      setEditError('');
    },
    onError: () => setEditError('Could not save worker — check that all required fields are filled in and try again.'),
  });

  const deleteWorker = useMutation({
    mutationFn: (workerId: string) =>
      api.delete(`/projects/${projectId}/workers/${workerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      setConfirmDeleteId(null);
    },
    onError: () => setEditError('Could not remove worker — they may have payroll entries that must be deleted first.'),
  });

  const deleteClassification = useMutation({
    mutationFn: ({ workerId, classificationId }: { workerId: string; classificationId: string }) =>
      api.delete(`/projects/${projectId}/workers/${workerId}/classifications/${classificationId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      setDeleteClassError('');
    },
    onError: () => setDeleteClassError('Could not update classification — try refreshing the page.'),
  });

  const addClassification = useMutation({
    mutationFn: ({ workerId }: { workerId: string }) => {
      const waRate = parseFloat(extraClass.waManualRate);
      return api.post(`/projects/${projectId}/workers/${workerId}/classifications`, {
        tradeCode: isWA ? extraClass.tradeCode.trim() : selectedExtraTrade!.tradeCode,
        tradeDescription: isWA ? extraClass.tradeDescription.trim() : selectedExtraTrade!.tradeDescription,
        laborType: extraClass.laborType,
        ...(extraClass.laborType === 'apprentice' ? { apprenticePercent: parseInt(extraClass.apprenticePercent, 10) } : {}),
        ...(extraClass.laborType === 'apprentice' && extraClass.programName.trim() ? { programName: extraClass.programName.trim() } : {}),
        ...(isWA && waRate > 0 ? { waManualRate: waRate } : {}),
        ...(isWA && extraClass.waTradeCode ? { waTradeCode: extraClass.waTradeCode } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      setAddingClassFor(null);
      setExtraClass({ tradeCode: '', tradeDescription: '', laborType: 'journeyworker', apprenticePercent: '', programName: '', waManualRate: '', waTradeCode: '' });
      setExtraError('');
    },
    onError: () => setExtraError('Could not update classification — try refreshing the page.'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSubmit() {
    setFormError('');
    if (!form.name.trim()) { setFormError('Worker name is required'); return; }
    if (form.ssn && !/^\d+$/.test(form.ssn)) { setFormError('SSN must contain only digits.'); return; }
    if (form.ssn && form.ssn.length !== 9) { setFormError('SSN must be exactly 9 digits.'); return; }
    if (!isWA && form.tradeCode && !selectedTrade) { setFormError('Select a valid trade from the list'); return; }
    if (form.laborType === 'apprentice' && !form.apprenticePercent) { setFormError('Apprentice % is required'); return; }
    addWorker.mutate(form);
  }

  function handleEditSave(workerId: string) {
    setEditError('');
    if (!editForm.name.trim()) { setEditError('Name is required'); return; }
    if (editForm.ssn && !/^\d+$/.test(editForm.ssn)) { setEditError('SSN must contain only digits.'); return; }
    if (editForm.ssn && editForm.ssn.length !== 9) { setEditError('SSN must be exactly 9 digits.'); return; }
    updateWorker.mutate({ id: workerId, data: editForm });
  }

  function handleAddExtraClass(workerId: string) {
    setExtraError('');
    if (!extraClass.tradeCode) { setExtraError('Trade code is required'); return; }
    if (isWA && !extraClass.tradeDescription.trim()) { setExtraError('Trade description is required'); return; }
    if (!isWA && !selectedExtraTrade) { setExtraError('Trade not found'); return; }
    if (extraClass.laborType === 'apprentice' && !extraClass.apprenticePercent) { setExtraError('Apprentice % required'); return; }
    addClassification.mutate({ workerId });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <button onClick={() => navigate(`/projects/${projectId}`)} className="text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4 inline-flex items-center min-h-[44px] px-1">
          &larr; Back to Project
        </button>
        <PageHeader title="Workers" />

        <HelpCallout
          icon={Users}
          title="Register Your Workers"
          body={<>Federal law requires every worker on a <TermTooltip term="Davis-Bacon" definition={DB_DEF} /> project to be logged with their classification and pay rate. Add all workers before entering payroll.</>}
        />

        {/* WD status */}
        {wdLoading && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            Loading prevailing wage rates...
          </div>
        )}
        {!wdLoading && hasWd && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-800">
            Wage determination <span className="font-mono font-medium">{wdNumber}</span> — prevailing wage rates loaded automatically.
          </div>
        )}
        {!wdLoading && !hasWd && wdData && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No federal wage determination found for this project's state and county.
            Use the <button onClick={() => navigate('/wages')} className="underline font-medium">Wage Lookup</button> page to search or enter rates manually.
          </div>
        )}

        {isLoading && <WorkersSkeleton />}
        {isError && (
          <div className="text-center py-12">
            <p className="text-red-600 text-sm mb-4">Failed to load workers.</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center justify-center font-semibold rounded-sm text-sm px-4 py-3 min-h-[44px] bg-transparent text-brand-gold border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !isError && workers.length === 0 && (
          <EmptyState
            illustration={<WorkersEmptyIllustration />}
            icon={Users}
            heading="No workers on this project yet"
            message={<>Federal law requires all workers to be registered before entering certified payroll. Each worker's trade classification and wage rate determines overtime calculations and DOL compliance — even workers who worked only one day must be logged.</>}
            action={
              <button
                onClick={() => {
                  const nameInput = document.querySelector<HTMLInputElement>('#add-worker-name');
                  if (nameInput) nameInput.focus();
                }}
                className="inline-flex items-center justify-center font-semibold rounded-sm transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 bg-brand-gold text-nav-dark hover:bg-brand-gold/90 border border-transparent text-sm px-4 py-2"
              >
                Add First Worker
              </button>
            }
          />
        )}

        {/* Ready-for-payroll nudge */}
        {allWorkers.length > 0 && (
          <div className="mb-4 rounded-lg border border-brand-gold/40 bg-brand-gold/5 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-700"><span className="font-semibold">{allWorkers.length} worker{allWorkers.length !== 1 ? 's' : ''} registered.</span> Ready to enter payroll for the current week.</p>
            <Link to={`/projects/${projectId}/payroll`} className="text-sm font-semibold text-brand-gold hover:underline whitespace-nowrap ml-4">Enter Payroll →</Link>
          </div>
        )}

        {/* Filter chips */}
        {allWorkers.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {FILTER_CHIPS.map(chip => (
              <button
                key={chip.key}
                onClick={() => setLaborFilter(chip.key as typeof laborFilter)}
                className={`px-3 py-2.5 rounded-full text-sm font-medium border transition-colors min-h-[44px] ${
                  laborFilter === chip.key
                    ? 'bg-brand-navy text-white border-brand-navy'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Search input */}
        {allWorkers.length > 0 && (
          <div className="mb-4">
            <label htmlFor="worker-search" className="sr-only">Search workers</label>
            <input
              id="worker-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workers by name or trade union..."
              className="w-full px-3 py-2 rounded-md border border-border-default bg-surface-card text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold"
              autoComplete="off"
            />
            {isSearching && searchFetching && (
              <p className="mt-1 text-xs text-text-muted">Searching...</p>
            )}
            {isSearching && !searchFetching && searchHits.length === 0 && (
              <p className="mt-1 text-xs text-text-muted">No workers match "{debouncedQuery}".</p>
            )}
          </div>
        )}

        {/* Worker list */}
        {allWorkers.length > 0 && !isSearching && workers.length === 0 && (
          <p className="text-sm text-gray-500 mb-4">No workers match the selected filter.</p>
        )}
        {displayedWorkers.length > 0 && (
          <div className="mb-8 space-y-3">
            {displayedWorkers.map((w) => (
              <Card key={w.id} padding="sm">

                {editingId === w.id ? (
                  /* ── Inline edit form ── */
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-3">Edit Worker</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="col-span-1 sm:col-span-2">
                        <label htmlFor={`edit-name-${w.id}`} className="block text-xs text-gray-600 mb-1">Full Name *</label>
                        <input
                          id={`edit-name-${w.id}`}
                          type="text"
                          value={editForm.name}
                          onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-ssn-${w.id}`} className="block text-xs text-gray-600 mb-1">Social Security Number</label>
                        <input
                          id={`edit-ssn-${w.id}`}
                          type="password"
                          inputMode="numeric"
                          maxLength={9}
                          autoComplete="off"
                          value={editForm.ssn}
                          onChange={e => setEditForm(p => ({ ...p, ssn: e.target.value.replace(/\D/g, '') }))}
                          placeholder="123456789"
                          className="w-full rounded border border-gray-200 px-3 py-2 text-base bg-surface-muted focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                        <p className="text-xs text-text-secondary mt-1">Enter 9-digit SSN to update. Leave blank to keep current value.</p>
                        {w.ssnLast4 && !w.hasFullSsn && (
                          <div className="mt-2">
                            <Badge variant="neutral">Full SSN not on file</Badge>
                          </div>
                        )}
                      </div>
                      <div>
                        <label htmlFor={`edit-union-${w.id}`} className="block text-xs text-gray-600 mb-1">Trade Union</label>
                        <input
                          id={`edit-union-${w.id}`}
                          type="text"
                          value={editForm.tradeUnion}
                          onChange={e => setEditForm(p => ({ ...p, tradeUnion: e.target.value }))}
                          placeholder="optional"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Address <span className="text-gray-400 font-normal normal-case">(required for WH-347)</span></p>
                      <div className="space-y-2">
                        <label htmlFor={`edit-street-${w.id}`} className="sr-only">Street address</label>
                        <input
                          id={`edit-street-${w.id}`}
                          type="text"
                          placeholder="Street"
                          value={editForm.addressStreet}
                          onChange={e => setEditForm(p => ({ ...p, addressStreet: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label htmlFor={`edit-city-${w.id}`} className="sr-only">City</label>
                            <input
                              id={`edit-city-${w.id}`}
                              type="text"
                              placeholder="City"
                              value={editForm.addressCity}
                              onChange={e => setEditForm(p => ({ ...p, addressCity: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                            />
                          </div>
                          <div>
                            <label htmlFor={`edit-state-${w.id}`} className="sr-only">State</label>
                            <input
                              id={`edit-state-${w.id}`}
                              type="text"
                              placeholder="State"
                              value={editForm.addressState}
                              onChange={e => setEditForm(p => ({ ...p, addressState: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                            />
                          </div>
                          <div>
                            <label htmlFor={`edit-zip-${w.id}`} className="sr-only">Zip code</label>
                            <input
                              id={`edit-zip-${w.id}`}
                              type="text"
                              placeholder="Zip"
                              value={editForm.addressZip}
                              onChange={e => setEditForm(p => ({ ...p, addressZip: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <details className="mt-4 border-t border-gray-100 pt-4 group">
                      <summary className="cursor-pointer text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1 list-none">
                        Union Information
                        <span className="text-xs font-normal text-gray-400 ml-1">(optional — click to expand)</span>
                      </summary>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor={`edit-union-local-${w.id}`} className="sr-only">Union local</label>
                          <input
                            id={`edit-union-local-${w.id}`}
                            type="text"
                            placeholder="Union Local"
                            value={editForm.unionLocal}
                            onChange={e => setEditForm(p => ({ ...p, unionLocal: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-book-${w.id}`} className="sr-only">Union book number</label>
                          <input
                            id={`edit-book-${w.id}`}
                            type="text"
                            placeholder="Book Number"
                            value={editForm.unionBookNumber}
                            onChange={e => setEditForm(p => ({ ...p, unionBookNumber: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                          />
                        </div>
                      </div>
                    </details>
                    {w.classifications?.some(c => c.laborType === 'apprentice') && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="text-sm font-semibold text-gray-900 mb-2">Apprenticeship</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label htmlFor={`edit-app-committee-${w.id}`} className="sr-only">Apprenticeship committee</label>
                            <input
                              id={`edit-app-committee-${w.id}`}
                              type="text"
                              placeholder="Committee"
                              value={editForm.apprenticeshipCommittee}
                              onChange={e => setEditForm(p => ({ ...p, apprenticeshipCommittee: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                            />
                          </div>
                          <div>
                            <label htmlFor={`edit-app-reg-${w.id}`} className="sr-only">Apprenticeship registration number</label>
                            <input
                              id={`edit-app-reg-${w.id}`}
                              type="text"
                              placeholder="Registration Number"
                              value={editForm.apprenticeshipRegNumber}
                              onChange={e => setEditForm(p => ({ ...p, apprenticeshipRegNumber: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {w.classifications.some(c => c.laborType === 'apprentice') && (
                      <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-800">Apprenticeship Program (Phase 70)</p>
                        <div>
                          <label htmlFor={`edit-app-program-${w.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                            Apprenticeship Program Name
                          </label>
                          <input
                            id={`edit-app-program-${w.id}`}
                            type="text"
                            placeholder="e.g. IBEW Apprenticeship Training"
                            value={editForm.apprenticeshipProgramName ?? ''}
                            onChange={e => setEditForm(p => ({ ...p, apprenticeshipProgramName: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-rapids-${w.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                            RAPIDS Number
                          </label>
                          <input
                            id={`edit-rapids-${w.id}`}
                            type="text"
                            placeholder="DOL RAPIDS registration number"
                            value={editForm.rapidsNumber ?? ''}
                            onChange={e => setEditForm(p => ({ ...p, rapidsNumber: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                          />
                        </div>
                      </div>
                    )}
                    <details className="mt-4 border-t border-gray-100 pt-4">
                      <summary className="cursor-pointer text-sm font-semibold text-gray-700 list-none flex items-center gap-2">
                        Apprenticeship
                        <span className="text-xs font-normal text-gray-400">(optional)</span>
                      </summary>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`nysRegisteredApprentice-edit-${w.id}`}
                          checked={editForm.nysRegisteredApprentice ?? false}
                          onChange={(e) => setEditForm(p => ({ ...p, nysRegisteredApprentice: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                        />
                        <label htmlFor={`nysRegisteredApprentice-edit-${w.id}`} className="text-sm font-medium text-gray-700">
                          NYS Registered Apprentice
                        </label>
                      </div>
                    </details>
                    {isIL && (
                      <details className="rounded-lg border border-purple-200 bg-purple-50 p-3" open>
                        <summary className="cursor-pointer text-sm font-medium text-purple-800">IL Compliance Demographics</summary>
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label htmlFor={`edit-il-race-${w.id}`} className="block text-xs font-medium text-gray-700 mb-1">Race</label>
                              <input id={`edit-il-race-${w.id}`} className="w-full rounded border px-2 py-1.5 text-base" value={editForm.race} onChange={e => setEditForm(f => ({ ...f, race: e.target.value }))} placeholder="Optional" />
                            </div>
                            <div>
                              <label htmlFor={`edit-il-ethnicity-${w.id}`} className="block text-xs font-medium text-gray-700 mb-1">Ethnicity</label>
                              <input id={`edit-il-ethnicity-${w.id}`} className="w-full rounded border px-2 py-1.5 text-base" value={editForm.ethnicity} onChange={e => setEditForm(f => ({ ...f, ethnicity: e.target.value }))} placeholder="Optional" />
                            </div>
                            <div>
                              <label htmlFor={`edit-il-gender-${w.id}`} className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                              <input id={`edit-il-gender-${w.id}`} className="w-full rounded border px-2 py-1.5 text-base" value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))} placeholder="Optional" />
                            </div>
                            <div>
                              <label htmlFor={`edit-il-veteran-${w.id}`} className="block text-xs font-medium text-gray-700 mb-1">Veteran Status</label>
                              <input id={`edit-il-veteran-${w.id}`} className="w-full rounded border px-2 py-1.5 text-base" value={editForm.veteranStatus} onChange={e => setEditForm(f => ({ ...f, veteranStatus: e.target.value }))} placeholder="Optional" />
                            </div>
                          </div>
                          <div>
                            <label htmlFor={`edit-il-skill-${w.id}`} className="block text-xs font-medium text-gray-700 mb-1">Skill Level</label>
                            <select id={`edit-il-skill-${w.id}`} className="w-full rounded border px-2 py-1.5 text-base" value={editForm.skillLevel} onChange={e => setEditForm(f => ({ ...f, skillLevel: e.target.value }))}>
                              <option value="">Not specified</option>
                              <option value="journeyman">Journeyman</option>
                              <option value="apprentice">Apprentice</option>
                            </select>
                          </div>
                        </div>
                      </details>
                    )}
                    {(isMA || isNJ) && (
                      <details className="rounded-lg border border-teal-200 bg-teal-50 p-3" open>
                        <summary className="cursor-pointer text-sm font-medium text-teal-800">
                          MA/NJ Workforce Participation
                        </summary>
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 gap-3">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={editForm.isWoman ?? false}
                                onChange={e => setEditForm(f => ({ ...f, isWoman: e.target.checked }))}
                              />
                              Woman (self-identified)
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={editForm.isMinority ?? false}
                                onChange={e => setEditForm(f => ({ ...f, isMinority: e.target.checked }))}
                              />
                              Minority (self-identified)
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={editForm.oshaTraining ?? false}
                                onChange={e => setEditForm(f => ({ ...f, oshaTraining: e.target.checked }))}
                              />
                              OSHA 10 Certified
                            </label>
                          </div>
                          <p className="text-xs text-teal-600">
                            All fields are optional. Workers may decline to self-identify.
                          </p>
                        </div>
                      </details>
                    )}
                    {isNJ && (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                        <p className="text-sm font-medium text-indigo-800 mb-2">NJ EEO — Sex</p>
                        <label htmlFor={`edit-nj-sex-${w.id}`} className="sr-only">Worker sex (NJ EEO)</label>
                        <select
                          id={`edit-nj-sex-${w.id}`}
                          className="w-full rounded border px-2 py-1.5 text-base"
                          value={editForm.workerSex ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, workerSex: e.target.value || null }))}
                        >
                          <option value="">Not reported</option>
                          <option value="M">M — Male</option>
                          <option value="F">F — Female</option>
                          <option value="N">N — Non-binary / Decline to state</option>
                        </select>
                      </div>
                    )}
                    {editError && <p className="text-xs text-red-600 mb-2">{editError}</p>}
                    <div className="flex gap-2">
                      <Button onClick={() => handleEditSave(w.id)} disabled={updateWorker.isPending}>
                        {updateWorker.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button variant="ghost" onClick={() => { setEditingId(null); setEditError(''); }}>Cancel</Button>
                    </div>
                  </div>
                ) : confirmDeleteId === w.id ? (
                  /* ── Delete confirmation ── */
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">Remove <span className="font-medium">{w.name}</span> and all their trade assignments?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteWorker.mutate(w.id)}
                        disabled={deleteWorker.isPending}
                        className="px-4 py-3 min-h-[44px] bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                        aria-label={`Confirm remove ${w.name}`}
                      >
                        {deleteWorker.isPending ? 'Removing...' : 'Yes, Remove'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-4 py-3 min-h-[44px] text-sm text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Normal worker card view ── */
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="flex items-start gap-3">
                        {/* Avatar circle */}
                        <div className="w-10 h-10 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {workerInitials(w.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">{w.name}</p>
                            {/* Labor type role badges */}
                            {w.classifications.map(c => {
                              const lt = LABOR_TYPE_LABELS[c.laborType] ?? { short: c.laborType, color: 'bg-gray-100 text-gray-700' };
                              return (
                                <span key={c.id} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${lt.color}`}>
                                  {lt.short}
                                </span>
                              );
                            })}
                            {/* Union local chip */}
                            {w.unionLocal && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                Local {w.unionLocal}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {w.tradeUnion && <span className="mr-3">Union: {w.tradeUnion}</span>}
                            {w.ssnLast4 && <span className="mr-3">SSN: ***-**-{w.ssnLast4}</span>}
                            {[w.addressStreet, w.addressCity, w.addressState, w.addressZip].some(Boolean) && (
                              <span className="mr-3">{[w.addressStreet, w.addressCity, w.addressState, w.addressZip].filter(Boolean).join(', ')}</span>
                            )}
                            {w.unionLocal && w.unionBookNumber && <span className="mr-3">Book #{w.unionBookNumber}</span>}
                            {w.apprenticeshipCommittee && <span className="mr-3">Apprenticeship: {w.apprenticeshipCommittee}{w.apprenticeshipRegNumber ? ` #${w.apprenticeshipRegNumber}` : ''}</span>}
                          </p>
                          {(![w.addressStreet, w.addressCity, w.addressState, w.addressZip].some(Boolean) || !w.ssnLast4) && (
                            <Badge variant="warning" className="mt-1">Missing data — WH-347 blocked</Badge>
                          )}
                          {(isMA || isNJ) && (
                            <p className="text-xs text-teal-700 mt-1">
                              <span className="mr-3">Woman: {w.isWoman === null ? '--' : w.isWoman ? 'Yes' : 'No'}</span>
                              <span className="mr-3">Minority: {w.isMinority === null ? '--' : w.isMinority ? 'Yes' : 'No'}</span>
                              <span className="mr-3">OSHA 10: {w.oshaTraining === null ? '--' : w.oshaTraining ? 'Yes' : 'No'}</span>
                            </p>
                          )}
                          {isNJ && w.workerSex && (
                            <p className="text-xs text-indigo-700 mt-1">Sex: {w.workerSex}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/projects/${projectId}/workers/${w.id}/compliance-history`}
                          className="text-xs text-gray-500 border border-gray-300 rounded px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 hover:bg-gray-50 transition-colors flex items-center"
                        >
                          Compliance History
                        </Link>
                        <button
                          onClick={() => { setEditingId(w.id); setEditForm(workerToEditForm(w)); setAddingClassFor(null); }}
                          className="text-xs text-gray-500 border border-gray-300 rounded px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 hover:bg-gray-50 transition-colors"
                          aria-label={`Edit ${w.name}`}
                        >
                          Edit
                        </button>
                        {(hasWd || isWA) && (
                          <button
                            onClick={() => { setAddingClassFor(addingClassFor === w.id ? null : w.id); setExtraError(''); setExtraClass({ tradeCode: '', tradeDescription: '', laborType: 'journeyworker', apprenticePercent: '', programName: '', waManualRate: '', waTradeCode: '' }); setEditingId(null); }}
                            className="text-xs text-gray-500 border border-gray-300 rounded px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 hover:bg-gray-50 transition-colors"
                            aria-label={`Add trade for ${w.name}`}
                          >
                            + Trade
                          </button>
                        )}
                        <button
                          onClick={() => { setConfirmDeleteId(w.id); setEditingId(null); setAddingClassFor(null); }}
                          className="text-xs text-red-400 border border-red-200 rounded px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 hover:bg-red-50 transition-colors"
                          aria-label={`Remove ${w.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Classifications */}
                    {w.classifications.length > 0 && (
                      <div className="mt-3 divide-y divide-gray-100 border border-gray-100 rounded">
                        {deleteClassError && (
                          <p className="px-3 py-2 text-xs text-red-600">{deleteClassError}</p>
                        )}
                        {w.classifications.map((c) => (
                          <div key={c.id} className="flex items-center justify-between px-3 py-2">
                            <div>
                              <span className="text-sm text-gray-900">{c.tradeDescription}</span>
                              <span className="ml-2 text-xs text-gray-400 capitalize">· {c.laborType}</span>
                              {c.apprenticePercent !== null && (
                                <span className="ml-1 text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{c.apprenticePercent}%</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-xs font-mono text-gray-600">
                                {c.baseRate !== null
                                  ? <>{fmt(c.baseRate)} base + {fmt(c.fringeRate ?? 0)} fringe</>
                                  : <span className="text-amber-600">Rate pending</span>
                                }
                              </div>
                              <button
                                onClick={() => deleteClassification.mutate({ workerId: w.id, classificationId: c.id })}
                                className="p-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
                                aria-label={`Remove ${c.tradeDescription} classification for ${w.name}`}
                                title="Remove trade"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add extra classification */}
                    {addingClassFor === w.id && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="text-sm font-semibold text-gray-900 mb-3">Add Another Trade</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {isWA ? (
                            <>
                              <div>
                                <label htmlFor={`extra-trade-code-${w.id}`} className="block text-xs text-gray-600 mb-1">Trade Code</label>
                                <input
                                  id={`extra-trade-code-${w.id}`}
                                  type="text"
                                  value={extraClass.tradeCode}
                                  onChange={(e) => setExtraClass(p => ({ ...p, tradeCode: e.target.value.toUpperCase() }))}
                                  placeholder="e.g. CARP"
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                                />
                              </div>
                              <div>
                                <label htmlFor={`extra-trade-desc-${w.id}`} className="block text-xs text-gray-600 mb-1">Trade Description</label>
                                <input
                                  id={`extra-trade-desc-${w.id}`}
                                  type="text"
                                  value={extraClass.tradeDescription ?? ''}
                                  onChange={(e) => setExtraClass(p => ({ ...p, tradeDescription: e.target.value }))}
                                  placeholder="e.g. Carpenter"
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="col-span-2">
                              <label htmlFor={`extra-trade-select-${w.id}`} className="block text-xs text-gray-600 mb-1">Trade Classification</label>
                              <select
                                id={`extra-trade-select-${w.id}`}
                                value={extraClass.tradeCode}
                                onChange={(e) => setExtraClass(p => ({ ...p, tradeCode: e.target.value }))}
                                className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                              >
                                <option value="">— Select a trade —</option>
                                {wageClassifications.map(wc => (
                                  <option key={wc.id} value={wc.tradeCode}>
                                    {wc.tradeDescription} — {fmt(wc.baseRate)} + {fmt(wc.fringeRate)} fringe/hr
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <label htmlFor={`extra-labor-type-${w.id}`} className="block text-xs text-gray-600 mb-1">Labor Type</label>
                            <select
                              id={`extra-labor-type-${w.id}`}
                              value={extraClass.laborType}
                              onChange={(e) => setExtraClass(p => ({ ...p, laborType: e.target.value as typeof extraClass.laborType }))}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                            >
                              {LABOR_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                            </select>
                          </div>
                          {extraClass.laborType === 'apprentice' && (
                            <div>
                              <label htmlFor={`extra-app-pct-${w.id}`} className="block text-xs text-gray-600 mb-1">Apprentice % of Journey Rate</label>
                              <input
                                id={`extra-app-pct-${w.id}`}
                                type="number"
                                min="0"
                                max="100"
                                value={extraClass.apprenticePercent}
                                onChange={(e) => setExtraClass(p => ({ ...p, apprenticePercent: e.target.value }))}
                                placeholder="e.g. 80"
                                className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                              />
                            </div>
                          )}
                          {extraClass.laborType === 'apprentice' && (
                            <div className="col-span-2">
                              <label htmlFor={`extra-program-name-${w.id}`} className="block text-xs text-gray-600 mb-1">DOL Apprenticeship Program Name <span className="text-gray-400">(optional)</span></label>
                              <input
                                id={`extra-program-name-${w.id}`}
                                type="text"
                                placeholder="DOL apprenticeship program name (optional)"
                                value={extraClass.programName}
                                onChange={e => setExtraClass(s => ({ ...s, programName: e.target.value }))}
                                className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-brand-gold focus:outline-hidden"
                              />
                            </div>
                          )}
                          {isWA && (
                            <div className="col-span-2 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                              <p className="text-xs font-medium text-blue-800">Washington Prevailing Wage</p>
                              <div>
                                <label htmlFor={`extra-wa-rate-${w.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                  WA Prevailing Rate ($/hr)
                                </label>
                                <input
                                  id={`extra-wa-rate-${w.id}`}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="e.g. 58.25"
                                  value={extraClass.waManualRate}
                                  onChange={(e) => setExtraClass(s => ({ ...s, waManualRate: e.target.value }))}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-base focus:border-brand-gold focus:outline-none"
                                />
                              </div>
                              <div>
                                <label htmlFor={`extra-wa-trade-code-${w.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                  WA Trade Code
                                </label>
                                <select
                                  id={`extra-wa-trade-code-${w.id}`}
                                  value={extraClass.waTradeCode}
                                  onChange={(e) => setExtraClass(s => ({ ...s, waTradeCode: e.target.value }))}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-base focus:border-brand-gold focus:outline-none"
                                >
                                  <option value="">Select WA trade code</option>
                                  <option value="BOIL">BOIL — Boilermakers</option>
                                  <option value="CARP">CARP — Carpenters</option>
                                  <option value="ELEC">ELEC — Electricians (Inside)</option>
                                  <option value="ELCO">ELCO — Electricians (Outside/Line)</option>
                                  <option value="GLAZ">GLAZ — Glaziers</option>
                                  <option value="IRON">IRON — Ironworkers</option>
                                  <option value="LABO">LABO — Laborers</option>
                                  <option value="MASO">MASO — Masons</option>
                                  <option value="OPER">OPER — Operating Engineers</option>
                                  <option value="PAIN">PAIN — Painters</option>
                                  <option value="PFRT">PFRT — Pile Drivers</option>
                                  <option value="PLAS">PLAS — Plasterers</option>
                                  <option value="PLUM">PLUM — Plumbers and Pipefitters</option>
                                  <option value="ROOF">ROOF — Roofers</option>
                                  <option value="SHEE">SHEE — Sheet Metal Workers</option>
                                  <option value="TEAM">TEAM — Teamsters</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                        {extraError && <p className="text-xs text-red-600 mb-2">{extraError}</p>}
                        <div className="flex gap-2">
                          <Button onClick={() => handleAddExtraClass(w.id)} disabled={addClassification.isPending}>
                            {addClassification.isPending ? 'Saving...' : 'Save'}
                          </Button>
                          <button onClick={() => setAddingClassFor(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
                        </div>
                      </div>
                    )}
                  </>
                )}

              </Card>
            ))}
          </div>
        )}

        {/* Add Worker form */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5">Add Worker</h2>

          <div className="space-y-4">
            {/* Name + SSN + Union */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="add-worker-name" className="block text-xs text-gray-600 mb-1">Full Name *</label>
                <input
                  id="add-worker-name"
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. John Smith"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
              </div>
              <div>
                <label htmlFor="add-worker-ssn" className="block text-xs text-gray-600 mb-1">Social Security Number (optional)</label>
                <input
                  id="add-worker-ssn"
                  type="password"
                  inputMode="numeric"
                  maxLength={9}
                  autoComplete="off"
                  value={form.ssn}
                  onChange={e => setForm(p => ({ ...p, ssn: e.target.value.replace(/\D/g, '') }))}
                  placeholder="123456789"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-base bg-surface-muted focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
              </div>
              <div>
                <label htmlFor="add-worker-union" className="block text-xs text-gray-600 mb-1">Trade Union (optional)</label>
                <input
                  id="add-worker-union"
                  type="text"
                  value={form.tradeUnion}
                  onChange={e => setForm(p => ({ ...p, tradeUnion: e.target.value }))}
                  placeholder="e.g. Carpenters Local 150"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm font-semibold text-gray-900 mb-2">Address <span className="text-gray-400 font-normal normal-case">(required for WH-347)</span></p>
              <div className="space-y-2">
                <label htmlFor="add-worker-street" className="sr-only">Street address</label>
                <input
                  id="add-worker-street"
                  type="text"
                  placeholder="Street"
                  value={form.addressStreet}
                  onChange={e => setForm(p => ({ ...p, addressStreet: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="add-worker-city" className="sr-only">City</label>
                    <input
                      id="add-worker-city"
                      type="text"
                      placeholder="City"
                      value={form.addressCity}
                      onChange={e => setForm(p => ({ ...p, addressCity: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-worker-state" className="sr-only">State</label>
                    <input
                      id="add-worker-state"
                      type="text"
                      placeholder="State"
                      value={form.addressState}
                      onChange={e => setForm(p => ({ ...p, addressState: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-worker-zip" className="sr-only">Zip code</label>
                    <input
                      id="add-worker-zip"
                      type="text"
                      placeholder="Zip"
                      value={form.addressZip}
                      onChange={e => setForm(p => ({ ...p, addressZip: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    />
                  </div>
                </div>
              </div>
            </div>
            <details className="mt-2 border-t border-gray-100 pt-4 group">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1 list-none">
                Union Information
                <span className="text-xs font-normal text-gray-400 ml-1">(optional — click to expand)</span>
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="add-worker-union-local" className="sr-only">Union local</label>
                  <input
                    id="add-worker-union-local"
                    type="text"
                    placeholder="Union Local"
                    value={form.unionLocal}
                    onChange={e => setForm(p => ({ ...p, unionLocal: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                  />
                </div>
                <div>
                  <label htmlFor="add-worker-book-number" className="sr-only">Union book number</label>
                  <input
                    id="add-worker-book-number"
                    type="text"
                    placeholder="Book Number"
                    value={form.unionBookNumber}
                    onChange={e => setForm(p => ({ ...p, unionBookNumber: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                  />
                </div>
              </div>
            </details>

            <details className="mt-2 border-t border-gray-100 pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700 list-none flex items-center gap-2">
                Apprenticeship
                <span className="text-xs font-normal text-gray-400">(optional)</span>
              </summary>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="nysRegisteredApprentice"
                  checked={form.nysRegisteredApprentice ?? false}
                  onChange={(e) => setForm(p => ({ ...p, nysRegisteredApprentice: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                />
                <label htmlFor="nysRegisteredApprentice" className="text-sm font-medium text-gray-700">
                  NYS Registered Apprentice
                </label>
              </div>
            </details>

            {isIL && (
              <details className="rounded-lg border border-purple-200 bg-purple-50 p-3" open>
                <summary className="cursor-pointer text-sm font-medium text-purple-800">IL Compliance Demographics</summary>
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="add-il-race" className="block text-xs font-medium text-gray-700 mb-1">Race</label>
                      <input id="add-il-race" className="w-full rounded border px-2 py-1.5 text-base" value={form.race} onChange={e => setForm(f => ({ ...f, race: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div>
                      <label htmlFor="add-il-ethnicity" className="block text-xs font-medium text-gray-700 mb-1">Ethnicity</label>
                      <input id="add-il-ethnicity" className="w-full rounded border px-2 py-1.5 text-base" value={form.ethnicity} onChange={e => setForm(f => ({ ...f, ethnicity: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div>
                      <label htmlFor="add-il-gender" className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                      <input id="add-il-gender" className="w-full rounded border px-2 py-1.5 text-base" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div>
                      <label htmlFor="add-il-veteran" className="block text-xs font-medium text-gray-700 mb-1">Veteran Status</label>
                      <input id="add-il-veteran" className="w-full rounded border px-2 py-1.5 text-base" value={form.veteranStatus} onChange={e => setForm(f => ({ ...f, veteranStatus: e.target.value }))} placeholder="Optional" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="add-il-skill" className="block text-xs font-medium text-gray-700 mb-1">Skill Level</label>
                    <select id="add-il-skill" className="w-full rounded border px-2 py-1.5 text-base" value={form.skillLevel} onChange={e => setForm(f => ({ ...f, skillLevel: e.target.value }))}>
                      <option value="">Not specified</option>
                      <option value="journeyman">Journeyman</option>
                      <option value="apprentice">Apprentice</option>
                    </select>
                  </div>
                </div>
              </details>
            )}

            {/* Trade selection */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Trade Classification</p>

              {wdLoading ? (
                <p className="text-sm text-gray-400">Loading available trades...</p>
              ) : isWA ? (
                /* WA projects: manual trade entry + WA rate section */
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="add-wa-trade-code" className="block text-xs text-gray-600 mb-1">Trade Code</label>
                    <input
                      id="add-wa-trade-code"
                      type="text"
                      value={form.tradeCode}
                      onChange={e => setForm(p => ({ ...p, tradeCode: e.target.value.toUpperCase() }))}
                      placeholder="e.g. CARP"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-wa-trade-desc" className="block text-xs text-gray-600 mb-1">Trade Description</label>
                    <input
                      id="add-wa-trade-desc"
                      type="text"
                      value={form.tradeDescription}
                      onChange={e => setForm(p => ({ ...p, tradeDescription: e.target.value }))}
                      placeholder="e.g. Carpenter"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-wa-labor-type" className="block text-xs text-gray-600 mb-1">Labor Type</label>
                    <select
                      id="add-wa-labor-type"
                      value={form.laborType}
                      onChange={e => setForm(p => ({ ...p, laborType: e.target.value as typeof form.laborType }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    >
                      {LABOR_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                    </select>
                  </div>
                  {form.laborType === 'apprentice' && (
                    <div>
                      <label htmlFor="add-wa-app-pct" className="block text-xs text-gray-600 mb-1">Apprentice % of Journey Rate</label>
                      <input
                        id="add-wa-app-pct"
                        type="number"
                        min="0"
                        max="100"
                        value={form.apprenticePercent}
                        onChange={e => setForm(p => ({ ...p, apprenticePercent: e.target.value }))}
                        placeholder="e.g. 80"
                        className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                      />
                    </div>
                  )}
                  {form.laborType === 'apprentice' && (
                    <div className="col-span-2">
                      <label htmlFor="add-wa-apprenticeship-program-name" className="block text-xs text-gray-600 mb-1">
                        Apprenticeship Program Name <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        id="add-wa-apprenticeship-program-name"
                        type="text"
                        placeholder="e.g. IBEW Apprenticeship Training"
                        value={form.apprenticeshipProgramName}
                        onChange={e => setForm(f => ({ ...f, apprenticeshipProgramName: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-brand-gold focus:outline-hidden"
                      />
                    </div>
                  )}
                  {form.laborType === 'apprentice' && (
                    <div>
                      <label htmlFor="add-wa-rapids-number" className="block text-xs text-gray-600 mb-1">
                        RAPIDS Number <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        id="add-wa-rapids-number"
                        type="text"
                        placeholder="DOL RAPIDS registration number"
                        value={form.rapidsNumber}
                        onChange={e => setForm(f => ({ ...f, rapidsNumber: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-brand-gold focus:outline-hidden"
                      />
                    </div>
                  )}
                  <div className="col-span-2 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-800">Washington Prevailing Wage</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="add-wa-manual-rate" className="block text-xs font-medium text-gray-700 mb-1">Prevailing Rate ($/hr)</label>
                        <input
                          id="add-wa-manual-rate"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 58.25"
                          value={form.waManualRate}
                          onChange={(e) => setForm(f => ({ ...f, waManualRate: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-base focus:border-brand-gold focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="add-wa-trade-code-select" className="block text-xs font-medium text-gray-700 mb-1">WA Trade Code</label>
                        <select
                          id="add-wa-trade-code-select"
                          value={form.waTradeCode}
                          onChange={(e) => setForm(f => ({ ...f, waTradeCode: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-base focus:border-brand-gold focus:outline-none"
                        >
                          <option value="">Select code</option>
                          <option value="BOIL">BOIL — Boilermakers</option>
                          <option value="CARP">CARP — Carpenters</option>
                          <option value="ELEC">ELEC — Electricians (Inside)</option>
                          <option value="ELCO">ELCO — Electricians (Outside/Line)</option>
                          <option value="GLAZ">GLAZ — Glaziers</option>
                          <option value="IRON">IRON — Ironworkers</option>
                          <option value="LABO">LABO — Laborers</option>
                          <option value="MASO">MASO — Masons</option>
                          <option value="OPER">OPER — Operating Engineers</option>
                          <option value="PAIN">PAIN — Painters</option>
                          <option value="PFRT">PFRT — Pile Drivers</option>
                          <option value="PLAS">PLAS — Plasterers</option>
                          <option value="PLUM">PLUM — Plumbers and Pipefitters</option>
                          <option value="ROOF">ROOF — Roofers</option>
                          <option value="SHEE">SHEE — Sheet Metal Workers</option>
                          <option value="TEAM">TEAM — Teamsters</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : hasWd ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label htmlFor="add-trade-select" className="block text-xs text-gray-600 mb-1">Trade</label>
                    <select
                      id="add-trade-select"
                      value={form.tradeCode}
                      onChange={e => setForm(p => ({ ...p, tradeCode: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    >
                      <option value="">— Select a trade —</option>
                      {wageClassifications.map(wc => (
                        <option key={wc.id} value={wc.tradeCode}>
                          {wc.tradeDescription} — {fmt(wc.baseRate)} + {fmt(wc.fringeRate)} fringe/hr
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="add-labor-type" className="block text-xs text-gray-600 mb-1">Labor Type</label>
                    <select
                      id="add-labor-type"
                      value={form.laborType}
                      onChange={e => setForm(p => ({ ...p, laborType: e.target.value as typeof form.laborType }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    >
                      {LABOR_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                    </select>
                  </div>
                  {form.laborType === 'apprentice' && (
                    <div>
                      <label htmlFor="add-app-pct" className="block text-xs text-gray-600 mb-1">Apprentice % of Journey Rate</label>
                      <input
                        id="add-app-pct"
                        type="number"
                        min="0"
                        max="100"
                        value={form.apprenticePercent}
                        onChange={e => setForm(p => ({ ...p, apprenticePercent: e.target.value }))}
                        placeholder="e.g. 80"
                        className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                      />
                    </div>
                  )}
                  {form.laborType === 'apprentice' && (
                    <div className="col-span-2">
                      <label htmlFor="add-program-name" className="block text-xs text-gray-600 mb-1">DOL Apprenticeship Program Name <span className="text-gray-400">(optional)</span></label>
                      <input
                        id="add-program-name"
                        type="text"
                        placeholder="DOL apprenticeship program name (optional)"
                        value={form.programName}
                        onChange={e => setForm(f => ({ ...f, programName: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-brand-gold focus:outline-hidden"
                      />
                    </div>
                  )}
                  {form.laborType === 'apprentice' && (
                    <div>
                      <label htmlFor="add-apprenticeship-program-name" className="block text-xs text-gray-600 mb-1">
                        Apprenticeship Program Name <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        id="add-apprenticeship-program-name"
                        type="text"
                        placeholder="e.g. IBEW Apprenticeship Training"
                        value={form.apprenticeshipProgramName}
                        onChange={e => setForm(f => ({ ...f, apprenticeshipProgramName: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-brand-gold focus:outline-hidden"
                      />
                    </div>
                  )}
                  {form.laborType === 'apprentice' && (
                    <div>
                      <label htmlFor="add-rapids-number" className="block text-xs text-gray-600 mb-1">
                        RAPIDS Number <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        id="add-rapids-number"
                        type="text"
                        placeholder="DOL RAPIDS registration number"
                        value={form.rapidsNumber}
                        onChange={e => setForm(f => ({ ...f, rapidsNumber: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-brand-gold focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-700">
                  Wage rates not available for this project's location — worker will be saved without a trade classification.
                  You can add trades after loading rates via the{' '}
                  <button onClick={() => navigate('/wages')} className="underline">Wage Lookup</button> page.
                </p>
              )}
            </div>
          </div>

          {formError && <p className="mt-3 text-xs text-red-600">{formError}</p>}

          <Button onClick={handleSubmit} disabled={addWorker.isPending} className="mt-5">
            {addWorker.isPending ? 'Saving...' : '+ Add Worker'}
          </Button>
        </Card>

      </div>
    </Layout>
  );
}
