import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Workflow, Settings, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';
import { TermTooltip } from '../components/ui/TermTooltip';
import { EmptyState } from '../components/ui/EmptyState';
import { getCprStatus, STATUS_BADGE } from '../lib/cprStatus';
import type { Subcontractor, CprWeek } from '../lib/cprStatus';

const WH347_DEF = "The Department of Labor's official certified payroll form. Contractors must submit it weekly to the contracting officer as proof that workers were paid the correct prevailing wage.";
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

interface Project {
  id: string;
  name: string;
  state: string;
  county: string;
  contractType: string;
  fundingType: string;
  awardDate: string;
  status: string;
  createdAt: string;
  projectSettings: string | null;
}

interface NotifSettings {
  notifyViolations: boolean;
  notifyDueSoon: boolean;
  dueSoonDays: number;
  notifyActivity: boolean;
  notifySubmission: boolean;
}

const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  notifyViolations: true,
  notifyDueSoon: true,
  dueSoonDays: 3,
  notifyActivity: true,
  notifySubmission: true,
};

function parseNotifSettings(raw: string | null | undefined): NotifSettings {
  if (!raw) return { ...DEFAULT_NOTIF_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NOTIF_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_NOTIF_SETTINGS };
  }
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  'federal-davis-bacon': 'Federal Davis-Bacon',
  'state-prevailing': 'State Prevailing',
  'gsa-schedule': 'GSA Schedule',
  private: 'Private',
};

const FUNDING_TYPE_LABELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  mixed: 'Mixed',
};

function WorkflowProgress({ steps }: { steps: { label: string; complete: boolean }[] }) {
  return (
    <div className="flex items-center gap-0 mb-6 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={
              step.complete
                ? 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold bg-status-compliant text-white'
                : 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 border-gray-300 text-gray-400 bg-white'
            }>
              {step.complete ? '\u2713' : i + 1}
            </div>
            <span className={
              step.complete
                ? 'text-sm font-medium text-status-compliant'
                : 'text-sm font-medium text-gray-400'
            }>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={
              step.complete
                ? 'mx-3 h-0.5 w-10 bg-status-compliant shrink-0'
                : 'mx-3 h-0.5 w-10 bg-gray-200 shrink-0'
            } />
          )}
        </div>
      ))}
    </div>
  );
}

const EMPTY_SUB_FORM = {
  name: '',
  licenseNumber: '',
  contactName: '',
  contactEmail: '',
  address: '',
};

const EMPTY_CPR_FORM = {
  weekEndingDate: '',
  receivedDate: '',
  isCompliant: '' as '' | '0' | '1',
  notes: '',
};

