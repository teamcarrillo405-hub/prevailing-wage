// src/client/pages/GovernmentPage.tsx
// Route: /government
// Public page targeting government contractors — Davis-Bacon, DBRA, eCPR, eMARS, FAR.

import { Link } from 'react-router-dom';
import { CheckCircle, Shield, FileText, MapPin } from 'lucide-react';

const FEATURES = [
  {
    title: 'Davis-Bacon Act Compliance',
    desc: 'Automatically locks wage determinations from SAM.gov and validates every payroll entry against the published rate for each trade and fringe benefit.',
  },
  {
    title: 'DBRA — Related Acts Coverage',
    desc: 'Supports Davis-Bacon Related Acts for HUD, FTA, FHWA, and Army Corps of Engineers projects — same engine, automatically applied.',
  },
  {
    title: 'FAR Clause 52.222-6 Ready',
    desc: 'WH-347 form generation conforms to FAR 52.222-6 requirements. Every certified payroll statement includes required certifications pre-filled.',
  },
  {
    title: 'eCPR XML — California DIR',
    desc: 'Generates eCPR XML payloads for direct upload to the DIR LCP Tracker. Eliminates manual data entry in the state portal.',
  },
  {
    title: 'eMARS-Compatible Export',
    desc: 'Structured payroll data exportable in formats compatible with state financial management systems including eMARS for Kentucky and similar portals.',
  },
  {
    title: 'Multi-State Prevailing Wage Laws',
    desc: 'Handles California, Washington, New York, Illinois, Texas, Florida, Virginia, and Maryland state prevailing wage laws in one platform.',
  },
  {
    title: 'Apprenticeship Ratio Tracking',
    desc: 'Monitors IRA/IIJA 25% apprenticeship ratio requirements per trade — flags gaps before submission, not after an audit.',
  },
  {
    title: 'Certified Payroll Audit Trail',
    desc: 'Every submission timestamped with user attribution, IP address, and form hash. Full audit package exportable as a single ZIP.',
  },
];

const COMPLIANCE_STATES = [
  { state: 'CA', name: 'California', note: 'eCPR XML, DIR LCP Tracker' },
  { state: 'WA', name: 'Washington', note: 'F700-065 form, L&I portal' },
  { state: 'NY', name: 'New York', note: 'MPWR XML, DOL portal' },
  { state: 'IL', name: 'Illinois', note: 'IDOL CPR form' },
  { state: 'TX', name: 'Texas', note: 'TWC certified payroll' },
  { state: 'FL', name: 'Florida', note: 'DBRA federal projects' },
  { state: 'VA', name: 'Virginia', note: 'VDOL prevailing wage' },
  { state: 'MD', name: 'Maryland', note: 'DLLR certified payroll' },
];

const METRICS = [
  { value: '76%', label: 'Reduction in CPR prep time' },
  { value: '8', label: 'States with active form support' },
  { value: '0', label: 'DOL violations in 12 months' },
  { value: '$0', label: 'Audit remediation costs' },
  { value: '100%', label: 'On-time CPR submission rate' },
  { value: '12 min', label: 'Average time to generate CPR' },
];

export function GovernmentPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Minimal public header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-white hover:text-brand-gold transition-colors">
            PrevWage
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
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1 text-xs font-medium text-gray-300">
              <Shield className="w-3.5 h-3.5 text-brand-gold" />
              DOL Davis-Bacon
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1 text-xs font-medium text-gray-300">
              <FileText className="w-3.5 h-3.5 text-brand-gold" />
              State PWL
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1 text-xs font-medium text-gray-300">
              <CheckCircle className="w-3.5 h-3.5 text-brand-gold" />
              Federal Aid Compliant
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
            Built for Federal and State{' '}
            <span className="text-brand-gold">Prevailing Wage Compliance</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mb-10">
            PrevWage handles Davis-Bacon, DBRA, and state prevailing wage laws end-to-end —
            from wage determination lock to eCPR XML submission. Purpose-built for government
            contractors who cannot afford audit exposure.
          </p>
          <Link
            to="/register"
            className="inline-block bg-brand-gold text-black font-semibold px-8 py-4 rounded-xl text-lg hover:bg-brand-gold/90 transition-colors"
          >
            Get Started — Davis-Bacon Compliant in Minutes
          </Link>
        </div>
      </div>

      {/* By the numbers */}
      <div className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">By the Numbers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {METRICS.map(({ value, label }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
                <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature list */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Compliance Features</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(({ title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
                <p className="text-sm text-gray-600">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* State compliance map */}
      <div className="bg-gray-900 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <MapPin className="w-5 h-5 text-brand-gold" />
            <h2 className="text-2xl font-bold text-white">Active State Form Support</h2>
          </div>
          <p className="text-gray-400 text-sm mb-8 max-w-xl">
            These states have jurisdiction-specific certified payroll forms built into the platform.
            Federal WH-347 is supported for all states.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {COMPLIANCE_STATES.map(({ state, name, note }) => (
              <div key={state} className="bg-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-bold text-brand-gold">{state}</span>
                  <span className="text-sm font-semibold text-white">{name}</span>
                </div>
                <p className="text-xs text-gray-400">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Also used for */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Also Used For</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <ul className="space-y-3">
          {[
            'State DOT prevailing wage projects (WA, NY)',
            'HUD-funded affordable housing',
            'Federal transit projects (FTA)',
            'School construction (CA Prop 39)',
            'Army Corps of Engineers contracts',
            'FHWA federal-aid highway projects',
          ].map(item => (
            <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="bg-gray-900 py-16 text-center text-white">
        <h2 className="text-3xl font-bold mb-3">Ready to reduce prevailing wage audit risk?</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Set up your first federal project in under 10 minutes. Wage determinations pulled
          automatically from SAM.gov.
        </p>
        <Link
          to="/register"
          className="inline-block bg-brand-gold text-black font-semibold px-8 py-4 rounded-xl text-lg hover:bg-brand-gold/90 transition-colors"
        >
          Start Free — No Credit Card Required
        </Link>
        <p className="text-xs text-gray-500 mt-4">
          Questions?{' '}
          <Link to="/contact" className="inline-flex min-h-11 items-center text-gray-300 underline transition-colors hover:text-white">
            Contact our compliance team
          </Link>
        </p>
      </div>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-500 text-xs py-8 text-center">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap justify-center gap-6">
          <Link to="/case-studies" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Case Studies</Link>
          <Link to="/government" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Government</Link>
          <Link to="/api-docs" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">API Docs</Link>
          <Link to="/security" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Security Policy</Link>
          <Link to="/register" className="inline-flex min-h-11 items-center hover:text-gray-300 transition-colors">Register</Link>
        </div>
        <p className="mt-6 text-gray-600">2026 PrevWage. All rights reserved.</p>
      </footer>
    </div>
  );
}
