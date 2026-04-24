import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  hasProjects: boolean;
  hasWorkers: boolean;
  hasPayroll: boolean;
  firstProjectId?: string;
  onDismiss: () => void;
}

interface Step {
  title: string;
  description: string;
  complete: boolean;
  recommended?: boolean;
  href?: string;
  disabled?: boolean;
}

export function OnboardingChecklist({
  hasProjects,
  hasWorkers,
  hasPayroll,
  firstProjectId,
  onDismiss,
}: Props) {
  const steps: Step[] = [
    {
      title: 'Create a project',
      description: 'Add your federal job to start tracking certified payroll.',
      complete: hasProjects,
      href: '/dashboard',
    },
    {
      title: 'Look up prevailing wage rates',
      description: "Find your county's Davis-Bacon wage determination from SAM.gov.",
      complete: false,
      recommended: true,
      href: '/wages',
    },
    {
      title: 'Register your workers',
      description:
        'Add all workers before entering payroll — even those who worked one day.',
      complete: hasWorkers,
      href: firstProjectId ? `/projects/${firstProjectId}/workers` : undefined,
      disabled: !firstProjectId,
    },
    {
      title: 'Enter your first payroll week',
      description: 'Submit certified payroll weekly to stay DOL-compliant.',
      complete: hasPayroll,
      href: firstProjectId ? `/projects/${firstProjectId}/payroll` : undefined,
      disabled: !firstProjectId,
    },
  ];

  return (
    <div className="rounded-lg border border-brand-gold/40 bg-brand-gold/5 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Getting started</h3>
        <button
          onClick={onDismiss}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Dismiss
        </button>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <StepRow key={index} step={step} />
        ))}
      </div>
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  const content = (
    <div className="flex items-start gap-3">
      {step.complete ? (
        <CheckCircle className="w-5 h-5 text-status-compliant flex-shrink-0 mt-0.5" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5" />
      )}
      <div>
        <div className="text-sm font-semibold text-gray-900">
          {step.title}
          {step.recommended && !step.complete && (
            <span className="ml-2 text-xs font-normal text-brand-gold">recommended</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{step.description}</div>
      </div>
    </div>
  );

  if (step.disabled || !step.href) {
    return (
      <div className="opacity-50 cursor-not-allowed" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={step.href}
      className="block rounded hover:bg-brand-gold/10 -mx-2 px-2 py-1 transition-colors"
    >
      {content}
    </Link>
  );
}
