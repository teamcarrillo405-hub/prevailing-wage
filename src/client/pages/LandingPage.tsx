import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FolderPlus, ClipboardList, FileCheck, Shield, CheckCircle, Clock, FileText, Database, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TermTooltip } from '../components/ui/TermTooltip';

const DB_DEF = "A federal law requiring contractors on federal or federally funded construction projects to pay workers the locally prevailing wage for their trade. Wages are set by the Department of Labor and published on SAM.gov.";
const WH347_DEF = "The Department of Labor's official certified payroll form. Contractors must submit it weekly to the contracting officer as proof that workers were paid the correct prevailing wage.";
const PW_DEF = "The minimum hourly pay rate for each trade and location, determined by the DOL based on what most workers in that area earn. Paying below this rate is a federal violation.";
const CWHSSA_DEF = "The Contract Work Hours and Safety Standards Act. It requires overtime pay (1.5x base rate) for all hours over 40 in a week on federal contracts exceeding $100,000.";
const WD_DEF = "Wage Determination — the specific DOL document that lists the prevailing wage rates for a given trade in a given county. Each project is assigned a WD number tied to its location.";

// ── UI-12: Hero Section with photography overlay ──────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient (photography placeholder) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "linear-gradient(135deg, #1a2744 0%, #2d4a8a 50%, #1a3a5c 100%)" }}
      />
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-nav-dark/40" />

      {/* Floating nav */}
      <nav className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-20">
        <span className="text-brand-gold font-headline text-xl font-bold">
          HCC Prevailing Wage
        </span>
        <Link
          to="/login"
          className="text-white hover:text-brand-gold transition-colors text-sm font-body"
        >
          Log In
        </Link>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <h1
          className="text-white font-headline font-bold leading-tight mb-4 tracking-tight"
          style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}
        >
          Certified Payroll Compliance<br />Made Simple
        </h1>
        <p className="text-white/80 text-lg sm:text-xl mb-3">
          8 states · Bank-grade SSN encryption · Pricing you can see in 5 seconds
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link
            to="/register"
            className="bg-brand-gold text-nav-dark font-semibold px-8 py-4 rounded-lg text-lg hover:opacity-90 transition-opacity min-h-[52px] flex items-center justify-center"
          >
            Start Free — No Credit Card
          </Link>
          <Link
            to="/pricing"
            className="border border-white/40 text-white font-semibold px-8 py-4 rounded-lg text-lg hover:bg-white/10 transition-colors min-h-[52px] flex items-center justify-center"
          >
            See Pricing
          </Link>
          <a
            href="#how-it-works"
            className="border border-white/20 text-white/70 font-semibold px-6 py-4 rounded-lg text-base hover:bg-white/5 transition-colors min-h-[52px] flex items-center justify-center"
          >
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Testimonial data ─────────────────────────────────────────────────────────
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

