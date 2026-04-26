// src/client/pages/ApiDocsPage.tsx
// Static API reference page — no auth required.
// Route: /api-docs

import { Link } from 'react-router-dom';

interface Endpoint {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  scope: string;
  description: string;
}

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/v1/projects', scope: 'projects:read', description: 'List all projects accessible to your API key. Supports ?page=1&limit=20 pagination.' },
  { method: 'GET', path: '/v1/projects/batch', scope: 'projects:read', description: 'Fetch up to 20 projects by ID in one request. Pass ?ids=id1,id2,id3.' },
  { method: 'GET', path: '/v1/projects/:id', scope: 'projects:read', description: 'Get a single project by ID.' },
  { method: 'GET', path: '/v1/projects/:id/payroll-weeks', scope: 'payroll:read', description: 'List payroll weeks with submission status for a project. Supports pagination.' },
  { method: 'GET', path: '/v1/projects/:id/compliance-summary', scope: 'projects:read', description: 'Violation counts and compliance status for a project.' },
  { method: 'GET', path: '/v1/projects/:id/workers', scope: 'workers:read', description: 'Worker list for a project. SSN is never returned; only last-4 digits. Supports pagination.' },
  { method: 'GET', path: '/v1/reports/compliance-summary', scope: 'projects:read', description: 'Aggregate compliance view across all accessible projects — enterprise dashboard roll-up.' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-800',
  POST: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-amber-100 text-amber-800',
};

