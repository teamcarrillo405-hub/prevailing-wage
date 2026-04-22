// src/client/components/payrollWizard/PayrollWizard.tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useWizardState } from './useWizardState';
import { Step1Roster, type Step1Values, type RosterRow } from './Step1Roster';
import { Step2HoursGrid, type GridWorkerRow } from './Step2HoursGrid';
import type { RowValues } from './Step2GridRow';
import { useEntryMutation } from './useEntryMutation';
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

  const { markDirty, flush } = useEntryMutation(state.weekId, () => dispatch({ type: 'LOCK' }));

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
    const gridRows = buildGridRows(step1, weekData);
    return (
      <Step2HoursGrid
        initialRows={gridRows}
        onRowChange={(row) => {
          markDirty({
            workerId: row.workerId,
            classificationId: row.classificationId,
            values: row.values,
            baseRateSnapshot: row.baseRate,
            fringeRateSnapshot: row.fringeRate,
            deductions: 0,
          });
        }}
        onReview={async () => {
          await flush();
          dispatch({ type: 'ADVANCE' });
        }}
        onBack={() => dispatch({ type: 'GO_BACK' })}
      />
    );
  }

  return <div className="text-sm text-gray-500">Step 3 — review (wired in later tasks)</div>;
}

function emptyRowValues(): RowValues {
  return {
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}

function buildGridRows(step1: Step1Values | null, weekData: WeekDetail | undefined): GridWorkerRow[] {
  // Edit mode: derive rows from existing entries
  if (weekData) {
    return weekData.entries.map((e) => ({
      workerId: e.entry.workerId,
      classificationId: e.entry.classificationId,
      workerName: e.workerName,
      tradeDescription: e.tradeDescription,
      baseRate: e.entry.baseRateSnapshot,
      fringeRate: e.entry.fringeRateSnapshot,
      values: {
        monSt: e.entry.monSt, tueSt: e.entry.tueSt, wedSt: e.entry.wedSt, thuSt: e.entry.thuSt,
        friSt: e.entry.friSt, satSt: e.entry.satSt, sunSt: e.entry.sunSt,
        monOt: e.entry.monOt, tueOt: e.entry.tueOt, wedOt: e.entry.wedOt, thuOt: e.entry.thuOt,
        friOt: e.entry.friOt, satOt: e.entry.satOt, sunOt: e.entry.sunOt,
      },
    }));
  }
  // Create mode: derive from Step 1 roster (included workers only)
  if (step1) {
    return step1.roster
      .filter((r: RosterRow) => r.included)
      .map((r) => ({
        workerId: r.workerId,
        classificationId: r.classificationId,
        workerName: r.workerName,
        tradeDescription: r.tradeDescription,
        baseRate: r.baseRate,
        fringeRate: r.fringeRate,
        values: emptyRowValues(),
      }));
  }
  return [];
}
