// src/client/pages/PricingPage.tsx
// Public pricing page — /pricing (no auth required)
// Sections: Hero, Pricing Cards (annual/monthly toggle), Feature Matrix, FAQ, ROI Calculator, CTA

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Shield } from 'lucide-react';

// ── Plan data ─────────────────────────────────────────────────────────────────

interface Plan {
  name: string;
  monthlyPrice: number | null;
  tagline: string;
  badge?: string;
  cta: string;
  ctaTo: string;
  highlight: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    monthlyPrice: 0,
    tagline: 'Solo contractor or PM',
    cta: 'Get Started Free',
    ctaTo: '/register',
    highlight: false,
    features: [
      '1 active project',
      'WH-347 federal form',
      '8-state certified payroll',
      'QB / ADP / Gusto CSV import',
      'Up to 25 workers',
      '1 team member',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: 49,
    tagline: 'Growing GC or sub',
    badge: 'Most Popular',
    cta: 'Start 14-Day Trial',
    ctaTo: '/register?plan=pro',
    highlight: true,
    features: [
      'Unlimited projects, unlimited workers, 10 team members',
      'All 8 state forms + XML exports',
      'Subcontractor CPR portal',
      'Public API access',
      'Email support',
    ],
  },
  {
    name: 'Enterprise',
    monthlyPrice: 149,
    tagline: 'Multi-office or agency',
    cta: 'Contact Us',
    ctaTo: '/contact',
    highlight: false,
    features: [
      'Everything in Pro',
      'Custom state form requests',
      'DBE / MBE certification tracking',
      'Priority support + SLA',
      'SSO / SAML',
      'Dedicated onboarding + CSM',
      'SOC 2 readiness evidence and future audit reports',
    ],
  },
];

// ── Feature comparison matrix ─────────────────────────────────────────────────

type CellVal = boolean | string;

interface MatrixRow {
  label: string;
  starter: CellVal;
  pro: CellVal;
  enterprise: CellVal;
}

const MATRIX_ROWS: MatrixRow[] = [
  { label: 'State CPRs',         starter: '8 states',       pro: '8 states',       enterprise: '8 + custom' },
  { label: 'WH-347',             starter: true,              pro: true,             enterprise: true          },
  { label: 'QBO import',         starter: true,              pro: true,             enterprise: true          },
  { label: 'API access',         starter: false,             pro: true,             enterprise: true          },
  { label: 'Webhooks',           starter: false,             pro: true,             enterprise: true          },
  { label: 'DBE tracking',       starter: false,             pro: false,            enterprise: true          },
  { label: 'Team members',       starter: '1',               pro: '5',              enterprise: 'Unlimited'   },
  { label: 'Sub portal',         starter: false,             pro: true,             enterprise: true          },
  { label: 'Audit export',       starter: false,             pro: true,             enterprise: true          },
  { label: 'MFA',                starter: true,              pro: true,             enterprise: true          },
  { label: 'SSO / SAML',        starter: false,             pro: false,            enterprise: true          },
  { label: 'Priority support',   starter: false,             pro: false,            enterprise: true          },
];

// ── FAQ data ──────────────────────────────────────────────────────────────────

interface FaqItem { q: string; a: string; }

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Can I change plans?',
    a: 'Yes — you can upgrade or downgrade at any time from your billing settings. Changes take effect immediately and are prorated.',
  },
  {
    q: 'Is there a contract?',
    a: 'No. All plans are month-to-month with no minimum commitment. You can cancel at any time and your data remains accessible through the end of your billing period.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards processed securely through Stripe. No invoices or wire transfers are required.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All Social Security Numbers and sensitive payroll data are encrypted using AES-256-GCM before being written to the database. See our security policy for full details.',
  },
  {
    q: 'Do you offer a nonprofit or government discount?',
    a: 'We offer discounted pricing for certified DBE/MBE firms and public agencies. Contact us to discuss options.',
  },
];

// ── Minimal nav for public page ───────────────────────────────────────────────

