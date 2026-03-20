// src/client/pages/WorkersPage.tsx
// Route: /projects/:projectId/workers
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

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
  tradeUnion: string | null;
  address: string | null;
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

function blankWorkerForm() {
  return {
    name: '',
    ssnLast4: '',
    tradeUnion: '',
    address: '',
    tradeCode: '',
    laborType: 'journeyworker' as 'journeyworker' | 'apprentice' | 'foreman',
    apprenticePercent: '',
    programName: '',
  };
}

function workerToEditForm(w: Worker) {
  return {
    name: w.name,
    ssnLast4: w.ssnLast4 ?? '',
    tradeUnion: w.tradeUnion ?? '',
    address: w.address ?? '',
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
  const [editForm, setEditForm] = useState({ name: '', ssnLast4: '', tradeUnion: '', address: '' });
  const [editError, setEditError] = useState('');

  // Add-extra-classification state
  const [addingClassFor, setAddingClassFor] = useState<string | null>(null);
  const [extraClass, setExtraClass] = useState({ tradeCode: '', laborType: 'journeyworker' as 'journeyworker' | 'apprentice' | 'foreman', apprenticePercent: '', programName: '' });
  const [extraError, setExtraError] = useState('');

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: () => api.get<{ data: { workers: Worker[] } }>(`/projects/${projectId}/workers`),
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

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addWorker = useMutation({
    mutationFn: async (f: typeof form) => {
      const workerRes = await api.post<{ data: { worker: Worker } }>(`/projects/${projectId}/workers`, {
        name: f.name.trim(),
        ...(f.ssnLast4 ? { ssnLast4: f.ssnLast4 } : {}),
        ...(f.tradeUnion.trim() ? { tradeUnion: f.tradeUnion.trim() } : {}),
        ...(f.address.trim() ? { address: f.address.trim() } : {}),
      });
      const workerId = workerRes.data.worker.id;
      if (f.tradeCode && selectedTrade) {
        await api.post(`/projects/${projectId}/workers/${workerId}/classifications`, {
          tradeCode: selectedTrade.tradeCode,
          tradeDescription: selectedTrade.tradeDescription,
          laborType: f.laborType,
          ...(f.laborType === 'apprentice' ? { apprenticePercent: parseInt(f.apprenticePercent, 10) } : {}),
          ...(f.laborType === 'apprentice' && f.programName.trim() ? { programName: f.programName.trim() } : {}),
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
        ssnLast4: data.ssnLast4 || null,
        tradeUnion: data.tradeUnion.trim() || null,
        address: data.address.trim() || null,
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
    mutationFn: ({ workerId }: { workerId: string }) =>
      api.post(`/projects/${projectId}/workers/${workerId}/classifications`, {
        tradeCode: selectedExtraTrade!.tradeCode,
        tradeDescription: selectedExtraTrade!.tradeDescription,
        laborType: extraClass.laborType,
        ...(extraClass.laborType === 'apprentice' ? { apprenticePercent: parseInt(extraClass.apprenticePercent, 10) } : {}),
        ...(extraClass.laborType === 'apprentice' && extraClass.programName.trim() ? { programName: extraClass.programName.trim() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers', projectId] });
      setAddingClassFor(null);
      setExtraClass({ tradeCode: '', laborType: 'journeyworker', apprenticePercent: '', programName: '' });
      setExtraError('');
    },
    onError: (e: Error) => setExtraError(e.message),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSubmit() {
    setFormError('');
    if (!form.name.trim()) { setFormError('Worker name is required'); return; }
    if (form.ssnLast4 && form.ssnLast4.length !== 4) { setFormError('SSN last 4 must be exactly 4 digits'); return; }
    if (form.tradeCode && !selectedTrade) { setFormError('Select a valid trade from the list'); return; }
    if (form.laborType === 'apprentice' && !form.apprenticePercent) { setFormError('Apprentice % is required'); return; }
    addWorker.mutate(form);
  }

  function handleEditSave(workerId: string) {
    setEditError('');
    if (!editForm.name.trim()) { setEditError('Name is required'); return; }
    if (editForm.ssnLast4 && editForm.ssnLast4.length !== 4) { setEditError('SSN last 4 must be exactly 4 digits'); return; }
    updateWorker.mutate({ id: workerId, data: editForm });
  }

  function handleAddExtraClass(workerId: string) {
    setExtraError('');
    if (!extraClass.tradeCode) { setExtraError('Select a trade'); return; }
    if (!selectedExtraTrade) { setExtraError('Trade not found'); return; }
    if (extraClass.laborType === 'apprentice' && !extraClass.apprenticePercent) { setExtraError('Apprentice % required'); return; }
    addClassification.mutate({ workerId });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            &larr; Back to Project
          </button>
          <h1 className="text-2xl font-headline text-gray-900">Workers</h1>
        </div>

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

        {/* Worker list */}
        {workers.length > 0 && (
          <div className="mb-8 space-y-3">
            {workers.map((w) => (
              <div key={w.id} className="bg-white rounded-lg border border-gray-200 p-5">

                {editingId === w.id ? (
                  /* ── Inline edit form ── */
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Edit Worker</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                        <input type="text" value={editForm.name}
                          onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">SSN Last 4</label>
                        <input type="text" maxLength={4} value={editForm.ssnLast4}
                          onChange={e => setEditForm(p => ({ ...p, ssnLast4: e.target.value.replace(/\D/g, '') }))}
                          placeholder="optional"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Trade Union</label>
                        <input type="text" value={editForm.tradeUnion}
                          onChange={e => setEditForm(p => ({ ...p, tradeUnion: e.target.value }))}
                          placeholder="optional"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Address <span className="text-gray-400">(required for WH-347)</span></label>
                        <input type="text" value={editForm.address}
                          onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                          placeholder="Street, City, State ZIP"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
                        />
                      </div>
                    </div>
                    {editError && <p className="text-xs text-red-600 mb-2">{editError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleEditSave(w.id)} disabled={updateWorker.isPending}
                        className="px-4 py-2 bg-[#F5C518] text-gray-900 text-sm font-medium rounded hover:bg-yellow-400 disabled:opacity-50 transition-colors">
                        {updateWorker.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button onClick={() => { setEditingId(null); setEditError(''); }}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                        Cancel
                      </button>
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
                          {w.address && <span>{w.address}</span>}
                        </p>
                        {(!w.address || !w.ssnLast4) && (
                          <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded mt-1">
                            Missing data — WH-347 blocked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingId(w.id); setEditForm(workerToEditForm(w)); setAddingClassFor(null); }}
                          className="text-xs text-gray-500 border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        {hasWd && (
                          <button
                            onClick={() => { setAddingClassFor(addingClassFor === w.id ? null : w.id); setExtraError(''); setExtraClass({ tradeCode: '', laborType: 'journeyworker', apprenticePercent: '', programName: '' }); setEditingId(null); }}
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
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-600 mb-1">Trade Classification</label>
                            <select
                              value={extraClass.tradeCode}
                              onChange={(e) => setExtraClass(p => ({ ...p, tradeCode: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
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
                            <select
                              value={extraClass.laborType}
                              onChange={(e) => setExtraClass(p => ({ ...p, laborType: e.target.value as typeof extraClass.laborType }))}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
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
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
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
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                              />
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

              </div>
            ))}
          </div>
        )}

        {/* Add Worker form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5">Add Worker</h2>

          <div className="space-y-4">
            {/* Name + SSN + Union */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. John Smith"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">SSN Last 4 (optional)</label>
                <input type="text" maxLength={4} value={form.ssnLast4}
                  onChange={e => setForm(p => ({ ...p, ssnLast4: e.target.value.replace(/\D/g, '') }))}
                  placeholder="e.g. 4321"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Trade Union (optional)</label>
                <input type="text" value={form.tradeUnion} onChange={e => setForm(p => ({ ...p, tradeUnion: e.target.value }))}
                  placeholder="e.g. Carpenters Local 150"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Address <span className="text-gray-400">(required for WH-347 certified payroll)</span></label>
              <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Street, City, State ZIP"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
              />
            </div>

            {/* Trade selection */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Trade Classification</p>

              {wdLoading ? (
                <p className="text-sm text-gray-400">Loading available trades...</p>
              ) : hasWd ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Trade</label>
                    <select value={form.tradeCode} onChange={e => setForm(p => ({ ...p, tradeCode: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
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
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
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
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
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
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
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

          <button onClick={handleSubmit} disabled={addWorker.isPending}
            className="mt-5 px-5 py-2 bg-[#F5C518] text-gray-900 text-sm font-medium rounded hover:bg-yellow-400 disabled:opacity-50 transition-colors"
          >
            {addWorker.isPending ? 'Saving...' : '+ Add Worker'}
          </button>
        </div>

      </div>
    </Layout>
  );
}
