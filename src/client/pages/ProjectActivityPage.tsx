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
          className="text-sm text-neutral-400 hover:text-white transition-colors mb-4 inline-block"
        >
          &larr; Back to Project
        </Link>

        <PageHeader
          title="Project Activity"
          subtitle="Audit trail of all project events"
        />

        {/* Date range filter */}
        <Card padding="sm" className="mb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => handleFilterChange('from', e.target.value)}
                className="border border-neutral-700 rounded px-3 py-1.5 text-sm bg-surface-card text-white focus:border-brand-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => handleFilterChange('to', e.target.value)}
                className="border border-neutral-700 rounded px-3 py-1.5 text-sm bg-surface-card text-white focus:border-brand-gold focus:outline-none"
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
          <p className="text-sm text-red-400 py-4">
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
            <ul className="divide-y divide-neutral-800">
              {rows.map((row) => {
                if (row.kind === 'header') {
                  return (
                    <li key={row.key} className="px-5 py-2 bg-nav-dark">
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
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
                      <p className="text-sm text-white">
                        {getActionLabel(item)}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
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
            <p className="text-xs text-neutral-400">
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
