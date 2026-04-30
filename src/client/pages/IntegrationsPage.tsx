import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { IntegrationsSkeleton } from '../components/ui/Skeleton.js';

interface QboStatusResponse {
  data: {
    connected: boolean;
    realmId?: string;
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
    nearExpiry?: boolean;
  };
}

interface ProcoreStatusResponse {
  data: {
    connected: boolean;
    companyId?: string;
    nearExpiry?: boolean;
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
  };
}

interface SsoConfigStatus {
  provider: string;
  domain: string | null;
  status: 'pending' | 'active' | 'disabled';
}

interface QboEmployee {
  qboId: string;
  displayName: string;
  email: string | null;
}

// ── QB Employee Import (Phase 121 / QB-02) ────────────────────────────────

interface QbEmployee {
  qboId: string;
  displayName: string;
  email: string | null;
  address: string | null;
  hasSsn: boolean;
  ssnLast4: string | null;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: Array<{ qboId: string; reason: string }>;
}

function EmployeeImportSection({ projectId }: { projectId: string }) {
  const [employees, setEmployees] = useState<QbEmployee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [existingNamesLower, setExistingNamesLower] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Refresh existing worker names for client-side dedup display whenever projectId changes
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/workers`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json: { data?: { workers?: Array<{ name: string }> } }) => {
        const names = (json.data?.workers ?? []).map((w) => w.name.trim().toLowerCase());
        setExistingNamesLower(new Set(names));
      })
      .catch(() => {
        // Non-fatal — server deduplicates authoritatively
      });
    // Reset on project change
    setEmployees([]);
    setSelected(new Set());
    setResult(null);
  }, [projectId]);

  async function handleLoadEmployees() {
    setLoading(true);
    setLoadError(null);
    try {
      const resp = await fetch('/api/integrations/qbo/employees', { credentials: 'include' });
      const json = await resp.json() as { data?: { employees?: QbEmployee[] }; error?: string };
      if (!resp.ok) {
        setLoadError(json.error ?? 'Failed to load QB employees');
        return;
      }
      setEmployees(json.data?.employees ?? []);
      setSelected(new Set());
    } catch {
      setLoadError('Failed to load QB employees. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (selected.size === 0 || !projectId) return;
    setImporting(true);
    try {
      const resp = await fetch('/api/integrations/qbo/import-employees', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, qboIds: [...selected] }),
      });
      const json = await resp.json() as { data?: ImportResult; error?: string };
      if (!resp.ok) {
        setLoadError(json.error ?? 'Import failed');
        return;
      }
      setResult(json.data ?? { created: 0, skipped: 0, errors: [] });
      setSelected(new Set());
      // Re-fetch existing workers to refresh dedup display
      fetch(`/api/projects/${projectId}/workers`, { credentials: 'include' })
        .then((r) => r.json())
        .then((j: { data?: { workers?: Array<{ name: string }> } }) => {
          const names = (j.data?.workers ?? []).map((w) => w.name.trim().toLowerCase());
          setExistingNamesLower(new Set(names));
        })
        .catch(() => {});
    } catch {
      setLoadError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  function toggleRow(qboId: string, alreadyExists: boolean) {
    if (alreadyExists) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(qboId)) next.delete(qboId);
      else next.add(qboId);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Import QB Employees as Workers</h2>
          <p className="text-sm text-gray-600 mt-1">
            Load employees from QuickBooks and import selected ones as Workers in the chosen project.
            SSN is retrieved server-side at import time — it is never sent to the browser.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {result && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <span className="font-medium">{result.created} worker{result.created !== 1 ? 's' : ''} created</span>
          {result.skipped > 0 && <span className="ml-2 text-gray-600">{result.skipped} already exist</span>}
          {result.errors.length > 0 && (
            <span className="ml-2">
              <button
                className="text-amber-700 underline text-xs"
                onClick={() => setShowErrors((v) => !v)}
              >
                {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
              </button>
              {showErrors && (
                <ul className="mt-1 list-disc list-inside text-xs text-red-700">
                  {result.errors.map((e) => (
                    <li key={e.qboId}>{e.qboId}: {e.reason}</li>
                  ))}
                </ul>
              )}
            </span>
          )}
        </div>
      )}

      {employees.length === 0 && (
        <Button variant="secondary" size="sm" onClick={handleLoadEmployees} loading={loading} disabled={loading}>
          {loading ? 'Loading...' : 'Load QB Employees'}
        </Button>
      )}

      {employees.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">QB Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Address</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">SSN (masked)</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => {
                  const alreadyExists = existingNamesLower.has(emp.displayName.toLowerCase());
                  const isChecked = selected.has(emp.qboId);
                  return (
                    <tr
                      key={emp.qboId}
                      className={`${alreadyExists ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-gray-50 cursor-pointer'}`}
                      onClick={() => toggleRow(emp.qboId, alreadyExists)}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={alreadyExists}
                          onChange={() => toggleRow(emp.qboId, alreadyExists)}
                          className="accent-brand-gold"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{emp.displayName}</td>
                      <td className="px-3 py-2 text-gray-600">{emp.email ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{emp.address ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-gray-600">
                        {emp.hasSsn && emp.ssnLast4 ? `\u2022\u2022\u2022 \u2022\u2022 ${emp.ssnLast4}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {alreadyExists ? (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Exists
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            New
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              loading={importing}
            >
              {importing ? 'Importing...' : `Import Selected (${selected.size})`}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleLoadEmployees} loading={loading} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── QB Timesheet Sync (Phase 121 / QB-03) ────────────────────────────────

// Client-side mirror of ImportedRow (matches src/server/services/importTypes.ts)
interface ImportedRow {
  csvName: string;
  workerId: string;
  workerName: string;
  classificationId: string;
  classificationName: string;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number;
  subcontractorId?: string | null;
}

interface SyncTimeEntry { date: string; hours: number; dayKey: string }
interface SyncTimeMatch { workerId: string; workerName: string; qboEmployeeRef: string; entries: SyncTimeEntry[] }

interface WorkerForSync {
  id: string;
  name: string;
  classifications: Array<{
    id: string;
    isActive: boolean;
    tradeCode: string;
    tradeDescription: string;
    baseRate: number | null;
    fringeRate: number | null;
  }>;
}

interface PayrollWeek {
  id: string;
  weekEndingDate: string;
  payrollNumber: number;
  submittedAt: string | null;
}

export function buildImportRows(
  matched: SyncTimeMatch[],
  workers: WorkerForSync[],
): { rows: ImportedRow[]; missingClassWorkerIds: string[] } {
  const missing: string[] = [];
  const map = new Map<string, ImportedRow>();
  for (const m of matched) {
    const w = workers.find((x) => x.id === m.workerId);
    const cls = w?.classifications.find((c) => c.isActive);
    if (!cls) { missing.push(m.workerId); continue; }
    if (!map.has(m.workerId)) {
      map.set(m.workerId, {
        csvName: m.qboEmployeeRef,
        workerId: m.workerId,
        workerName: m.workerName,
        classificationId: cls.id,
        classificationName: cls.tradeDescription ?? cls.tradeCode ?? '',
        baseRateSnapshot: cls.baseRate ?? 0,
        fringeRateSnapshot: cls.fringeRate ?? 0,
        monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
        monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
      });
    }
    const row = map.get(m.workerId)!;
    for (const e of m.entries) {
      (row as unknown as Record<string, number | string>)[e.dayKey] =
        ((row as unknown as Record<string, number>)[e.dayKey] ?? 0) + e.hours;
    }
  }
  return { rows: [...map.values()], missingClassWorkerIds: missing };
}

function SyncTimesheetSection({ projectId }: { projectId: string }) {
  const [weeks, setWeeks] = useState<PayrollWeek[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerForSync[]>([]);
  const [preview, setPreview] = useState<{ matched: SyncTimeMatch[]; unmatched: Array<{ employeeRef: string; totalHours: number }> } | null>(null);
  const [needsDailySplit, setNeedsDailySplit] = useState(false);
  const [dailySplitConfirmed, setDailySplitConfirmed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ entriesCreated: number } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Fetch open payroll weeks and workers when projectId changes
  useEffect(() => {
    if (!projectId) return;
    setPreview(null);
    setCommitResult(null);
    setCommitError(null);
    setNeedsDailySplit(false);
    setDailySplitConfirmed(false);

    // Fetch payroll weeks — filter out submitted ones
    fetch(`/api/projects/${projectId}/payroll-weeks`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json: { data?: { weeks?: PayrollWeek[] } }) => {
        const open = (json.data?.weeks ?? []).filter((w) => w.submittedAt === null);
        setWeeks(open);
        setSelectedWeekId(open[0]?.id ?? null);
      })
      .catch(() => {
        setWeeks([]);
        setSelectedWeekId(null);
      });

    // Fetch workers for classification resolution
    fetch(`/api/projects/${projectId}/workers`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json: { data?: { workers?: WorkerForSync[] } }) => {
        setWorkers(json.data?.workers ?? []);
      })
      .catch(() => setWorkers([]));
  }, [projectId]);

  async function handlePreview() {
    if (!selectedWeekId) return;
    setPreviewing(true);
    setCommitError(null);
    setPreview(null);
    setNeedsDailySplit(false);
    setDailySplitConfirmed(false);
    try {
      const res = await fetch(
        `/api/integrations/qbo/sync-time?weekId=${selectedWeekId}&projectId=${projectId}`,
        { method: 'POST', credentials: 'include' },
      );
      const json = await res.json() as { data?: { weekId: string; startDate: string; endDate: string; matched: SyncTimeMatch[]; unmatched: Array<{ employeeRef: string; totalHours: number }> }; error?: string };
      if (!res.ok) { setCommitError(json.error ?? 'Preview failed'); return; }
      setPreview({ matched: json.data!.matched, unmatched: json.data!.unmatched });
      // Detect daily split via timeactivities (separate call)
      const taRes = await fetch(
        `/api/integrations/qbo/timeactivities?startDate=${json.data!.startDate}&endDate=${json.data!.endDate}&projectId=${projectId}`,
        { credentials: 'include' },
      );
      if (taRes.ok) {
        const taJson = await taRes.json() as { data?: { activities?: Array<{ needsDailySplit: boolean }> } };
        const anyNeedsSplit = (taJson.data?.activities ?? []).some((r) => r.needsDailySplit === true);
        setNeedsDailySplit(anyNeedsSplit);
      }
    } catch {
      setCommitError('Preview failed. Check your QuickBooks connection.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCommit() {
    if (!preview || !selectedWeekId) return;
    const { rows } = buildImportRows(preview.matched, workers);
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch('/api/payroll/import/commit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekId: selectedWeekId,
          provider: 'quickbooks',
          matched: rows,
          unmatchedCount: preview.unmatched.length,
          sourceFilename: 'QuickBooks TimeActivity',
        }),
      });
      const json = await res.json() as { data?: { entriesCreated?: number }; error?: string };
      if (!res.ok) { setCommitError(json.error ?? 'Commit failed'); return; }
      setCommitResult({ entriesCreated: json.data?.entriesCreated ?? rows.length });
    } catch {
      setCommitError('Commit failed. Please try again.');
    } finally {
      setCommitting(false);
    }
  }

  const { rows: previewRows, missingClassWorkerIds } = preview
    ? buildImportRows(preview.matched, workers)
    : { rows: [], missingClassWorkerIds: [] };

  const commitDisabled =
    !preview ||
    (needsDailySplit && !dailySplitConfirmed) ||
    missingClassWorkerIds.length > 0 ||
    committing ||
    previewRows.length === 0;

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_KEYS_ST = ['monSt', 'tueSt', 'wedSt', 'thuSt', 'friSt', 'satSt', 'sunSt'] as const;

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sync Timesheet from QB</h2>
          <p className="text-sm text-gray-600 mt-1">
            Preview QuickBooks time records for a payroll week and commit them as payroll entries.
            Hours flow through the same conflict-detection pipeline as CSV imports.
          </p>
        </div>
      </div>

      {/* Week selector */}
      {weeks.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">No open payroll weeks found for this project.</p>
      ) : (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="sync-week-selector">
            Payroll Week
          </label>
          <select
            id="sync-week-selector"
            value={selectedWeekId ?? ''}
            onChange={(e) => {
              setSelectedWeekId(e.target.value || null);
              setPreview(null);
              setCommitResult(null);
              setCommitError(null);
              setNeedsDailySplit(false);
              setDailySplitConfirmed(false);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                Week ending {w.weekEndingDate} (#{w.payrollNumber})
              </option>
            ))}
          </select>
        </div>
      )}

      {commitError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {commitError}
        </div>
      )}

      {commitResult && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <span className="font-medium">{commitResult.entriesCreated} payroll {commitResult.entriesCreated === 1 ? 'entry' : 'entries'} created.</span>
        </div>
      )}

      {/* Preview button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={handlePreview}
        disabled={!selectedWeekId || previewing}
        loading={previewing}
      >
        {previewing ? 'Loading preview...' : 'Preview from QB'}
      </Button>

      {/* Preview results */}
      {preview && (
        <div className="mt-5 space-y-4">
          {/* Daily-split amber callout */}
          {needsDailySplit && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium mb-2">
                QuickBooks stored weekly totals — hours have been split evenly across days. Confirm before committing.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailySplitConfirmed}
                  onChange={(e) => setDailySplitConfirmed(e.target.checked)}
                  className="accent-brand-gold"
                />
                <span>I understand hours were distributed evenly and wish to proceed</span>
              </label>
            </div>
          )}

          {/* Missing classification warnings */}
          {missingClassWorkerIds.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {missingClassWorkerIds.length} worker{missingClassWorkerIds.length !== 1 ? 's have' : ' has'} no active classification. Add a classification before importing.
            </div>
          )}

          {/* Preview table */}
          {previewRows.length > 0 && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Worker</th>
                    {DAY_LABELS.map((d) => (
                      <th key={d} className="px-2 py-2 text-center font-medium text-gray-700">{d}</th>
                    ))}
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Total</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewRows.map((row) => {
                    const dayHours = DAY_KEYS_ST.map((k) => row[k] ?? 0);
                    const total = dayHours.reduce((s, h) => s + h, 0);
                    return (
                      <tr key={row.workerId} className="bg-white hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{row.workerName}</td>
                        {dayHours.map((h, i) => (
                          <td key={i} className="px-2 py-2 text-center text-gray-600">
                            {h > 0 ? h.toFixed(2) : '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center font-medium text-gray-900">{total.toFixed(2)}</td>
                        <td className="px-3 py-2 text-gray-600">{row.classificationName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {previewRows.length === 0 && missingClassWorkerIds.length === 0 && (
            <p className="text-sm text-gray-500">No matched workers found for this payroll week.</p>
          )}

          {/* Unmatched panel */}
          {preview.unmatched.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {preview.unmatched.length} QB {preview.unmatched.length === 1 ? 'employee' : 'employees'} could not be matched. Import them first via the Employee Import section.
            </div>
          )}

          {/* Commit button */}
          <div className="pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCommit}
              disabled={commitDisabled}
              loading={committing}
            >
              {committing ? 'Committing...' : 'Commit Import'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Employee Mapping (stored in localStorage, keyed by qboId → our workerId) ──
const MAPPING_KEY = 'qbo_employee_mapping';

function loadMapping(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MAPPING_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function saveMapping(mapping: Record<string, string>): void {
  localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
}

function EmployeeMappingSection() {
  const [qboEmployees, setQboEmployees] = useState<QboEmployee[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>(loadMapping);
  const [saved, setSaved] = useState(false);

  // Minimal worker list fetch (no project scoping — cross-project search not needed here;
  // the mapping UI is intentionally simple: user picks from a text input for each QB employee)

  async function fetchEmployees() {
    setFetching(true);
    setError(null);
    try {
      const resp = await api.post<{ data: { employees: QboEmployee[]; count: number } }>(
        '/integrations/qbo/sync-employees',
        {},
      );
      setQboEmployees(resp.data.employees);
    } catch {
      setError('Failed to fetch employees from QuickBooks. Check your connection.');
    } finally {
      setFetching(false);
    }
  }

  function handleMap(qboId: string, workerName: string) {
    setMapping((prev) => ({ ...prev, [qboId]: workerName }));
    setSaved(false);
  }

  function handleSave() {
    saveMapping(mapping);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  useEffect(() => {
    // Sync persisted mapping on mount so other components can read it
    setMapping(loadMapping());
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Employee Mapping</h2>
          <p className="text-sm text-gray-600 mt-1">
            Link QuickBooks employees to workers in your prevailing-wage projects. Mapping is used
            when syncing QB time records to auto-populate payroll entries.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!qboEmployees && (
        <Button variant="secondary" size="sm" onClick={fetchEmployees} loading={fetching} disabled={fetching}>
          {fetching ? 'Loading...' : 'Load QB Employees'}
        </Button>
      )}

      {qboEmployees && qboEmployees.length === 0 && (
        <p className="text-sm text-gray-500">No employees found in your QuickBooks company.</p>
      )}

      {qboEmployees && qboEmployees.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Enter the exact worker name as it appears in this app (case-insensitive matching is applied during sync).
          </p>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {qboEmployees.map((emp) => (
              <div key={emp.qboId} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{emp.displayName}</p>
                  {emp.email && <p className="text-xs text-gray-400 truncate">{emp.email}</p>}
                </div>
                <span className="text-gray-400 text-sm shrink-0">maps to</span>
                <input
                  type="text"
                  value={mapping[emp.qboId] ?? ''}
                  onChange={(e) => handleMap(emp.qboId, e.target.value)}
                  placeholder="Worker name in app"
                  className="w-48 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button variant="primary" size="sm" onClick={handleSave}>
              Save Mapping
            </Button>
            {saved && <span className="text-sm text-green-600">Saved.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const procoreJustConnected = searchParams.get('procore') === 'connected';

  const { data, isLoading } = useQuery<QboStatusResponse>({
    queryKey: ['qbo-status'],
    queryFn: () => api.get<QboStatusResponse>('/api/integrations/qbo/status'),
  });

  const disconnect = useMutation({
    mutationFn: () => api.delete<unknown>('/api/integrations/qbo'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qbo-status'] }),
  });

  const { data: procoreData } = useQuery<ProcoreStatusResponse>({
    queryKey: ['procore-status'],
    queryFn: () => api.get<ProcoreStatusResponse>('/api/integrations/procore/status'),
  });

  const disconnectProcore = useMutation({
    mutationFn: () => api.delete<unknown>('/api/integrations/procore'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procore-status'] }),
  });

  const { data: ssoData } = useQuery({
    queryKey: ['sso-config'],
    queryFn: () =>
      api.get<{ data: SsoConfigStatus | null }>('/sso/config').catch(() => ({ data: null })),
  });
  const ssoConfig = ssoData?.data ?? null;

  // Shared project selector for QB employee import + (future) timesheet sync
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: projectsData } = useQuery<{ data: { projects: Array<{ id: string; name: string }> } }>({
    queryKey: ['projects-for-integrations'],
    queryFn: () => api.get<{ data: { projects: Array<{ id: string; name: string }> } }>('/api/projects'),
  });

  const projectsList = projectsData?.data?.projects ?? [];

  // Set default selectedProjectId when projects load for the first time
  useEffect(() => {
    if (projectsList.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(projectsList[0].id);
    }
  }, [projectsList, selectedProjectId]);

  const status = data?.data;
  const procoreStatus = procoreData?.data;

  return (
    <Layout>
      <PageHeader
        title="Integrations"
        subtitle="Connect third-party services to streamline your prevailing wage workflow."
      />

      <div className="w-full max-w-2xl md:mx-auto space-y-6">
        {isLoading && <IntegrationsSkeleton />}

        {/* QuickBooks Online card */}
        {!isLoading && (
          <>
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">QuickBooks Online</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Import employees and time records directly from QuickBooks — eliminates the CSV
                    export step.
                  </p>
                </div>
                {status?.connected ? (
                  <Badge variant="compliant">Connected</Badge>
                ) : (
                  <Badge variant="neutral">Not connected</Badge>
                )}
              </div>

              {status?.connected ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Realm ID:</span>{' '}
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {status.realmId}
                    </span>
                  </p>

                  {status.nearExpiry && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      Your QuickBooks connection expires soon. Reconnect to maintain access.
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { window.location.href = '/api/integrations/qbo/connect'; }}
                    >
                      Reconnect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 border border-red-200"
                      onClick={() => disconnect.mutate()}
                      loading={disconnect.isPending}
                      disabled={disconnect.isPending}
                    >
                      {disconnect.isPending ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { window.location.href = '/api/integrations/qbo/connect'; }}
                >
                  Connect to QuickBooks
                </Button>
              )}
            </div>

            {status?.connected && (
              <>
                {/* Shared project selector — drives EmployeeImportSection (Phase 121) and future SyncTimesheetSection (Phase 121-02) */}
                <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="qb-project-selector">
                    Project
                  </label>
                  {projectsList.length === 0 ? (
                    <p className="text-sm text-gray-500">No projects found. Create a project first.</p>
                  ) : (
                    <select
                      id="qb-project-selector"
                      value={selectedProjectId ?? ''}
                      onChange={(e) => setSelectedProjectId(e.target.value || null)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    >
                      {projectsList.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <EmployeeMappingSection />

                {selectedProjectId !== null ? (
                  <>
                    <EmployeeImportSection projectId={selectedProjectId} />
                    <SyncTimesheetSection projectId={selectedProjectId} />
                  </>
                ) : (
                  <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6 text-sm text-gray-500">
                    Select a project to import QB employees.
                  </div>
                )}
              </>
            )}

            {/* Procore connection success banner */}
            {procoreJustConnected && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Procore connected successfully.
              </div>
            )}

            {/* Procore card */}
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Procore</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Import timesheet entries directly from Procore projects to populate
                    prevailing wage payroll entries without manual re-entry.
                  </p>
                </div>
                {procoreStatus?.connected ? (
                  <Badge variant="compliant">Connected</Badge>
                ) : (
                  <Badge variant="neutral">Not connected</Badge>
                )}
              </div>

              {procoreStatus?.connected ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Company ID:</span>{' '}
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {procoreStatus.companyId}
                    </span>
                  </p>

                  {procoreStatus.nearExpiry && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      Your Procore connection expires soon. Reconnect to maintain access.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-1">
                    <a
                      href="/procore/import"
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Import Timesheets
                    </a>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { window.location.href = '/api/integrations/procore/connect'; }}
                    >
                      Reconnect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 border border-red-200"
                      onClick={() => disconnectProcore.mutate()}
                      loading={disconnectProcore.isPending}
                      disabled={disconnectProcore.isPending}
                    >
                      {disconnectProcore.isPending ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { window.location.href = '/api/integrations/procore/connect'; }}
                >
                  Connect to Procore
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-500">
              QuickBooks and Procore credentials are stored encrypted with AES-256-GCM and never
              appear in plaintext.
            </p>

            {/* Enterprise SSO — Phase 110 ENT-03 */}
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Enterprise</h2>
              <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-headline text-nav-dark text-lg">SAML Single Sign-On</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Connect Okta, Azure AD, or any SAML 2.0 IdP for enterprise team login.
                    </p>
                  </div>
                  <Badge variant={ssoConfig?.status === 'active' ? 'compliant' : ssoConfig ? 'warning' : 'neutral'}>
                    {ssoConfig?.status === 'active' ? 'Active' : ssoConfig?.status === 'pending' ? 'Pending' : 'Not Configured'}
                  </Badge>
                </div>
                {ssoConfig && (
                  <div className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Domain:</span> {ssoConfig.domain ?? '—'}
                    {'  '}
                    <span className="font-medium ml-4">Provider:</span> {ssoConfig.provider?.replace('_', ' ')}
                  </div>
                )}
                <Link to="/settings/sso">
                  <Button variant="secondary">
                    {ssoConfig ? 'Manage SSO Configuration' : 'Configure SSO'}
                  </Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
