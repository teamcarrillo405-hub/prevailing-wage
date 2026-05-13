import type { ReactNode } from 'react';
import { CheckCircle } from 'lucide-react';

const STEPS = [
  { key: 'roster', label: 'Roster & Dates' },
  { key: 'hours',  label: 'Enter Hours' },
  { key: 'review', label: 'Review & Submit' },
] as const;

type WizardStep = typeof STEPS[number]['key'];

interface StepProgressProps {
  currentStep: WizardStep;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  const currentIndex = STEPS.findIndex(s => s.key === currentStep);

  return (
    <nav aria-label="Wizard progress" className="mb-8">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done    = i < currentIndex;
          const active  = i === currentIndex;
          const upcoming = i > currentIndex;

          return (
            <li key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  aria-current={active ? 'step' : undefined}
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 text-sm font-semibold',
                    done    ? 'bg-brand-gold text-black' : '',
                    active  ? 'bg-nav-dark text-white ring-2 ring-brand-gold ring-offset-2' : '',
                    upcoming ? 'bg-gray-200 text-gray-400' : '',
                  ].join(' ')}
                >
                  {done
                    ? <CheckCircle className="w-4 h-4" aria-hidden="true" />
                    : <span>{i + 1}</span>
                  }
                </div>
                <span className={[
                  'text-xs font-medium whitespace-nowrap',
                  active  ? 'text-text-primary' : '',
                  done    ? 'text-brand-gold' : '',
                  upcoming ? 'text-text-secondary' : '',
                ].join(' ')}>
                  {step.label}
                </span>
              </div>

              {/* Connector line — not after last step */}
              {i < STEPS.length - 1 && (
                <div className={[
                  'flex-1 h-px mx-3 mb-5 transition-colors duration-200',
                  i < currentIndex ? 'bg-brand-gold' : 'bg-gray-200',
                ].join(' ')} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface StepTransitionProps {
  direction: 'forward' | 'backward';
  children: ReactNode;
}

export function StepTransition({ direction, children }: StepTransitionProps) {
  return (
    <div className={direction === 'forward' ? 'wizard-enter-forward' : 'wizard-enter-backward'}>
      {children}
    </div>
  );
}
