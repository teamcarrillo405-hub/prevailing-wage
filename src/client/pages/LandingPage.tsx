import { Link } from 'react-router-dom';
import { FolderPlus, ClipboardList, FileCheck, Shield, CheckCircle, Clock, FileText, Database } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

function LandingNav() {
  return (
    <nav className="bg-nav-dark sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
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
  );
}

function HeroSection() {
  return (
    <section className="bg-nav-dark text-white py-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="font-headline text-5xl font-bold leading-tight mb-6">
          WH-347 Certified Payroll.<br />
          Davis-Bacon Rates from SAM.gov, Automated.
        </h1>
        <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
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
  const steps = [
    {
      Icon: FolderPlus,
      title: 'Create Your Project',
      description:
        'Enter your project name and location. We pull the correct Davis-Bacon wage determination from SAM.gov automatically.',
    },
    {
      Icon: ClipboardList,
      title: 'Enter Weekly Payroll',
      description:
        'Log hours, classifications, and fringe benefits for each worker. The system flags underpayments in real time.',
    },
    {
      Icon: FileCheck,
      title: 'Generate WH-347',
      description:
        'Download the January 2025 WH-347 form, pre-filled and ready to submit to the contracting officer.',
    },
  ];

  return (
    <section id="how-it-works" className="bg-nav-dark text-white py-20 px-4">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-headline text-4xl font-bold text-white mb-3">
          How It Works
        </h2>
        <p className="text-gray-400 mb-12">
          Three steps from contract award to certified payroll
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 text-left">
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
  const trustStatements = [
    'Davis-Bacon and Related Acts (DBRA) compliance for all federal contracts over $2,000',
    'CWHSSA overtime detection for contracts over $100,000 with 40-hour workweeks',
    'SAM.gov wage determination data — the same source contracting officers use',
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
              The January 2025 WH-347 form revision is the only version accepted by the Department of Labor. HCC Prevailing Wage generates this exact form — not a generic PDF approximation.
            </p>
          </div>
          <div className="space-y-4">
            {trustStatements.map((statement) => (
              <div key={statement} className="flex items-start gap-3">
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
      <LandingNav />
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <FeatureHighlightsSection />
      <TrustSignalsSection />
      <CTACloseSection />
      <LandingFooter />
    </div>
  );
}
