// src/client/pages/CaseStudiesPage.tsx
// Route: /case-studies — public, no auth required.

import { Link } from 'react-router-dom';
import { Clock, MapPin, FileCheck, TrendingDown, ArrowRight } from 'lucide-react';

interface CaseStudyCard {
  href: string;
  tag: string;
  company: string;
  headline: string;
  description: string;
  stats: { value: string; label: string }[];
  accent: string;
}

const caseStudies: CaseStudyCard[] = [
  {
    href: '/case-studies/hcc',
    tag: 'Multi-State GC',
    company: 'Hispanic Construction Council',
    headline: 'Certified payroll prep cut from 4 hours to 20 minutes',
    description:
      'HCC managed prevailing wage compliance across 8 states using spreadsheets and PDFs. PrevWage automated the full certified payroll lifecycle — WH-347, CA eCPR, WA F700-065, and more — eliminating 76% of prep time in 90 days.',
    stats: [
      { value: '76%', label: 'Faster prep' },
      { value: '0', label: 'Missed submissions' },
      { value: '$0', label: 'Audit penalties' },
    ],
    accent: '#DEB400',
  },
  {
    href: '/case-studies/wa-dot',
    tag: 'WA State DOT',
    company: 'Pacific Northwest Infrastructure (name changed)',
    headline: 'Zero WA L&I XML rejections across 3 simultaneous projects',
    description:
      'Six XML rejections in two months from WA L&I were delaying projects and triggering compliance inquiries. PrevWage\'s WA-native CPR export, built to the exact L&I schema, eliminated rejections from day one.',
    stats: [
      { value: '0', label: 'Rejections' },
      { value: '40%', label: 'Admin reduction' },
      { value: '3', label: 'Projects tracked' },
    ],
    accent: '#1E3A5F',
  },
];

function CaseStudyCardBlock({ card }: { card: CaseStudyCard }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
      {/* Top accent bar */}
      <div className="h-1.5" style={{ backgroundColor: card.accent }} />

      <div className="p-8 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{
              backgroundColor: card.accent === '#DEB400' ? '#FEF9E7' : '#EBF0F8',
              color: card.accent,
            }}
          >
            {card.tag}
          </span>
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {card.company}
        </p>
        <h2 className="text-xl font-bold text-gray-900 mb-4 leading-snug font-headline">
          {card.headline}
        </h2>
        <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">
          {card.description}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8 py-4 border-t border-gray-100">
          {card.stats.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-gray-900 font-headline">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        <Link
          to={card.href}
          className="inline-flex items-center gap-2 text-sm font-semibold text-nav-dark hover:text-brand-gold transition-colors"
        >
          Read full case study
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm text-gray-300 hover:text-white transition-colors">
            <span className="font-semibold text-white">PrevWage</span>
          </Link>
          <Link
            to="/register"
            className="text-sm bg-brand-gold text-gray-900 font-semibold px-4 py-2 rounded-lg hover:bg-brand-gold/90 transition-colors"
          >
            Start Free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-nav-dark text-white pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold text-brand-gold uppercase tracking-widest mb-4">
            Case Studies
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6 font-headline">
            Real Results from Real Contractors
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            See how contractors across 8 states use PrevWage to eliminate certified payroll
            errors, pass DOL audits, and reclaim hours of admin time every week.
          </p>
        </div>
      </div>

      {/* Stats summary strip */}
      <div className="bg-brand-gold py-10 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: '50+', label: 'Projects tracked' },
            { value: '$0', label: 'Audit penalties (verified users)' },
            { value: '76%', label: 'Avg. prep time reduction' },
            { value: '8 States', label: 'Native CPR forms' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-bold text-nav-dark font-headline">{value}</p>
              <p className="text-sm text-nav-dark/70 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Case study cards */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {caseStudies.map((card) => (
              <CaseStudyCardBlock key={card.href} card={card} />
            ))}
          </div>

          {/* "Your company here" CTA */}
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Coming soon
            </p>
            <h3 className="text-xl font-bold text-gray-900 mb-3 font-headline">
              Your company here?
            </h3>
            <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
              We publish verified case studies for contractors who achieve measurable compliance
              results on PrevWage. Share your story and we'll feature it here.
            </p>
            <a
              href="mailto:support@prevwage.com?subject=Case%20Study%20Inquiry"
              className="inline-block bg-nav-dark text-white font-semibold px-6 py-3 rounded-lg hover:bg-nav-dark/90 transition-colors text-sm"
            >
              Contact us about a case study
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="bg-nav-dark py-16 text-center text-white">
        <h2 className="text-3xl font-bold mb-3">Start your compliance story.</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Free to start. No credit card required. First project set up in under 10 minutes.
        </p>
        <Link
          to="/register"
          className="inline-block bg-brand-gold text-gray-900 font-semibold px-8 py-4 rounded-xl text-lg hover:bg-brand-gold/90 transition-colors"
        >
          Create Free Account
        </Link>
      </div>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-500 text-xs py-8 text-center">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap justify-center gap-6">
          <Link to="/case-studies/hcc" className="hover:text-gray-300 transition-colors">HCC Case Study</Link>
          <Link to="/case-studies/wa-dot" className="hover:text-gray-300 transition-colors">WA DOT Case Study</Link>
          <Link to="/contact" className="hover:text-gray-300 transition-colors">Contact</Link>
          <Link to="/api-docs" className="hover:text-gray-300 transition-colors">API Docs</Link>
          <Link to="/security" className="hover:text-gray-300 transition-colors">Security Policy</Link>
          <Link to="/register" className="hover:text-gray-300 transition-colors">Register</Link>
        </div>
        <p className="mt-6 text-gray-600">2026 PrevWage. All rights reserved.</p>
      </footer>
    </div>
  );
}
