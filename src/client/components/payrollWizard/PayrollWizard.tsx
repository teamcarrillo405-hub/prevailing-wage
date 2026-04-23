// src/client/components/payrollWizard/PayrollWizard.tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useWizardState } from './useWizardState';
import { Step1Roster, type Step1Values, type RosterRow } from './Step1Roster';
import { Step2HoursGrid, type GridWorkerRow } from './Step2HoursGrid';
import type { RowValues } from './Step2GridRow';
import { Step3Review } from './Step3Review';
import { useEntryMutation } from './useEntryMutation';
import { api } from '../../lib/api';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { calculateCwhssaOt } from '../../../server/services/calculations.js';
import { DAYS } from './types';

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
      monDt: number; tueDt: number; wedDt: number; thuDt: number;
      friDt: number; satDt: number; sunDt: number;
      baseRateSnapshot: number;
      fringeRateSnapshot: number;
      deductions: number | null;
      fringeHealthWelfare: number | null;
      fringePension: number | null;
      fringeVacation: number | null;
      fringeTraining: number | null;
      nonPwHours: number | null;
      checkNumber: string | null;
      allOtherHours: number | null;
      totalWeekGrossWages: number | null;
      ficaTax: number | null;
      federalIncomeTax: number | null;
      stateIncomeTax: number | null;
    };
    workerName: string;
    tradeDescription: string;
  }>;
}

interface ProjectResponse {
  data: { project: { id: string; state: string } };
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

  // Fetch project state so the grid can render state-specific toggles (CA DT, NJ deductions, etc.)
  const { data: projectData } = useQuery<ProjectResponse>({
    queryKey: ['project', projectId],
    queryFn: () => api.get<ProjectResponse>(`/projects/${projectId}`),
  });
  const projectState = (projectData?.data?.project?.state ?? '').toUpperCase();

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

  // Mid-session lock: another tab submitted the week while this one was editing.
  if (state.locked) {
    return (
      <div className="p-6 rounded-sm border border-red-300 bg-red-50">
        <h3 className="text-sm font-semibold text-red-900 mb-2">Payroll week was submitted</h3>
        <p className="text-sm text-red-800 mb-3">
          Changes can't be saved. To make changes, go to the payroll detail page and use the amend flow.
        </p>
        <a
          href={`/projects/${projectId}/payroll/${state.weekId}`}
          className="text-sm font-semibold text-red-900 underline"
        >
          Open detail page →
        </a>
      </div>
    );
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
        projectState={projectState}
        onRowChange={(row) => {
          const computed = computeGrossNet(row);
          markDirty({
            workerId: row.workerId,
            classificationId: row.classificationId,
            values: row.values,
            baseRateSnapshot: row.baseRate,
            fringeRateSnapshot: row.fringeRate,
            deductions: row.deductions,
            grossWages: computed.grossWages,
            netPay: computed.netPay,
          });
        }}
        onReview={async () => {
          await flush();
          // Refetch the week so Step 3 sees the just-saved gross/net values.
          await qc.invalidateQueries({ queryKey: ['payroll-week', state.weekId] });
          dispatch({ type: 'ADVANCE' });
        }}
        onBack={() => dispatch({ type: 'GO_BACK' })}
      />
    );
  }

  if (state.step === 'review' && state.weekId) {
    return (
      <Step3Review
        projectId={projectId}
        weekId={state.weekId}
        onBack={() => dispatch({ type: 'GO_BACK' })}
      />
    );
  }

  return null;
}

function emptyRowValues(): RowValues {
  return {
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
    monDt: 0, tueDt: 0, wedDt: 0, thuDt: 0, friDt: 0, satDt: 0, sunDt: 0,
    fringeHealthWelfare: null, fringePension: null, fringeVacation: null, fringeTraining: null,
    nonPwHours: null,
    checkNumber: null, allOtherHours: null, totalWeekGrossWages: null,
    ficaTax: null, federalIncomeTax: null, stateIncomeTax: null,
  };
}

// Client-side CWHSSA gross + net computation. Mirrors what the server would compute
// if it had the rate data — needed because server currently stores grossWages/netPay
// unchanged from client input. Phase 64 will move computation server-side.
function computeGrossNet(row: GridWorkerRow): { grossWages: number; netPay: number } {
  const v = row.values;
  const totalSt = DAYS.reduce((s, d) => s + (v[`${d}St` as keyof typeof v] as number || 0), 0);
  const totalOt = DAYS.reduce((s, d) => s + (v[`${d}Ot` as keyof typeof v] as number || 0), 0);
  const totalDt = DAYS.reduce((s, d) => s + (v[`${d}Dt` as keyof typeof v] as number || 0), 0);
  const totalHoursWorked = totalSt + totalOt + totalDt;
  const result = calculateCwhssaOt({
    baseRate: row.baseRate,
    fringeRate: row.fringeRate,
    totalHoursWorked,
    overtimeHours: totalOt + totalDt,
  });
  const grossWages = parseFloat(result.totalWeeklyCost.toFixed(2));
  const netPay = parseFloat((grossWages - (row.deductions || 0)).toFixed(2));
  return { grossWages, netPay };
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
      deductions: e.entry.deductions ?? 0,
      values: {
        monSt: e.entry.monSt, tueSt: e.entry.tueSt, wedSt: e.entry.wedSt, thuSt: e.entry.thuSt,
        friSt: e.entry.friSt, satSt: e.entry.satSt, sunSt: e.entry.sunSt,
        monOt: e.entry.monOt, tueOt: e.entry.tueOt, wedOt: e.entry.wedOt, thuOt: e.entry.thuOt,
        friOt: e.entry.friOt, satOt: e.entry.satOt, sunOt: e.entry.sunOt,
        monDt: e.entry.monDt ?? 0, tueDt: e.entry.tueDt ?? 0, wedDt: e.entry.wedDt ?? 0,
        thuDt: e.entry.thuDt ?? 0, friDt: e.entry.friDt ?? 0, satDt: e.entry.satDt ?? 0,
        sunDt: e.entry.sunDt ?? 0,
        fringeHealthWelfare: e.entry.fringeHealthWelfare,
        fringePension: e.entry.fringePension,
        fringeVacation: e.entry.fringeVacation,
        fringeTraining: e.entry.fringeTraining,
        nonPwHours: e.entry.nonPwHours,
        checkNumber: e.entry.checkNumber,
        allOtherHours: e.entry.allOtherHours,
        totalWeekGrossWages: e.entry.totalWeekGrossWages,
        ficaTax: e.entry.ficaTax,
        federalIncomeTax: e.entry.federalIncomeTax,
        stateIncomeTax: e.entry.stateIncomeTax,
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
        deductions: 0,
        values: emptyRowValues(),
      }));
  }
  return [];
}
