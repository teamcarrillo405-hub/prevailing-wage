// src/client/components/workers/WorkerCsvImportModal.tsx
// 3-step CSV import modal: Upload → Preview → Result
import { useState, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';

// ── Types ─────────────────────────────────────────────────────────────────

type LaborType = 'journeyworker' | 'apprentice' | 'foreman';

interface MappedWorker {
  name: string;
  tradeDescription: string;
  laborType: LaborType | '?';
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  ssnLast4?: string;
  tradeUnion?: string;
  unionLocal?: string;
  // validation
  hasErrors: boolean;
  errors: string[];
  // original row for display
  rawIndex: number;
}

interface BulkResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; name: string; reason: string }>;
}

// ── CSV Parser ────────────────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n').map(l =>
    l.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
  );
  return { headers: lines[0] ?? [], rows: lines.slice(1).filter(r => r.some(c => c)) };
}

// ── Column Auto-Detection ─────────────────────────────────────────────────

type FieldKey =
  | 'name'
  | 'tradeDescription'
  | 'laborType'
  | 'addressStreet'
  | 'addressCity'
  | 'addressState'
  | 'addressZip'
  | 'ssnLast4'
  | 'tradeUnion'
  | 'unionLocal'
  | 'ignore';

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  name: ['name', 'worker name', 'employee name', 'full name', 'worker'],
  tradeDescription: ['trade', 'classification', 'trade/classification', 'job title', 'trade description', 'occupation'],
  laborType: ['labor type', 'type', 'worker type', 'journeyworker/apprentice', 'labor_type', 'laborer type'],
  addressStreet: ['address', 'street', 'street address', 'address street'],
  addressCity: ['city', 'address city'],
  addressState: ['state', 'address state'],
  addressZip: ['zip', 'zip code', 'postal code', 'address zip'],
  ssnLast4: ['ssn', 'last 4', 'ssn last 4', 'social', 'ssn last4', 'last4'],
  tradeUnion: ['union', 'trade union'],
  unionLocal: ['local', 'union local'],
  ignore: [],
};

function autoDetectMapping(headers: string[]): FieldKey[] {
  return headers.map(h => {
    const lower = h.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [FieldKey, string[]][]) {
      if (field === 'ignore') continue;
      if (aliases.includes(lower)) return field;
    }
    return 'ignore' as FieldKey;
  });
}

// ── Labor Type Normalization ──────────────────────────────────────────────

function normalizeLaborType(raw: string): LaborType | '?' {
  const v = raw.trim().toLowerCase();
  if (['j', 'jw', 'journeyman', 'journeyworker', 'journey worker'].includes(v)) return 'journeyworker';
  if (['a', 'app', 'apprentice'].includes(v)) return 'apprentice';
  if (['f', 'foreman', 'fm'].includes(v)) return 'foreman';
  return '?';
}

// ── Props ─────────────────────────────────────────────────────────────────

interface WorkerCsvImportModalProps {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: 'ignore', label: '— Ignore —' },
  { value: 'name', label: 'Name' },
  { value: 'tradeDescription', label: 'Trade / Classification' },
  { value: 'laborType', label: 'Labor Type' },
  { value: 'addressStreet', label: 'Address Street' },
  { value: 'addressCity', label: 'City' },
  { value: 'addressState', label: 'State' },
  { value: 'addressZip', label: 'Zip Code' },
  { value: 'ssnLast4', label: 'SSN Last 4' },
  { value: 'tradeUnion', label: 'Trade Union' },
  { value: 'unionLocal', label: 'Union Local' },
];

// ── Component ─────────────────────────────────────────────────────────────

