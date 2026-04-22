// src/client/components/payrollWizard/PayrollWizard.tsx
import { useWizardState } from './useWizardState';

interface Props {
  projectId: string;
  weekId: string | null;
}

export function PayrollWizard({ projectId, weekId }: Props) {
  const [state] = useWizardState(weekId);
  return (
    <div className="rounded-sm border border-gray-200 bg-white p-6">
      <p className="text-sm text-gray-500">Step: {state.step}</p>
      <p className="text-sm text-gray-500">Project: {projectId}</p>
      <p className="text-sm text-gray-500">Week: {state.weekId ?? '(new)'}</p>
    </div>
  );
}
