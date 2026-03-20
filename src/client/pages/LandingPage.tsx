import { Link } from 'react-router-dom';
import { FolderPlus, ClipboardList, FileCheck } from 'lucide-react';
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

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      {/* Feature highlights, trust signals, CTA close, footer — Plan 03 */}
    </div>
  );
}
