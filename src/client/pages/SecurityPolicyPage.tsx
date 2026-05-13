// src/client/pages/SecurityPolicyPage.tsx
// Route: /security — public page, no auth required.
// Security posture page — trust signal (TRUST-03).

import { Link } from 'react-router-dom';
import { Lock, Shield, Server, Eye, Mail, FileCheck } from 'lucide-react';
import { TRUST_CONTROLS, categoryLabel, summarizeTrustControls, type TrustControlStatus } from '../../shared/trustCenter';

export function SecurityPolicyPage() {
  const trustSummary = summarizeTrustControls(TRUST_CONTROLS);

  return (
    <div className="min-h-screen bg-white">

      {/* Minimal public header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold text-white">PrevWage</Link>
          <Link
            to="/register"
            className="text-sm bg-brand-gold text-black font-semibold px-4 py-2 rounded-lg hover:bg-brand-gold/90 transition-colors"
          >
            Start Free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gray-900 text-white pt-16 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-brand-gold uppercase tracking-widest mb-4">
            Security
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
            Security Policy
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            Your workers' data is protected with the same encryption standards
            used by financial institutions. Here's exactly how.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-16">

        {/* Data encryption */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-brand-gold" />
            <h2 className="text-2xl font-bold text-gray-900">Data Encryption</h2>
          </div>
          <div className="space-y-4 text-gray-600">
            <p>
              All worker Social Security Numbers (SSNs) are encrypted using <strong>AES-256-GCM</strong> — the same
              algorithm mandated for federal government classified systems. The plaintext SSN never touches
              our database; only the encrypted ciphertext is persisted.
            </p>
            <p>
              Encryption keys are managed separately from the application database. A compromised database
              dump cannot be used to recover SSNs without the separate encryption key material.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {[
                { label: 'Algorithm', value: 'AES-256-GCM (authenticated encryption)' },
                { label: 'Key Size', value: '256-bit (32 bytes)' },
                { label: 'IV', value: '96-bit random per encryption' },
                { label: 'Authentication Tag', value: '128-bit GCM tag' },
                { label: 'Key Storage', value: 'Environment secret, not in DB' },
                { label: 'API Display', value: 'Last 4 digits only — never full SSN' },
              ].map(({ label, value }) => (
                <div key={label} className="border border-gray-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-sm text-gray-900 font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Data in transit */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-brand-gold" />
            <h2 className="text-2xl font-bold text-gray-900">Data in Transit</h2>
          </div>
          <div className="space-y-4 text-gray-600">
            <p>
              All traffic between your browser and PrevWage is encrypted with TLS 1.2+ (HTTPS).
              HTTP connections are permanently redirected to HTTPS. HSTS headers are set with a
              one-year max-age, including subdomains.
            </p>
            <p>
              API keys transmitted via <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">Authorization: Bearer</code> headers
              are only accepted over HTTPS — never over plain HTTP connections.
            </p>
          </div>
        </section>

        {/* Infrastructure */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Server className="w-6 h-6 text-brand-gold" />
            <h2 className="text-2xl font-bold text-gray-900">Infrastructure</h2>
          </div>
          <div className="space-y-4 text-gray-600">
            <p>
              PrevWage is hosted on <strong>Render</strong>, a SOC 2 Type II certified cloud platform. Application
              servers run in isolated containers with no shared state between tenants. Database files
              are stored on persistent, encrypted block storage volumes.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>Automated daily database backups with 7-day retention</li>
              <li>No worker data is processed outside the United States</li>
              <li>Dependency updates reviewed and applied within 30 days of CVE publication</li>
              <li>Security events (login failures, authentication anomalies) are logged and retained for 90 days</li>
            </ul>
          </div>
        </section>

        {/* Access controls */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Eye className="w-6 h-6 text-brand-gold" />
            <h2 className="text-2xl font-bold text-gray-900">Access Controls</h2>
          </div>
          <div className="space-y-4 text-gray-600">
            <p>
              All data access is scoped to the authenticated user's organization. A user with access to
              Project A cannot view data from Project B unless explicitly added as a team member.
            </p>
            <p>
              Role-based access control (RBAC) supports three roles: <strong>Owner</strong>,
              <strong> Member</strong>, and <strong>Auditor</strong>. Auditors have read-only access
              and cannot modify payroll data or export sensitive worker information.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>JWT session tokens are HTTP-only cookies — inaccessible to JavaScript</li>
              <li>CSRF protection on all state-modifying endpoints</li>
              <li>API keys are hashed with SHA-256 before storage — cannot be recovered by PrevWage staff</li>
              <li>Webhook secrets are encrypted with AES-256-GCM before database storage</li>
            </ul>
          </div>
        </section>

        {/* SOC 2 status */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <FileCheck className="w-6 h-6 text-brand-gold" />
            <h2 className="text-2xl font-bold text-gray-900">Trust Center Controls</h2>
          </div>
          <div className="mb-5 border border-gray-200 bg-gray-50 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Public readiness posture</p>
                <p className="mt-1 text-sm text-gray-600">
                  Controls are marked as implemented, needs evidence, action needed, or planned so buyers can separate
                  shipped protections from SOC 2 work still in progress.
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-3xl font-bold text-gray-900">{trustSummary.readinessPercent}%</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Trust readiness</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TRUST_CONTROLS.map((control) => (
              <div key={control.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {categoryLabel(control.category)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{control.label}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(control.status)}`}>
                    {statusLabel(control.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-600">{control.buyerProof}</p>
                {control.nextAction ? (
                  <p className="mt-2 text-xs font-medium text-gray-500">{control.nextAction}</p>
                ) : null}
              </div>
            ))}
          </div>
          <Link to="/methodology" className="mt-5 inline-flex text-sm font-semibold text-blue-600 hover:underline">
            View compliance methodology
          </Link>
        </section>

        <section>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-brand-gold" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">SOC 2 Type II — In Progress</h3>
                <p className="text-gray-600 text-sm mb-3">
                  PrevWage is currently undergoing a SOC 2 Type II audit. Enterprise customers
                  can request a copy of the in-progress security controls summary under NDA.
                </p>
                <p className="text-sm text-gray-500">
                  Target completion: Q4 2026. Auditor: independent AICPA-accredited firm.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Vulnerability disclosure */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Mail className="w-6 h-6 text-brand-gold" />
            <h2 className="text-2xl font-bold text-gray-900">Responsible Disclosure</h2>
          </div>
          <div className="space-y-4 text-gray-600">
            <p>
              If you discover a security vulnerability in PrevWage, please report it to our
              security team. We commit to acknowledging your report within 72 hours and providing
              a remediation timeline within 14 calendar days.
            </p>
            <p>
              Please do not publicly disclose vulnerabilities before we have had a reasonable
              opportunity to address them.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">Security Contact</p>
              <a href="mailto:security@prevailingwage.app" className="text-blue-600 hover:underline text-sm">
                security@prevailingwage.app
              </a>
            </div>
          </div>
        </section>

        {/* Data retention */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Retention &amp; Deletion</h2>
          <div className="space-y-4 text-gray-600 text-sm">
            <p>
              Payroll and worker data is retained for the duration of your account. Upon account
              closure, all project data including worker records and payroll entries is deleted
              within 30 days from production systems.
            </p>
            <p>
              Backup copies are purged within 60 days of account deletion, consistent with our
              7-day backup retention policy.
            </p>
          </div>
        </section>

        {/* Last updated */}
        <p className="text-xs text-gray-400 border-t border-gray-100 pt-8">
          Last updated: April 2026. To request a copy of our full security documentation, contact{' '}
          <a href="mailto:security@prevailingwage.app" className="underline">security@prevailingwage.app</a>.
        </p>

      </div>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-500 text-xs py-8 text-center">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap justify-center gap-6">
          <Link to="/case-studies/hcc" className="hover:text-gray-300 transition-colors">Case Studies</Link>
          <Link to="/api-docs" className="hover:text-gray-300 transition-colors">API Docs</Link>
          <Link to="/methodology" className="hover:text-gray-300 transition-colors">Methodology</Link>
          <Link to="/security" className="hover:text-gray-300 transition-colors">Security Policy</Link>
          <Link to="/register" className="hover:text-gray-300 transition-colors">Register</Link>
        </div>
        <p className="mt-6 text-gray-600">2026 PrevWage. All rights reserved.</p>
      </footer>
    </div>
  );
}

function statusLabel(status: TrustControlStatus): string {
  switch (status) {
    case 'implemented':
      return 'Implemented';
    case 'needs-evidence':
      return 'Needs evidence';
    case 'action-needed':
      return 'Action needed';
    case 'planned':
      return 'Planned';
  }
}

function statusClass(status: TrustControlStatus): string {
  switch (status) {
    case 'implemented':
      return 'bg-emerald-50 text-emerald-700';
    case 'needs-evidence':
      return 'bg-amber-50 text-amber-700';
    case 'action-needed':
      return 'bg-red-50 text-red-700';
    case 'planned':
      return 'bg-gray-100 text-gray-700';
  }
}
