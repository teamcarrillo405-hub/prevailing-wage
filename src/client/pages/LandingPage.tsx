import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, ClipboardCheck, FileCheck, ShieldCheck, Timer, UploadCloud } from 'lucide-react';
import { UsComplianceMap } from '../components/UsComplianceMap.js';

const workflow = [
  {
    title: 'Create the project',
    body: 'Add location, funding type, workers, subcontractors, and the wage determination source.',
  },
  {
    title: 'Enter or import payroll',
    body: 'Use QuickBooks/CSV imports or guided manual entry. Open items stay visible until fixed.',
  },
  {
    title: 'Export clean packages',
    body: 'Generate WH-347, evidence, project reports, and audit-ready backup from one workspace.',
  },
];

const proofPoints = [
  { value: '3,843', label: 'federal WDs cached' },
  { value: '97,075', label: 'parsed classifications' },
  { value: '3,143', label: 'counties covered' },
];

const productWins = [
  {
    icon: ClipboardCheck,
    title: 'Dashboard tells contractors what to fix',
    body: 'Payroll due, subcontractor CPR gaps, setup issues, and export readiness are separated into clear saved views.',
  },
  {
    icon: FileCheck,
    title: 'Rates stay tied to source data',
    body: 'Workers, classifications, wage determinations, and payroll blockers are connected back to the project record.',
  },
  {
    icon: UploadCloud,
    title: 'Imports are built around real office workflows',
    body: 'QuickBooks, CSV, and manual entry paths support contractors who are not ready for a full system migration.',
  },
  {
    icon: ShieldCheck,
    title: 'Exports are built for audit confidence',
    body: 'The product focuses on clean certified payroll packages, evidence, and follow-up records before filing.',
  },
];

const comparisonRows = [
  ['DOL/FLC tools', 'Great source search, not contractor workflow management.', 'We turn rates into project setup, payroll checks, and export actions.'],
  ['Knowify / job management', 'Strong contractor operations, lighter prevailing wage specialization.', 'We focus directly on Davis-Bacon, WD rates, CPR blockers, and audit evidence.'],
  ['B2Gnow / eComply', 'Mature compliance workflows and reports, often agency/process oriented.', 'We make the contractor dashboard action-first and easier to demo without training.'],
  ['LCPtracker', 'Deep certified payroll collection and validation maturity.', 'We compete with a cleaner contractor experience and guided rate/payroll logic.'],
];

const faqs = [
  {
    q: 'Is this only for federal Davis-Bacon work?',
    a: 'The launch focus is federal Davis-Bacon and federally funded construction payroll. Native state and local expansion can layer on after the federal workflow is clean.',
  },
  {
    q: 'Do contractors need to pay during signup?',
    a: 'No. The account flow is member-access first. Contractors create an account with their HCC membership number and complete onboarding.',
  },
  {
    q: 'Can a contractor use Excel or QuickBooks data?',
    a: 'Yes. The product should support QuickBooks/CSV imports and Excel-friendly exports because that is how most construction payroll offices actually work.',
  },
];