// ── Testimonial Carousel ──────────────────────────────────────────────────────
function TestimonialCarousel() {
  const [active, setActive] = useState(0);
  const total = TESTIMONIALS.length;

  const next = useCallback(() => setActive((i) => (i + 1) % total), [total]);
  const prev = useCallback(() => setActive((i) => (i - 1 + total) % total), [total]);

  useEffect(() => {
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [next]);

  const t = TESTIMONIALS[active];

  return (
    <div className="max-w-2xl mx-auto mb-16">
      <div className="relative bg-nav-dark rounded-2xl p-8 text-white overflow-hidden">
        {/* Quote mark decoration */}
        <div className="absolute top-4 left-6 text-brand-gold text-7xl font-serif leading-none opacity-30 select-none" aria-hidden="true">
          &ldquo;
        </div>

        <blockquote className="relative z-10">
          <p className="text-lg text-gray-100 italic leading-relaxed mb-6">
            &ldquo;{t.quote}&rdquo;
          </p>
          <footer className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center text-nav-dark font-bold text-sm flex-shrink-0">
              {t.initials}
            </div>
            <div>
              <cite className="not-italic font-semibold text-white text-sm block">
                {t.name}
              </cite>
              <span className="text-gray-400 text-xs">{t.company}</span>
              <span className="text-gray-500 text-xs block">{t.project}</span>
            </div>
          </footer>
        </blockquote>

        {/* Controls */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <div className="flex gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === active ? 'bg-brand-gold' : 'bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={prev}
              aria-label="Previous testimonial"
              className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:border-brand-gold hover:text-brand-gold transition-colors text-gray-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={next}
              aria-label="Next testimonial"
              className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:border-brand-gold hover:text-brand-gold transition-colors text-gray-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Capterra CTA */}
      <p className="text-center text-sm text-gray-500 mt-4">
        <a
          href="/reviews"
          className="font-medium text-nav-dark hover:text-brand-gold transition-colors underline underline-offset-2"
        >
          Rate us on Capterra
        </a>
        {' '}— join 50+ contractors already using PrevWage
      </p>
    </div>
  );
}

// ── UI-13: Social Proof Section ───────────────────────────────────────────────
function SocialProofSection() {
  return (
    <section className="bg-white py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-gray-500 text-sm uppercase tracking-widest mb-12">
          Trusted by contractors managing prevailing wage compliance
        </p>

        {/* Testimonial carousel */}
        <TestimonialCarousel />

        {/* HCC Verified Customer badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 border border-brand-gold/40 rounded-full px-5 py-2 bg-brand-gold/5">
            <CheckCircle className="w-4 h-4 text-brand-gold flex-shrink-0" />
            <span className="text-sm font-semibold text-nav-dark">Hispanic Construction Council</span>
            <span className="text-xs text-gray-500 border-l border-gray-200 pl-2">Verified Customer</span>
          </div>
        </div>

        {/* Trust badges — 4 badges in a responsive grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-14">
          {[
            { icon: Shield, line1: 'SOC 2 Type II', line2: 'In Progress' },
            { icon: Database, line1: 'AES-256-GCM', line2: 'Encrypted' },
            { icon: CheckCircle, line1: 'Davis-Bacon', line2: 'Compliant' },
            { icon: FileCheck, line1: 'HCC Trusted', line2: 'Partner' },
          ].map(({ icon: Icon, line1, line2 }) => (
            <div
              key={line1}
              className="flex items-center gap-3 bg-nav-dark text-white px-4 py-3 rounded-xl border border-white/10"
            >
              <Icon className="w-5 h-5 text-brand-gold flex-shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold leading-tight">{line1}</p>
                <p className="text-xs text-gray-400 leading-tight">{line2}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Key stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 pt-10 border-t border-gray-100">
          {[
            { value: '8 States', label: 'Native certified payroll forms' },
            { value: '<10 min', label: 'Avg CPR generation time' },
            { value: '100%', label: 'DOL compliant output' },
            { value: '$0', label: 'Audit penalties (verified users)' },
            { value: '50+', label: 'Projects tracked' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold text-nav-dark font-headline">{value}</p>
              <p className="text-gray-500 text-sm mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── UI-14: How It Works (4-step visual) ──────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      step: '01',
      Icon: FolderPlus,
      title: 'Add Project',
      desc: (
        <>
          Enter project details, funding type, and{' '}
          <TermTooltip term="prevailing wage" definition={PW_DEF} /> determination number.
          Rates auto-populate from SAM.gov.
        </>
      ),
    },
    {
      step: '02',
      Icon: ClipboardList,
      title: 'Enter Payroll',
      desc: 'Import from QuickBooks, ADP, Gusto — or enter hours directly. ST/OT/DT auto-calculated per CWHSSA rules.',
    },
    {
      step: '03',
      Icon: Shield,
      title: 'Check Compliance',
      desc: (
        <>
          Instant violation detection for under-wage, overtime, and apprenticeship ratio issues —
          before you file your{' '}
          <TermTooltip term="WH-347" definition={WH347_DEF} />.
        </>
      ),
    },
    {
      step: '04',
      Icon: FileCheck,
      title: 'Download CPR',
      desc: 'State-certified forms: WH-347, CA A-1-131, WA F700-065, NY MPWR, IL, MA, NJ, TX — all formats. Print or e-file.',
    },
  ];

  return (
    <section id="how-it-works" className="bg-gray-50 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-center text-3xl font-bold text-nav-dark font-headline mb-4">
          From payroll data to compliant CPR in minutes
        </h2>
        <p className="text-center text-gray-600 mb-14 max-w-2xl mx-auto">
          Built specifically for{' '}
          <TermTooltip term="Davis-Bacon" definition={DB_DEF} /> and prevailing wage contractors —
          not bolted onto generic project management.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map(({ step, Icon, title, desc }) => (
            <div key={step} className="text-center">
              {/* Step circle */}
              <div className="w-14 h-14 rounded-full bg-nav-dark text-brand-gold font-bold text-lg flex items-center justify-center mx-auto mb-3 font-headline">
                {step}
              </div>
              <Icon className="w-6 h-6 text-brand-gold mx-auto mb-3" />
              <h3 className="font-bold text-nav-dark text-lg mb-2 font-headline">{title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── "See It in Action" video placeholder section ─────────────────────────────
function VideoSection() {
  const VIDEO_CARDS = [
    {
      title: 'Import Payroll in 60 Seconds',
      description: 'Connect QuickBooks Online and pull your employee time records directly — no CSV export, no manual re-entry. Workers and hours flow in automatically.',
    },
    {
      title: 'Generate WH-347 in One Click',
      description: 'Our system pre-fills the January 2025 revision of the federal certified payroll form using your imported payroll data, wage determinations, and worker classifications.',
    },
    {
      title: '8-State Compliance, Zero Confusion',
      description: 'Whether you need a CA A-1-131, WA F700-065, NY MPWR, or federal WH-347 — the correct form auto-selects based on your project state. No form hunting.',
    },
  ];

  return (
    <section className="bg-nav-dark py-20 px-6" id="see-it-in-action">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-center text-3xl font-bold text-white font-headline mb-3">
          See It in Action
        </h2>
        <p className="text-center text-gray-400 mb-14 max-w-2xl mx-auto text-sm">
          Watch how contractors cut certified payroll prep from hours to minutes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {VIDEO_CARDS.map(({ title, description }) => (
            <div
              key={title}
              className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5 group cursor-pointer"
              aria-label={`Watch: ${title}`}
            >
              {/* Dark gradient background */}
              <div className="aspect-video bg-gradient-to-br from-nav-dark via-[#1a2744] to-[#0f1a30] flex items-center justify-center relative">
                {/* Play button SVG */}
                <div className="w-14 h-14 rounded-full bg-brand-gold/90 flex items-center justify-center shadow-lg group-hover:bg-brand-gold transition-colors">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-nav-dark ml-0.5">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </div>
                {/* Coming soon label */}
                <span className="absolute top-3 right-3 text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
                  Coming soon
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 text-brand-gold font-semibold hover:text-brand-gold/80 transition-colors"
          >
            Request a live walkthrough
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── UI-15: State Coverage Grid ────────────────────────────────────────────────
function StateCoverageSection() {
  const activeStates = [
    { code: 'CA', label: 'California' },
    { code: 'WA', label: 'Washington' },
    { code: 'NY', label: 'New York' },
    { code: 'IL', label: 'Illinois' },
    { code: 'TX', label: 'Texas' },
    { code: 'MA', label: 'Massachusetts' },
    { code: 'NJ', label: 'New Jersey' },
    { code: 'FL', label: 'Florida' },
  ];

  const comingSoonStates = [
    'CO', 'OH', 'PA', 'MN', 'AZ', 'GA', 'NC', 'VA',
    'OR', 'NV', 'MI', 'WI', 'IN', 'TN', 'MD', 'CT',
  ];

  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-nav-dark font-headline mb-4">
          8 States — More Coming
        </h2>
        <p className="text-gray-600 mb-12 max-w-2xl mx-auto">
          Native certified payroll forms for every active state.
          Federal WH-347 supported for all 50 states.
        </p>

        {/* Active states */}
        <div className="mb-3">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">
            State-specific forms available now
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {activeStates.map(({ code, label }) => (
              <div
                key={code}
                title={label}
                className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold bg-nav-dark text-brand-gold shadow-md cursor-default select-none"
              >
                {code}
              </div>
            ))}
          </div>
        </div>

        {/* Coming soon states */}
        <div className="mt-6 mb-10">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">
            Coming soon
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {comingSoonStates.map((code) => (
              <div
                key={code}
                title={`${code} — Coming Soon`}
                className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold bg-gray-100 text-gray-400 border border-gray-200 cursor-default select-none"
              >
                {code}
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-gray-500">
          All 50 states supported via federal WH-347 · State-specific forms for active states above
        </p>
      </div>
    </section>
  );
}

// ── UI-16: Pricing Time-Saved Calculator ─────────────────────────────────────
function PricingCalculator() {
  const [weeksPerMonth, setWeeksPerMonth] = useState(8);
  const [workersPerProject, setWorkersPerProject] = useState(15);

  const hoursPerCPR = 2.5; // industry average: 2.5 hours manual CPR prep per week
  const hoursSaved = Math.round(weeksPerMonth * hoursPerCPR);
  const dollarsSaved = hoursSaved * 65; // ~$65/hr admin/PM rate

  return (
    <div className="bg-nav-dark/5 border border-nav-dark/20 rounded-2xl p-8 mb-12 max-w-2xl mx-auto">
      <h3 className="text-xl font-bold text-nav-dark mb-2 text-center font-headline">
        How much time will you save?
      </h3>
      <p className="text-gray-600 text-center mb-8 text-sm">
        Based on industry average of 2.5 hours per certified payroll report
      </p>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payroll weeks / month
          </label>
          <input
            type="range"
            min="1"
            max="40"
            value={weeksPerMonth}
            onChange={(e) => setWeeksPerMonth(Number(e.target.value))}
            className="w-full accent-brand-gold"
          />
          <p className="text-2xl font-bold text-nav-dark mt-1 font-headline">{weeksPerMonth}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Workers per project
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={workersPerProject}
            onChange={(e) => setWorkersPerProject(Number(e.target.value))}
            className="w-full accent-brand-gold"
          />
          <p className="text-2xl font-bold text-nav-dark mt-1 font-headline">{workersPerProject}</p>
        </div>
      </div>

      <div className="text-center bg-white rounded-xl p-6 border border-nav-dark/10">
        <p className="text-4xl font-bold text-nav-dark font-headline">{hoursSaved} hrs/mo</p>
        <p className="text-gray-500 text-sm mt-1">saved on payroll compliance</p>
        <p className="text-brand-gold font-semibold mt-3 text-lg">
          ≈ ${dollarsSaved.toLocaleString()}/month in admin time
        </p>
      </div>
    </div>
  );
}

// ── Existing: Problem Section ─────────────────────────────────────────────────
function ProblemSection() {
  const painPoints = [
    {
      title: 'Rate Lookup Wastes Hours',
      description:
        'Manually searching SAM.gov for wage determinations, then copying rates into spreadsheets for every new project location.',
    },
    {
      title: 'WH-347 Errors Risk Debarment',
      description:
        'One wrong classification or missing apprentice certification can get your company debarred from federal projects.',
    },
    {
      title: 'Violations Surface Too Late',
      description:
        'Finding underpayment violations during a DOL audit — not before you file — means back pay, penalties, and project delays.',
    },
  ];

  return (
    <section className="bg-surface-page py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-headline text-4xl font-bold text-text-primary text-center mb-2">
          The Paper Trail Is Killing Your Margins
        </h2>
        <p className="text-text-secondary text-center mb-10">
          Every general contractor on a federal project faces the same three problems.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          {painPoints.map((point) => (
            <Card key={point.title}>
              <h3 className="font-headline text-xl font-bold text-text-primary mb-3">
                {point.title}
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {point.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Existing: Feature Highlights ──────────────────────────────────────────────
function FeatureHighlightsSection() {
  const features = [
    {
      Icon: Database,
      title: 'Wage Rates Auto-Populated',
      description:
        'Pull current Davis-Bacon rates from SAM.gov by project location — no manual lookup, no spreadsheet imports.',
    },
    {
      Icon: FileText,
      title: 'WH-347 in One Click',
      description:
        'Generate a complete, pre-filled January 2025 certified payroll form ready to submit to your contracting officer.',
    },
    {
      Icon: Shield,
      title: 'Violation Detection Before You File',
      description:
        'The system flags underpayment and CWHSSA overtime violations before you generate the WH-347 — not after a DOL audit.',
    },
    {
      Icon: CheckCircle,
      title: 'Apprentice Compliance Built In',
      description:
        'Track program name, registration number, and J/RA ratio for apprentice workers — required on the 2025 form.',
    },
    {
      Icon: Clock,
      title: 'Minutes, Not Hours',
      description:
        'Contractors report completing weekly certified payroll in under 10 minutes once project wage rates are loaded.',
    },
    {
      Icon: FileText,
      title: 'Full Audit Trail',
      description:
        "Every payroll entry is timestamped and stored. Retrieve any week's data instantly if a project is audited.",
    },
  ];

  return (
    <section className="bg-surface-page py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-headline text-4xl font-bold text-text-primary text-center mb-2">
          Everything You Need for Davis-Bacon Compliance
        </h2>
        <p className="text-text-secondary text-center mb-4">
          Built for general contractors who can't afford compliance mistakes
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mt-12">
          {features.map(({ Icon, title, description }) => (
            <Card key={title}>
              <Icon className="w-6 h-6 text-brand-gold mb-3" />
              <h3 className="font-headline text-lg font-bold text-text-primary mb-2">
                {title}
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Existing: Trust Signals ───────────────────────────────────────────────────
function TrustSignalsSection() {
  const trustStatements: React.ReactNode[] = [
    <><TermTooltip term="Davis-Bacon" definition={DB_DEF} /> and Related Acts (DBRA) compliance for all federal contracts over $2,000</>,
    <><TermTooltip term="CWHSSA" definition={CWHSSA_DEF} /> overtime detection for contracts over $100,000 with 40-hour workweeks</>,
    <>SAM.gov <TermTooltip term="WD" definition={WD_DEF} /> data — the same source contracting officers use</>,
  ];

  return (
    <section className="bg-nav-dark text-white py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div className="border-l-4 border-brand-gold pl-6">
            <h2 className="font-headline text-3xl font-bold text-white mb-4">
              Current as of January 2025
            </h2>
            <p className="text-gray-300 leading-relaxed">
              The January 2025 <TermTooltip term="WH-347" definition={WH347_DEF} /> form revision is the only version accepted by the Department of Labor. HCC Prevailing Wage generates this exact form — not a generic PDF approximation.
            </p>
          </div>
          <div className="space-y-4">
            {trustStatements.map((statement, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-brand-gold flex-shrink-0 mt-0.5" />
                <p className="text-gray-300 text-sm leading-relaxed">{statement}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing Section with Calculator ───────────────────────────────────────────
function PricingSection() {
  return (
    <section className="bg-gray-50 py-20 px-6" id="pricing">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-nav-dark font-headline mb-4">
          Transparent Pricing
        </h2>
        <p className="text-gray-600 mb-12 max-w-2xl mx-auto">
          No hidden setup fees. No per-form charges. Cancel any time.
        </p>

        {/* UI-16: Time-saved calculator */}
        <PricingCalculator />

        {/* Pricing tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            {
              name: 'Starter',
              price: '$49',
              period: '/mo',
              tagline: 'Solo contractor or PM',
              features: [
                '1 active project',
                'WH-347 federal form',
                'Up to 10 workers',
                'Email support',
              ],
              cta: 'Start Free',
              highlight: false,
            },
            {
              name: 'Professional',
              price: '$129',
              period: '/mo',
              tagline: 'Growing GC or sub',
              features: [
                'Up to 10 projects',
                'All 8 state forms',
                'Unlimited workers',
                'SSN encryption',
                'Priority support',
              ],
              cta: 'Start Free',
              highlight: true,
            },
            {
              name: 'Enterprise',
              price: 'Custom',
              period: '',
              tagline: 'Multi-office or agency',
              features: [
                'Unlimited projects',
                'Team seats + RBAC',
                'API access',
                'Custom state forms',
                'Dedicated CSM',
              ],
              cta: 'Contact Us',
              highlight: false,
            },
          ].map(({ name, price, period, tagline, features, cta, highlight }) => (
            <div
              key={name}
              className={`rounded-2xl p-8 flex flex-col ${
                highlight
                  ? 'bg-nav-dark text-white shadow-xl ring-2 ring-brand-gold'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <p className={`text-sm font-semibold uppercase tracking-widest mb-1 ${highlight ? 'text-brand-gold' : 'text-gray-500'}`}>
                {name}
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span className={`text-4xl font-bold font-headline ${highlight ? 'text-white' : 'text-nav-dark'}`}>
                  {price}
                </span>
                {period && (
                  <span className={`text-sm pb-1 ${highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                    {period}
                  </span>
                )}
              </div>
              <p className={`text-sm mb-6 ${highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                {tagline}
              </p>
              <ul className="space-y-2 flex-1 mb-8">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${highlight ? 'text-brand-gold' : 'text-status-compliant'}`} />
                    <span className={highlight ? 'text-gray-300' : 'text-gray-700'}>{f}</span>
                  </li>
                ))}
              </ul>
              {name === 'Enterprise' ? (
                <a
                  href="mailto:support@hcc.com"
                  className={`block text-center font-semibold py-3 rounded-lg transition-colors ${
                    highlight
                      ? 'bg-brand-gold text-nav-dark hover:opacity-90'
                      : 'border border-nav-dark text-nav-dark hover:bg-gray-50'
                  }`}
                >
                  {cta}
                </a>
              ) : (
                <Link
                  to="/register"
                  className={`block text-center font-semibold py-3 rounded-lg transition-colors ${
                    highlight
                      ? 'bg-brand-gold text-nav-dark hover:opacity-90'
                      : 'border border-nav-dark text-nav-dark hover:bg-gray-50'
                  }`}
                >
                  {cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Comparison Table ─────────────────────────────────────────────────────────
function ComparisonSection() {
  type CellVal = string | boolean;

  interface CompRow {
    feature: string;
    us: CellVal;
    b2gnow: CellVal;
    knowify: CellVal;
  }

  const rows: CompRow[] = [
    { feature: 'State forms depth',       us: '8 states native',   b2gnow: '3–4 states',       knowify: 'Federal only'   },
    { feature: 'Pricing transparency',    us: 'Public pricing',     b2gnow: 'Quote required',   knowify: 'Quote required' },
    { feature: 'SSN encryption',          us: 'AES-256-GCM',        b2gnow: 'Not disclosed',    knowify: 'Not disclosed'  },
    { feature: 'Free tier',               us: true,                 b2gnow: false,              knowify: false            },
    { feature: 'Setup time',              us: '<10 minutes',        b2gnow: '1–2 weeks',        knowify: '1–3 days'       },
    { feature: 'WH-347 (Jan 2025 rev)',   us: true,                 b2gnow: true,               knowify: true             },
    { feature: 'CA eCPR XML export',      us: true,                 b2gnow: true,               knowify: false            },
    { feature: 'WA L&I XML export',       us: true,                 b2gnow: false,              knowify: false            },
    { feature: 'Subcontractor portal',    us: true,                 b2gnow: false,              knowify: false            },
    { feature: 'QuickBooks import',       us: true,                 b2gnow: false,              knowify: true             },
  ];

  function Cell({ val, highlight }: { val: CellVal; highlight?: boolean }) {
    if (typeof val === 'boolean') {
      return (
        <td className={`px-4 py-3 text-center ${highlight ? 'bg-nav-dark/5' : ''}`}>
          {val ? (
            <CheckCircle className={`w-5 h-5 mx-auto ${highlight ? 'text-brand-gold' : 'text-emerald-500'}`} />
          ) : (
            <span className="block w-5 h-px mx-auto bg-gray-300" aria-label="No" />
          )}
        </td>
      );
    }
    return (
      <td className={`px-4 py-3 text-sm text-center ${highlight ? 'bg-nav-dark/5 font-semibold text-nav-dark' : 'text-gray-600'}`}>
        {val}
      </td>
    );
  }

  return (
    <section className="bg-gray-50 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-nav-dark font-headline text-center mb-4">
          How We Compare
        </h2>
        <p className="text-gray-600 text-center mb-12 max-w-xl mx-auto">
          Purpose-built for prevailing wage compliance — not bolted onto generic project management.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">
                  Feature
                </th>
                <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider w-1/5 bg-nav-dark/5 text-nav-dark">
                  PrevWage
                  <span className="block text-brand-gold normal-case font-normal text-xs tracking-normal mt-0.5">Our app</span>
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">
                  B2Gnow
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">
                  Knowify
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ feature, us, b2gnow, knowify }, idx) => (
                <tr key={feature} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700">{feature}</td>
                  <Cell val={us} highlight />
                  <Cell val={b2gnow} />
                  <Cell val={knowify} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Competitor information based on publicly available documentation as of 2026. Subject to change.
        </p>
      </div>
    </section>
  );
}

// ── FAQ Section ───────────────────────────────────────────────────────────────
interface FaqItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'What states do you support?',
    a: 'We support 8 states with native certified payroll forms: California, Washington, New York, Illinois, Texas, Massachusetts, New Jersey, and Florida. Federal WH-347 (January 2025 revision) is supported for all 50 states. State-specific forms for Colorado, Ohio, Pennsylvania, and 13 more states are in development.',
  },
  {
    q: 'Is my workers\' SSN data secure?',
    a: 'Yes. All Social Security Numbers are encrypted using AES-256-GCM before being written to the database. SSNs are decrypted only at the moment they are printed or exported to a certified payroll form — they are never stored in plaintext. The encryption key is managed separately from the database.',
  },
  {
    q: 'Can I import from QuickBooks?',
    a: 'Yes. PrevWage supports QuickBooks Online payroll exports and ADP payroll files. You can map classification codes and hourly rates once per project, and subsequent weekly imports require only the export file. Manual entry is also supported if you don\'t use a payroll provider.',
  },
  {
    q: 'How do subcontractor CPR submissions work?',
    a: 'Each subcontractor receives a unique, time-limited upload link. They enter their own payroll data directly through the portal — no account required on their end. Their submissions appear in your project dashboard alongside your own entries and are included in consolidated reporting and compliance checks.',
  },
  {
    q: 'Do you support WH-347 federal forms?',
    a: 'Yes. We generate the January 2025 revision of the WH-347 — the only version currently accepted by the Department of Labor. The form is pre-filled from your payroll data including worker classifications, fringe benefit statements, apprentice information, and the required compliance certification statement.',
  },
];

function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  function toggle(idx: number) {
    setOpenIdx((prev) => (prev === idx ? null : idx));
  }

  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-nav-dark font-headline text-center mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-gray-600 text-center mb-12">
          Still have questions?{' '}
          <Link to="/contact" className="text-nav-dark font-semibold underline underline-offset-2 hover:text-brand-gold transition-colors">
            Talk to a compliance expert.
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
                }`}
              >
                <button
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 text-sm pr-4">{q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-brand-gold' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
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

// ── Existing: CTA Close ───────────────────────────────────────────────────────
function CTACloseSection() {
  return (
    <section className="bg-brand-gold py-16 px-4 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-headline text-4xl font-bold text-nav-dark mb-4">
          Ready to File Your First Certified Payroll?
        </h2>
        <p className="text-nav-dark/80 mb-8 text-lg">
          Free to start. No credit card required.
        </p>
        <Link to="/register">
          <Button
            variant="primary"
            size="md"
            className="bg-nav-dark text-brand-gold hover:bg-nav-dark/90"
          >
            Create Free Account
          </Button>
        </Link>
      </div>
    </section>
  );
}

// TODO: set after Better Stack account setup — replace YOUR-SUBDOMAIN with the actual subdomain
// chosen during account creation at https://betterstack.com/uptime
const STATUS_PAGE_URL = 'https://YOUR-SUBDOMAIN.betteruptime.com';

// ── Existing: Footer ──────────────────────────────────────────────────────────
function LandingFooter() {
  const footerLinks = [
    { label: 'Pricing', to: '/pricing' },
    { label: 'Case Studies', to: '/case-studies' },
    { label: 'Contact', to: '/contact' },
    { label: 'Reviews', to: '/reviews' },
    { label: 'Security Policy', to: '/security' },
    { label: 'API Docs', to: '/api-docs' },
    { label: 'Log In', to: '/login' },
  ];

  return (
    <footer className="bg-nav-dark text-gray-400 py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
          <span className="text-white font-headline text-sm">
            HCC Prevailing Wage
          </span>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {footerLinks.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className="text-gray-400 hover:text-brand-gold transition-colors"
              >
                {label}
              </Link>
            ))}
            <a
              href={STATUS_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-brand-gold transition-colors"
            >
              System Status
            </a>
          </div>
        </div>
        {/* Better Stack embeddable status badge */}
        <div className="mb-4">
          <iframe
            src={`${STATUS_PAGE_URL}/badge?theme=dark`}
            width="250"
            height="30"
            frameBorder="0"
            scrolling="no"
            title="Service status"
            style={{ colorScheme: 'none' }}
          />
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
export function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <SocialProofSection />
      <HowItWorksSection />
      <VideoSection />
      <StateCoverageSection />
      <ProblemSection />
      <FeatureHighlightsSection />
      <TrustSignalsSection />
      <PricingSection />
      <ComparisonSection />
      <FaqSection />
      <CTACloseSection />
      <LandingFooter />
    </div>
  );
}
