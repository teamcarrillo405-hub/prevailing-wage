// src/client/pages/ProjectActivityPage.tsx
// Route: /projects/:id/activity
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ActivityEmptyIllustration } from '../components/illustrations/EmptyIllustrations';
import { AlertTriangle, Camera, CheckCircle2, ClipboardCheck, Clock3, Download, FileClock, ShieldCheck } from 'lucide-react';

// Client-side mirror of server types — DO NOT import from server
interface AuditLogItem {
  id: string;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  entityType: string;
  entityId: string;
  action: string;
  diff: { before: Record<string, unknown>; after: Record<string, unknown> } | null;
  snapshot: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
}

interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface EvidenceSummary {
  auditEventCount: number;
  payrollWeekCount: number;
  submittedWeekCount: number;
  unsubmittedWeekCount: number;
  photoCount: number;
  projectPhotoCount: number;
  weekPhotoCount: number;
  timePunchCount: number;
  latestAuditAt: string | null;
  readyForPacket: boolean;
  missingEvidence: string[];
  requirements: EvidenceRequirement[];
  weeks: EvidenceWeek[];
}

interface EvidenceWeek {
  weekId: string;
  payrollNumber: number;
  weekEndingDate: string;
  submitted: boolean;
  weekPhotoCount: number;
  timePunchCount: number;
  readyForPacket: boolean;
  missingEvidence: string[];
}

interface EvidenceRequirement {
  key: 'payroll_submissions' | 'audit_trail' | 'photo_evidence' | 'gps_time_punches';
  label: string;
  requiredCount: number;
  collectedCount: number;
  missingCount: number;
  status: 'complete' | 'missing' | 'not_applicable';
}

// Human-readable action labels — mirrors auditService action keys
const ACTION_LABELS: Record<string, (log: AuditLogItem) => string> = {
  'worker.created':           (l) => `Added worker ${l.meta?.workerName ?? 'unknown'}`,
  'worker.updated':           (l) => `Updated worker ${l.meta?.workerName ?? 'unknown'}`,
  'worker.deleted':           (l) => `Removed worker ${l.meta?.workerName ?? 'unknown'}`,
  'payroll_entry.created':    (l) => `Added payroll entry for ${l.meta?.workerName ?? 'unknown'} (Week ${l.meta?.payrollNumber ?? '?'})`,
  'payroll_entry.updated':    (l) => `Edited payroll entry for ${l.meta?.workerName ?? 'unknown'} (Week ${l.meta?.payrollNumber ?? '?'})`,
  'payroll_entry.deleted':    (l) => `Deleted payroll entry for ${l.meta?.workerName ?? 'unknown'} (Week ${l.meta?.payrollNumber ?? '?'})`,
  'payroll_week.submitted':   (l) => `Certified payroll Week ${l.meta?.payrollNumber ?? '?'} as submitted to ${l.meta?.submittedTo ?? 'agency'}`,
  'payroll_week.unsubmitted': (l) => `Cleared submission status for Week ${l.meta?.payrollNumber ?? '?'}`,
  'wh347.downloaded':         (l) => `Downloaded WH-347 PDF for Week ${l.meta?.payrollNumber ?? '?'}`,
  'ecpr_xml.downloaded':      (l) => `Downloaded CA eCPR XML for Week ${l.meta?.payrollNumber ?? '?'}`,
  'wa_pwia_xml.downloaded':   (l) => `Downloaded WA PWIA XML for Week ${l.meta?.payrollNumber ?? '?'}`,
  'ny_mpwr_xml.downloaded':   (l) => `Downloaded NY MPWR XML for Week ${l.meta?.payrollNumber ?? '?'}`,
  'il_pdf.downloaded':        (l) => `Downloaded IL Certified Payroll PDF for Week ${l.meta?.payrollNumber ?? '?'}`,
  'payroll_import.committed': (l) => `Imported ${l.meta?.committedCount ?? '?'} entries via ${l.meta?.provider ?? 'unknown provider'}`,
  'agency_submission.created':(l) => `Marked Week ${l.meta?.payrollNumber ?? '?'} as submitted to ${
    l.meta?.agency === 'CA_DIR'
      ? 'CA DIR eCPR'
      : l.meta?.agency === 'WA_LNI'
      ? 'WA L&I PWIA'
      : String(l.meta?.agency ?? 'agency')
  }`,
};

