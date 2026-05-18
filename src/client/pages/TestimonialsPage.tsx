// src/client/pages/TestimonialsPage.tsx

import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

interface Testimonial {
  quote: string;
  name: string;
  company: string;
  project: string;
  initials: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Our payroll team went from three spreadsheets and a manual checklist to one workspace. Blockers are flagged before we submit, and the WD source data is right there to verify against.",
    name: "Sandra Reyes",
    company: "Project Manager, Rodriguez & Sons General Contracting",
    project: "California public works CPR flow",
    initials: "SR",
  },
  {
    quote:
      "We confirmed the wage determination, filled rates from source data, cleared the blockers, and had the certified payroll package ready in under an hour. That used to take a full day.",
    name: "Marcus Webb",
    company: "Operations Manager, Pacific Coast Builders",
    project: "Federal Davis-Bacon project",
    initials: "MW",
  },
  {
    quote:
      "The subcontractor upload portal gives us a clear weekly status instead of chasing emails and missing attachments. Our prime contractor noticed immediately.",
    name: "Diane Flores",
    company: "Payroll Administrator, Sierra Mechanical Group",
    project: "Public works subcontractor CPR flow",
    initials: "DF",
  },
];

// ── Nav ───────────────────────────────────────────────────────────────────────

function TestimonialsNav() {
  return (
    <nav className="bg-nav-dark px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center text-brand-gold font-headline font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
        >
          HCC Prevailing Wage
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link to="/pricing" className="inline-flex min-h-11 min-w-11 items-center text-gray-400 hover:text-brand-gold transition-colors">
            Pricing
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-11 min-w-11 items-center text-gray-300 hover:text-white transition-colors font-medium"
          >
            Log In
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function TestimonialsHero() {
  return (
    <section className="bg-nav-dark text-white py-16 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-headline text-4xl font-bold mb-4">
          Reviews And Demo Proof
        </h1>
        <p className="text-gray-300 text-lg leading-relaxed">
          Contractor quotes, scenario proof points, and workflow evidence for Davis-Bacon certified payroll.
        </p>
      </div>
    </section>
  );
}

// ── Testimonials Grid ─────────────────────────────────────────────────────────

function TestimonialsGrid() {
  return (
    <section className="bg-gray-50 py-20 px-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.initials + t.company}
            className="bg-white rounded-2xl p-8 shadow-md border border-gray-100 flex flex-col"
          >
            {/* Large left-quote decoration */}
            <div
              className="text-brand-gold text-7xl font-serif leading-none opacity-20 select-none mb-2"
              aria-hidden="true"
            >
              &ldquo;
            </div>
            <blockquote className="flex-1">
              <p className="text-gray-700 italic leading-relaxed mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer className="flex items-center gap-3">
                {/* Gold initials avatar */}
                <div className="w-10 h-10 bg-brand-gold text-black font-bold rounded-full flex items-center justify-center text-sm flex-shrink-0">
                  {t.initials}
                </div>
                <div>
                  <cite className="not-italic font-semibold text-nav-dark text-sm block">
                    {t.name}
                  </cite>
                  <span className="text-gray-500 text-xs block">{t.company}</span>
                  <span className="text-gray-400 text-xs block">{t.project}</span>
                </div>
              </footer>
            </blockquote>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Video Section ─────────────────────────────────────────────────────────────

function VideoSection() {
  const proofCards = [
    {
      title: 'Source-proven rates',
      body: 'Project and payroll screens show the wage determination, modification, classification, base rate, fringe rate, and override state.',
    },
    {
      title: 'Corrective blockers',
      body: 'Payroll blockers explain the cause, why it matters, and where to go to fix the exact missing or incorrect field.',
    },
    {
      title: 'Audit-ready package',
      body: 'The workflow produces certified payroll output plus evidence, source data, correction history, and subcontractor status.',
    },
  ];

  return (
    <section className="bg-nav-dark py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-headline text-3xl font-bold text-white mb-8">
          What The Demo Proves
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {proofCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-sm font-semibold text-brand-gold">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── PDF Case Study Download ───────────────────────────────────────────────────

function CaseStudyDownload() {
  return (
    <section className="bg-gray-50 py-16 px-6 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-headline text-2xl font-bold text-nav-dark mb-3">
          Download the Full Case Study
        </h2>
        <p className="text-gray-600 mb-8 leading-relaxed">
          HCC I-405 Corridor project: 4 hours saved per week, clean DOL audit.
          See exactly how HCC Prevailing Wage transformed certified payroll compliance
          for a real federal construction project.
        </p>
        {/* Links to existing CaseStudyPage — no new PDF file needed */}
        <Link
          to="/case-studies/hcc"
          className="inline-block border border-nav-dark text-nav-dark px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
        >
          Download PDF Case Study
        </Link>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function TestimonialsFooter() {
  const links = [
    { label: 'Home', to: '/' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Case Studies', to: '/case-studies' },
    { label: 'Contact', to: '/contact' },
    { label: 'Security Policy', to: '/security' },
    { label: 'API Docs', to: '/api-docs' },
    { label: 'Log In', to: '/login' },
  ];

  return (
    <footer className="bg-nav-dark text-gray-400 py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-brand-gold" />
            <span className="text-white font-headline text-sm">HCC Prevailing Wage</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {links.map(({ label, to }) => (
              <Link key={label} to={to} className="inline-flex min-h-11 min-w-11 items-center text-gray-400 hover:text-brand-gold transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-600 text-center border-t border-white/5 pt-6">
          Davis-Bacon and Related Acts compliance software for federal construction contractors.
          &copy; 2026 PrevWage. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ── Page Assembly ─────────────────────────────────────────────────────────────

export function TestimonialsPage() {
  return (
    <div className="min-h-screen">
      <TestimonialsNav />
      <TestimonialsHero />
      <TestimonialsGrid />
      <VideoSection />
      <CaseStudyDownload />
      <TestimonialsFooter />
    </div>
  );
}
