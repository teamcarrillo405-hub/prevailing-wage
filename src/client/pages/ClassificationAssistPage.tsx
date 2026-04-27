// src/client/pages/ClassificationAssistPage.tsx
// Phase 103: AI Classification Assist — AI-01, AI-02
// Protected route — requires authentication (calls /api/ai/classify which requires JWT)

import { useState } from 'react';
import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../lib/api.js';

// ── Response shape from 103-01 ────────────────────────────────────────────────

interface ClassifyResponse {
  tradeCode: string;
  tradeDescription: string;
  confidence: number;   // 0.0 – 1.0
  reasoning: string;
  alternatives: Array<{ tradeCode: string; tradeDescription: string; confidence: number }>;
  aiClassificationId: string;
}

// ── Confidence bar component ──────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          style={{ width: `${pct}%` }}
          className="bg-brand-gold h-2 rounded-full transition-all duration-300"
        />
      </div>
      <span className="text-sm font-medium text-nav-dark w-10 text-right">{pct}%</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ClassificationAssistPage() {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (jobDescription.trim().length < 10) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await api.post<ClassifyResponse>('/api/ai/classify', {
        jobDescription: jobDescription.trim(),
      });
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <PageHeader
          title="AI Classification Assist"
          subtitle="Describe a construction task and get an instant Davis-Bacon trade classification suggestion."
        />

        {/* IL AI Act Disclosure — always visible, not dismissible (legal requirement) */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 mb-6">
          <svg
            className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">AI-Assisted Classification Notice</p>
            <p className="text-xs text-amber-700 mt-1">
              This tool uses artificial intelligence (Claude by Anthropic) to suggest Davis-Bacon trade
              classifications. Per the Illinois Artificial Intelligence Video Interview Act and similar state
              AI disclosure laws, you are informed that AI is processing your input. All suggestions must be
              reviewed and confirmed by a qualified human before use in certified payroll submissions.
              Results are not legal advice.
            </p>
          </div>
        </div>

        {/* Input form */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6">
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-nav-dark mb-2">
              Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="e.g. Install electrical conduit and pull wire for commercial HVAC system on federal building renovation..."
              rows={5}
              maxLength={2000}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-transparent resize-y"
            />
            <div className="flex items-center justify-between mt-2 mb-4">
              <p className="text-xs text-gray-400">{jobDescription.length}/2000 characters</p>
              {jobDescription.length < 10 && jobDescription.length > 0 && (
                <p className="text-xs text-amber-600">Minimum 10 characters required</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || jobDescription.trim().length < 10}
              className="bg-nav-dark text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-nav-dark/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Classifying...
                </>
              ) : (
                'Classify with AI'
              )}
            </button>
          </form>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-white border border-red-300 rounded-2xl p-6 shadow-sm mb-6">
            <p className="text-sm font-semibold text-red-700 mb-1">Classification Error</p>
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-gray-500 mt-2">
              If this error persists, ensure ANTHROPIC_API_KEY is configured on the server.
            </p>
          </div>
        )}

        {/* Result card */}
        {result && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
            {/* Primary result */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Primary Classification
              </p>
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-nav-dark text-brand-gold font-bold text-sm px-3 py-1 rounded font-headline">
                  {result.tradeCode}
                </span>
                <span className="text-nav-dark font-semibold text-lg">{result.tradeDescription}</span>
              </div>

              {/* Confidence bar */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Confidence</p>
                <ConfidenceBar value={result.confidence} />
              </div>

              {/* Reasoning */}
              {result.reasoning && (
                <p className="text-sm italic text-gray-600 leading-relaxed">
                  &ldquo;{result.reasoning}&rdquo;
                </p>
              )}
            </div>

            {/* Alternatives */}
            {result.alternatives && result.alternatives.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Alternative Classifications
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.alternatives.map((alt) => (
                    <div
                      key={alt.tradeCode}
                      className="border border-gray-100 rounded-xl p-4 bg-gray-50"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-gray-200 text-gray-700 font-bold text-xs px-2 py-0.5 rounded font-headline">
                          {alt.tradeCode}
                        </span>
                        <span className="text-sm text-gray-700">{alt.tradeDescription}</span>
                      </div>
                      <ConfidenceBar value={alt.confidence} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit ID footer */}
            <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
              Classification ID: {result.aiClassificationId}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
