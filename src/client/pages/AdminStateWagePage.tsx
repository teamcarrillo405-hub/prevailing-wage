// src/client/pages/AdminStateWagePage.tsx
// Admin page for importing state prevailing wage CSV data.
// Supports CA (DIR), WA (L&I), and NY (DOL) — manual import, no live scraping.
// No emojis — use text colors and borders for feedback states.

import { useState, useRef } from 'react';

interface ImportResult {
  inserted: number;
  skipped: number;
}

export function AdminStateWagePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setSuccess(null);
    setError(null);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Select a CSV file first.');
      return;
    }

    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/admin/wages/import-state', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        // Note: Do NOT set Content-Type header — the browser sets it with the boundary
      });

      const body = await res.json().catch(() => ({ error: 'Unexpected response from server' }));

      if (!res.ok) {
        setError(body.error ?? `Import failed (${res.status})`);
      } else {
        setSuccess(body as ImportResult);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSelectedFile(null);
      }
    } catch (err) {
      setError('Network error: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="font-headline text-2xl font-bold text-gray-900 mb-2">
        Import State Prevailing Wages
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload a CSV file with prevailing wage rates for California (CA), Washington (WA), or New York (NY).
        Rates are stored in the local wage cache and returned by the wage lookup tool for those states.
        Re-import to update rates — existing rows are replaced on re-upload.
      </p>

      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700 mb-2 font-headline uppercase tracking-wide">
          Required CSV Format
        </h2>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-5">
{`state,county,wd_number,construction_type,trade_code,trade_description,labor_type,base_rate,fringe_rate

CA,Los Angeles,CA-DIR-2025-CARP,Building,CARP,Carpenter,journeyworker,62.50,28.75
CA,Los Angeles,CA-DIR-2025-CARP,Building,ELEC,Electrician,journeyworker,78.00,32.50
WA,King,WA-LI-2025-001,Building,CARP,Carpenter,journeyworker,58.20,24.10
NY,New York,NY-DOL-2025-001,Building,CARP,Carpenter,journeyworker,71.00,35.50`}
        </pre>
        <p className="text-xs text-gray-500 mt-2">
          Note: <code className="font-mono">construction_type</code> is optional. All other columns are required.
          Multiple classification rows with the same <code className="font-mono">wd_number</code> are grouped into one wage determination.
        </p>
      </div>

      {success && (
        <div className="mb-4 p-3 border border-green-300 bg-green-50 rounded text-sm text-green-700">
          Import complete. Inserted {success.inserted} wage determination{success.inserted !== 1 ? 's' : ''} successfully.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 border border-red-300 bg-red-50 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">CSV File</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block text-sm text-gray-700 border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={handleImport}
          disabled={loading || !selectedFile}
          style={{ backgroundColor: loading || !selectedFile ? undefined : '#F5C518' }}
          className="px-5 py-2 rounded font-semibold text-gray-900 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {loading ? 'Importing...' : 'Import'}
        </button>
      </div>

      {selectedFile && !loading && (
        <p className="mt-2 text-xs text-gray-500">Selected: {selectedFile.name}</p>
      )}
    </div>
  );
}
