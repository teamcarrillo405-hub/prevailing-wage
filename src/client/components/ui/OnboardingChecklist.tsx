import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  hasProjects: boolean;
  hasWorkers: boolean;
  hasPayroll: boolean;
  hasWageDetermination?: boolean;
  hasReport?: boolean;
  hasTeamMember?: boolean;
  hasQboConnection?: boolean;
  firstProjectId?: string;
  onDismiss: () => void;
}

interface Step {
  num: number;
  title: string;
  description: string;
  complete: boolean;
  optional?: boolean;
  href?: string;
  disabled?: boolean;
}

export function OnboardingChecklist({
  hasProjects,
  hasWorkers,
  hasPayroll,
  hasWageDetermination,
  hasReport = false,
  hasTeamMember = false,
  hasQboConnection = false,
  firstProjectId,
  onDismiss,
}: Props) {
  const steps: Step[] = [
    {
      num: 1,
      title: hasProjects ? 'Project created' : 'Create your first project',
      description: hasProjects
        ? 'Your first job is ready for certified payroll tracking.'
        : 'Add your federal or state job to start tracking certified payroll.',
      complete: hasProjects,
      href: '/dashboard',
    },
    {
      num: 2,
      title: 'Add your workers',
      description: 'Register all workers with trade classification and encrypted SSN before entering payroll.',
      complete: hasWorkers,
      href: firstProjectId ? `/projects/${firstProjectId}/workers` : undefined,
      disabled: !firstProjectId,
    },
    {
      num: 3,
      title: (hasWageDetermination ?? hasProjects) ? 'Wage determination selected' : 'Set wage determinations for your state',
      description: "Find your county's Davis-Bacon wage determination from SAM.gov — rates auto-populate.",
      complete: hasWageDetermination ?? hasProjects,
      href: '/wages',
    },
    {
      num: 4,
      title: 'Enter your first payroll week',
      description: 'Submit certified payroll weekly to stay DOL-compliant — import from QuickBooks or enter manually.',
      complete: hasPayroll,
      href: firstProjectId ? `/projects/${firstProjectId}/payroll` : undefined,
      disabled: !firstProjectId,
    },
    {
      num: 5,
      title: 'Generate and download your certified payroll report',
      description: 'Export the WH-347 or your state-specific form — pre-filled and ready to submit.',
      complete: hasReport,
      href: firstProjectId ? `/projects/${firstProjectId}/reports` : undefined,
      disabled: !firstProjectId,
    },
    {
      num: 6,
      title: 'Invite a team member or subcontractor',
      description: 'Add teammates with role-based access, or share a sub upload link for CPR submissions.',
      complete: hasTeamMember,
      href: '/team',
    },
    {
      num: 7,
      title: 'Connect QuickBooks for automated imports',
      description: 'Link your QB Online account so employee time records flow in automatically each week.',
      complete: hasQboConnection,
      optional: true,
      href: '/settings/integrations',
    },
  ];

  const completedCount = steps.filter(s => s.complete).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="rounded-xl border border-brand-gold/40 bg-brand-gold/5 p-5 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Getting started</h3>
        <button
          onClick={onDismiss}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">{completedCount} of {steps.length} complete</span>
          <span className="text-xs font-semibold text-brand-gold">{progressPct}%</span>
        </div>
        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-gold rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <StepRow key={step.num} step={step} />
        ))}
      </div>
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  const content = (
    <div className="flex items-start gap-3">
      {/* Numbered circle — gold when incomplete, navy when complete */}
      {step.complete ? (
        <CheckCircle className="w-6 h-6 text-status-compliant flex-shrink-0 mt-0.5" />
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-brand-gold bg-brand-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-brand-gold leading-none">{step.num}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${step.complete ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {step.title}
          </span>
          {step.optional && !step.complete && (
            <span className="text-xs font-normal text-gray-400">(optional)</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{step.description}</div>
      </div>
      {/* "Do this now" arrow — only on incomplete, non-disabled steps */}
      {!step.complete && !step.disabled && (
        <span className="text-xs text-brand-gold font-medium whitespace-nowrap mt-0.5 flex-shrink-0">
          Do this now →
        </span>
      )}
    </div>
  );

  if (step.disabled || !step.href) {
    return (
      <div className="opacity-40 cursor-not-allowed px-2 py-1.5" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={step.href}
      className="block rounded-lg hover:bg-brand-gold/10 -mx-2 px-2 py-1.5 transition-colors"
    >
      {content}
    </Link>
  );
}