export function WorkerCsvImportModal({ projectId, onClose, onSuccess }: WorkerCsvImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [mappedWorkers, setMappedWorkers] = useState<MappedWorker[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [apiError, setApiError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1 Helpers ─────────────────────────────────────────────────────

  function processFile(file: File) {
    setParseError('');
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers: h, rows: r } = parseCsv(text);
        if (h.length === 0) { setParseError('CSV appears to be empty.'); return; }
        setHeaders(h);
        setRows(r);
        setMapping(autoDetectMapping(h));
      } catch {
        setParseError('Could not parse the CSV file. Make sure it is valid CSV.');
      }
    };
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function updateMapping(colIdx: number, field: FieldKey) {
    setMapping(prev => prev.map((f, i) => (i === colIdx ? field : f)));
  }

  // ── Step 1 → 2: Build mapped workers ──────────────────────────────────

  function buildMappedWorkers(): MappedWorker[] {
    return rows.map((row, rawIndex) => {
      const get = (field: FieldKey) => {
        const colIdx = mapping.indexOf(field);
        return colIdx >= 0 ? (row[colIdx] ?? '').trim() : '';
      };

      const name = get('name');
      const tradeDescription = get('tradeDescription');
      const laborTypeRaw = get('laborType');
      const laborType = laborTypeRaw ? normalizeLaborType(laborTypeRaw) : '?';
      const addressStreet = get('addressStreet') || undefined;
      const addressCity = get('addressCity') || undefined;
      const addressState = get('addressState') || undefined;
      const addressZip = get('addressZip') || undefined;
      const ssnLast4 = get('ssnLast4') || undefined;
      const tradeUnion = get('tradeUnion') || undefined;
      const unionLocal = get('unionLocal') || undefined;

      const errors: string[] = [];
      if (!name) errors.push('Missing name');
      if (!tradeDescription) errors.push('Missing trade/classification');
      if (laborType === '?') errors.push(`Unrecognized labor type: "${laborTypeRaw}"`);

      return {
        name,
        tradeDescription,
        laborType,
        addressStreet,
        addressCity,
        addressState,
        addressZip,
        ssnLast4,
        tradeUnion,
        unionLocal,
        hasErrors: errors.length > 0,
        errors,
        rawIndex,
      };
    });
  }

  function goToPreview() {
    // Validate mapping has required fields
    if (!mapping.includes('name')) { setParseError('Map at least one column to "Name".'); return; }
    if (!mapping.includes('tradeDescription')) { setParseError('Map at least one column to "Trade / Classification".'); return; }
    if (!mapping.includes('laborType')) { setParseError('Map at least one column to "Labor Type".'); return; }
    const workers = buildMappedWorkers();
    setMappedWorkers(workers);
    setStep(2);
  }

  // ── Step 2 → 3: Import ────────────────────────────────────────────────

  async function handleImport() {
    const validWorkers = mappedWorkers.filter(w => !w.hasErrors && w.laborType !== '?');
    setImporting(true);
    setApiError('');
    try {
      const res = await api.post<{ data: BulkResult }>(
        `/projects/${projectId}/workers/bulk`,
        {
          workers: validWorkers.map(w => ({
            name: w.name,
            tradeDescription: w.tradeDescription,
            laborType: w.laborType as LaborType,
            ...(w.addressStreet ? { addressStreet: w.addressStreet } : {}),
            ...(w.addressCity ? { addressCity: w.addressCity } : {}),
            ...(w.addressState ? { addressState: w.addressState } : {}),
            ...(w.addressZip ? { addressZip: w.addressZip } : {}),
            ...(w.ssnLast4 ? { ssnLast4: w.ssnLast4 } : {}),
            ...(w.tradeUnion ? { tradeUnion: w.tradeUnion } : {}),
            ...(w.unionLocal ? { unionLocal: w.unionLocal } : {}),
          })),
        }
      );
      setResult(res.data);
      setStep(3);
    } catch (err: any) {
      setApiError(err?.message ?? 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  const previewRows = mappedWorkers.slice(0, 10);
  const readyCount = mappedWorkers.filter(w => !w.hasErrors && w.laborType !== '?').length;
  const errorRowCount = mappedWorkers.filter(w => w.hasErrors).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Import workers from CSV"
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import Workers from CSV</h2>
            <p className="text-sm text-gray-500">Step {step} of 3</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
                <strong>Required columns:</strong> Name, Trade/Classification, Labor Type<br />
                <strong>Optional:</strong> Address, Last 4 SSN, Union, Union Local<br />
                Labor Type values: journeyworker (or J, JW), apprentice (or A, APP), foreman (or F)
              </div>

              {/* Drop zone */}
              <div
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-brand-gold bg-yellow-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-gray-700">Drop CSV here or click to browse</p>
                <p className="mt-1 text-xs text-gray-500">Accepts .csv files only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={handleFileInput}
                />
              </div>

              {parseError && (
                <p className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{parseError}</p>
              )}

              {/* Column mapping (shown after file is parsed) */}
              {headers.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    {rows.length} rows detected. Map each CSV column to a field:
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {headers.map((header, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-28 truncate text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded" title={header}>
                          {header}
                        </span>
                        <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <select
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                          value={mapping[i] ?? 'ignore'}
                          onChange={(e) => updateMapping(i, e.target.value as FieldKey)}
                        >
                          {FIELD_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={goToPreview}>Preview Rows</Button>
                  </div>
                </div>
              )}

              {headers.length === 0 && (
                <div className="flex justify-end">
                  <Button variant="secondary" onClick={onClose}>Cancel</Button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-green-700">{readyCount} rows ready</span>
                {errorRowCount > 0 && (
                  <span className="font-medium text-red-600">{errorRowCount} rows have errors</span>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Trade</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Labor Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((w, i) => (
                      <tr
                        key={i}
                        className={w.hasErrors ? 'bg-red-50' : 'bg-white even:bg-gray-50'}
                      >
                        <td className="px-3 py-2 text-gray-500">{w.rawIndex + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{w.name || <span className="text-red-500 italic">missing</span>}</td>
                        <td className="px-3 py-2 text-gray-700">{w.tradeDescription || <span className="text-red-500 italic">missing</span>}</td>
                        <td className="px-3 py-2">
                          {w.laborType === '?' ? (
                            <span className="font-bold text-red-600">?</span>
                          ) : (
                            <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                              w.laborType === 'journeyworker' ? 'bg-blue-100 text-blue-800' :
                              w.laborType === 'apprentice' ? 'bg-amber-100 text-amber-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {w.laborType}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-red-600">
                          {w.errors.join('; ') || null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {mappedWorkers.length > 10 && (
                <p className="text-xs text-gray-500">Showing first 10 of {mappedWorkers.length} rows.</p>
              )}

              {apiError && (
                <p className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{apiError}</p>
              )}

              <div className="flex justify-between gap-3 pt-2">
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={onClose}>Cancel</Button>
                  <Button
                    onClick={handleImport}
                    disabled={importing || readyCount === 0}
                  >
                    {importing ? 'Importing...' : `Import ${readyCount} worker${readyCount !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === 3 && result && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4">
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-sm text-green-600 mt-1">Created</p>
                </div>
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-4">
                  <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
                  <p className="text-sm text-yellow-600 mt-1">Skipped (duplicate)</p>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-4">
                  <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                  <p className="text-sm text-red-600 mt-1">Errors</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-red-700">Rows with errors:</p>
                  <ul className="space-y-1 text-sm">
                    {result.errors.map((e, i) => (
                      <li key={i} className="flex gap-2 rounded bg-red-50 border border-red-100 px-3 py-1.5">
                        <span className="shrink-0 font-mono text-red-500">Row {e.row}</span>
                        <span className="font-medium text-gray-900">{e.name}</span>
                        <span className="text-gray-600">{e.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={onSuccess}>Done</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