function LandingNav() {
  return (
    <header className="absolute left-0 right-0 top-0 z-20">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="text-sm font-semibold tracking-wide text-white">
          HCC Prevailing Wage
        </Link>
        <div className="hidden items-center gap-8 text-sm font-medium text-white/70 sm:flex">
          <a href="#workflow" className="hover:text-white">Workflow</a>
          <a href="#proof" className="hover:text-white">Proof</a>
          <a href="#compare" className="hover:text-white">Compare</a>
          <Link to="/methodology" className="hover:text-white">Methodology</Link>
        </div>
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10"
        >
          Log in
        </Link>
      </nav>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[92vh] overflow-hidden bg-[#121826] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-55"
        style={{
          backgroundImage:
            "linear-gradient(110deg, rgba(18,24,38,0.96) 0%, rgba(18,24,38,0.84) 46%, rgba(18,24,38,0.34) 100%), url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1800&q=80')",
        }}
        aria-hidden="true"
      />
      <LandingNav />
      <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl items-center px-5 pb-14 pt-28 sm:px-8">
        <div className="max-w-3xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-brand-gold">
            Built for construction contractors
          </p>
          <h1 className="font-headline text-5xl font-bold leading-[0.95] tracking-normal sm:text-7xl">
            Certified payroll without the spreadsheet chase.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/78">
            PrevWage guides federal prevailing wage projects from wage determination to payroll review, subcontractor CPR follow-up, and audit-ready export.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-brand-gold px-6 text-sm font-bold text-nav-dark hover:opacity-90"
            >
              Create member account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href="#workflow"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10"
            >
              See the workflow
            </a>
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto -mt-24 grid max-w-7xl grid-cols-1 gap-3 px-5 pb-8 sm:grid-cols-3 sm:px-8">
        {proofPoints.map((point) => (
          <div key={point.label} className="border border-white/10 bg-white/10 p-5 backdrop-blur-md">
            <p className="text-3xl font-bold tabular-nums">{point.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/60">{point.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="bg-white px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">How it works</p>
            <h2 className="mt-4 font-headline text-4xl font-bold leading-tight text-gray-950 sm:text-5xl">
              One clean path from project setup to payroll export.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-gray-600">
            The dashboard is designed to answer one question first: what needs to be fixed before this payroll can be submitted cleanly?
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {workflow.map((step, index) => (
            <div key={step.title} className="border border-gray-200 bg-gray-50 p-6">
              <p className="text-sm font-bold text-brand-gold">0{index + 1}</p>
              <h3 className="mt-5 text-xl font-semibold text-gray-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductProofSection() {
  return (
    <section id="proof" className="bg-[#f4f6f8] px-5 py-20 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">Product proof</p>
          <h2 className="mt-4 font-headline text-4xl font-bold leading-tight text-gray-950">
            The dashboard is the product.
          </h2>
          <p className="mt-5 text-base leading-7 text-gray-600">
            Contractors should not need a one-hour training module to know what to do next. PrevWage uses saved views, source-linked rates, and exact payroll-week links to move work forward.
          </p>
          <div className="mt-8 space-y-4">
            {productWins.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-nav-dark text-brand-gold">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-950">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-gray-200 bg-white p-4 shadow-sm">
          <div className="border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Today</p>
                <p className="mt-1 text-lg font-bold text-gray-950">Collect CPR from subcontractor</p>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">High</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ['1', 'Urgent fix'],
                ['2', 'Payroll due'],
                ['1', 'Sub CPR gap'],
              ].map(([value, label]) => (
                <div key={label} className="bg-white p-4">
                  <p className="text-2xl font-bold text-gray-950">{value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {['Payroll due', 'Sub CPR overdue', 'Ready to export'].map((label) => (
                <div key={label} className="flex min-h-11 items-center justify-between bg-white px-4 text-sm font-semibold text-gray-800">
                  <span>{label}</span>
                  <ArrowRight className="h-4 w-4 text-brand-gold" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoverageSection() {
  return (
    <section className="bg-white px-5 py-20 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">Federal coverage</p>
          <h2 className="mt-4 font-headline text-4xl font-bold leading-tight text-gray-950">
            Federal wage data for every state and county.
          </h2>
          <p className="mt-5 text-base leading-7 text-gray-600">
            The launch promise is focused: federal WH-347 workflows, SAM.gov wage determination coverage, and contractor-ready payroll review. State and local native forms can expand after launch.
          </p>
        </div>
        <div className="min-h-[360px]">
          <UsComplianceMap />
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section id="compare" className="bg-nav-dark px-5 py-20 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">Competitive position</p>
          <h2 className="mt-4 font-headline text-4xl font-bold leading-tight">
            Built to be easier before it tries to be bigger.
          </h2>
        </div>
        <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {comparisonRows.map(([competitor, theirEdge, ourEdge]) => (
            <div key={competitor} className="grid gap-4 py-6 lg:grid-cols-[0.35fr_0.65fr_0.75fr]">
              <p className="font-semibold text-white">{competitor}</p>
              <p className="text-sm leading-6 text-white/60">{theirEdge}</p>
              <p className="text-sm leading-6 text-white/86">{ourEdge}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="bg-white px-5 py-20 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">Questions</p>
          <h2 className="mt-4 font-headline text-4xl font-bold text-gray-950">Short answers for the first demo.</h2>
        </div>
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {faqs.map(({ q, a }) => (
            <div key={q} className="py-6">
              <h3 className="font-semibold text-gray-950">{q}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="bg-brand-gold px-5 py-16 text-nav-dark sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-headline text-4xl font-bold">Ready to test the workflow?</h2>
          <p className="mt-2 text-sm font-medium text-nav-dark/70">
            Create a member account, complete onboarding, and start with one federal project.
          </p>
        </div>
        <Link
          to="/register"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-nav-dark px-6 text-sm font-bold text-brand-gold hover:bg-nav-dark/90"
        >
          Create member account
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="bg-[#101522] px-5 py-8 text-sm text-white/50 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 PrevWage. Davis-Bacon payroll workflows for construction contractors.</p>
        <div className="flex flex-wrap gap-5">
          <Link to="/contact" className="hover:text-white">Contact</Link>
          <Link to="/security" className="hover:text-white">Security</Link>
          <Link to="/api-docs" className="hover:text-white">API Docs</Link>
          <Link to="/login" className="hover:text-white">Log in</Link>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <HeroSection />
      <WorkflowSection />
      <ProductProofSection />
      <CoverageSection />
      <ComparisonSection />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
