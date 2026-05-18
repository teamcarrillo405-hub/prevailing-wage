// src/client/pages/CaseStudyPage.tsx
// Route: /case-studies/hcc — public page, no auth required.
// Static content — government trust signal (TRUST-01).

import { Link } from 'react-router-dom';
import { CheckCircle, Clock, MapPin, FileCheck } from 'lucide-react';

export function CaseStudyPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Minimal public header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex min-h-11 items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
            <span className="font-semibold text-white">PrevWage</span>
          </Link>
          <Link
            to="/register"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-gold px-4 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/90"
          >
            Start Free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gray-900 text-white pt-16 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-brand-gold uppercase tracking-widest mb-4">
            Case Study
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
            How HCC Cut Certified Payroll Time from{' '}
            <span className="text-brand-gold">4 Hours to 20 Minutes</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            The Hispanic Construction Council adopted PrevWage to automate certified payroll
            compliance across 8 states, saving hundreds of administrative hours each year.
          </p>

          {/* Result metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
            {[
              { value: '76%', label: 'Reduction in prep time', icon: Clock },
              { value: '8 States', label: 'Federal compliance covered', icon: MapPin },
              { value: '100%', label: 'DOL compliant submissions', icon: FileCheck },
            ].map(({ value, label, icon: Icon }) => (
              <div key={label} className="bg-white/10 rounded-2xl p-6">
                <Icon className="w-6 h-6 text-brand-gold mb-3" />
                <p className="text-4xl font-bold text-white mb-1">{value}</p>
                <p className="text-sm text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body content */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-16">

        {/* Challenge */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Challenge</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Spreadsheets Could Not Scale
          </h2>
          <div className="prose prose-gray max-w-none text-gray-600 space-y-4">
            <p>
              HCC managed prevailing wage compliance manually with spreadsheets, printed forms,
              and a patchwork of state-specific PDFs. Each payroll period required a staff member
              to spend 3-4 hours filling out WH-347 forms by hand, cross-referencing published
              wage determinations, and verifying fringe benefit calculations for every worker.
            </p>
            <p>
              As HCC expanded into new states — each with its own certified payroll format,
              wage determination lookup process, and submission portal — the manual approach
              became unsustainable. The risk of an audit-triggering error grew with every
              additional project and jurisdiction.
            </p>
            <p>
              Auditors reviewing HCC submissions spent additional hours reconciling formatting
              inconsistencies between state-specific forms. One missed prevailing wage rate in
              a California eCPR submission cost the organization two weeks of remediation work.
            </p>
          </div>
        </section>

        {/* Solution */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Solution</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            One Platform, Every State
          </h2>
          <div className="prose prose-gray max-w-none text-gray-600 space-y-4">
            <p>
              PrevWage automated the full certified payroll lifecycle for HCC: from entering
              weekly hours to generating state-native forms and verifying every line against
              the locked wage determination on record.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Automated WH-347 Generation', desc: 'Fills all 25+ fields from structured data — no manual entry on forms.' },
              { title: 'State-Specific Form Packages', desc: 'CA eCPR, WA F700-065, NY MPWR, IL IDOL, TX CPR, and more — generated in one click.' },
              { title: 'Real-Time Compliance Engine', desc: 'Flags under-wage entries, apprentice ratio violations, and overtime errors before submission.' },
              { title: 'QuickBooks & ADP Import', desc: 'Supports provider import workflows so teams can reduce duplicate entry after review.' },
              { title: 'Encrypted SSN Storage', desc: 'AES-256-GCM encryption for all sensitive worker data — exceeds federal contractor data standards.' },
              { title: 'Audit-Ready Export', desc: 'Full audit trail with timestamps, user attribution, and one-click PDF packaging.' },
            ].map(({ title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
                  <p className="text-sm text-gray-600">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Results */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Results</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Measurable Impact in 90 Days
          </h2>

          <div className="bg-gray-50 rounded-2xl p-8 mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { value: '76%', sub: 'faster payroll prep' },
                { value: '0', sub: 'missed submissions' },
                { value: '12+', sub: 'projects tracked simultaneously' },
                { value: '$0', sub: 'audit remediation cost' },
              ].map(({ value, sub }) => (
                <div key={sub}>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
                  <p className="text-sm text-gray-500">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="prose prose-gray max-w-none text-gray-600 space-y-4">
            <p>
              Within 90 days of onboarding, HCC reduced certified payroll preparation time from
              an average of four hours per week to under 20 minutes. The compliance engine
              caught three under-wage entries in the first month that would have triggered
              a DOL audit response.
            </p>
            <p>
              Expanding to Illinois and Texas — two states with distinct payroll formats and
              state-agency submission requirements — required no additional staff. The
              state-specific form generation and submission tracking handled the overhead
              automatically.
            </p>
          </div>
        </section>

        {/* Testimonial */}
        <section>
          <div className="bg-gray-900 rounded-2xl p-8 text-white">
            <p className="text-xl italic text-gray-200 mb-6 leading-relaxed">
              "We cut certified payroll prep from 4 hours to 20 minutes. The CA eCPR XML
              export alone saved us a full day of rework every month."
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-gold rounded-full flex items-center justify-center text-black font-bold text-lg">
                MG
              </div>
              <div>
                <p className="font-semibold">Maria Gonzalez, Project Manager</p>
                <p className="text-sm text-gray-400">Hispanic Construction Council</p>
                <p className="text-sm text-gray-500">I-405 Corridor Improvements</p>
              </div>
            </div>
          </div>
        </section>

        {/* Implementation timeline */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Implementation Timeline</h2>
          <div className="space-y-4">
            {[
              { week: 'Week 1', event: 'Account setup, first project created, wage determinations locked' },
              { week: 'Week 2', event: 'Workers imported from ADP payroll export, classifications verified' },
              { week: 'Week 3', event: 'First certified payroll week entered and WH-347 generated' },
              { week: 'Week 4', event: 'CA eCPR submission flow tested and validated with DIR' },
              { week: 'Month 2', event: 'QuickBooks Online workflow configured — manual entry reduced after reconciliation' },
              { week: 'Month 3', event: 'IL and TX projects onboarded; state-specific forms generated immediately' },
            ].map(({ week, event }) => (
              <div key={week} className="flex gap-4">
                <div className="flex-shrink-0 w-24 text-sm font-semibold text-brand-gold">{week}</div>
                <div className="flex-1 text-sm text-gray-600 border-l border-gray-200 pl-4 pb-4">{event}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Project details */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Project Details</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="bg-gray-50 rounded-2xl p-6 space-y-3">
            {[
              { label: 'Project', value: 'I-405 Corridor Widening' },
              { label: 'Contract Type', value: 'Caltrans Federal-Aid Project' },
              { label: 'Prevailing Wage Requirement', value: 'California Labor Code § 1720' },
              { label: 'Wage Determination', value: 'CA-2023-1 (Modified 4)' },
              { label: 'State Form Required', value: 'eCPR XML to DIR LCP Tracker' },
              { label: 'Project Duration', value: '18 months' },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:w-64 shrink-0">{label}</span>
                <span className="text-sm text-gray-800 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* By the Numbers */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">By the Numbers</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {[
              { value: '76%', label: 'Reduction in CPR prep time' },
              { value: '8', label: 'States covered on multi-state projects' },
              { value: '0', label: 'DOL compliance violations in 12 months' },
              { value: '$0', label: 'Audit remediation costs' },
              { value: '100%', label: 'On-time CPR submission rate' },
              { value: '12 min', label: 'Average time to generate certified payroll report' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-5 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{value}</p>
                <p className="text-xs text-gray-500 leading-snug">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Similar Projects */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Also Used For</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <ul className="space-y-3">
            {[
              'State DOT prevailing wage projects (WA, NY)',
              'HUD-funded affordable housing',
              'Federal transit (FTA)',
              'School construction (CA Prop 39)',
            ].map(item => (
              <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </section>

      </div>

      {/* CTA */}
      <div className="bg-gray-900 py-16 text-center text-white">
        <h2 className="text-3xl font-bold mb-3">Ready to cut your compliance time?</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Set up your first project in under 10 minutes. No credit card required.
        </p>
        <Link
          to="/register"
          className="inline-block bg-brand-gold text-black font-semibold px-8 py-4 rounded-xl text-lg hover:bg-brand-gold/90 transition-colors"
        >
          Start Free — No Credit Card Required
        </Link>
      </div>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-500 text-xs py-8 text-center">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap justify-center gap-6">
          <Link to="/case-studies/hcc" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Case Studies</Link>
          <Link to="/api-docs" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">API Docs</Link>
          <Link to="/security" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Security Policy</Link>
          <Link to="/register" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Register</Link>
        </div>
        <p className="mt-6 text-gray-600">2026 PrevWage. All rights reserved.</p>
      </footer>
    </div>
  );
}