export function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <p className="text-xs font-semibold text-brand-gold uppercase tracking-widest mb-3">
            Developer Reference
          </p>
          <h1 className="text-4xl font-bold mb-3">PrevWage Public API</h1>
          <p className="text-gray-400 max-w-xl">
            Integrate certified payroll data into your own systems. Read-only access to projects,
            payroll weeks, compliance status, and workers.
          </p>
          <div className="mt-6 flex gap-4">
            <Link
              to="/settings/api-keys"
              className="inline-block bg-brand-gold text-gray-900 font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-brand-gold/90 transition-colors"
            >
              Generate API Key
            </Link>
            <a
              href="#endpoints"
              className="inline-block border border-white/20 text-white px-5 py-2.5 rounded-lg text-sm hover:bg-white/10 transition-colors"
            >
              View Endpoints
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

        {/* Authentication */}
        <section id="authentication">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
          <p className="text-gray-600 mb-4">
            All API requests must include your API key as a Bearer token in the{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">Authorization</code> header.
            Keys are created in <Link to="/settings/api-keys" className="text-blue-600 hover:underline">Settings &rarr; API Keys</Link>.
          </p>
          <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono text-gray-300 overflow-x-auto">
            <pre>{`curl https://prevwage.app/v1/projects \\
  -H "Authorization: Bearer pw_live_your_key_here"`}</pre>
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            Your API key is shown only once at creation. Store it securely — it cannot be retrieved after creation.
          </div>
        </section>

        {/* Base URL */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Base URL</h2>
          <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono text-gray-300">
            <pre>{`https://prevwage.app/v1`}</pre>
          </div>
        </section>

        {/* Scopes */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Scopes</h2>
          <p className="text-gray-600 mb-4">
            Each API key is issued with one or more scopes that limit what data can be accessed.
          </p>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Scope</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { scope: 'projects:read', desc: 'Read project metadata and compliance summaries' },
                  { scope: 'payroll:read', desc: 'Read payroll weeks and submission status' },
                  { scope: 'workers:read', desc: 'Read worker records (no SSN)' },
                ].map(({ scope, desc }) => (
                  <tr key={scope}>
                    <td className="px-4 py-3 font-mono text-blue-700">{scope}</td>
                    <td className="px-4 py-3 text-gray-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Endpoints */}
        <section id="endpoints">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Endpoints</h2>
          <div className="space-y-3">
            {ENDPOINTS.map((ep) => (
              <div key={ep.path} className="border border-gray-200 rounded-xl p-4 bg-white">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${METHOD_COLORS[ep.method]}`}>
                    {ep.method}
                  </span>
                  <code className="font-mono text-sm text-gray-900">{ep.path}</code>
                  <span className="text-xs text-gray-500 ml-auto font-mono bg-gray-100 px-2 py-0.5 rounded">
                    {ep.scope}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{ep.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pagination */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Pagination</h2>
          <p className="text-gray-600 mb-4">
            All list endpoints support cursor-free offset pagination via{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">page</code> and{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">limit</code> query
            parameters. Default page size is 20; maximum is 100.
          </p>
          <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono text-gray-300 overflow-x-auto mb-4">
            <pre>{`GET /v1/projects?page=2&limit=50`}</pre>
          </div>
          <p className="text-gray-600 mb-4">Paginated responses include a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">meta</code> envelope with navigation fields:</p>
          <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono text-gray-300 overflow-x-auto">
            <pre>{`{
  "data": [ ... ],
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601",
    "page": 2,
    "limit": 50,
    "total": 137,
    "hasNext": true
  }
}`}</pre>
          </div>
        </section>

        {/* Batch Endpoint */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Batch Endpoint</h2>
          <p className="text-gray-600 mb-4">
            Fetch up to 20 projects in a single request to reduce round-trips:
          </p>
          <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono text-gray-300 overflow-x-auto">
            <pre>{`GET /v1/projects/batch?ids=proj_abc,proj_def,proj_ghi

# Response:
{
  "data": [ { "id": "proj_abc", ... }, { "id": "proj_def", ... } ],
  "meta": { "requested": 3, "returned": 2, "requestId": "...", "timestamp": "..." }
}`}</pre>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Projects not found or not accessible to your API key are silently omitted. Check{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">meta.returned</code> vs{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">meta.requested</code> to detect gaps.
          </p>
        </section>

        {/* Response Format */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Response Format</h2>
          <p className="text-gray-600 mb-4">
            All responses are JSON with a consistent envelope:
          </p>
          <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono text-gray-300 overflow-x-auto">
            <pre>{`{
  "data": { ... },        // the requested resource or array
  "meta": {
    "requestId": "uuid",  // unique per-request ID for support
    "timestamp": "ISO8601"
  }
}`}</pre>
          </div>
        </section>

        {/* Error Format */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Errors</h2>
          <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono text-gray-300 mb-4 overflow-x-auto">
            <pre>{`{
  "error": "Human-readable error message"
}`}</pre>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { status: '200 OK', meaning: 'Success' },
                  { status: '401 Unauthorized', meaning: 'Missing, invalid, or expired API key' },
                  { status: '403 Forbidden', meaning: 'API key lacks required scope' },
                  { status: '404 Not Found', meaning: 'Resource not found or access denied' },
                ].map(({ status, meaning }) => (
                  <tr key={status}>
                    <td className="px-4 py-3 font-mono text-gray-800">{status}</td>
                    <td className="px-4 py-3 text-gray-600">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rate Limiting */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate Limiting</h2>
          <p className="text-gray-600 mb-4">
            All responses include rate-limit headers. The limit is 1,000 requests per hour per API key.
          </p>
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Header</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { header: 'X-RateLimit-Limit', desc: 'Maximum requests per hour for this key' },
                  { header: 'X-RateLimit-Remaining', desc: 'Requests remaining in the current window' },
                  { header: 'X-RateLimit-Reset', desc: 'Unix timestamp when the window resets' },
                  { header: 'Retry-After', desc: 'Seconds to wait before retrying (only present on 429 responses)' },
                ].map(({ header, desc }) => (
                  <tr key={header}>
                    <td className="px-4 py-3 font-mono text-blue-700 text-xs">{header}</td>
                    <td className="px-4 py-3 text-gray-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500">
            When your key is rate-limited you receive HTTP 429. Retry after the number of seconds in
            the <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">Retry-After</code> header.
          </p>
        </section>

        {/* Example request */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Example Requests</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">List projects:</p>
              <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono text-gray-300 overflow-x-auto">
                <pre>{`curl https://prevwage.app/v1/projects \\
  -H "Authorization: Bearer pw_live_..."

# Response:
{
  "data": [
    {
      "id": "proj_abc123",
      "name": "I-95 Bridge Expansion",
      "state": "CA",
      "status": "active"
    }
  ],
  "meta": { "requestId": "...", "timestamp": "2026-04-25T..." }
}`}</pre>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Get compliance summary:</p>
              <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono text-gray-300 overflow-x-auto">
                <pre>{`curl https://prevwage.app/v1/projects/proj_abc123/compliance-summary \\
  -H "Authorization: Bearer pw_live_..."`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-gray-900 rounded-2xl p-8 text-center text-white">
          <h3 className="text-xl font-bold mb-2">Ready to integrate?</h3>
          <p className="text-gray-400 mb-6">Generate your first API key from the Settings panel.</p>
          <Link
            to="/settings/api-keys"
            className="inline-block bg-brand-gold text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-brand-gold/90 transition-colors"
          >
            Go to API Keys
          </Link>
        </div>

      </div>
    </div>
  );
}
