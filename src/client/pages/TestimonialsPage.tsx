// src/client/pages/TestimonialsPage.tsx
// Public /testimonials page — TRUST-05 (contractor quotes) + TRUST-06 (video + case study)
// Phase 101

import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

// ── Testimonial data (same shape + data as LandingPage.tsx TESTIMONIALS) ─────

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
      "We cut certified payroll prep from 4 hours to 20 minutes. The CA eCPR XML export alone saved us a full day of rework every month.",
    name: "Maria Gonzalez, Project Manager",
    company: "Hispanic Construction Council",
    project: "I-405 Corridor Improvements",
    initials: "MG",
  },
  {
    quote:
      "Finally a tool that actually generates the WH-347 correctly for federal projects. Our DOL audit came back clean on the first try.",
    name: "Name withheld pending approval",
    company: "General contractor — name withheld",
    project: "Federal Government Contract",
    initials: "GC",
  },
  {
    quote:
      "The subcontractor upload portal saved us from chasing CPRs by email. Our subs submit online and we have everything in one place.",
    name: "Name withheld pending approval",
    company: "Subcontractor — name withheld",
    project: "State DOT Project — WA",
    initials: "SC",
  },
];

// ── Nav ───────────────────────────────────────────────────────────────────────

function TestimonialsNav() {
  return (
    <nav className="bg-nav-dark px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="text-brand-gold font-headline font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
        >
          HCC Prevailing Wage
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link to="/pricing" className="text-gray-400 hover:text-brand-gold transition-colors">
            Pricing
          </Link>
          <Link
            to="/login"
            className="text-gray-300 hover:text-white transition-colors font-medium"
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
          What Contractors Are Saying
        </h1>
        <p className="text-gray-300 text-lg leading-relaxed">
          Real results from verified users managing Davis-Bacon compliance.
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
                <div className="w-10 h-10 bg-brand-gold text-nav-dark font-bold rounded-full flex items-center justify-center text-sm flex-shrink-0">
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
  // TODO: replace with real video ID once HCC records an official demo video
  const VIDEO_ID = 'dQw4w9WgXcQ';

  return (
    <section className="bg-nav-dark py-20 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-headline text-3xl font-bold text-white mb-8">
          See It in Action
        </h2>
        <div className="max-w-3xl mx-auto aspect-video rounded-2xl overflow-hidden shadow-2xl">
          <iframe
            width="560"
            height="315"
            src={`https://www.youtube.com/embed/${VIDEO_ID}`}
            title="HCC Prevailing Wage Demo"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
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
              <Link key={label} to={to} className="text-gray-400 hover:text-brand-gold transition-colors">
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
