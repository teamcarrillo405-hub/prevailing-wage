// src/client/components/payrollWizard/Step1Roster.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';

export interface RosterRow {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  fringeRate: number;
  included: boolean;
}

export interface Step1Values {
  weekEndingDate: string;
  payrollNumber: number;
  roster: RosterRow[];
}

interface Props {
  projectId: string;
  defaultPayrollNumber: number;
  defaultWeekEndingDate: string;
  onNext: (v: Step1Values) => void;
}

interface WorkerClassification {
  id: string;
  workerId: string;
  tradeDescription: string;
  baseRate?: number;
  fringeRate?: number;
}
interface Worker {
  id: string;
  name: string;
  classifications: WorkerClassification[];
}
interface WorkersResponse { data: { workers: Worker[] } }
interface WeeksResponse { weeks: Array<{ id: string; payrollNumber: number; weekEndingDate: string }> }
interface WeekDetailResponse {
  week: { id: string };
  entries: Array<{ entry: { workerId: string; classificationId: string } }>;
}

export function Step1Roster({ projectId, defaultPayrollNumber, defaultWeekEndingDate, onNext }: Props) {
  const [weekEndingDate, setWeekEndingDate] = useState(defaultWeekEndingDate);
  const [payrollNumber, setPayrollNumber] = useState(defaultPayrollNumber);
  const [roster, setRoster] = useState<RosterRow[]>([]);

  const { data: workersData, isLoading: wLoading } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: () => api.get<WorkersResponse>(`/projects/${projectId}/workers`),
  });

  const { data: weeksData, isLoading: weeksLoading } = useQuery({
    queryKey: ['payroll-weeks-list', projectId],
    queryFn: () => api.get<WeeksResponse>(`/payroll/projects/${projectId}/weeks`),
  });

  const mostRecentWeekId = weeksData?.weeks?.[0]?.id ?? null;

  const { data: lastWeek, isLoading: lastLoading } = useQuery({
    queryKey: ['payroll-week', mostRecentWeekId],
    queryFn: () => api.get<WeekDetailResponse>(`/payroll/weeks/${mostRecentWeekId}`),
    enabled: !!mostRecentWeekId,
  });

  // Sync roster from source data once both queries settle
  useEffect(() => {
    if (wLoading || weeksLoading) return;
    if (mostRecentWeekId && lastLoading) return;
    const prevKeys = new Set(
      (lastWeek?.entries ?? []).map((e) => `${e.entry.workerId}::${e.entry.classificationId}`)
    );
    const rows: RosterRow[] = [];
    for (const w of workersData?.data?.workers ?? []) {
      for (const c of w.classifications ?? []) {
        rows.push({
          workerId: w.id,
          classificationId: c.id,
          workerName: w.name,
          tradeDescription: c.tradeDescription,
          baseRate: c.baseRate ?? 0,
          fringeRate: c.fringeRate ?? 0,
          included: mostRecentWeekId ? prevKeys.has(`${w.id}::${c.id}`) : false,
        });
      }
    }
    setRoster(rows);
  }, [wLoading, weeksLoading, lastLoading, mostRecentWeekId, workersData, lastWeek]);

  const canAdvance =
    weekEndingDate.length > 0 &&
    payrollNumber >= 1 &&
    roster.some((r) => r.included);

  function toggle(workerId: string, classificationId: string) {
    setRoster((rs) =>
      rs.map((r) =>
        r.workerId === workerId && r.classificationId === classificationId
          ? { ...r, included: !r.included }
          : r
      )
    );
  }

  if (wLoading || weeksLoading || (mostRecentWeekId && lastLoading)) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Input
          label="Week ending"
          type="date"
          value={weekEndingDate}
          onChange={(e) => setWeekEndingDate(e.target.value)}
        />
        <Input
          label="Payroll #"
          type="number"
          min={1}
          value={payrollNumber}
          onChange={(e) => setPayrollNumber(Number(e.target.value))}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Who worked this week?</h3>
        {roster.length === 0 ? (
          <p className="text-sm text-gray-500">
            No workers on this project yet.{' '}
            <Link
              to={`/projects/${projectId}/workers`}
              className="text-brand-gold hover:underline"
            >
              Add workers →
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-sm max-w-2xl">
            {roster.map((r) => (
              <li
                key={`${r.workerId}::${r.classificationId}`}
                className="px-4 py-2 flex items-center gap-3"
              >
                <input
                  type="checkbox"
                  checked={r.included}
                  onChange={() => toggle(r.workerId, r.classificationId)}
                  className="h-5 w-5"
                />
                <span className="flex-1 text-sm">{r.workerName}</span>
                <span className="text-xs text-gray-500">{r.tradeDescription}</span>
                <span className="text-xs text-gray-700 w-16 text-right">
                  ${r.baseRate.toFixed(2)}/hr
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!canAdvance}
          onClick={() => onNext({ weekEndingDate, payrollNumber, roster })}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
