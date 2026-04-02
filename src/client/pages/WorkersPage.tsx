// src/client/pages/WorkersPage.tsx
// Route: /projects/:projectId/workers
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';
import { EmptyState } from '../components/ui/EmptyState';
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
  };
}

export function WorkersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState(blankWorkerForm);
  const [formError, setFormError] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', ssn: '', tradeUnion: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '', unionLocal: '', unionBookNumber: '', apprenticeshipCommittee: '', apprenticeshipRegNumber: '' });
  const [editError, setEditError] = useState('');

  // Add-extra-classification state
  const [addingClassFor, setAddingClassFor] = useState<string | null>(null);
  const [extraClass, setExtraClass] = useState({ tradeCode: '', tradeDescription: '', laborType: 'journeyworker' as 'journeyworker' | 'apprentice' | 'foreman', apprenticePercent: '', programName: '', waManualRate: '', waTradeCode: '' });
  const [extraError, setExtraError] = useState('');

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
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

  const wageClassifications = wdData?.data?.classifications ?? [];
  const hasWd = wdData?.data?.hasWd ?? false;
  const wdNumber = wdData?.data?.wdNumber;
  const workers = data?.data?.workers ?? [];
  const selectedTrade = wageClassifications.find(wc => wc.tradeCode === form.tradeCode);
  const selectedExtraTrade = wageClassifications.find(wc => wc.tradeCode === extraClass.tradeCode);
  const isWA = projectData?.data?.project?.state === 'WA';

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
    onError: (e: Error) => setFormError(e.message),
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
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      setEditingId(null);
      setEditError('');
    },
    onError: (e: Error) => setEditError(e.message),
  });

  const deleteWorker = useMutation({
    mutationFn: (workerId: string) =>
      api.delete(`/projects/${projectId}/workers/${workerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      setConfirmDeleteId(null);
    },
  });

  const deleteClassification = useMutation({
    mutationFn: ({ workerId, classificationId }: { workerId: string; classificationId: string }) =>
      api.delete(`/projects/${projectId}/workers/${workerId}/classifications/${classificationId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers', projectId] }),
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
    onError: (e: Error) => setExtraError(e.message),
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
        <button onClick={() => navigate(`/projects/${projectId}`)} className="text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4 inline-block">
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

        {isLoading && <LoadingSpinner />}
        {isError && <p className="text-sm text-red-600">Failed to load workers.</p>}

        {!isLoading && !isError && workers.length === 0 && (
          <EmptyState
            heading="No workers on this project yet"
            message={<>Add every worker before entering payroll. Federal <TermTooltip term="Davis-Bacon" definition={DB_DEF} /> rules require all workers to be classified and logged — even if they worked only one day.</>}
            action={
              <button
                onClick={() => {
                  const nameInput = document.querySelector<HTMLInputElement>('input[placeholder="Full Name"]');
                  if (nameInput) nameInput.focus();
                }}
                className="inline-flex items-center justify-center font-semibold rounded-sm transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 bg-brand-gold text-nav-dark hover:bg-brand-gold/90 border border-transparent text-sm px-4 py-2"
              >
                Add First Worker
              </button>
            }
          />
        )}

        {/* Worker list */}
        {workers.length > 0 && (
          <div className="mb-8 space-y-3">
            {workers.map((w) => (
              <Card key={w.id} padding="sm">

                {editingId === w.id ? (
                  /* ── Inline edit form ── */
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Edit Worker</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                        <input type="text" value={editForm.name}
                          onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Social Security Number</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={9}
                          autoComplete="off"
                          value={editForm.ssn}
                          onChange={e => setEditForm(p => ({ ...p, ssn: e.target.value.replace(/\D/g, '') }))}
                          placeholder="123456789"
                          className="w-full rounded border border-gray-200 px-3 py-2 text-sm bg-surface-muted focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                        <p className="text-xs text-text-secondary mt-1">Enter 9-digit SSN to update. Leave blank to keep current value.</p>
                        {w.ssnLast4 && !w.hasFullSsn && (
                          <div className="mt-2">
                            <Badge variant="neutral">Full SSN not on file</Badge>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Trade Union</label>
                        <input type="text" value={editForm.tradeUnion}
                          onChange={e => setEditForm(p => ({ ...p, tradeUnion: e.target.value }))}
                          placeholder="optional"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Address <span className="text-gray-400 font-normal normal-case">(required for WH-347)</span></p>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Street"
                          value={editForm.addressStreet}
                          onChange={e => setEditForm(p => ({ ...p, addressStreet: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="City"
                            value={editForm.addressCity}
                            onChange={e => setEditForm(p => ({ ...p, addressCity: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                          />
                          <input
                            type="text"
                            placeholder="State"
                            value={editForm.addressState}
                            onChange={e => setEditForm(p => ({ ...p, addressState: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                          />
                          <input
                            type="text"
                            placeholder="Zip"
                            value={editForm.addressZip}
                            onChange={e => setEditForm(p => ({ ...p, addressZip: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Union Information</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Union Local"
                          value={editForm.unionLocal}
                          onChange={e => setEditForm(p => ({ ...p, unionLocal: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                        <input
                          type="text"
                          placeholder="Book Number"
                          value={editForm.unionBookNumber}
                          onChange={e => setEditForm(p => ({ ...p, unionBookNumber: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                        />
                      </div>
                    </div>
                    {w.classifications?.some(c => c.laborType === 'apprentice') && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Apprenticeship</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Committee"
                            value={editForm.apprenticeshipCommittee}
                            onChange={e => setEditForm(p => ({ ...p, apprenticeshipCommittee: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                          />
                          <input
                            type="text"
                            placeholder="Registration Number"
                            value={editForm.apprenticeshipRegNumber}
                            onChange={e => setEditForm(p => ({ ...p, apprenticeshipRegNumber: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                          />
                        </div>
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
                      <button onClick={() => deleteWorker.mutate(w.id)} disabled={deleteWorker.isPending}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50 transition-colors">
                        {deleteWorker.isPending ? 'Removing...' : 'Yes, Remove'}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Normal worker card view ── */
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{w.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {w.tradeUnion && <span className="mr-3">Union: {w.tradeUnion}</span>}
                          {w.ssnLast4 && <span className="mr-3">SSN: ***-**-{w.ssnLast4}</span>}
                          {[w.addressStreet, w.addressCity, w.addressState, w.addressZip].some(Boolean) && (
                            <span className="mr-3">{[w.addressStreet, w.addressCity, w.addressState, w.addressZip].filter(Boolean).join(', ')}</span>
                          )}
                          {w.unionLocal && <span className="mr-3">Local: {w.unionLocal}{w.unionBookNumber ? ` #${w.unionBookNumber}` : ''}</span>}
                          {w.apprenticeshipCommittee && <span className="mr-3">Apprenticeship: {w.apprenticeshipCommittee}{w.apprenticeshipRegNumber ? ` #${w.apprenticeshipRegNumber}` : ''}</span>}
                        </p>
                        {(![w.addressStreet, w.addressCity, w.addressState, w.addressZip].some(Boolean) || !w.ssnLast4) && (
                          <Badge variant="warning" className="mt-1">Missing data — WH-347 blocked</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/projects/${projectId}/workers/${w.id}/compliance-history`}
                          className="text-xs text-gray-500 border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          Compliance History
                        </Link>
                        <button
                          onClick={() => { setEditingId(w.id); setEditForm(workerToEditForm(w)); setAddingClassFor(null); }}
                          className="text-xs text-gray-500 border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        {(hasWd || isWA) && (
                          <button
                            onClick={() => { setAddingClassFor(addingClassFor === w.id ? null : w.id); setExtraError(''); setExtraClass({ tradeCode: '', tradeDescription: '', laborType: 'journeyworker', apprenticePercent: '', programName: '', waManualRate: '', waTradeCode: '' }); setEditingId(null); }}
                            className="text-xs text-gray-500 border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
                          >
                            + Trade
                          </button>
                        )}
                        <button
                          onClick={() => { setConfirmDeleteId(w.id); setEditingId(null); setAddingClassFor(null); }}
                          className="text-xs text-red-400 border border-red-200 rounded px-3 py-1.5 hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Classifications */}
                    {w.classifications.length > 0 && (
                      <div className="mt-3 divide-y divide-gray-100 border border-gray-100 rounded">
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
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
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
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Add Another Trade</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {isWA ? (
                            <>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Trade Code</label>
                                <input type="text" value={extraClass.tradeCode}
                                  onChange={(e) => setExtraClass(p => ({ ...p, tradeCode: e.target.value.toUpperCase() }))}
                                  placeholder="e.g. CARP"
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Trade Description</label>
                                <input type="text" value={extraClass.tradeDescription ?? ''}
                                  onChange={(e) => setExtraClass(p => ({ ...p, tradeDescription: e.target.value }))}
                                  placeholder="e.g. Carpenter"
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-600 mb-1">Trade Classification</label>
                              <select
                                value={extraClass.tradeCode}
                                onChange={(e) => setExtraClass(p => ({ ...p, tradeCode: e.target.value }))}
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
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
                            <label className="block text-xs text-gray-600 mb-1">Labor Type</label>
                            <select
                              value={extraClass.laborType}
                              onChange={(e) => setExtraClass(p => ({ ...p, laborType: e.target.value as typeof extraClass.laborType }))}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                            >
                              {LABOR_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                            </select>
                          </div>
                          {extraClass.laborType === 'apprentice' && (
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Apprentice % of Journey Rate</label>
                              <input type="number" min="0" max="100" value={extraClass.apprenticePercent}
                                onChange={(e) => setExtraClass(p => ({ ...p, apprenticePercent: e.target.value }))}
                                placeholder="e.g. 80"
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                              />
                            </div>
                          )}
                          {extraClass.laborType === 'apprentice' && (
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-600 mb-1">DOL Apprenticeship Program Name <span className="text-gray-400">(optional)</span></label>
                              <input
                                type="text"
                                placeholder="DOL apprenticeship program name (optional)"
                                value={extraClass.programName}
                                onChange={e => setExtraClass(s => ({ ...s, programName: e.target.value }))}
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-gold focus:outline-hidden"
                              />
                            </div>
                          )}
                          {isWA && (
                            <div className="col-span-2 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                              <p className="text-xs font-medium text-blue-800">Washington Prevailing Wage</p>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  WA Prevailing Rate ($/hr)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="e.g. 58.25"
                                  value={extraClass.waManualRate}
                                  onChange={(e) => setExtraClass(s => ({ ...s, waManualRate: e.target.value }))}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-brand-gold focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  WA Trade Code
                                </label>
                                <select
                                  value={extraClass.waTradeCode}
                                  onChange={(e) => setExtraClass(s => ({ ...s, waTradeCode: e.target.value }))}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-brand-gold focus:outline-none"
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
                          <button onClick={() => handleAddExtraClass(w.id)} disabled={addClassification.isPending}
                            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 disabled:opacity-50 transition-colors">
                            {addClassification.isPending ? 'Saving...' : 'Save'}
                          </button>
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. John Smith"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Social Security Number (optional)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={9}
                  autoComplete="off"
                  value={form.ssn}
                  onChange={e => setForm(p => ({ ...p, ssn: e.target.value.replace(/\D/g, '') }))}
                  placeholder="123456789"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm bg-surface-muted focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Trade Union (optional)</label>
                <input type="text" value={form.tradeUnion} onChange={e => setForm(p => ({ ...p, tradeUnion: e.target.value }))}
                  placeholder="e.g. Carpenters Local 150"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Address <span className="text-gray-400 font-normal normal-case">(required for WH-347)</span></p>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Street"
                  value={form.addressStreet}
                  onChange={e => setForm(p => ({ ...p, addressStreet: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={form.addressCity}
                    onChange={e => setForm(p => ({ ...p, addressCity: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={form.addressState}
                    onChange={e => setForm(p => ({ ...p, addressState: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                  />
                  <input
                    type="text"
                    placeholder="Zip"
                    value={form.addressZip}
                    onChange={e => setForm(p => ({ ...p, addressZip: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                  />
                </div>
              </div>
            </div>
            <div className="mt-2 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Union Information</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Union Local"
                  value={form.unionLocal}
                  onChange={e => setForm(p => ({ ...p, unionLocal: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
                <input
                  type="text"
                  placeholder="Book Number"
                  value={form.unionBookNumber}
                  onChange={e => setForm(p => ({ ...p, unionBookNumber: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                />
              </div>
            </div>

            {/* Trade selection */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Trade Classification</p>

              {wdLoading ? (
                <p className="text-sm text-gray-400">Loading available trades...</p>
              ) : isWA ? (
                /* WA projects: manual trade entry + WA rate section */
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Trade Code</label>
                    <input type="text" value={form.tradeCode} onChange={e => setForm(p => ({ ...p, tradeCode: e.target.value.toUpperCase() }))}
                      placeholder="e.g. CARP"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Trade Description</label>
                    <input type="text" value={form.tradeDescription} onChange={e => setForm(p => ({ ...p, tradeDescription: e.target.value }))}
                      placeholder="e.g. Carpenter"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Labor Type</label>
                    <select value={form.laborType} onChange={e => setForm(p => ({ ...p, laborType: e.target.value as typeof form.laborType }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    >
                      {LABOR_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                    </select>
                  </div>
                  {form.laborType === 'apprentice' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Apprentice % of Journey Rate</label>
                      <input type="number" min="0" max="100" value={form.apprenticePercent}
                        onChange={e => setForm(p => ({ ...p, apprenticePercent: e.target.value }))}
                        placeholder="e.g. 80"
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                      />
                    </div>
                  )}
                  <div className="col-span-2 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-800">Washington Prevailing Wage</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Prevailing Rate ($/hr)</label>
                        <input
                          type="number" step="0.01" min="0" placeholder="e.g. 58.25"
                          value={form.waManualRate}
                          onChange={(e) => setForm(f => ({ ...f, waManualRate: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-brand-gold focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">WA Trade Code</label>
                        <select
                          value={form.waTradeCode}
                          onChange={(e) => setForm(f => ({ ...f, waTradeCode: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-brand-gold focus:outline-none"
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
                    <label className="block text-xs text-gray-600 mb-1">Trade</label>
                    <select value={form.tradeCode} onChange={e => setForm(p => ({ ...p, tradeCode: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
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
                    <label className="block text-xs text-gray-600 mb-1">Labor Type</label>
                    <select value={form.laborType} onChange={e => setForm(p => ({ ...p, laborType: e.target.value as typeof form.laborType }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                    >
                      {LABOR_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                    </select>
                  </div>
                  {form.laborType === 'apprentice' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Apprentice % of Journey Rate</label>
                      <input type="number" min="0" max="100" value={form.apprenticePercent}
                        onChange={e => setForm(p => ({ ...p, apprenticePercent: e.target.value }))}
                        placeholder="e.g. 80"
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
                      />
                    </div>
                  )}
                  {form.laborType === 'apprentice' && (
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">DOL Apprenticeship Program Name <span className="text-gray-400">(optional)</span></label>
                      <input
                        type="text"
                        placeholder="DOL apprenticeship program name (optional)"
                        value={form.programName}
                        onChange={e => setForm(f => ({ ...f, programName: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-gold focus:outline-hidden"
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
