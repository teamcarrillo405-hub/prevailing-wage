// src/client/pages/CaseStudyWaDotPage.tsx
// Route: /case-studies/wa-dot — public page, no auth required.
// WA DOT contractor case study — anonymized.

import { Link } from 'react-router-dom';
import { CheckCircle, Clock, MapPin, FileCheck, TrendingDown } from 'lucide-react';

export function CaseStudyWaDotPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Minimal public header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex min-h-11 items-center text-sm text-gray-300 hover:text-white transition-colors">
            <span className="font-semibold text-white">PrevWage</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/case-studies" className="inline-flex min-h-11 items-center text-sm text-gray-400 hover:text-white transition-colors">
              All Case Studies
            </Link>
            <Link
              to="/register"
              className="inline-flex min-h-11 items-center rounded-lg bg-brand-gold px-4 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/90"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gray-900 text-white pt-16 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-brand-gold uppercase tracking-widest mb-4">
            Case Study — Washington State
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
            How a WA Infrastructure Contractor Achieved{' '}
            <span className="text-brand-gold">Zero CPR Rejections</span> Across 3 Active Projects
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            Pacific Northwest Infrastructure (name changed) was losing days to WA L&I XML submission
            rejections. PrevWage's WA-native CPR export helped the team correct the package before resubmission.
          </p>

          {/* Result metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mt-12">
            {[
              { value: '0', label: 'Submission rejections', icon: FileCheck },
              { value: '3', label: 'Active projects managed', icon: MapPin },
              { value: '40%', label: 'Admin overhead reduction', icon: TrendingDown },
              { value: '<15 min', label: 'Weekly CPR completion', icon: Clock },
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

        {/* Company overview */}
        <section className="bg-gray-50 rounded-2xl p-8">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
            {[
              { term: 'Company', def: 'Pacific Northwest Infrastructure (name changed)' },
              { term: 'Industry', def: 'Civil Construction — Public Works' },
              { term: 'Location', def: 'Washington State' },
              { term: 'Contract type', def: 'WA DOT State-Funded' },
            ].map(({ term, def }) => (
              <div key={term}>
                <dt className="text-gray-400 uppercase tracking-wider text-xs font-semibold mb-1">{term}</dt>
                <dd className="text-gray-900 font-medium">{def}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Challenge */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Challenge</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            WA L&I XML Rejections Were Derailing Projects
          </h2>
          <div className="text-gray-600 space-y-4 text-base leading-relaxed">
            <p>
              Pacific Northwest Infrastructure manages civil construction contracts for Washington
              State DOT, including road improvement, bridge work, and drainage projects — all
              requiring weekly certified payroll submissions to the Washington State Department of
              Labor and Industries (L&I) via the agency's online XML portal.
            </p>
            <p>
              The company's compliance coordinator was generating CPR XML files manually using a
              combination of spreadsheet macros and a third-party PDF tool. The WA L&I XML schema
              is highly specific — field lengths, date formats, and classification codes must match
              the agency's current specification exactly. One character out of place triggers a full
              rejection with a vague error message and no line-level diagnosis.
            </p>
            <p>
              Over a two-month period, the team experienced six XML rejections across three active
              projects. Each rejection required the coordinator to diagnose the error, regenerate
              the file, and resubmit — a process that added two to four hours per incident. On one
              project, a pattern of late submissions triggered a compliance inquiry from the
              contracting office.
            </p>
            <p>
              The company was also managing state and federal prevailing wage rates simultaneously
              on two projects — WA state rates from L&I plus federal Davis-Bacon rates from SAM.gov.
              Maintaining both rate tables manually created a dual-entry burden and a second source
              of error risk.
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
            WA-Native CPR Export — Built to L&I Specification
          </h2>
          <div className="text-gray-600 space-y-4 text-base leading-relaxed mb-8">
            <p>
              The company onboarded to PrevWage and configured all three active WA DOT projects
              in a single afternoon. The WA F700-065 form and L&I XML export are generated
              natively — not approximated from a federal template — using the current WA L&I schema
              version with all required field validations enforced at entry time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: 'WA L&I XML Export',
                desc: 'Native WA CPR XML generated to current schema — field lengths, date formats, and classification codes validated before export.',
              },
              {
                title: 'WA F700-065 Form',
                desc: 'Washington-specific certified payroll form auto-populated from structured payroll data. Print-ready PDF in one click.',
              },
              {
                title: 'Dual Rate Table Management',
                desc: 'State and federal wage rates managed separately per project — no manual crosswalk between L&I and SAM.gov sources.',
              },
              {
                title: 'Pre-Submission Validation',
                desc: 'Compliance engine flags classification mismatches, overtime thresholds, and fringe deficiencies before the file is generated.',
              },
              {
                title: 'Multi-Project Dashboard',
                desc: 'All three active projects visible from one screen — submission status, outstanding weeks, and compliance flags centralized.',
              },
              {
                title: 'SSN Encryption',
                desc: 'AES-256-GCM encryption for all worker SSNs — required for state-submitted data under WA data protection standards.',
              },
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
            Zero Rejections. Three Projects. Immediate.
          </h2>

          <div className="bg-gray-50 rounded-2xl p-8 mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { value: '0', sub: 'submission rejections' },
                { value: '6', sub: 'prior rejections reviewed and corrected' },
                { value: '40%', sub: 'reduction in admin overhead' },
                { value: '$0', sub: 'compliance inquiry costs' },
              ].map(({ value, sub }) => (
                <div key={sub}>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
                  <p className="text-sm text-gray-500">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-gray-600 space-y-4 text-base leading-relaxed">
            <p>
              From the first submission week on PrevWage, Pacific Northwest Infrastructure had zero
              XML rejections across all three active WA DOT projects. The pre-submission validation
              engine caught two classification issues in the first month that would have triggered
              rejection under the L&I schema — both resolved before the file was generated.
            </p>
            <p>
              The compliance coordinator reduced weekly CPR time from approximately 90 minutes per
              project to under 15 minutes total for all three — a 40% overall reduction in
              compliance administration overhead. The compliance inquiry from the contracting office
              was resolved with documentation of on-time submissions from the audit trail.
            </p>
            <p>
              The dual rate management capability allowed the team to onboard a new mixed-funding
              project (partial federal, partial state) without creating separate spreadsheet
              processes. Both rate sets were managed within the same project record.
            </p>
          </div>
        </section>

        {/* Testimonial */}
        <section>
          <div className="bg-gray-900 rounded-2xl p-8 text-white">
            <p className="text-xl italic text-gray-200 mb-6 leading-relaxed">
              "We had six rejections in two months from WA L&I — every one was a formatting
              issue in the XML that our old tool didn't catch. Since switching, we've had
              zero rejections across all three projects. The pre-submission check alone is
              worth the subscription."
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-gold rounded-full flex items-center justify-center text-black font-bold text-lg">
                PNI
              </div>
              <div>
                <p className="font-semibold">Operations Director</p>
                <p className="text-sm text-gray-400">
                  Pacific Northwest Infrastructure (name changed at company request)
                </p>
                <p className="text-sm text-gray-400">State DOT Project — Washington</p>
              </div>
            </div>
          </div>
        </section>

        {/* Implementation timeline */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Implementation Timeline</h2>
          <div className="space-y-4">
            {[
              { week: 'Day 1', event: 'Three WA DOT projects configured, WA L&I wage determinations locked, workers imported from payroll export' },
              { week: 'Week 1', event: 'First certified payroll week completed — WA F700-065 and L&I XML generated and submitted with zero errors' },
              { week: 'Week 2', event: 'Compliance engine caught first classification issue pre-submission; corrected before filing' },
              { week: 'Week 3', event: 'Federal wage rates configured for dual-funding project; both rate sets validated simultaneously' },
              { week: 'Month 2', event: 'Compliance inquiry from contracting office resolved using audit trail export from PrevWage' },
              { week: 'Month 3', event: 'Fourth WA DOT project added; onboarding completed in under two hours by coordinator independently' },
            ].map(({ week, event }) => (
              <div key={week} className="flex gap-4">
                <div className="flex-shrink-0 w-24 text-sm font-semibold text-brand-gold">{week}</div>
                <div className="flex-1 text-sm text-gray-600 border-l border-gray-200 pl-4 pb-4">{event}</div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* CTA */}
      <div className="bg-gray-900 py-16 text-center text-white">
        <h2 className="text-3xl font-bold mb-3">Stop losing days to submission rejections.</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Set up your first WA project in under 10 minutes. No credit card required.
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
          <Link to="/case-studies" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Case Studies</Link>
          <Link to="/case-studies/hcc" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">HCC Case Study</Link>
          <Link to="/api-docs" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">API Docs</Link>
          <Link to="/security" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Security Policy</Link>
          <Link to="/contact" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Contact</Link>
          <Link to="/register" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Register</Link>
        </div>
        <p className="mt-6 text-gray-600">2026 PrevWage. All rights reserved.</p>
      </footer>
    </div>
  );
}
