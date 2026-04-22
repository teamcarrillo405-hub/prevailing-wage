// src/client/components/payrollWizard/PayrollWizard.tsx
import { useWizardState } from './useWizardState';
import { Step1Roster } from './Step1Roster';

interface Props {
  projectId: string;
  weekId: string | null;
}

function getNextSunday(): string {
  const d = new Date();
  const daysUntilSun = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSun);
  return d.toISOString().slice(0, 10);
}

export function PayrollWizard({ projectId, weekId }: Props) {
  const [state] = useWizardState(weekId);

  if (state.step === 'roster') {
    return (
      <Step1Roster
        projectId={projectId}
        defaultPayrollNumber={1}
        defaultWeekEndingDate={getNextSunday()}
        onNext={() => { /* wired in T8 */ }}
      />
    );
  }

  return <div className="text-sm text-gray-500">Step {state.step} — not yet implemented</div>;
}
