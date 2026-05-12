// src/client/pages/ProjectActivityPage.tsx
// Route: /projects/:id/activity
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
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

export function ProjectActivityPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['auditLogs', projectId, { from, to, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
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
    setSearchParams(next);
  }

  function handleExportCsv() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
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
      <div className="max-w-4xl mx-auto">
        <Link
          to={`/projects/${projectId}`}
          className="text-sm text-brand-gold hover:underline transition-colors mb-4 inline-block"
        >
          &larr; Back to Project
        </Link>

        <PageHeader
          title="Evidence Dashboard"
          subtitle="Audit trail, payroll submissions, field photos, and GPS-backed activity"
        />

        <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-4 mb-4">
          <Card padding="sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Evidence status</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {evidenceSummary && evidenceSummary.payrollWeekCount === 0
                    ? 'No payroll weeks yet'
                    : evidenceSummary?.readyForPacket
                    ? 'Packet ready'
                    : evidenceSummary
                    ? `${evidenceSummary.missingEvidence.length} evidence gaps`
                    : 'Loading evidence'}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {evidenceSummary?.payrollWeekCount
                    ? `${evidenceSummary.submittedWeekCount}/${evidenceSummary.payrollWeekCount} payroll weeks submitted.`
                    : 'No payroll weeks recorded yet.'}
                  {' '}Latest audit event {evidenceSummary?.latestAuditAt ? formatTimestamp(evidenceSummary.latestAuditAt) : 'not recorded yet'}.
                </p>
              </div>
              <div className="h-10 w-10 rounded bg-brand-gold/15 flex items-center justify-center text-brand-gold shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card padding="sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Audit events', value: evidenceSummary?.auditEventCount ?? 0, Icon: FileClock },
                { label: 'Photos', value: evidenceSummary?.photoCount ?? 0, Icon: Camera },
                { label: 'GPS punches', value: evidenceSummary?.timePunchCount ?? 0, Icon: Clock3 },
                { label: 'Open weeks', value: evidenceSummary?.unsubmittedWeekCount ?? 0, Icon: ClipboardCheck },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="border border-gray-200 rounded p-3 min-h-[76px]">
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

        <Card padding="sm" className="mb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Required vs collected</p>
                <p className="mt-1 text-sm text-gray-600">
                  Evidence packet readiness based on payroll submission, audit, photo, and GPS proof.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleExportEvidencePacket('json')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-brand-gold text-brand-gold rounded hover:bg-brand-gold/10 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  JSON packet
                </button>
                <button
                  onClick={() => handleExportEvidencePacket('csv')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
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
                  <div key={item.key} className="border border-gray-200 rounded p-3 min-h-[88px]">
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
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {(evidenceSummary?.weeks?.length ?? 0) > 0 && (
          <Card padding="sm" className="mb-4">
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
        <Card padding="sm" className="mb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => handleFilterChange('from', e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white text-gray-900 focus:border-brand-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => handleFilterChange('to', e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white text-gray-900 focus:border-brand-gold focus:outline-none"
              />
            </div>
            {(from || to) && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-brand-gold hover:text-brand-gold/80 transition-colors pb-1.5"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={handleExportCsv}
              title="Export all project activity as CSV — includes timestamps, user, action type, and details for every recorded event."
              className="px-3 py-1.5 text-sm border border-brand-gold text-brand-gold rounded hover:bg-brand-gold/10 transition-colors"
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
          <Card padding="none">
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
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-gold/20 flex items-center justify-center mt-0.5">
                      <span className="text-xs font-semibold text-brand-gold">
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
                className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= data.totalPages}
                className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
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
