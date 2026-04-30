import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Workflow, Settings, ChevronRight, Building2, Shield, AlertTriangle, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ProjectDetailSkeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';
import { TermTooltip } from '../components/ui/TermTooltip';
import { Tooltip } from '../components/ui/Tooltip';
import { EmptyState } from '../components/ui/EmptyState';
import { getCprStatus, STATUS_BADGE } from '../lib/cprStatus';
import type { Subcontractor, CprWeek, SubcontractorCertification, SamGovEntity } from '../lib/cprStatus';

const WH347_DEF = "The Department of Labor's official certified payroll form. Contractors must submit it weekly to the contracting officer as proof that workers were paid the correct prevailing wage.";
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ProjectWageDeterminationsPanel } from '../components/ProjectWageDeterminationsPanel';
import { useToast } from '../contexts/ToastContext';
import { SignaturePad } from '../components/ui/SignaturePad';
import { PhotoGallery } from '../components/ui/PhotoGallery';
import { ApprenticeshipDashboard } from '../components/ApprenticeshipDashboard';

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

interface PinRow {
  wageDeterminationId: string;
  isPrimary: boolean;
  wdNumber: string;
  revisionNumber: number;
  lastFetchedAt: string | null;
  constructionType: string | null;
  pinnedAt: string;
}

function StaleWdBanner({ lastFetchedAt }: { lastFetchedAt: string | null }) {
  if (lastFetchedAt === null) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-400 text-amber-800 rounded-md px-4 py-3 mb-4 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Wage Determination has never been synced from SAM.gov &mdash; refresh recommended.</span>
      </div>
    );
  }
  const ageMs = Date.now() - new Date(lastFetchedAt).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  if (ageDays <= 7) return null;
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-400 text-amber-800 rounded-md px-4 py-3 mb-4 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Wage Determination last updated {ageDays} days ago &mdash; refresh recommended.</span>
    </div>
  );
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

/** Maximum DOL civil penalty per violation — 29 CFR Part 5.14 (2024 inflation adjustment). */
const CIVIL_PENALTY_PER_VIOLATION = 13_508;