function getActionLabel(log: AuditLogItem): string {
  const fn = ACTION_LABELS[log.action];
  return fn ? fn(log) : log.action;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitial(email: string | null): string {
  if (!email) return '?';
  return email.charAt(0).toUpperCase();
}

function requirementGuidance(requirement: EvidenceRequirement): string {
  if (requirement.key === 'payroll_submissions') {
    return requirement.status === 'complete'
      ? 'All payroll weeks have been marked submitted.'
      : 'Payroll edits do not clear this gap. Open each week and record the submission in the Submission Status section.';
  }
  if (requirement.key === 'audit_trail') {
    return 'Audit events are created automatically when workers, payroll, exports, or submissions change.';
  }
  if (requirement.key === 'photo_evidence') {
    return 'Field photos are optional for this project setup, but collected photos strengthen the evidence packet.';
  }
  return 'GPS punches are optional for this project setup, but collected time punches strengthen the evidence packet.';
}

function requirementWeekLink(projectId: string | undefined, requirement: EvidenceRequirement, weekId: string) {
  const base = `/projects/${projectId}/payroll/${weekId}`;
  return requirement.key === 'payroll_submissions' ? `${base}#submission-status` : base;
}

function requirementEntityType(requirement: EvidenceRequirement): string {
  if (requirement.key === 'payroll_submissions') return 'payroll_week';
  if (requirement.key === 'audit_trail') return '';
  if (requirement.key === 'photo_evidence') return 'project_photo';
  return 'time_punch';
}

const AUDIT_SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'worker', label: 'Workers' },
  { value: 'payroll_entry', label: 'Payroll entries' },
  { value: 'payroll_week', label: 'Payroll weeks and forms' },
  { value: 'payroll_import', label: 'Payroll imports' },
  { value: 'subcontractor', label: 'Subcontractors' },
  { value: 'project_photo', label: 'Photos' },
  { value: 'time_punch', label: 'GPS and time' },
];

