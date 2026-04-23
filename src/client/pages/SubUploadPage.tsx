import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface UploadInfo { subName: string; weekEndingDate: string; alreadyUploaded: boolean; }

export function SubUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<UploadInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle');

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

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!info) return <div className="p-8 text-gray-500">Loading…</div>;
  if (info.alreadyUploaded) {
    return (
      <div className="p-8 text-green-700">
        Your certified payroll for week ending {info.weekEndingDate} has already been received. Thank you!
      </div>
    );
  }
  if (status === 'done') {
    return (
      <div className="p-8 text-green-700">
        Upload received! The general contractor has been notified.
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-16 p-8 border border-gray-200 rounded-lg">
      <h1 className="text-xl font-bold mb-2">Upload Certified Payroll</h1>
      <p className="text-sm text-gray-600 mb-6">{info.subName} — week ending {info.weekEndingDate}</p>
      <input
        type="file"
        accept="application/pdf"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
        className="block mb-4"
      />
      <button
        onClick={submit}
        disabled={!file || status === 'uploading'}
        className="bg-yellow-700 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {status === 'uploading' ? 'Uploading…' : 'Submit CPR'}
      </button>
    </div>
  );
}
