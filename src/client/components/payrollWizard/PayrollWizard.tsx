// src/client/components/payrollWizard/PayrollWizard.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWizardState } from './useWizardState';
import { Step1Roster, type Step1Values } from './Step1Roster';
import { api } from '../../lib/api';

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

interface CreateWeekResponse {
  id: string;
  payrollNumber: number;
}

export function PayrollWizard({ projectId, weekId }: Props) {
  const [state, dispatch] = useWizardState(weekId);
  const [error, setError] = useState<string | null>(null);
  const [step1, setStep1] = useState<Step1Values | null>(null);
  const qc = useQueryClient();

  const createWeek = useMutation<CreateWeekResponse, Error, Step1Values>({
    mutationFn: (v) =>
      api.post<CreateWeekResponse>('/payroll/weeks', {
        projectId,
        weekEndingDate: v.weekEndingDate,
        payrollNumber: v.payrollNumber,
      }),
    onSuccess: (data, variables) => {
      setStep1(variables);
      dispatch({ type: 'SET_WEEK_ID', weekId: data.id });
      dispatch({ type: 'ADVANCE' });
      qc.invalidateQueries({ queryKey: ['payroll-weeks-list', projectId] });
    },
    onError: (err) => setError(err.message),
  });

  if (state.step === 'roster') {
    return (
      <>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <Step1Roster
          projectId={projectId}
          defaultPayrollNumber={1}
          defaultWeekEndingDate={getNextSunday()}
          onNext={(v) => {
            setError(null);
            createWeek.mutate(v);
          }}
        />
      </>
    );
  }

  if (state.step === 'hours') {
    return (
      <div className="text-sm text-gray-500">
        Step 2 — hours grid (wired in later tasks). Week created: {state.weekId}.
        {step1 && <span> {step1.roster.filter((r) => r.included).length} workers selected.</span>}
      </div>
    );
  }

  return <div className="text-sm text-gray-500">Step 3 — review (wired in later tasks)</div>;
}