function WorkflowProgress({ steps }: { steps: { label: string; complete: boolean; to: string }[] }) {
  return (
    <div className="flex items-center gap-0 mb-6 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <Link
            to={step.to}
            className="flex items-center gap-2 group"
            aria-label={`${step.label}${step.complete ? ' (complete)' : ''}`}
          >
            <div className={
              step.complete
                ? 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold bg-status-compliant text-white'
                : 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 border-brand-navy/30 text-gray-400 bg-white group-hover:border-brand-gold group-hover:text-brand-gold transition-colors'
            }>
              {step.complete ? '\u2713' : i + 1}
            </div>
            <span className={
              step.complete
                ? 'text-sm font-medium text-status-compliant'
                : 'text-sm font-medium text-gray-400 group-hover:text-brand-gold transition-colors'
            }>
              {step.label}
            </span>
          </Link>
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

// Phase 107 (DBE-07): DBE classification options and badge color map
type DbeClass = 'none' | 'dbe' | 'mbe' | 'wbe' | 'sdvosb';

const DBE_CLASS_OPTIONS: Array<{ value: DbeClass; label: string }> = [
  { value: 'none',   label: 'None' },
  { value: 'dbe',    label: 'DBE' },
  { value: 'mbe',    label: 'MBE' },
  { value: 'wbe',    label: 'WBE' },
  { value: 'sdvosb', label: 'SDVOSB' },
];

const DBE_BADGE_CLASSES: Record<Exclude<DbeClass, 'none'>, string> = {
  dbe:    'bg-brand-gold text-black',
  mbe:    'bg-emerald-600 text-white',
  wbe:    'bg-blue-600 text-white',
  sdvosb: 'bg-purple-600 text-white',
};

const EMPTY_SUB_FORM = {
  name: '',
  licenseNumber: '',
  contactName: '',
  contactEmail: '',
  address: '',
  dbeClassification: 'none' as DbeClass,
};

const EMPTY_CPR_FORM = {
  weekEndingDate: '',
  receivedDate: '',
  isCompliant: '' as '' | '0' | '1',
  notes: '',
};

function CprWeekTable({ projectId, subId }: { projectId: string; subId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cprForm, setCprForm] = useState({ ...EMPTY_CPR_FORM });
  const [cprError, setCprError] = useState<string | null>(null);
  const [receivingRowId, setReceivingRowId] = useState<string | null>(null);
  const [receivedDate, setReceivedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [cprFilter, setCprFilter] = useState<'all' | 'received-compliant' | 'received-non-compliant' | 'not-received' | 'overdue'>('all');
  const [undoNonCompliant, setUndoNonCompliant] = useState<{ weekId: string; weekLabel: string } | null>(null);

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
      toast.success('CPR week added');
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
      toast.success('CPR week updated');
    },
    onError: () => toast.error('Could not update CPR week'),
  });

  const revertNonCompliantMutation = useMutation({
    mutationFn: (weekId: string) =>
      api.patch(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks/${weekId}`, { isCompliant: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpr-weeks', projectId, subId] });
      toast.success('Non-compliant mark reverted');
    },
    onError: () => toast.error('Could not revert non-compliant mark'),
  });

  const weeks = cprData?.data?.cprWeeks ?? [];

  const filteredWeeks = weeks.filter(week => {
    if (cprFilter === 'all') return true;
    return getCprStatus(week) === cprFilter;
  });

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
      <h4 className="font-headline text-sm text-gray-700 mb-2">
        <TermTooltip
          term="CPR Weeks"
          definition="Certified Payroll Report weeks — each subcontractor must submit a weekly WH-347 form to the prime contractor. Track receipt and compliance status here."
        />
      </h4>

      {cprLoading && <p className="text-xs text-gray-500">Loading...</p>}

      {!cprLoading && weeks.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">No CPR weeks recorded yet.</p>
      )}

      {weeks.length > 0 && (
        <>
          {undoNonCompliant && (
            <div className="mb-3 flex items-center justify-between rounded-sm border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span>Marked as non-compliant.</span>
              <button
                type="button"
                onClick={() => { revertNonCompliantMutation.mutate(undoNonCompliant.weekId); setUndoNonCompliant(null); }}
                className="ml-4 font-semibold underline hover:no-underline"
              >
                Undo
              </button>
            </div>
          )}
          <div className="mb-2 flex items-center gap-2">
            <label className="text-xs text-gray-500 shrink-0">Filter:</label>
            <select
              value={cprFilter}
              onChange={e => setCprFilter(e.target.value as typeof cprFilter)}
              className="border border-border-default rounded-sm px-3 py-2 text-base min-h-[44px] bg-surface-card text-text-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              <option value="all">All</option>
              <option value="received-compliant">Compliant</option>
              <option value="received-non-compliant">Non-Compliant</option>
              <option value="not-received">Not Received</option>
              <option value="overdue">Overdue</option>
            </select>
            {cprFilter !== 'all' && (
              <span className="text-xs text-gray-400">
                {filteredWeeks.length} of {weeks.length} weeks
              </span>
            )}
          </div>
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
              {filteredWeeks.map(week => {
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
                      <div className="flex gap-2 flex-wrap items-center">
                        {!week.receivedDate && receivingRowId !== week.id && (
                          <button
                            className="text-xs font-medium text-brand-gold hover:underline"
                            onClick={() => {
                              setReceivedDate(new Date().toISOString().slice(0, 10));
                              setReceivingRowId(week.id);
                            }}
                            disabled={updateCprWeekMutation.isPending}
                          >
                            Mark Received
                          </button>
                        )}
                        {!week.receivedDate && receivingRowId === week.id && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              className="border border-border-default rounded px-1.5 py-0.5 text-xs bg-surface-page"
                              value={receivedDate}
                              onChange={e => setReceivedDate(e.target.value)}
                            />
                            <button
                              className="text-xs font-medium text-brand-gold hover:underline"
                              onClick={() => {
                                if (!receivedDate) return;
                                updateCprWeekMutation.mutate(
                                  { weekId: week.id, body: { receivedDate, isCompliant: null } },
                                  { onSettled: () => setReceivingRowId(null) }
                                );
                              }}
                              disabled={!receivedDate || updateCprWeekMutation.isPending}
                            >
                              Confirm
                            </button>
                            <button
                              className="text-xs text-gray-500 hover:underline"
                              onClick={() => setReceivingRowId(null)}
                            >
                              Cancel
                            </button>
                          </div>
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
                            onClick={() => {
                              if (window.confirm('Mark this week as non-compliant? This will be recorded in the audit log.')) {
                                updateCprWeekMutation.mutate(
                                  { weekId: week.id, body: { isCompliant: 0 } },
                                  {
                                    onSuccess: () => {
                                      const label = `Week ending ${week.weekEndingDate}`;
                                      setUndoNonCompliant({ weekId: week.id, weekLabel: label });
                                      setTimeout(() => setUndoNonCompliant(null), 8000);
                                    },
                                  }
                                );
                              }
                            }}
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
        </>
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

const CERT_TYPE_OPTIONS = ['DBE', 'MBE', 'WBE', 'SBE', 'ACDBE', '8(a)', 'HUBZone'];

const REEVAL_OPTIONS: { value: SubcontractorCertification['reevaluationStatus']; label: string }[] = [
  { value: 'not_required', label: 'Not subject to IFR review' },
  { value: 'pending',      label: 'Under DOT Oct 2025 IFR review' },
  { value: 'cleared',      label: 'Cleared by DOT' },
  { value: 'suspended',    label: 'Suspended — contact DOT' },
];

const EMPTY_CERT_FORM = {
  certTypes: '',
  certifyingAgency: '',
  certNumber: '',
  naicsCodes: '',
  issueDate: '',
  expiresDate: '',
  reevaluationStatus: 'not_required' as SubcontractorCertification['reevaluationStatus'],
  selfCertified: false,
  // Phase 82 (Gap-2): SAM.gov-derived fields
  uei: '',
  cageCode: '',
  samRegistrationStatus: '',
};

function CertificationsSection({ projectId, subId }: { projectId: string; subId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addCertOpen, setAddCertOpen] = useState(false);
  const [certForm, setCertForm] = useState({ ...EMPTY_CERT_FORM });
  const [certError, setCertError] = useState<string | null>(null);

  // Phase 122 (DBE-02): inline edit state
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [editCertForm, setEditCertForm] = useState<typeof EMPTY_CERT_FORM>({ ...EMPTY_CERT_FORM });
  const [editCertError, setEditCertError] = useState<string | null>(null);

  // Phase 82 (Gap-2) — SAM.gov verification state
  const [samQuery, setSamQuery] = useState('');
  const [samResults, setSamResults] = useState<SamGovEntity[]>([]);
  const [samError, setSamError] = useState<string | null>(null);
  const [samLoading, setSamLoading] = useState(false);
  const [samNotice, setSamNotice] = useState<string | null>(null);

  async function handleSamSearch() {
    setSamError(null);
    setSamNotice(null);
    const trimmed = samQuery.trim();
    if (!trimmed) { setSamError('Enter a company name or UEI.'); return; }
    setSamLoading(true);
    try {
      const looksLikeUei = /^[A-Z0-9]{12}$/i.test(trimmed);
      const params = looksLikeUei
        ? `uei=${encodeURIComponent(trimmed)}`
        : `name=${encodeURIComponent(trimmed)}`;
      const res = await api.get<{ data: { results: SamGovEntity[]; cached: boolean } }>(`/sam-gov/search?${params}`);
      setSamResults(res.data.results);
      if (res.data.results.length === 0) {
        setSamNotice('No matching SAM.gov entities. Try the company\u2019s legal name.');
      }
    } catch (err) {
      setSamError(err instanceof Error ? err.message : 'SAM.gov lookup failed');
      setSamResults([]);
    } finally {
      setSamLoading(false);
    }
  }

  function importFromSam(entity: SamGovEntity) {
    const certCsv = entity.certifications.length > 0
      ? entity.certifications.join(',')
      : certForm.certTypes;
    const naicsCsv = entity.naicsCodes.length > 0 ? entity.naicsCodes.join(',') : '';
    setCertForm(f => ({
      ...f,
      certTypes: certCsv,
      certifyingAgency: 'SAM.gov',
      certNumber: entity.uei ?? f.certNumber,
      uei: entity.uei ?? '',
      cageCode: entity.cage ?? '',
      samRegistrationStatus: entity.registrationStatus ?? '',
    }));
    setAddCertOpen(true);
    if (naicsCsv) {
      // Surface NAICS via certNumber field tail when present — keeps schema flat.
    }
    toast.success(`Imported ${entity.entityName} from SAM.gov`);
  }

  const { data: certData, isLoading: certLoading } = useQuery({
    queryKey: ['certifications', projectId, subId],
    queryFn: () => api.get<{ data: { certifications: SubcontractorCertification[] } }>(
      `/projects/${projectId}/subcontractors/${subId}/certifications`
    ),
    enabled: !!subId,
  });

  const addCertMutation = useMutation({
    mutationFn: (body: Omit<typeof EMPTY_CERT_FORM, ''>) =>
      api.post<{ data: { certification: SubcontractorCertification } }>(
        `/projects/${projectId}/subcontractors/${subId}/certifications`,
        body
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', projectId, subId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Certification added');
      setAddCertOpen(false);
      setCertForm({ ...EMPTY_CERT_FORM });
      setCertError(null);
    },
    onError: () => setCertError('Failed to save certification.'),
  });

  const deleteCertMutation = useMutation({
    mutationFn: (certId: string) =>
      api.delete(`/projects/${projectId}/subcontractors/${subId}/certifications/${certId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', projectId, subId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Certification removed');
    },
    onError: () => toast.error('Could not remove certification'),
  });

  // Phase 122 (DBE-02): edit cert mutation — PATCH to server, double-invalidate both caches
  const editCertMutation = useMutation({
    mutationFn: ({ certId, body }: { certId: string; body: Partial<typeof EMPTY_CERT_FORM> }) =>
      api.patch<{ data: { certification: SubcontractorCertification } }>(
        `/projects/${projectId}/subcontractors/${subId}/certifications/${certId}`,
        body
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', projectId, subId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Certification updated');
      setEditingCertId(null);
      setEditCertForm({ ...EMPTY_CERT_FORM });
      setEditCertError(null);
    },
    onError: () => setEditCertError('Failed to update certification.'),
  });

  const certs = certData?.data?.certifications ?? [];

  function handleAddCert() {
    if (!certForm.certTypes.trim()) { setCertError('Cert types are required.'); return; }
    addCertMutation.mutate({
      certTypes: certForm.certTypes.trim(),
      certifyingAgency: certForm.certifyingAgency || undefined,
      certNumber: certForm.certNumber || undefined,
      expiresDate: certForm.expiresDate || undefined,
      reevaluationStatus: certForm.reevaluationStatus,
      // Phase 82 (Gap-2)
      uei: certForm.uei.trim() || undefined,
      cageCode: certForm.cageCode.trim() || undefined,
      samRegistrationStatus: certForm.samRegistrationStatus.trim() || undefined,
    } as any);
  }

  const INPUT_CLASSES = 'border border-border-default rounded px-2 py-1 text-sm bg-surface-page';

  return (
    <div className="mt-3 border-t border-border-default pt-3">
      <h4 className="font-headline text-sm text-gray-700 mb-2 inline-flex items-center">
        DBE / MBE / WBE Certifications
        <Tooltip content="Disadvantaged/Minority/Women Business Enterprise — federal diversity contracting designations. Required tracking on federal-aid contracts." />
      </h4>

      {certLoading && <p className="text-xs text-gray-500">Loading...</p>}

      {/* Cert badges */}
      {certs.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {certs.map(cert => (
            <span
              key={cert.id}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                cert.reevaluationStatus === 'suspended'
                  ? 'bg-red-100 text-red-700'
                  : cert.reevaluationStatus === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {cert.certTypes}
              {cert.reevaluationStatus === 'suspended' && ' (Suspended)'}
              {cert.reevaluationStatus === 'pending' && ' (DOT Review)'}
            </span>
          ))}
        </div>
      )}

      {/* Cert table */}
      {certs.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-border-default">
                <th className="pb-1 pr-3 font-medium">Cert Types</th>
                <th className="pb-1 pr-3 font-medium">Agency</th>
                <th className="pb-1 pr-3 font-medium">Expires</th>
                <th className="pb-1 pr-3 font-medium">DOT IFR Status</th>
                <th className="pb-1 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map(cert => (
                editingCertId === cert.id ? (
                  <tr key={cert.id} className="border-b border-border-default/50 last:border-0 bg-amber-50">
                    <td colSpan={5} className="p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={editCertForm.certTypes}
                          onChange={e => setEditCertForm(f => ({ ...f, certTypes: e.target.value }))}
                          placeholder="Cert types (DBE,WBE,...)"
                          className={INPUT_CLASSES + ' col-span-2'}
                        />
                        <input
                          value={editCertForm.certifyingAgency ?? ''}
                          onChange={e => setEditCertForm(f => ({ ...f, certifyingAgency: e.target.value }))}
                          placeholder="Certifying agency"
                          className={INPUT_CLASSES}
                        />
                        <input
                          value={editCertForm.certNumber ?? ''}
                          onChange={e => setEditCertForm(f => ({ ...f, certNumber: e.target.value }))}
                          placeholder="Cert number"
                          className={INPUT_CLASSES}
                        />
                        <input
                          type="date"
                          value={editCertForm.issueDate ?? ''}
                          onChange={e => setEditCertForm(f => ({ ...f, issueDate: e.target.value }))}
                          className={INPUT_CLASSES}
                          title="Issue date"
                        />
                        <input
                          type="date"
                          value={editCertForm.expiresDate ?? ''}
                          onChange={e => setEditCertForm(f => ({ ...f, expiresDate: e.target.value }))}
                          className={INPUT_CLASSES}
                          title="Expiry date"
                        />
                        <select
                          value={editCertForm.reevaluationStatus}
                          onChange={e => setEditCertForm(f => ({ ...f, reevaluationStatus: e.target.value as SubcontractorCertification['reevaluationStatus'] }))}
                          className={INPUT_CLASSES + ' col-span-2'}
                        >
                          {REEVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      {editCertError && <p className="text-red-600 text-xs mt-2">{editCertError}</p>}
                      <div className="mt-2 flex gap-2 justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => { setEditingCertId(null); setEditCertForm({ ...EMPTY_CERT_FORM }); setEditCertError(null); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            if (editCertForm.issueDate && editCertForm.expiresDate &&
                                editCertForm.expiresDate <= editCertForm.issueDate) {
                              setEditCertError('Expires date must be after issue date.');
                              return;
                            }
                            editCertMutation.mutate({ certId: cert.id, body: editCertForm });
                          }}
                          disabled={!editCertForm.certTypes.trim() || editCertMutation.isPending}
                        >
                          {editCertMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={cert.id} className="border-b border-border-default/50 last:border-0">
                    <td className="py-1.5 pr-3 font-medium text-gray-900">{cert.certTypes}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{cert.certifyingAgency ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{cert.expiresDate ?? '—'}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        cert.reevaluationStatus === 'suspended' ? 'bg-red-100 text-red-700' :
                        cert.reevaluationStatus === 'pending'   ? 'bg-amber-100 text-amber-700' :
                        cert.reevaluationStatus === 'cleared'   ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {REEVAL_OPTIONS.find(o => o.value === cert.reevaluationStatus)?.label ?? cert.reevaluationStatus}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <button
                        className="text-gray-500 hover:text-brand-gold mr-2"
                        aria-label="Edit certification"
                        title="Edit"
                        onClick={() => {
                          setEditingCertId(cert.id);
                          setEditCertForm({
                            certTypes: cert.certTypes,
                            certifyingAgency: cert.certifyingAgency ?? '',
                            certNumber: cert.certNumber ?? '',
                            naicsCodes: cert.naicsCodes ?? '',
                            issueDate: cert.issueDate ?? '',
                            expiresDate: cert.expiresDate ?? '',
                            reevaluationStatus: cert.reevaluationStatus,
                            selfCertified: cert.selfCertified,
                            uei: cert.uei ?? '',
                            cageCode: cert.cageCode ?? '',
                            samRegistrationStatus: cert.samRegistrationStatus ?? '',
                          });
                          setEditCertError(null);
                        }}
                      >
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <button
                        className="text-xs font-medium text-status-violation hover:underline"
                        onClick={() => {
                          if (window.confirm('Remove this certification?')) {
                            deleteCertMutation.mutate(cert.id);
                          }
                        }}
                        disabled={deleteCertMutation.isPending}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!certs.length && !certLoading && (
        <p className="text-xs text-gray-400 mb-2">No certifications on file.</p>
      )}

      {/* Phase 82 (Gap-2) — SAM.gov verification panel */}
      <div className="bg-surface-page border border-border-default rounded-md p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700">Verify via SAM.gov</p>
          <span
            className="text-[10px] text-gray-400"
            title="Searches the federal System for Award Management (SAM.gov) entity registry. Returns the legal business name, UEI, CAGE code, registration status, and any socio-economic certifications on file."
          >
            What is this?
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className={INPUT_CLASSES + ' flex-1'}
            placeholder="Company legal name or 12-character UEI"
            value={samQuery}
            onChange={e => setSamQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSamSearch(); } }}
          />
          <Button
            variant="secondary"
            onClick={() => void handleSamSearch()}
            disabled={samLoading || !samQuery.trim()}
          >
            {samLoading ? 'Searching...' : 'Search SAM.gov'}
          </Button>
        </div>
        {samError && <p className="text-xs text-status-violation mt-1.5">{samError}</p>}
        {samNotice && <p className="text-xs text-gray-500 mt-1.5">{samNotice}</p>}
        {samResults.length > 0 && (
          <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
            {samResults.slice(0, 5).map((entity, idx) => (
              <div
                key={`${entity.uei ?? idx}-${idx}`}
                className="border border-border-default bg-white rounded-md p-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{entity.entityName}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-gray-500">
                      <span>UEI: <code className="text-gray-700">{entity.uei ?? '\u2014'}</code></span>
                      <span>CAGE: <code className="text-gray-700">{entity.cage ?? '\u2014'}</code></span>
                      <span>
                        Status:
                        <span className={`ml-1 font-medium ${
                          entity.registrationStatus === 'Active' ? 'text-emerald-700'
                          : entity.registrationStatus === 'Inactive' ? 'text-red-700'
                          : 'text-amber-700'
                        }`}>
                          {entity.registrationStatus ?? 'Unknown'}
                        </span>
                      </span>
                    </div>
                    {entity.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entity.certifications.map(c => (
                          <span key={c} className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => importFromSam(entity)}
                  >
                    Import
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add cert button / form */}
      {!addCertOpen ? (
        <button
          onClick={() => setAddCertOpen(true)}
          className="text-xs text-brand-gold hover:underline"
        >
          + Add Certification
        </button>
      ) : (
        <div className="bg-surface-page border border-border-default rounded p-3 space-y-2">
          <p className="text-xs font-medium text-gray-700 mb-1">Add Certification</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-0.5">Cert Types * (comma-separated)</label>
              <div className="flex flex-wrap gap-1 mb-1">
                {CERT_TYPE_OPTIONS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const current = certForm.certTypes
                        .split(',').map(s => s.trim()).filter(Boolean);
                      const next = current.includes(t)
                        ? current.filter(s => s !== t)
                        : [...current, t];
                      setCertForm(f => ({ ...f, certTypes: next.join(',') }));
                    }}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      certForm.certTypes.split(',').map(s => s.trim()).includes(t)
                        ? 'bg-brand-gold/90 text-white border-brand-gold'
                        : 'border-border-default text-gray-600 hover:border-brand-gold'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className={INPUT_CLASSES + ' w-full'}
                placeholder="e.g. DBE,MBE"
                value={certForm.certTypes}
                onChange={e => setCertForm(f => ({ ...f, certTypes: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Certifying Agency</label>
              <input
                type="text"
                className={INPUT_CLASSES + ' w-full'}
                placeholder="Optional"
                value={certForm.certifyingAgency}
                onChange={e => setCertForm(f => ({ ...f, certifyingAgency: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Cert Number</label>
              <input
                type="text"
                className={INPUT_CLASSES + ' w-full'}
                placeholder="Optional"
                value={certForm.certNumber}
                onChange={e => setCertForm(f => ({ ...f, certNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Expiration Date</label>
              <input
                type="date"
                className={INPUT_CLASSES + ' w-full'}
                value={certForm.expiresDate}
                onChange={e => setCertForm(f => ({ ...f, expiresDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                DOT IFR Status
                <span
                  title="The DOT Interim Final Rule (Oct 3, 2025) requires individual reevaluation of all DBE certifications. Suspended status means DBE goals cannot be counted on federal projects."
                  className="cursor-help text-gray-400 hover:text-gray-600 text-xs border border-gray-300 rounded-full w-4 h-4 inline-flex items-center justify-center font-bold"
                >
                  ?
                </span>
              </label>
              <select
                className={INPUT_CLASSES + ' w-full'}
                value={certForm.reevaluationStatus}
                onChange={e => setCertForm(f => ({ ...f, reevaluationStatus: e.target.value as SubcontractorCertification['reevaluationStatus'] }))}
              >
                {REEVAL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          {certError && <p className="text-xs text-status-violation">{certError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => { setAddCertOpen(false); setCertForm({ ...EMPTY_CERT_FORM }); setCertError(null); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCert}
              disabled={!certForm.certTypes.trim() || addCertMutation.isPending}
            >
              {addCertMutation.isPending ? 'Saving...' : 'Save Certification'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubcontractorsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_SUB_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_SUB_FORM });

  // DBE-05: ref for scroll-to-panel behavior from participation card click
  const subsHeaderRef = useRef<HTMLDivElement>(null);

  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: () => api.get<{ data: { subcontractors: Subcontractor[] } }>(`/projects/${projectId}/subcontractors`),
    enabled: !!projectId,
  });

  const addSubMutation = useMutation({
    mutationFn: (body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string; dbeClassification?: DbeClass }) =>
      api.post<{ data: { subcontractor: Subcontractor } }>(`/projects/${projectId}/subcontractors`, body),
    onSuccess: (_, body) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success(`Subcontractor "${body.name}" added`);
      setAddingNew(false);
      setAddForm({ ...EMPTY_SUB_FORM });
    },
    onError: () => toast.error('Could not add subcontractor'),
  });

  const editSubMutation = useMutation({
    mutationFn: ({ subId, body }: { subId: string; body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string; dbeClassification?: DbeClass } }) =>
      api.patch(`/projects/${projectId}/subcontractors/${subId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Subcontractor updated');
      setEditingSubId(null);
    },
    onError: () => toast.error('Could not update subcontractor'),
  });

  const deleteSubMutation = useMutation({
    mutationFn: (subId: string) => api.delete(`/projects/${projectId}/subcontractors/${subId}`),
    onSuccess: (_data, subId) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
      toast.success('Subcontractor removed');
      setDeletingSubId(null);
      setExpandedSubId(prev => prev === subId ? null : prev);
    },
    onError: () => toast.error('Could not remove subcontractor'),
  });

  function handleAddSub() {
    if (!addForm.name.trim()) return;
    const body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string; dbeClassification?: DbeClass } = {
      name: addForm.name.trim(),
      dbeClassification: addForm.dbeClassification,
    };
    if (addForm.licenseNumber.trim()) body.licenseNumber = addForm.licenseNumber.trim();
    if (addForm.contactName.trim()) body.contactName = addForm.contactName.trim();
    if (addForm.contactEmail.trim()) body.contactEmail = addForm.contactEmail.trim();
    if (addForm.address.trim()) body.address = addForm.address.trim();
    addSubMutation.mutate(body);
  }

  function handleEditSub(subId: string) {
    if (!editForm.name.trim()) return;
    const body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string; dbeClassification?: DbeClass } = {
      name: editForm.name.trim(),
      dbeClassification: editForm.dbeClassification,
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
      dbeClassification: sub.dbeClassification ?? 'none',
    });
  }

  const subs = subsData?.data?.subcontractors ?? [];

  // DBE-05: derive participation counts from server-attached certSummary
  const activeCertifiedCount = subs.filter(
    s => s.certSummary?.isCertified && !s.certSummary.hasSuspendedCert,
  ).length;
  const expiredCount = subs.filter(s => s.certSummary?.hasExpiredCert).length;
  const pendingCount = subs.filter(s => s.certSummary?.hasPendingCert).length;

  // DBE-05: Branch A — expandedSubId state exists; click scrolls to panel and expands first certified sub.
  // If no certified sub exists, the participation card is conditionally hidden (see render gate below),
  // so this state is unreachable in practice — still guarded with early return for safety.
  function handleParticipationCardClick() {
    subsHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstCertified = subs.find(s => s.certSummary?.isCertified);
    if (!firstCertified) return;
    setExpandedSubId(firstCertified.id);
  }

  const INPUT_CLASSES = 'border border-border-default rounded px-2 py-1 text-sm bg-surface-page';

  return (
    <div>
      <div ref={subsHeaderRef} className="flex items-center justify-between mb-3">
        {!addingNew && (
          <Button variant="secondary" onClick={() => setAddingNew(true)}>
            Add Subcontractor
          </Button>
        )}
      </div>

      {/* DBE-05: DBE Participation Summary card — shown only when there are certified subs */}
      {subs.length > 0 && subs.some(s => s.certSummary?.isCertified) && (
        <div
          className="rounded-xl border border-gray-200 shadow-sm p-5 mb-5 cursor-pointer hover:bg-gray-50 transition-colors"
          role="button"
          tabIndex={0}
          onClick={handleParticipationCardClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleParticipationCardClick();
            }
          }}
          aria-label="Open subcontractor certifications panel"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-gold" />
            DBE/MBE/WBE Participation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{activeCertifiedCount}</p>
              <p className="text-xs text-gray-500">Active Certified</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${expiredCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {expiredCount}
              </p>
              <p className="text-xs text-gray-500">Expired Certs</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {pendingCount}
              </p>
              <p className="text-xs text-gray-500">DOT IFR Review</p>
            </div>
          </div>
          {(expiredCount > 0 || pendingCount > 0) && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mt-3">
              Resolve certification issues before the next CPR submission deadline.
            </p>
          )}
        </div>
      )}

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
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">DBE Classification</label>
              <select
                className={INPUT_CLASSES + ' w-full'}
                value={addForm.dbeClassification}
                onChange={e => setAddForm(f => ({ ...f, dbeClassification: e.target.value as DbeClass }))}
              >
                {DBE_CLASS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
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
          icon={Building2}
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
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">DBE Classification</label>
                  <select
                    className={INPUT_CLASSES + ' w-full'}
                    value={editForm.dbeClassification}
                    onChange={e => setEditForm(f => ({ ...f, dbeClassification: e.target.value as DbeClass }))}
                  >
                    {DBE_CLASS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
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
                    {sub.dbeClassification && sub.dbeClassification !== 'none' && (
                      <span className={`px-1.5 py-0.5 text-xs font-semibold rounded uppercase ${DBE_BADGE_CLASSES[sub.dbeClassification as Exclude<DbeClass, 'none'>]}`}>
                        {sub.dbeClassification.toUpperCase()}
                      </span>
                    )}
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
                        aria-label={expandedSubId === sub.id ? 'Collapse CPR weeks' : 'Expand CPR weeks'}
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
                <>
                  <CertificationsSection projectId={projectId} subId={sub.id} />
                  <CprWeekTable projectId={projectId} subId={sub.id} />
                </>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Phase 117: Apprenticeship Ratios collapsible section ─────────────────────

function ApprenticeshipSection({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-brand-navy transition-colors mb-3"
        aria-expanded={open}
      >
        <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        Apprenticeship Ratios
      </button>
      {open && (
        <div className="mt-2">
          <ApprenticeshipDashboard projectId={projectId} />
        </div>
      )}
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
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

  const { data: wdPinsData } = useQuery({
    queryKey: ['wd-pins', id],
    queryFn: () => api.get<{ pins: PinRow[] }>(`/projects/${id}/wage-determinations`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: complianceSummaryData } = useQuery({
    queryKey: ['compliance-summary-batch'],
    queryFn: () => api.get<{ projects: Array<{ id: string; status: string; violationCount: number }> }>(
      '/compliance/projects/summary'
    ),
    enabled: !!id && data?.data?.project?.status === 'active',
    staleTime: 60_000,
  });

  const primaryPin = wdPinsData?.pins?.find((p) => p.isPrimary) ?? null;
  const showStaleBanner =
    primaryPin !== null &&
    (primaryPin.lastFetchedAt === null ||
      Date.now() - new Date(primaryPin.lastFetchedAt).getTime() > 7 * 24 * 60 * 60 * 1000);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast.success('Project restored');
    },
    onError: () => toast.error('Could not restore project'),
  });

  const saveNotifMutation = useMutation({
    mutationFn: (prefs: NotifSettings) => {
      return api.patch(`/projects/${id}`, { projectSettings: JSON.stringify(prefs) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      toast.success('Notification preferences saved');
      setNotifPanelOpen(false);
    },
    onError: () => toast.error('Could not save notification preferences'),
  });

  useEffect(() => {
    if (!archiveModalOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setArchiveModalOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [archiveModalOpen]);

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

  // Civil penalty exposure — COMP-08 / DOL 2024
  const projectCompliance = complianceSummaryData?.projects?.find(p => p.id === id);
  const violationCount = projectCompliance?.violationCount ?? 0;
  const maxCivilPenalty = violationCount * CIVIL_PENALTY_PER_VIOLATION;

  const steps = [
    { label: 'Create Project', complete: true, to: `/projects/${id}` },
    { label: 'Add Workers', complete: workers.length > 0, to: `/projects/${id}/workers` },
    { label: 'Enter Payroll', complete: weeks.length > 0, to: `/projects/${id}/payroll` },
    { label: 'Download WH-347', complete: weeks.some(w => w.submittedAt !== null), to: `/projects/${id}/payroll` },
  ];

  return (
    <Layout>
      {isLoading && <ProjectDetailSkeleton />}

      {isError && (
        <div className="text-center py-12">
          <p className="text-red-600 text-sm mb-4">Project not found or access denied.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center justify-center font-semibold rounded-sm text-sm px-4 py-3 min-h-[44px] bg-transparent text-brand-gold border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
          >
            Try Again
          </button>
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

          {/* Project sub-page navigation — scrollable on mobile, wraps on md: */}
          <div className="mb-6 -mx-4 px-4 overflow-x-auto">
          <div className="flex flex-nowrap md:flex-wrap gap-2 items-center whitespace-nowrap pb-2 md:pb-0">
            <Link
              to={`/projects/${project.id}/workers`}
              className="inline-flex items-center justify-center text-sm px-4 py-3 min-h-[44px] font-semibold rounded-lg bg-brand-gold text-nav-dark hover:bg-brand-gold/90 border border-transparent transition-all duration-150"
            >
              Workers
            </Link>
            <Link
              to={`/projects/${project.id}/payroll`}
              className="inline-flex items-center justify-center text-sm px-4 py-3 min-h-[44px] font-semibold rounded-lg bg-brand-gold text-nav-dark hover:bg-brand-gold/90 border border-transparent transition-all duration-150"
            >
              Payroll Weeks
            </Link>
            <Link
              to={`/projects/${project.id}/field`}
              className="inline-flex items-center justify-center text-sm px-4 py-3 min-h-[44px] font-semibold rounded-lg bg-transparent text-brand-gold border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
            >
              Field Clock
            </Link>
            <Link
              to={`/projects/${project.id}/ot-scenarios`}
              className="inline-flex items-center justify-center text-sm px-4 py-3 min-h-[44px] font-semibold rounded-lg bg-transparent text-brand-gold border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
            >
              OT Scenarios
            </Link>
            <Link
              to={`/projects/${project.id}/variance`}
              className="inline-flex items-center justify-center text-sm px-4 py-3 min-h-[44px] font-semibold rounded-lg bg-transparent text-brand-gold border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
            >
              Variance
            </Link>
            <Link
              to={`/projects/${project.id}/reports`}
              className="inline-flex items-center justify-center text-sm px-4 py-3 min-h-[44px] font-semibold rounded-lg bg-transparent text-brand-gold border border-brand-gold hover:bg-brand-gold/10 transition-all duration-150"
            >
              Reports
            </Link>
            <Link
              to={`/projects/${project.id}/activity`}
              className="inline-flex items-center justify-center text-sm px-4 py-3 min-h-[44px] font-semibold rounded-lg bg-transparent text-text-secondary border border-transparent hover:bg-gray-100 transition-all duration-150"
            >
              Activity
            </Link>
            <Link
              to={`/projects/${project.id}/settings`}
              className="inline-flex items-center justify-center text-sm px-4 py-3 min-h-[44px] font-semibold rounded-lg bg-transparent text-text-secondary border border-transparent hover:bg-gray-100 transition-all duration-150"
            >
              Settings
            </Link>
          </div>
          </div>{/* end overflow-x-auto */}

          <Card className="w-full md:max-w-lg shadow-card-elevated">
            <h2 className="font-headline text-base text-text-primary mb-3 pb-2 border-b border-border-subtle">Project Details</h2>
            <dl className="space-y-3 text-sm md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-3 md:space-y-0">
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
                <dd>
                  <Badge variant={project.status === 'active' ? 'compliant' : project.status === 'archived' ? 'neutral' : 'warning'}>
                    {project.status}
                  </Badge>
                </dd>
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
            <Card className="mt-4 max-w-lg shadow-card-elevated">
              <h2 className="font-headline text-base text-text-primary mb-3 pb-2 border-b border-border-subtle">Notification Preferences</h2>
              <div className="space-y-5 text-sm font-body">

                {/* Alerts group — instant notifications */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Alerts</h4>
                  <div className="space-y-3">

                    <label
                      className="flex items-center justify-between gap-4 cursor-pointer"
                      title="Fires immediately when a worker's wages fall below the required prevailing wage rate"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">Compliance violation detected</span>
                        <p className="text-xs text-gray-500 mt-0.5">Instant alert when a worker's wages fall below the required prevailing wage</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-gold shrink-0"
                        checked={notifPrefs.notifyViolations}
                        onChange={e => setNotifPrefs(p => ({ ...p, notifyViolations: e.target.checked }))}
                        title="Fires immediately when a compliance violation is detected"
                      />
                    </label>

                    <label
                      className="flex items-center justify-between gap-4 cursor-pointer"
                      title="Fires when any team member (other than you) edits or updates this project"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">Team activity</span>
                        <p className="text-xs text-gray-500 mt-0.5">Instant alert when another team member edits this project</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-gold shrink-0"
                        checked={notifPrefs.notifyActivity}
                        onChange={e => setNotifPrefs(p => ({ ...p, notifyActivity: e.target.checked }))}
                        title="Fires when any team member other than you edits this project"
                      />
                    </label>

                    <label
                      className="flex items-center justify-between gap-4 cursor-pointer"
                      title="Fires when a certified payroll report (WH-347) is successfully submitted"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">Payroll submission confirmed</span>
                        <p className="text-xs text-gray-500 mt-0.5">Instant email confirmation when a WH-347 is submitted</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-gold shrink-0"
                        checked={notifPrefs.notifySubmission}
                        onChange={e => setNotifPrefs(p => ({ ...p, notifySubmission: e.target.checked }))}
                        title="Fires when a certified payroll report is successfully submitted"
                      />
                    </label>

                  </div>
                </div>

                {/* Reminders group — scheduled/upcoming */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Reminders</h4>
                  <div className="space-y-3">

                    <div className="flex items-start justify-between gap-4">
                      <label
                        className="flex items-start gap-2 cursor-pointer"
                        title="Sends a scheduled reminder email N days before each weekly payroll deadline"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-gold mt-0.5 shrink-0"
                          checked={notifPrefs.notifyDueSoon}
                          onChange={e => setNotifPrefs(p => ({ ...p, notifyDueSoon: e.target.checked }))}
                          title="Enable scheduled reminders before each weekly payroll deadline"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Payroll due-date reminder</span>
                          <p className="text-xs text-gray-500 mt-0.5">Scheduled email before each weekly payroll deadline</p>
                        </div>
                      </label>
                      <div
                        className="flex items-center gap-2 shrink-0"
                        title="Number of days before the payroll deadline to send the reminder"
                      >
                        <span className="text-xs text-gray-500 whitespace-nowrap">Notify me</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={notifPrefs.dueSoonDays}
                          disabled={!notifPrefs.notifyDueSoon}
                          className="w-16 border border-border-default rounded px-2 py-2 text-base min-h-[44px] disabled:opacity-40 bg-surface-page text-center"
                          onChange={e => setNotifPrefs(p => ({ ...p, dueSoonDays: Math.max(1, Math.min(30, Number(e.target.value))) }))}
                          title="Days before the payroll deadline to send the reminder (1–30)"
                          aria-label="Days before payroll is due"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">days before payroll is due</span>
                      </div>
                    </div>

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

          {/* Civil penalty exposure — COMP-08 / DOL 2024 */}
          {project.status === 'active' && violationCount > 0 && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 max-w-lg">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-status-violation">
                    Civil Penalty Exposure
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {violationCount} active violation{violationCount !== 1 ? 's' : ''} detected
                    across payroll weeks for this project.
                  </p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
                    <div className="rounded bg-white border border-red-100 px-3 py-2">
                      <p className="text-lg font-bold text-status-violation">{violationCount}</p>
                      <p className="text-xs text-gray-500">Violations</p>
                    </div>
                    <div className="rounded bg-white border border-red-100 px-3 py-2">
                      <p className="text-lg font-bold text-status-violation">
                        ${maxCivilPenalty.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Max Exposure</p>
                    </div>
                  </div>
                  <p className="text-xs text-red-600 mt-2">
                    Max penalty: ${CIVIL_PENALTY_PER_VIOLATION.toLocaleString()} per violation (29 CFR Part 5.14, 2024).
                    Resolve violations on the Payroll Weeks page before submission.
                  </p>
                </div>
              </div>
            </div>
          )}

          {archiveModalOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div
                className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby="archive-modal-title"
              >
                <h3 id="archive-modal-title" className="font-headline text-lg text-gray-900 mb-3">
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
          <Card className="mt-8 shadow-card-elevated">
            <h2 className="font-headline text-base text-text-primary mb-3 pb-2 border-b border-border-subtle">Subcontractors</h2>
            <SubcontractorsPanel projectId={project.id} />
          </Card>

          {/* Apprenticeship Ratios — Phase 117 (APP-01) */}
          <Card padding="none" className="mt-8 shadow-card-elevated overflow-hidden">
            <ApprenticeshipSection projectId={project.id} />
          </Card>

          {/* Wage determinations panel */}
          <Card className="mt-8 shadow-card-elevated">
            <h2 className="font-headline text-base text-text-primary mb-3 pb-2 border-b border-border-subtle">Wage Determinations</h2>
            {/* Stale WD banner — COMP-06 Phase 88 */}
            {showStaleBanner && primaryPin && (
              <StaleWdBanner lastFetchedAt={primaryPin.lastFetchedAt} />
            )}
            <ProjectWageDeterminationsPanel
              projectId={project.id}
              projectState={project.state}
              projectCounty={project.county}
            />
          </Card>

          {/* Phase 96: Contractor Signature */}
          <div className="mt-8">
            <SignaturePad projectId={project.id} />
          </div>

          {/* Phase 96: Site Photo Gallery */}
          <div className="mt-8">
            <PhotoGallery projectId={project.id} />
          </div>
        </div>
      )}
    </Layout>
  );
}
