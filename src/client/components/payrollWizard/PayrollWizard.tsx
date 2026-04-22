// src/client/components/payrollWizard/PayrollWizard.tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useWizardState } from './useWizardState';
import { Step1Roster, type Step1Values } from './Step1Roster';
import { api } from '../../lib/api';
import { LoadingSpinner } from '../shared/LoadingSpinner';

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

interface WeekDetail {
  week: {
    id: string;
    projectId: string;
    isFinal: boolean;
    weekEndingDate: string;
    payrollNumber: number;
  };
  entries: Array<{
    entry: {
      id: string;
      workerId: string;
      classificationId: string;
      monSt: number; tueSt: number; wedSt: number; thuSt: number;
      friSt: number; satSt: number; sunSt: number;
      monOt: number; tueOt: number; wedOt: number; thuOt: number;
      friOt: number; satOt: number; sunOt: number;
      baseRateSnapshot: number;
      fringeRateSnapshot: number;
      deductions: number | null;
    };
    workerName: string;
    tradeDescription: string;
  }>;
}

export function PayrollWizard({ projectId, weekId }: Props) {
  const [state, dispatch] = useWizardState(weekId);
  const [error, setError] = useState<string | null>(null);
  const [step1, setStep1] = useState<Step1Values | null>(null);
  const qc = useQueryClient();

  // Edit-mode: fetch week + entries. Provides lock check + pre-population data.
  const { data: weekData, isLoading: weekLoading } = useQuery<WeekDetail>({
    queryKey: ['payroll-week', weekId],
    queryFn: () => api.get<WeekDetail>(`/payroll/weeks/${weekId}`),
    enabled: !!weekId,
  });

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

  // Edit mode: wait for week to load before rendering any step
  if (weekId && weekLoading) return <LoadingSpinner />;

  // Edit mode: if the week is already submitted, redirect to the detail page.
  // Submitted weeks must be amended (on the detail page) before editing.
  if (weekId && weekData?.week.isFinal) {
    return <Navigate to={`/projects/${projectId}/payroll/${weekId}`} replace />;
  }

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
    const entryCount = weekData?.entries.length ?? step1?.roster.filter((r) => r.included).length ?? 0;
    return (
      <div className="text-sm text-gray-500">
        Step 2 — hours grid (wired in later tasks). Week: {state.weekId}. Workers: {entryCount}.
      </div>
    );
  }

  return <div className="text-sm text-gray-500">Step 3 — review (wired in later tasks)</div>;
}
