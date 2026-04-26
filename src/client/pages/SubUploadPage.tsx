// MOB-12 — Sub CPR Upload page, mobile-optimized
// Public page — no auth required. Subcontractors land here via emailed link.
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface UploadInfo {
  subName: string;
  weekEndingDate: string;
  alreadyUploaded: boolean;
}

type Status = 'idle' | 'uploading' | 'done';

function StatusPill({ status }: { status: 'pending' | 'submitted' | 'overdue' }) {
  const styles: Record<typeof status, string> = {
    pending:   'bg-amber-100 text-amber-800 border-amber-200',
    submitted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    overdue:   'bg-red-100 text-red-800 border-red-200',
  };
  const labels: Record<typeof status, string> = {
    pending:   'Pending',
    submitted: 'Submitted',
    overdue:   'Overdue',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function SubUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<UploadInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/sub-upload/${token}`)
      .then(r => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(e.error)))
      .then(setInfo)
      .catch((e: unknown) => setError(typeof e === 'string' ? e : 'Link not found or expired'));
  }, [token]);

  async function submit() {
    if (!file || !token) return;
    setStatus('uploading');
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`/api/sub-upload/${token}`, { method: 'POST', body: fd });
    if (r.ok) {
      setStatus('done');
    } else {
      const e = await r.json() as { error: string };
      setError(e.error);
      setStatus('idle');
    }
  }

  // ── Error / loading states ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 w-full max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl font-bold">!</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Link Not Valid</h1>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  // ── Already uploaded ──────────────────────────────────────────────────────
  if (info.alreadyUploaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 w-full max-w-md text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-600 text-2xl font-bold">&#10003;</span>
          </div>
          <StatusPill status="submitted" />
          <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2">Already Received</h1>
          <p className="text-sm text-gray-600">
            Your certified payroll for week ending{' '}
            <strong>{info.weekEndingDate}</strong> has already been received. Thank you!
          </p>
        </div>
      </div>
    );
  }

  // ── Upload success ────────────────────────────────────────────────────────
  if (status === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 w-full max-w-md text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-600 text-2xl font-bold">&#10003;</span>
          </div>
          <StatusPill status="submitted" />
          <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2">Upload Received</h1>
          <p className="text-sm text-gray-600">
            The general contractor has been notified. No further action is needed.
          </p>
        </div>
      </div>
    );
  }

  // ── Main upload form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 flex items-start justify-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md">
        {/* Header */}
        <div className="px-6 pt-7 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <StatusPill status="pending" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-3">Upload Certified Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{info.subName}</span>
            {' '}— week ending{' '}
            <span className="font-medium text-gray-700">{info.weekEndingDate}</span>
          </p>
        </div>

        {/* Upload area */}
        <div className="px-6 py-6 space-y-5">
          {/* File input — wrapped in label for tap-target coverage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Certified Payroll Report (PDF)
            </label>
            {/* Accessible, tap-friendly file drop zone */}
            <label
              htmlFor="cpr-file-input"
              className={`flex flex-col items-center justify-center w-full min-h-[120px] border-2 border-dashed rounded-xl cursor-pointer transition-colors px-4 py-6 text-center ${
                file
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-gray-300 bg-gray-50 hover:border-brand-gold hover:bg-brand-gold/5'
              }`}
            >
              {file ? (
                <>
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                    <span className="text-emerald-600 text-lg font-bold">&#10003;</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 break-all">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(file.size / 1024).toFixed(0)} KB — tap to change
                  </p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                    <span className="text-gray-500 text-lg">&#8679;</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Tap to select PDF</p>
                  <p className="text-xs text-gray-400 mt-1">or drag and drop here</p>
                </>
              )}
              <input
                id="cpr-file-input"
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          </div>

          {/* Submit button — full-width, 44px minimum */}
          <button
            onClick={() => void submit()}
            disabled={!file || status === 'uploading'}
            className="w-full min-h-[52px] bg-brand-navy text-white rounded-xl font-bold text-base transition-colors hover:bg-brand-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'uploading' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Uploading…
              </span>
            ) : (
              'Submit CPR'
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Only PDF files are accepted. Contact the general contractor if you have questions.
          </p>
        </div>
      </div>
    </div>
  );
}
