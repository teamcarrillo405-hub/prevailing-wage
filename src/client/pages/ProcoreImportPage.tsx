import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimesheetEntry {
  procoreId: string;
  workerName: string;
  workerId: string | null;
  date: string | null;
  hours: number;
  costCode: string | null;
  description: string | null;
}

interface TimesheetEntriesResponse {
  data: {
    entries: TimesheetEntry[];
    count: number;
  };
}

interface ImportResponse {
  data: {
    committed: number;
    weekId: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Given a week-ending date (YYYY-MM-DD), returns the start date 6 days earlier. */
function deriveStartDate(weekEndingDate: string): string {
  const d = new Date(weekEndingDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

// ── Component ─────────────────────────────────────────────────────────────────

type PageState = 'input' | 'preview' | 'success';

export function ProcoreImportPage() {
  // ── Form state ────────────────────────────────────────────────────────────
  const [projectId, setProjectId] = useState('');
  const [weekEndingDate, setWeekEndingDate] = useState('');
  const [weekId, setWeekId] = useState('');

  // ── Flow state ────────────────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>('input');
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importedCount, setImportedCount] = useState(0);

  // ── Request state ─────────────────────────────────────────────────────────
  const [fetchLoading, setFetchLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleFetch() {
    setFetchError(null);
    setNotConnected(false);
    if (!projectId.trim()) { setFetchError('Project ID is required.'); return; }
    if (!weekEndingDate) { setFetchError('Week ending date is required.'); return; }

    setFetchLoading(true);
    try {
      const startDate = deriveStartDate(weekEndingDate);
      const resp = await api.get<TimesheetEntriesResponse>(
        `/integrations/procore/timesheet-entries?projectId=${encodeURIComponent(projectId)}&startDate=${startDate}&endDate=${weekEndingDate}`,
      );
      const rows = resp.data.entries;
      setEntries(rows);
      setSelectedIds(new Set(rows.map((e) => e.procoreId)));
      setPageState('preview');
    } catch (err: any) {
      if (err?.status === 401) {
        setNotConnected(true);
      } else {
        setFetchError(err?.message || 'Failed to fetch timesheets. Please try again.');
      }
    } finally {
      setFetchLoading(false);
    }
  }

  async function handleImport() {
    setImportError(null);
    if (!weekId.trim()) { setImportError('Payroll Week ID is required.'); return; }

    const selectedEntries = entries.filter((e) => selectedIds.has(e.procoreId));
    if (selectedEntries.length === 0) { setImportError('Select at least one entry to import.'); return; }

    const importPayload = selectedEntries.map((e) => ({
      // workerName only — classificationId must be provided by the user in the real flow.
      // For the import bridge, we use a placeholder classificationId that the
      // server will accept (the user must correct it on the payroll entry page).
      workerId: e.workerId ?? e.procoreId,
      classificationId: 'PROCORE_IMPORT',
      date: e.date ?? weekEndingDate,
      hours: e.hours,
    }));

    setImportLoading(true);
    try {
      const resp = await api.post<ImportResponse>('/integrations/procore/import', {
        weekId: weekId.trim(),
        entries: importPayload,
      });
      setImportedCount(resp.data.committed);
      setPageState('success');
    } catch (err: any) {
      if (err?.status === 401) {
        setImportError('Procore connection lost. Reconnect from the Integrations page.');
      } else if (err?.status === 423) {
        setImportError('This payroll week is already submitted and cannot be modified.');
      } else {
        setImportError(err?.message || 'Import failed. Please try again.');
      }
    } finally {
      setImportLoading(false);
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleStartOver() {
    setProjectId('');
    setWeekEndingDate('');
    setWeekId('');
    setEntries([]);
    setSelectedIds(new Set());
    setFetchError(null);
    setImportError(null);
    setNotConnected(false);
    setPageState('input');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageHeader title="Procore Timesheet Import" subtitle="Import timesheet entries from Procore into prevailing wage payroll." />

        {/* STATE A — Input form */}
        {pageState === 'input' && (
          <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6 space-y-6">

            {notConnected && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Procore is not connected.{' '}
                <Link to="/settings/integrations" className="underline font-medium">
                  Connect Procore on the Integrations page.
                </Link>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="projectId">
                Procore Project ID
              </label>
              <input
                id="projectId"
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g. 1234567"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="weekEndingDate">
                Week ending date
              </label>
              <input
                id="weekEndingDate"
                type="date"
                value={weekEndingDate}
                onChange={(e) => setWeekEndingDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold"
              />
              {weekEndingDate && (
                <p className="text-xs text-gray-500 mt-1">
                  Fetching entries from {deriveStartDate(weekEndingDate)} to {weekEndingDate}
                </p>
              )}
            </div>

            {fetchError && (
              <p className="text-sm text-red-600">{fetchError}</p>
            )}

            <Button
              variant="primary"
              onClick={handleFetch}
              loading={fetchLoading}
              disabled={fetchLoading}
            >
              {fetchLoading ? 'Fetching...' : 'Fetch Timesheets'}
            </Button>
          </div>
        )}

        {/* STATE B — Preview table */}
        {pageState === 'preview' && (
          <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6 space-y-6">
            <div className="flex items-center justify-between">
              <Badge variant="neutral">{entries.length} entries from Procore</Badge>
              <Button variant="ghost" size="sm" onClick={handleStartOver}>
                Start Over
              </Button>
            </div>

            {/* Entry table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-8 px-3 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === entries.length && entries.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(new Set(entries.map((en) => en.procoreId)));
                          else setSelectedIds(new Set());
                        }}
                        className="rounded border-gray-300"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-700">Worker Name</th>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-700">Date</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-700">Hours</th>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-700">Cost Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                        No timesheet entries found for this date range.
                      </td>
                    </tr>
                  )}
                  {entries.map((entry) => (
                    <tr
                      key={entry.procoreId}
                      className={`transition-colors ${selectedIds.has(entry.procoreId) ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.procoreId)}
                          onChange={() => toggleRow(entry.procoreId)}
                          className="rounded border-gray-300"
                          aria-label={`Select ${entry.workerName}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-gray-900 font-medium">{entry.workerName}</td>
                      <td className="px-3 py-2.5 text-gray-600">{entry.date ?? '—'}</td>
                      <td className="px-3 py-2.5 text-gray-900 text-right font-mono">{entry.hours.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-gray-600">{entry.costCode ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payroll week ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="weekId">
                Payroll Week ID
              </label>
              <input
                id="weekId"
                type="text"
                value={weekId}
                onChange={(e) => setWeekId(e.target.value)}
                placeholder="Paste the payroll week ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold"
              />
              <p className="text-xs text-gray-500 mt-1">
                Find this in the URL on the Payroll Week Detail page.
              </p>
            </div>

            {importError && (
              <p className="text-sm text-red-600">{importError}</p>
            )}

            <Button
              variant="primary"
              onClick={handleImport}
              loading={importLoading}
              disabled={importLoading || selectedIds.size === 0 || !weekId.trim()}
            >
              {importLoading ? 'Importing...' : `Import ${selectedIds.size} Selected to Payroll`}
            </Button>
          </div>
        )}

        {/* STATE C — Success */}
        {pageState === 'success' && (
          <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6 space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
              Imported {importedCount} {importedCount === 1 ? 'entry' : 'entries'} into payroll week.
            </div>
            <Button variant="ghost" onClick={handleStartOver}>
              Import More
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