export function ProjectActivityPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEvidenceKey, setSelectedEvidenceKey] = useState<EvidenceRequirement['key'] | null>(null);
  const evidenceDetailRef = useRef<HTMLDivElement | null>(null);

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const entityType = searchParams.get('entityType') ?? '';
  const evidenceKey = (searchParams.get('evidence') as EvidenceRequirement['key'] | null) ?? selectedEvidenceKey;
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['auditLogs', projectId, { from, to, entityType, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (entityType) params.set('entityType', entityType);
      params.set('page', String(page));
      return api.get<AuditLogResponse>(`/audit/${projectId}?${params.toString()}`);
    },
    enabled: !!projectId,
  });

  const { data: evidenceSummary } = useQuery({
    queryKey: ['evidenceSummary', projectId],
    queryFn: () =>
      api.get<{ data: EvidenceSummary }>(`/audit/${projectId}/evidence-summary`).then((r) => r.data),
    enabled: !!projectId,
  });

  function handleFilterChange(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  }

  function handleClearFilters() {
    const next = new URLSearchParams();
    setSelectedEvidenceKey(null);
    setSearchParams(next);
  }

  function handleExportCsv() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (entityType) params.set('entityType', entityType);
    const url = `/api/audit/${projectId}/csv${params.size > 0 ? '?' + params.toString() : ''}`;
    window.location.href = url;
  }

  function handleExportEvidencePacket(format: 'json' | 'csv') {
    window.location.href = `/api/audit/${projectId}/evidence-packet?format=${format}`;
  }

  function handlePageChange(newPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
  }

  const items = data?.items ?? [];
  const selectedRequirement =
    evidenceSummary?.requirements.find((item) => item.key === evidenceKey) ??
    evidenceSummary?.requirements.find((item) => item.status === 'missing') ??
    evidenceSummary?.requirements[0] ??
    null;
  const selectedRequirementWeeks = selectedRequirement
    ? (evidenceSummary?.weeks ?? []).filter((week) => {
        if (selectedRequirement.key === 'payroll_submissions') return !week.submitted;
        if (selectedRequirement.key === 'photo_evidence') return week.weekPhotoCount === 0;
        if (selectedRequirement.key === 'gps_time_punches') return week.timePunchCount === 0;
        return !week.readyForPacket;
      })
    : [];

  function selectEvidenceRequirement(key: EvidenceRequirement['key']) {
    setSelectedEvidenceKey(key);
    const requirement = evidenceSummary?.requirements.find((item) => item.key === key);
    const next = new URLSearchParams(searchParams);
    next.set('evidence', key);
    const source = requirement ? requirementEntityType(requirement) : '';
    if (source) {
      next.set('entityType', source);
    } else {
      next.delete('entityType');
    }
    next.set('page', '1');
    setSearchParams(next);
    window.setTimeout(() => {
      evidenceDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  // Build list with day-group headers
  type RowItem =
    | { kind: 'header'; label: string; key: string }
    | { kind: 'entry'; item: AuditLogItem };

  const rows: RowItem[] = [];
  let lastDateStr = '';
  for (const item of items) {
    const dateStr = new Date(item.createdAt).toDateString();
    if (dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      rows.push({ kind: 'header', label: formatDateGroup(item.createdAt), key: dateStr });
    }
    rows.push({ kind: 'entry', item });
  }

  return (
    <Layout>
      <div className="w-full space-y-6">
        <Link
          to={`/projects/${projectId}`}
          className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-black transition-colors hover:underline"
        >
          &larr; Back to Project
        </Link>

        <PageHeader
          title="Audit Packet"
          subtitle="Submission proof, payroll records, photos, GPS activity, and audit trail"
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <Card padding="none" className="overflow-hidden border border-gray-200">
            <div className="border-b border-gray-200 bg-black px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Audit packet status</p>
                <p className="mt-2 font-headline text-xl text-white">
                  {evidenceSummary && evidenceSummary.payrollWeekCount === 0
                    ? 'No payroll weeks yet'
                    : evidenceSummary?.readyForPacket
                    ? 'Packet ready'
                    : evidenceSummary
                    ? `${evidenceSummary.missingEvidence.length} evidence gaps`
                    : 'Loading evidence'}
                </p>
                <p className="mt-2 max-w-3xl text-sm text-gray-200">
                  {evidenceSummary?.payrollWeekCount
                    ? `${evidenceSummary.submittedWeekCount}/${evidenceSummary.payrollWeekCount} payroll weeks submitted.`
                    : 'No payroll weeks recorded yet.'}
                  {' '}Latest audit event {evidenceSummary?.latestAuditAt ? formatTimestamp(evidenceSummary.latestAuditAt) : 'not recorded yet'}.
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-brand-gold text-black">
                <ShieldCheck className="h-5 w-5" />
              </div>
              </div>
            </div>
            <div className="grid divide-y divide-gray-200 md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payroll weeks</p>
                <p className="mt-2 font-headline text-lg text-gray-950">{evidenceSummary?.payrollWeekCount ?? 0}</p>
                <p className="mt-1 text-sm text-gray-600">Weeks represented in the packet.</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted</p>
                <p className="mt-2 font-headline text-lg text-gray-950">{evidenceSummary?.submittedWeekCount ?? 0}</p>
                <p className="mt-1 text-sm text-gray-600">Weeks with recorded agency submission.</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Open gaps</p>
                <p className="mt-2 font-headline text-lg text-gray-950">{evidenceSummary?.missingEvidence.length ?? 0}</p>
                <p className="mt-1 text-sm text-gray-600">Items to clear before export.</p>
              </div>
            </div>
          </Card>

          <Card padding="lg" className="border border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Audit events', value: evidenceSummary?.auditEventCount ?? 0, Icon: FileClock },
                { label: 'Photos', value: evidenceSummary?.photoCount ?? 0, Icon: Camera },
                { label: 'GPS punches', value: evidenceSummary?.timePunchCount ?? 0, Icon: Clock3 },
                { label: 'Open weeks', value: evidenceSummary?.unsubmittedWeekCount ?? 0, Icon: ClipboardCheck },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="min-h-[88px] rounded-sm border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">{label}</p>
                    <Icon className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="mt-2 text-xl font-semibold text-gray-900 font-mono">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card padding="sm" className="border border-gray-200">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Required vs collected</p>
                <p className="mt-1 text-sm text-gray-600">
                  Click a category to see the exact week and page that needs attention.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleExportEvidencePacket('json')}
                   className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-brand-gold px-3 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/10"
                >
                  <Download className="h-4 w-4" />
                  JSON packet
                </button>
                <button
                  onClick={() => handleExportEvidencePacket('csv')}
                   className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-gray-300 px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  CSV packet
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(evidenceSummary?.requirements ?? []).map((item) => {
                const isComplete = item.status === 'complete';
                const isMissing = item.status === 'missing';
                const Icon = isComplete ? CheckCircle2 : isMissing ? AlertTriangle : Clock3;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectEvidenceRequirement(item.key)}
                    className={`min-h-[96px] rounded-sm border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-gold ${
                      selectedRequirement?.key === item.key
                        ? 'border-brand-gold bg-brand-gold/10'
                        : 'border-gray-200 hover:border-brand-gold hover:bg-brand-gold/5'
                    }`}
                    aria-pressed={selectedRequirement?.key === item.key}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.collectedCount} collected / {item.requiredCount} required
                        </p>
                      </div>
                      <Icon className={`h-4 w-4 shrink-0 ${isComplete ? 'text-green-600' : isMissing ? 'text-amber-600' : 'text-gray-400'}`} />
                    </div>
                    {isMissing && (
                      <p className="mt-2 text-xs text-amber-700">{item.missingCount} missing</p>
                    )}
                    <p className="mt-2 text-xs font-semibold text-gray-800">
                      {selectedRequirement?.key === item.key ? 'Showing action area below' : 'Show affected weeks'}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedRequirement && (
              <div ref={evidenceDetailRef} tabIndex={-1} className="rounded-sm border border-brand-gold/40 bg-brand-gold/10 p-4 focus:outline-none focus:ring-2 focus:ring-brand-gold">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Action area</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedRequirement.label}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {selectedRequirement.status === 'complete'
                        ? 'This evidence category is complete for the current packet.'
                        : selectedRequirement.status === 'not_applicable'
                        ? 'This evidence category is optional for this project setup, but collected proof still appears in the packet.'
                        : `${selectedRequirement.missingCount} item${selectedRequirement.missingCount === 1 ? '' : 's'} still need evidence.`}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-700">
                      {requirementGuidance(selectedRequirement)}
                    </p>
                  </div>
                  <Badge variant={selectedRequirement.status === 'complete' ? 'compliant' : selectedRequirement.status === 'missing' ? 'warning' : 'neutral'}>
                    {selectedRequirement.status.replace('_', ' ')}
                  </Badge>
                </div>
                {selectedRequirementWeeks.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {selectedRequirementWeeks.slice(0, 5).map((week) => (
                      <Link
                        key={`${selectedRequirement.key}-${week.weekId}`}
                        to={requirementWeekLink(projectId, selectedRequirement, week.weekId)}
                         className="flex min-h-11 items-center justify-between gap-3 rounded-sm border border-gray-200 bg-white px-3 py-2 text-sm hover:border-brand-gold hover:bg-brand-gold/5"
                      >
                        <span>
                          <span className="font-medium text-gray-900">Open Week {week.payrollNumber}</span>
                          <span className="block text-xs text-gray-500">
                            {selectedRequirement.key === 'payroll_submissions'
                              ? 'Open submission status'
                              : week.missingEvidence.join(', ')}
                          </span>
                        </span>
                        <span className="text-xs text-gray-500">{week.weekEndingDate}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-600">
                    No weekly gaps are currently associated with this category.
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        {(evidenceSummary?.weeks?.length ?? 0) > 0 && (
          <Card padding="sm" className="border border-gray-200">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weekly evidence</p>
                <p className="mt-1 text-sm text-gray-600">
                  Per-week proof needed for a clean audit packet.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Week</th>
                    <th className="py-2 pr-3">Submitted</th>
                    <th className="py-2 pr-3">Photos</th>
                    <th className="py-2 pr-3">GPS</th>
                    <th className="py-2">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {evidenceSummary!.weeks.map((week) => (
                    <tr key={week.weekId}>
                      <td className="py-2 pr-3 text-gray-900">
                        Week {week.payrollNumber}
                        <span className="block text-xs text-gray-500">{week.weekEndingDate}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={week.submitted ? 'text-green-600' : 'text-amber-700'}>
                          {week.submitted ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-700">{week.weekPhotoCount}</td>
                      <td className="py-2 pr-3 text-gray-700">{week.timePunchCount}</td>
                      <td className="py-2 text-gray-700">
                        {week.readyForPacket ? (
                          <span className="text-green-600">Ready</span>
                        ) : (
                          week.missingEvidence.join(', ')
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Date range filter */}
          <Card padding="sm" className="border border-gray-200">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="activity-from-date" className="block text-xs text-gray-500 mb-1">From</label>
              <input
                id="activity-from-date"
                type="date"
                value={from}
                onChange={(e) => handleFilterChange('from', e.target.value)}
                className="min-h-11 rounded border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-brand-gold focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="activity-to-date" className="block text-xs text-gray-500 mb-1">To</label>
              <input
                id="activity-to-date"
                type="date"
                value={to}
                onChange={(e) => handleFilterChange('to', e.target.value)}
                className="min-h-11 rounded border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-brand-gold focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="activity-source-filter" className="block text-xs text-gray-500 mb-1">Source</label>
              <select
                id="activity-source-filter"
                value={entityType}
                onChange={(e) => handleFilterChange('entityType', e.target.value)}
                className="min-h-11 rounded border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-brand-gold focus:outline-none"
              >
                {AUDIT_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            {(from || to || entityType || evidenceKey) && (
              <button
                onClick={handleClearFilters}
                className="inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/10"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={handleExportCsv}
              title="Export all project activity as CSV — includes timestamps, user, action type, and details for every recorded event."
              className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-gold px-3 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/10"
            >
              Export CSV
            </button>
          </div>
        </Card>

        {isLoading && <LoadingSpinner />}

        {isError && (
          <p className="text-sm text-red-600 py-4">
            Failed to load activity log. Please try again.
          </p>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            illustration={<ActivityEmptyIllustration />}
            heading="No activity yet"
            message="Actions like adding workers, entering payroll, and downloading reports will appear here."
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <Card padding="none" className="overflow-hidden border border-gray-200">
            <ul className="divide-y divide-gray-200">
              {rows.map((row) => {
                if (row.kind === 'header') {
                  return (
                    <li key={row.key} className="px-5 py-2 bg-gray-50">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {row.label}
                      </span>
                    </li>
                  );
                }
                const { item } = row;
                return (
                  <li key={item.id} className="px-5 py-3 flex items-start gap-3">
                    {/* Actor initial avatar */}
                    <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-gold text-black">
                      <span className="text-sm font-semibold text-black">
                        {getInitial(item.userEmail)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {getActionLabel(item)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.userEmail ?? 'System'} &middot; {formatTimestamp(item.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {data.page} of {data.totalPages} ({data.total} events)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-gold px-3 py-2 text-sm font-semibold text-black transition-colors duration-150 hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= data.totalPages}
                className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-gold px-3 py-2 text-sm font-semibold text-black transition-colors duration-150 hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