function PricingNav() {
  return (
    <nav className="bg-nav-dark px-6 py-4 flex items-center justify-between">
      <Link to="/" className="inline-flex min-h-11 items-center text-brand-gold font-headline text-xl font-bold">
        AVERO Prevailing Wage
      </Link>
      <div className="flex items-center gap-6">
        <Link to="/" className="inline-flex min-h-11 min-w-11 items-center text-gray-400 hover:text-white transition-colors text-sm">
          Home
        </Link>
        <Link
          to="/login"
          className="inline-flex min-h-11 min-w-11 items-center text-white hover:text-brand-gold transition-colors text-sm font-medium"
        >
          Log In
        </Link>
        <Link
          to="/register"
          className="bg-brand-gold text-black font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          Get Started Free
        </Link>
      </div>
    </nav>
  );
}

// ── 1. Hero ───────────────────────────────────────────────────────────────────

function PricingHero() {
  return (
    <section className="bg-nav-dark text-white py-20 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-headline font-bold leading-tight mb-4 tracking-tight text-4xl sm:text-5xl">
          Transparent pricing.<br />No hidden fees. No "request a demo."
        </h1>
        <p className="text-white/80 text-lg mb-6">
          The only prevailing wage tool that shows you the price before you call.
        </p>
        {/* Competitor callout */}
        <div className="inline-block bg-white/5 border border-white/15 rounded-xl px-6 py-4 text-left max-w-xl">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">How we're different</p>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-brand-gold font-semibold text-sm">PrevWage</p>
              <p className="text-white font-bold text-xl mt-0.5">$0 – $149/mo</p>
              <p className="text-gray-400 text-xs mt-0.5">Listed right here</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <p className="text-gray-400 font-semibold text-sm">B2Gnow</p>
              <p className="text-gray-300 font-bold text-xl mt-0.5">???</p>
              <p className="text-gray-500 text-xs mt-0.5">"Contact us for pricing"</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <p className="text-gray-400 font-semibold text-sm">Knowify</p>
              <p className="text-gray-300 font-bold text-xl mt-0.5">???</p>
              <p className="text-gray-500 text-xs mt-0.5">"Request a quote"</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 2. Pricing Cards ──────────────────────────────────────────────────────────

function PricingCards() {
  const [annual, setAnnual] = useState(false);
  const DISCOUNT = 0.20;

  function displayPrice(plan: Plan): string {
    if (plan.monthlyPrice === null) return 'Custom';
    if (plan.monthlyPrice === 0) return 'Free';
    const price = annual
      ? Math.round(plan.monthlyPrice * (1 - DISCOUNT))
      : plan.monthlyPrice;
    return `$${price}`;
  }

  return (
    <section className="bg-gray-50 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Billing toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm">
            <button
              onClick={() => setAnnual(false)}
              className={`inline-flex min-h-11 items-center text-sm font-medium transition-colors ${!annual ? 'text-nav-dark' : 'text-gray-400'}`}
            >
              Monthly
            </button>
            <button
              role="switch"
              aria-label="Toggle annual billing"
              aria-checked={annual}
              onClick={() => setAnnual((v) => !v)}
              className={`relative inline-flex h-11 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-gold ${
                annual ? 'bg-nav-dark' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform ${
                  annual ? 'translate-x-8' : 'translate-x-1.5'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-nav-dark">
              Annual
              <span className="ml-1.5 bg-brand-gold text-black text-xs font-bold px-1.5 py-0.5 rounded">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.highlight
                  ? 'bg-nav-dark text-white shadow-xl ring-2 ring-brand-gold'
                  : 'bg-white border border-gray-200 shadow-sm'
              }`}
            >
              {/* Most Popular badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-gold text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan name */}
              <p className={`text-sm font-semibold uppercase tracking-widest mb-1 ${
                plan.highlight ? 'text-brand-gold' : 'text-gray-500'
              }`}>
                {plan.name}
              </p>

              {/* Price */}
              <div className="flex items-end gap-1 mb-1">
                <span className={`text-4xl font-bold font-headline ${
                  plan.highlight ? 'text-white' : 'text-nav-dark'
                }`}>
                  {displayPrice(plan)}
                </span>
                {plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                  <span className={`text-sm pb-1 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                    /mo
                  </span>
                )}
              </div>

              {annual && plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                <p className={`text-xs mb-2 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                  billed as ${Math.round(plan.monthlyPrice * (1 - DISCOUNT) * 12)}/yr
                </p>
              )}

              <p className={`text-sm mb-6 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                {plan.tagline}
              </p>

              {/* Features */}
              <ul className="space-y-2 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      plan.highlight ? 'text-brand-gold' : 'text-emerald-500'
                    }`} />
                    <span className={plan.highlight ? 'text-gray-300' : 'text-gray-700'}>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                to={plan.ctaTo}
                className={`block text-center font-semibold py-3 rounded-lg transition-colors ${
                  plan.highlight
                    ? 'bg-brand-gold text-black hover:opacity-90'
                    : 'border border-nav-dark text-nav-dark hover:bg-gray-50'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          No credit card required for Starter. Pro trial includes full feature access for 14 days.
        </p>
      </div>
    </section>
  );
}

// ── 3. Feature Comparison Table ───────────────────────────────────────────────

function MatrixCell({ val, highlight }: { val: CellVal; highlight?: boolean }) {
  if (typeof val === 'boolean') {
    return (
      <td className={`px-4 py-3 text-center ${highlight ? 'bg-nav-dark/5' : ''}`}>
        {val ? (
          <CheckCircle className={`w-5 h-5 mx-auto ${highlight ? 'text-brand-gold' : 'text-emerald-500'}`} />
        ) : (
          <span className="block w-4 h-px mx-auto bg-gray-300" aria-label="Not included" />
        )}
      </td>
    );
  }
  return (
    <td className={`px-4 py-3 text-sm text-center ${
      highlight ? 'bg-nav-dark/5 font-semibold text-nav-dark' : 'text-gray-600'
    }`}>
      {val}
    </td>
  );
}

function FeatureMatrix() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-nav-dark font-headline text-center mb-4">
          Full Feature Comparison
        </h2>
        <p className="text-gray-600 text-center mb-12">
          Every feature, every tier — no asterisks.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-sm border-collapse bg-white">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-2/5">
                  Feature
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">
                  Starter
                </th>
                <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider w-1/5 bg-nav-dark/5 text-nav-dark">
                  Pro
                  <span className="block text-brand-gold normal-case font-normal text-xs tracking-normal mt-0.5">
                    Most Popular
                  </span>
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map(({ label, starter, pro, enterprise }, idx) => (
                <tr key={label} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700">{label}</td>
                  <MatrixCell val={starter} />
                  <MatrixCell val={pro} highlight />
                  <MatrixCell val={enterprise} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ── 4. FAQ ────────────────────────────────────────────────────────────────────

function PricingFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="bg-gray-50 py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-nav-dark font-headline text-center mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-gray-600 text-center mb-12">
          Still have questions?{' '}
          <Link to="/contact" className="inline-flex min-h-11 items-center text-nav-dark font-semibold underline underline-offset-2 hover:text-brand-gold transition-colors">
            Contact us.
          </Link>
        </p>

        <div className="space-y-3">
          {FAQ_ITEMS.map(({ q, a }, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={`border rounded-xl overflow-hidden transition-colors ${
                  isOpen ? 'border-nav-dark/30' : 'border-gray-200'
                } bg-white`}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 text-sm pr-4">{q}</span>
                  <span className={`text-gray-400 flex-shrink-0 text-lg leading-none transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-gold' : ''}`}>
                    &#8964;
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
                    {q.includes('secure') && (
                      <Link to="/security" className="text-xs text-brand-gold hover:underline mt-2 inline-block">
                        View full security policy
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── 5. ROI Calculator ─────────────────────────────────────────────────────────

function RoiCalculator() {
  const [workersPerProject, setWorkersPerProject] = useState(15);
  const [projectsPerMonth, setProjectsPerMonth] = useState(3);

  const hoursPerCprManual = 2.5;
  const adminRatePerHour = 85;
  const proMonthlyPrice = 49;

  const cprReportsPerMonth = projectsPerMonth * 4; // ~4 payroll weeks per month
  const hoursSavedPerMonth = Math.round(cprReportsPerMonth * hoursPerCprManual);
  const dollarsSavedPerMonth = hoursSavedPerMonth * adminRatePerHour;
  const roiMonths = proMonthlyPrice / dollarsSavedPerMonth;
  const roiDays = Math.ceil(roiMonths * 30);

  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-nav-dark font-headline text-center mb-4">
          ROI Calculator
        </h2>
        <p className="text-gray-600 text-center mb-10">
          Based on industry average of 2.5 hours per certified payroll report and $85/hr admin rate.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
              <label htmlFor="pricing-workers-per-project" className="block text-sm font-medium text-gray-700 mb-2">
                Workers per project
              </label>
              <input
                id="pricing-workers-per-project"
                type="range"
                aria-label="Workers per project"
                min="1"
                max="100"
                value={workersPerProject}
                onChange={(e) => setWorkersPerProject(Number(e.target.value))}
                className="h-11 w-full accent-brand-gold"
              />
              <p className="text-2xl font-bold text-nav-dark mt-1 font-headline">{workersPerProject}</p>
            </div>
            <div>
              <label htmlFor="pricing-active-projects" className="block text-sm font-medium text-gray-700 mb-2">
                Active projects per month
              </label>
              <input
                id="pricing-active-projects"
                type="range"
                aria-label="Active projects per month"
                min="1"
                max="20"
                value={projectsPerMonth}
                onChange={(e) => setProjectsPerMonth(Number(e.target.value))}
                className="h-11 w-full accent-brand-gold"
              />
              <p className="text-2xl font-bold text-nav-dark mt-1 font-headline">{projectsPerMonth}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
              <p className="text-3xl font-bold text-nav-dark font-headline">{hoursSavedPerMonth}</p>
              <p className="text-gray-500 text-sm mt-1">hours saved/month</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
              <p className="text-3xl font-bold text-nav-dark font-headline">
                ${dollarsSavedPerMonth.toLocaleString()}
              </p>
              <p className="text-gray-500 text-sm mt-1">admin time saved/month</p>
            </div>
            <div className="bg-brand-gold rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-nav-dark font-headline">
                {roiDays < 1 ? '<1' : roiDays} day{roiDays !== 1 ? 's' : ''}
              </p>
              <p className="text-nav-dark/70 text-sm mt-1">to break even on Pro plan</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Pro plan costs ${proMonthlyPrice}/month. Savings estimate based on {cprReportsPerMonth} CPR reports/month at $85/hr.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── 6. CTA Strip ──────────────────────────────────────────────────────────────

function PricingCta() {
  return (
    <section className="bg-brand-gold py-16 px-6 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-headline text-3xl font-bold text-nav-dark mb-3">
          Start free today. Upgrade when you're ready.
        </h2>
        <p className="text-nav-dark/80 mb-8">
          No credit card required. Full Pro trial after you create your account.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/register"
            className="bg-nav-dark text-brand-gold font-semibold px-8 py-4 rounded-lg text-base hover:bg-nav-dark/90 transition-colors"
          >
            Create Free Account
          </Link>
          <Link
            to="/contact"
            className="border border-nav-dark text-nav-dark font-semibold px-8 py-4 rounded-lg text-base hover:bg-nav-dark/10 transition-colors"
          >
            Talk to Sales
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function PricingFooter() {
  const links = [
    { label: 'Home', to: '/' },
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
            <span className="text-white font-headline text-sm">AVERO Prevailing Wage</span>
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

export function PricingPage() {
  return (
    <div className="min-h-screen">
      <PricingNav />
      <PricingHero />
      <PricingCards />
      <FeatureMatrix />
      <RoiCalculator />
      <PricingFaq />
      <PricingCta />
      <PricingFooter />
    </div>
  );
}
