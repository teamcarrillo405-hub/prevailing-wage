import { Link } from 'react-router-dom';
import { FolderPlus, ClipboardList, FileCheck, Shield, CheckCircle, Clock, FileText, Database, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TermTooltip } from '../components/ui/TermTooltip';

const DB_DEF = "A federal law requiring contractors on federal or federally funded construction projects to pay workers the locally prevailing wage for their trade. Wages are set by the Department of Labor and published on SAM.gov.";
const WH347_DEF = "The Department of Labor's official certified payroll form. Contractors must submit it weekly to the contracting officer as proof that workers were paid the correct prevailing wage.";
const PW_DEF = "The minimum hourly pay rate for each trade and location, determined by the DOL based on what most workers in that area earn. Paying below this rate is a federal violation.";
const CWHSSA_DEF = "The Contract Work Hours and Safety Standards Act. It requires overtime pay (1.5x base rate) for all hours over 40 in a week on federal contracts exceeding $100,000.";
const WD_DEF = "Wage Determination — the specific DOL document that lists the prevailing wage rates for a given trade in a given county. Each project is assigned a WD number tied to its location.";

function HeroSection() {
  return (
    <section
      className="hero-bg relative min-h-screen flex flex-col"
      style={{
        backgroundImage: "url('/images/hero.webp')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay per D-06: bg-black/60 */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Content above overlay */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Floating nav per D-09 — transparent, no bg-nav-dark on landing */}
        <nav className="px-6 py-4 flex items-center justify-between">
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

        {/* Hero content centered vertically */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1
              className="font-headline font-bold leading-tight mb-6 tracking-tight text-white"
              style={{ fontSize: 'clamp(56px, 8vw, 88px)' }}
            >
              WH-347 Certified Payroll.<br />
              Davis-Bacon Rates from SAM.gov, Automated.
            </h1>
            <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto font-body">
              Pull prevailing wage rates for your project location, enter weekly
              payroll, and generate compliant WH-347 forms — in minutes, not hours.
            </p>
            <div className="flex gap-4 justify-center flex-wrap mt-8">
              <Link to="/register">
                <Button variant="primary" size="md">Create Free Account</Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="secondary" size="md">See How It Works</Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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

function HowItWorksSection() {
  const steps: { Icon: React.ElementType; title: string; description: React.ReactNode }[] = [
    {
      Icon: FolderPlus,
      title: 'Create Your Project',
      description: <>Enter your project name and location. We pull the required <TermTooltip term="prevailing wage" definition={PW_DEF} /> rates from SAM.gov — the same source your contracting officer uses. No manual rate lookup.</>,
    },
    {
      Icon: Users,
      title: 'Add Your Workers',
      description: <>Register every worker with their trade classification. Federal law requires each worker on a <TermTooltip term="Davis-Bacon" definition={DB_DEF} /> job to be documented — apprentices need their program name and registration number.</>,
    },
    {
      Icon: ClipboardList,
      title: 'Enter Weekly Payroll',
      description: <>Log hours and pay for each worker every week. The system checks rates against the <TermTooltip term="prevailing wage" definition={PW_DEF} /> and flags underpayments before you file — not after a DOL audit.</>,
    },
    {
      Icon: FileCheck,
      title: 'Generate and Submit Your WH-347',
      description: <>Download the completed January 2025 <TermTooltip term="WH-347" definition={WH347_DEF} /> form, pre-filled with all required data. Submit it to your contracting officer each week to stay compliant.</>,
    },
  ];

  return (
    <section id="how-it-works" className="bg-nav-dark text-white py-20 px-4">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-headline text-4xl font-bold text-white mb-3">
          How It Works
        </h2>
        <p className="text-gray-400 mb-12">
          Four steps from contract award to certified payroll submission
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12 text-left">
          {steps.map(({ Icon, title, description }) => (
            <div key={title}>
              <Icon className="w-10 h-10 text-brand-gold mb-4" />
              <h3 className="font-headline text-xl font-bold text-white mb-2">
                {title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
        'Every payroll entry is timestamped and stored. Retrieve any week\'s data instantly if a project is audited.',
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

function LandingFooter() {
  return (
    <footer className="bg-nav-dark text-gray-400 py-8 px-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <span className="text-white font-headline text-sm">
          HCC Prevailing Wage
        </span>
        <div className="flex gap-6 text-sm">
          <Link
            to="/login"
            className="text-gray-400 hover:text-brand-gold transition-colors"
          >
            Log In
          </Link>
          <a
            href="mailto:support@hcc.com"
            className="text-gray-400 hover:text-brand-gold transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
      <p className="text-xs text-gray-600 text-center mt-4">
        Davis-Bacon and Related Acts compliance software for federal construction contractors.
      </p>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <HowItWorksSection />
      <ProblemSection />
      <FeatureHighlightsSection />
      <TrustSignalsSection />
      <CTACloseSection />
      <LandingFooter />
    </div>
  );
}