function CprWeekTable({ projectId, subId }: { projectId: string; subId: string }) {
  const queryClient = useQueryClient();
  const [cprForm, setCprForm] = useState({ ...EMPTY_CPR_FORM });
  const [cprError, setCprError] = useState<string | null>(null);

  const { data: cprData, isLoading: cprLoading } = useQuery({
    queryKey: ['cpr-weeks', projectId, subId],
    queryFn: () => api.get<{ data: { cprWeeks: CprWeek[] } }>(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks`),
    enabled: !!subId,
  });

  const addCprWeekMutation = useMutation({
    mutationFn: (body: { weekEndingDate: string; receivedDate?: string; isCompliant?: 0 | 1; notes?: string }) =>
      api.post<{ data: { cprWeek: CprWeek } }>(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpr-weeks', projectId, subId] });
      setCprForm({ ...EMPTY_CPR_FORM });
      setCprError(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { status?: number })?.status === 409
        ? 'A record for this week ending date already exists.'
        : 'Failed to save CPR week record.';
      setCprError(msg);
    },
  });

  const updateCprWeekMutation = useMutation({
    mutationFn: ({ weekId, body }: { weekId: string; body: Partial<{ receivedDate: string; isCompliant: 0 | 1 | null; notes: string }> }) =>
      api.patch(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks/${weekId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpr-weeks', projectId, subId] });
    },
  });

  const weeks = cprData?.data?.cprWeeks ?? [];
  const todayYMD = new Date().toISOString().slice(0, 10);

  function handleAddCprWeek() {
    if (!cprForm.weekEndingDate) return;
    const body: { weekEndingDate: string; receivedDate?: string; isCompliant?: 0 | 1; notes?: string } = {
      weekEndingDate: cprForm.weekEndingDate,
    };
    if (cprForm.receivedDate) body.receivedDate = cprForm.receivedDate;
    if (cprForm.isCompliant === '0') body.isCompliant = 0;
    if (cprForm.isCompliant === '1') body.isCompliant = 1;
    if (cprForm.notes.trim()) body.notes = cprForm.notes.trim();
    addCprWeekMutation.mutate(body);
  }

  return (
    <div className="mt-3 border-t border-border-default pt-3">
      <h4 className="font-headline text-sm text-gray-700 mb-2">CPR Weeks</h4>

      {cprLoading && <p className="text-xs text-gray-500">Loading...</p>}

      {!cprLoading && weeks.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">No CPR weeks recorded yet.</p>
      )}

      {weeks.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-border-default">
                <th className="pb-1 pr-3 font-medium">Week Ending</th>
                <th className="pb-1 pr-3 font-medium">Status</th>
                <th className="pb-1 pr-3 font-medium">Received</th>
                <th className="pb-1 pr-3 font-medium">Notes</th>
                <th className="pb-1 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map(week => {
                const status = getCprStatus(week);
                const badge = STATUS_BADGE[status];
                return (
                  <tr key={week.id} className="border-b border-border-default/50 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-700">{week.weekEndingDate}</td>
                    <td className="py-1.5 pr-3">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className="py-1.5 pr-3">
                      {week.uploadedAt
                        ? <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">PDF Uploaded</span>
                        : week.uploadToken
                          ? <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Awaiting upload</span>
                          : null
                      }
                    </td>
                    <td className="py-1.5 pr-3 text-gray-600">{week.receivedDate ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-gray-500 max-w-xs truncate">{week.notes ?? '—'}</td>
                    <td className="py-1.5">
                      <div className="flex gap-2">
                        {!week.receivedDate && (
                          <button
                            className="text-xs font-medium text-brand-gold hover:underline"
                            onClick={() => updateCprWeekMutation.mutate({ weekId: week.id, body: { receivedDate: todayYMD, isCompliant: null } })}
                            disabled={updateCprWeekMutation.isPending}
                          >
                            Mark Received
                          </button>
                        )}
                        {week.receivedDate && week.isCompliant !== 1 && (
                          <button
                            className="text-xs font-medium text-brand-gold hover:underline"
                            onClick={() => updateCprWeekMutation.mutate({ weekId: week.id, body: { isCompliant: 1 } })}
                            disabled={updateCprWeekMutation.isPending}
                          >
                            Mark Compliant
                          </button>
                        )}
                        {week.receivedDate && week.isCompliant === 1 && (
                          <button
                            className="text-xs font-medium text-status-violation hover:underline"
                            onClick={() => updateCprWeekMutation.mutate({ weekId: week.id, body: { isCompliant: 0 } })}
                            disabled={updateCprWeekMutation.isPending}
                          >
                            Mark Non-Compliant
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add CPR Week inline form */}
      <div className="bg-surface-page border border-border-default rounded p-3 space-y-2">
        <p className="text-xs font-medium text-gray-700 mb-1">Add CPR Week</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Week Ending Date *</label>
            <input
              type="date"
              className="border border-border-default rounded px-2 py-1 text-sm bg-surface-page"
              value={cprForm.weekEndingDate}
              onChange={e => setCprForm(f => ({ ...f, weekEndingDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Received Date</label>
            <input
              type="date"
              className="border border-border-default rounded px-2 py-1 text-sm bg-surface-page"
              value={cprForm.receivedDate}
              onChange={e => setCprForm(f => ({ ...f, receivedDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Compliance</label>
            <select
              className="border border-border-default rounded px-2 py-1 text-sm bg-surface-page"
              value={cprForm.isCompliant}
              onChange={e => setCprForm(f => ({ ...f, isCompliant: e.target.value as '' | '0' | '1' }))}
            >
              <option value="">— (unassessed)</option>
              <option value="1">Compliant</option>
              <option value="0">Non-Compliant</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
            <input
              type="text"
              className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-page"
              placeholder="Optional"
              value={cprForm.notes}
              onChange={e => setCprForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <Button
            onClick={handleAddCprWeek}
            disabled={!cprForm.weekEndingDate || addCprWeekMutation.isPending}
          >
            {addCprWeekMutation.isPending ? 'Saving...' : 'Add Week'}
          </Button>
        </div>
        {cprError && <p className="text-xs text-status-violation mt-1">{cprError}</p>}
      </div>
    </div>
  );
}

function SubcontractorsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();

  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_SUB_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_SUB_FORM });

  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: () => api.get<{ data: { subcontractors: Subcontractor[] } }>(`/projects/${projectId}/subcontractors`),
    enabled: !!projectId,
  });

  const addSubMutation = useMutation({
    mutationFn: (body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string }) =>
      api.post<{ data: { subcontractor: Subcontractor } }>(`/projects/${projectId}/subcontractors`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      setAddingNew(false);
      setAddForm({ ...EMPTY_SUB_FORM });
    },
  });

  const editSubMutation = useMutation({
    mutationFn: ({ subId, body }: { subId: string; body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string } }) =>
      api.patch(`/projects/${projectId}/subcontractors/${subId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      setEditingSubId(null);
    },
  });

  const deleteSubMutation = useMutation({
    mutationFn: (subId: string) => api.delete(`/projects/${projectId}/subcontractors/${subId}`),
    onSuccess: (_data, subId) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      setDeletingSubId(null);
      setExpandedSubId(prev => prev === subId ? null : prev);
    },
  });

  function handleAddSub() {
    if (!addForm.name.trim()) return;
    const body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string } = {
      name: addForm.name.trim(),
    };
    if (addForm.licenseNumber.trim()) body.licenseNumber = addForm.licenseNumber.trim();
    if (addForm.contactName.trim()) body.contactName = addForm.contactName.trim();
    if (addForm.contactEmail.trim()) body.contactEmail = addForm.contactEmail.trim();
    if (addForm.address.trim()) body.address = addForm.address.trim();
    addSubMutation.mutate(body);
  }

  function handleEditSub(subId: string) {
    if (!editForm.name.trim()) return;
    const body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string } = {
      name: editForm.name.trim(),
    };
    if (editForm.licenseNumber.trim()) body.licenseNumber = editForm.licenseNumber.trim();
    if (editForm.contactName.trim()) body.contactName = editForm.contactName.trim();
    if (editForm.contactEmail.trim()) body.contactEmail = editForm.contactEmail.trim();
    if (editForm.address.trim()) body.address = editForm.address.trim();
    editSubMutation.mutate({ subId, body });
  }

  function startEdit(sub: Subcontractor) {
    setEditingSubId(sub.id);
    setEditForm({
      name: sub.name,
      licenseNumber: sub.licenseNumber ?? '',
      contactName: sub.contactName ?? '',
      contactEmail: sub.contactEmail ?? '',
      address: sub.address ?? '',
    });
  }

  const subs = subsData?.data?.subcontractors ?? [];

  const INPUT_CLASSES = 'border border-border-default rounded px-2 py-1 text-sm bg-surface-page';

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-headline text-lg text-gray-900">Subcontractors</h2>
        {!addingNew && (
          <Button variant="secondary" onClick={() => setAddingNew(true)}>
            Add Subcontractor
          </Button>
        )}
      </div>

      {/* Add form */}
      {addingNew && (
        <Card className="mb-4">
          <h3 className="font-headline text-sm text-gray-900 mb-3">Add Subcontractor</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Name *</label>
              <input
                type="text"
                className={INPUT_CLASSES + ' w-full'}
                placeholder="Company name"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">License Number</label>
                <input
                  type="text"
                  className={INPUT_CLASSES + ' w-full'}
                  placeholder="Optional"
                  value={addForm.licenseNumber}
                  onChange={e => setAddForm(f => ({ ...f, licenseNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Contact Name</label>
                <input
                  type="text"
                  className={INPUT_CLASSES + ' w-full'}
                  placeholder="Optional"
                  value={addForm.contactName}
                  onChange={e => setAddForm(f => ({ ...f, contactName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Contact Email</label>
                <input
                  type="email"
                  className={INPUT_CLASSES + ' w-full'}
                  placeholder="Optional"
                  value={addForm.contactEmail}
                  onChange={e => setAddForm(f => ({ ...f, contactEmail: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Address</label>
                <input
                  type="text"
                  className={INPUT_CLASSES + ' w-full'}
                  placeholder="Optional"
                  value={addForm.address}
                  onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setAddingNew(false); setAddForm({ ...EMPTY_SUB_FORM }); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSub}
              disabled={!addForm.name.trim() || addSubMutation.isPending}
            >
              {addSubMutation.isPending ? 'Saving...' : 'Add Subcontractor'}
            </Button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!subsLoading && subs.length === 0 && !addingNew && (
        <EmptyState
          heading="No subcontractors"
          message="Track CPR receipt and compliance status for each subcontractor on this project."
        />
      )}

      {/* Sub list */}
      {subs.map(sub => (
        <Card key={sub.id} className="mb-3">
          {editingSubId === sub.id ? (
            /* Edit form inline */
            <div>
              <h3 className="font-headline text-sm text-gray-900 mb-3">Edit Subcontractor</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Name *</label>
                  <input
                    type="text"
                    className={INPUT_CLASSES + ' w-full'}
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">License Number</label>
                    <input
                      type="text"
                      className={INPUT_CLASSES + ' w-full'}
                      value={editForm.licenseNumber}
                      onChange={e => setEditForm(f => ({ ...f, licenseNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Contact Name</label>
                    <input
                      type="text"
                      className={INPUT_CLASSES + ' w-full'}
                      value={editForm.contactName}
                      onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Contact Email</label>
                    <input
                      type="email"
                      className={INPUT_CLASSES + ' w-full'}
                      value={editForm.contactEmail}
                      onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Address</label>
                    <input
                      type="text"
                      className={INPUT_CLASSES + ' w-full'}
                      value={editForm.address}
                      onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEditingSubId(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleEditSub(sub.id)}
                  disabled={!editForm.name.trim() || editSubMutation.isPending}
                >
                  {editSubMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            /* Normal row */
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 font-body">{sub.name}</span>
                    {sub.licenseNumber && (
                      <span className="text-xs text-gray-500">Lic: {sub.licenseNumber}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                    {sub.contactName && <span>{sub.contactName}</span>}
                    {sub.contactEmail && <span>{sub.contactEmail}</span>}
                    {sub.address && <span>{sub.address}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {deletingSubId === sub.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Confirm remove?</span>
                      <button
                        className="text-xs font-medium text-status-violation hover:underline"
                        onClick={() => deleteSubMutation.mutate(sub.id)}
                        disabled={deleteSubMutation.isPending}
                      >
                        {deleteSubMutation.isPending ? 'Removing...' : 'Confirm'}
                      </button>
                      <button
                        className="text-xs font-medium text-gray-500 hover:underline"
                        onClick={() => setDeletingSubId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="text-xs font-medium text-gray-700 hover:text-brand-gold transition-colors"
                        onClick={() => startEdit(sub)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs font-medium text-gray-700 hover:text-status-violation transition-colors"
                        onClick={() => setDeletingSubId(sub.id)}
                      >
                        Remove
                      </button>
                      <button
                        className="text-sm font-medium text-gray-700 hover:text-brand-gold transition-colors flex items-center"
                        onClick={() => setExpandedSubId(prev => prev === sub.id ? null : sub.id)}
                        aria-expanded={expandedSubId === sub.id}
                      >
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${expandedSubId === sub.id ? 'rotate-90' : ''}`}
                        />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {expandedSubId === sub.id && (
                <CprWeekTable projectId={projectId} subId={sub.id} />
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<{ data: { project: Project } }>(`/projects/${id}`),
    enabled: !!id,
  });

  const { data: workersData } = useQuery({
    queryKey: ['workers', id],
    queryFn: () => api.get<{ data: { workers: { id: string }[] } }>(`/projects/${id}/workers`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: weeksData } = useQuery({
    queryKey: ['payroll-weeks', id],
    queryFn: () => api.get<{ weeks: { id: string; submittedAt: string | null }[] }>(`/payroll/projects/${id}/weeks`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [complianceWarning, setComplianceWarning] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS);

  const archiveMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => api.patch(`/projects/${id}`, { status: 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
    },
  });

  const saveNotifMutation = useMutation({
    mutationFn: (prefs: NotifSettings) => {
      // Send the prefs as a JSON string in projectSettings
      // Server-side PATCH will merge with existing keys (46-04 Task 1)
      return api.patch(`/projects/${id}`, { projectSettings: JSON.stringify(prefs) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      setNotifPanelOpen(false);
    },
  });

  async function handleArchiveClick() {
    const summary = await queryClient.fetchQuery({
      queryKey: ['compliance-summary', id],
      queryFn: async () => {
        const res = await fetch(`/api/compliance/project/${id}`);
        if (!res.ok) return null;
        return res.json() as Promise<{ badge: string; weekCount: number; lastWeekNumber: number | null }>;
      },
      staleTime: 60_000,
    });
    setComplianceWarning(summary?.badge === 'violations');
    setArchiveModalOpen(true);
  }

  function handleOpenNotifPanel() {
    setNotifPrefs(parseNotifSettings(project?.projectSettings));
    setNotifPanelOpen(true);
  }

  const project = data?.data?.project;

  const workers = workersData?.data?.workers ?? [];
  const weeks = weeksData?.weeks ?? [];

  const steps = [
    { label: 'Create Project', complete: true },
    { label: 'Add Workers', complete: workers.length > 0 },
    { label: 'Enter Payroll', complete: weeks.length > 0 },
    { label: 'Download WH-347', complete: weeks.some(w => w.submittedAt !== null) },
  ];

  return (
    <Layout>
      {isLoading && <LoadingSpinner />}

      {isError && (
        <div className="text-center py-12 text-red-600 text-sm">
          Project not found or access denied.
        </div>
      )}

      {project && (
        <div>
          <PageHeader
            title={project.name}
            subtitle={`${project.state} — ${project.county}`}
          />

          <HelpCallout
            icon={Workflow}
            title="Your Project Workflow"
            body={<>Complete all four steps before generating your <TermTooltip term="WH-347" definition={WH347_DEF} />. Submitting an incomplete certified payroll can trigger a DOL audit.</>}
          />

          <WorkflowProgress steps={steps} />

          {/* Project sub-page navigation */}
          <div className="mt-6 mb-8 flex flex-wrap gap-3">
            <Link
              to={`/projects/${project.id}/workers`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-brand-gold text-black hover:bg-brand-gold/90 transition-colors duration-150"
            >
              Workers
            </Link>
            <Link
              to={`/projects/${project.id}/payroll`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-brand-gold text-black hover:bg-brand-gold/90 transition-colors duration-150"
            >
              Payroll Weeks
            </Link>
            <Link
              to={`/projects/${project.id}/ot-scenarios`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-brand-gold text-black hover:bg-brand-gold/90 transition-colors duration-150"
            >
              OT Scenario Planner
            </Link>
            <Link
              to={`/projects/${project.id}/variance`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-brand-gold text-black hover:bg-brand-gold/90 transition-colors duration-150"
            >
              Variance
            </Link>
            <Link
              to={`/projects/${project.id}/reports`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-brand-gold text-black hover:bg-brand-gold/90 transition-colors duration-150"
            >
              Reports
            </Link>
            <Link
              to={`/projects/${project.id}/activity`}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-brand-gold text-black hover:bg-brand-gold/90 transition-colors duration-150"
            >
              Activity
            </Link>
          </div>

          <Card className="max-w-lg">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Contract type</dt>
                <dd className="text-gray-900 font-medium">
                  {CONTRACT_TYPE_LABELS[project.contractType] ?? project.contractType}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Funding type</dt>
                <dd>
                  <Badge variant="neutral">
                    {FUNDING_TYPE_LABELS[project.fundingType] ?? project.fundingType}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Award date</dt>
                <dd className="text-gray-900 font-medium">{project.awardDate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="text-gray-900 font-medium capitalize">{project.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{new Date(project.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </Card>

          <div className="mt-4 flex gap-3">
            {project.status === 'active' ? (
              <Button variant="secondary" onClick={handleArchiveClick}>
                Archive Project
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => restoreMutation.mutate()}
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending ? 'Restoring...' : 'Restore Project'}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleOpenNotifPanel}
              aria-label="Notification preferences"
            >
              <Settings className="w-4 h-4 mr-1.5" />
              Notifications
            </Button>
          </div>

          {notifPanelOpen && (
            <Card className="mt-4 max-w-lg">
              <h3 className="font-headline text-base text-gray-900 mb-4">Notification Preferences</h3>
              <div className="space-y-4 text-sm font-body">

                <label className="flex items-center justify-between gap-4">
                  <span className="text-gray-700">Compliance violation alerts</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-gold"
                    checked={notifPrefs.notifyViolations}
                    onChange={e => setNotifPrefs(p => ({ ...p, notifyViolations: e.target.checked }))}
                  />
                </label>

                <label className="flex items-center justify-between gap-4">
                  <span className="text-gray-700">Team activity alerts (non-owner edits)</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-gold"
                    checked={notifPrefs.notifyActivity}
                    onChange={e => setNotifPrefs(p => ({ ...p, notifyActivity: e.target.checked }))}
                  />
                </label>

                <label className="flex items-center justify-between gap-4">
                  <span className="text-gray-700">Submission confirmation emails</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-gold"
                    checked={notifPrefs.notifySubmission}
                    onChange={e => setNotifPrefs(p => ({ ...p, notifySubmission: e.target.checked }))}
                  />
                </label>

                <div className="flex items-center justify-between gap-4">
                  <label className="flex items-center gap-2 text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-gold"
                      checked={notifPrefs.notifyDueSoon}
                      onChange={e => setNotifPrefs(p => ({ ...p, notifyDueSoon: e.target.checked }))}
                    />
                    Payroll due-soon reminders
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={notifPrefs.dueSoonDays}
                      disabled={!notifPrefs.notifyDueSoon}
                      className="w-16 border border-border-default rounded px-2 py-1 text-sm disabled:opacity-50 bg-surface-page"
                      onChange={e => setNotifPrefs(p => ({ ...p, dueSoonDays: Math.max(1, Math.min(30, Number(e.target.value))) }))}
                    />
                    <span className="text-gray-500">days before</span>
                  </div>
                </div>

              </div>

              <div className="mt-5 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setNotifPanelOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => saveNotifMutation.mutate(notifPrefs)}
                  disabled={saveNotifMutation.isPending}
                >
                  {saveNotifMutation.isPending ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </Card>
          )}

          {archiveModalOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="font-headline text-lg text-gray-900 mb-3">
                  Archive Project
                </h3>
                {complianceWarning && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    This project has open compliance violations. Archiving will not resolve them. You can restore the project later if needed.
                  </div>
                )}
                <p className="text-sm text-gray-600 mb-5">
                  {complianceWarning
                    ? 'Are you sure you want to archive this project despite open violations?'
                    : 'Are you sure you want to archive this project? It will be hidden from your active dashboard.'}
                </p>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setArchiveModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => archiveMutation.mutate()}
                    disabled={archiveMutation.isPending}
                  >
                    {archiveMutation.isPending ? 'Archiving...' : (complianceWarning ? 'Archive Anyway' : 'Archive')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Subcontractors panel */}
          <SubcontractorsPanel projectId={project.id} />
        </div>
      )}
    </Layout>
  );
}
