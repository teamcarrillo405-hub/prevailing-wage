import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, CalendarCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DueSoonItem {
  weekId: string;
  projectId: string;
  projectName: string;
  weekEndingDate: string;
  payrollNumber: number;
  status: 'overdue' | 'due-today' | 'due-soon';
  daysUntil: number;
}

async function fetchDueSoon(): Promise<DueSoonItem[]> {
  const res = await fetch('/api/payroll/due-soon', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load due-soon data');
  return res.json();
}

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  return `due in ${days}d`;
}

export function DueSoonPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['payroll-due-soon'],
    queryFn: fetchDueSoon,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 mb-6 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-9 bg-gray-100 rounded" />)}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const overdue = data.filter((d) => d.status === 'overdue');
  const upcoming = data.filter((d) => d.status !== 'overdue');

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="size-4 text-amber-600 shrink-0" />
        <h3 className="text-sm font-semibold text-amber-900">
          Payroll Action Needed
          <span className="ml-2 text-xs font-normal text-amber-700">
            {data.length} week{data.length !== 1 ? 's' : ''} pending
          </span>
        </h3>
      </div>

      <div className="space-y-1.5">
        {overdue.length > 0 && (
          <>
            <div className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Overdue</div>
            {overdue.map((item) => <DueSoonRow key={item.weekId} item={item} />)}
          </>
        )}
        {upcoming.length > 0 && (
          <>
            {overdue.length > 0 && <div className="pt-1" />}
            <div className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Due This Week</div>
            {upcoming.map((item) => <DueSoonRow key={item.weekId} item={item} />)}
          </>
        )}
      </div>
    </div>
  );
}

function DueSoonRow({ item }: { item: DueSoonItem }) {
  const isOverdue = item.status === 'overdue';
  const isToday = item.status === 'due-today';

  return (
    <Link
      to={`/projects/${item.projectId}/payroll`}
      className={cn(
        'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
        'hover:bg-white/80',
        isOverdue ? 'bg-red-50 border border-red-200' : 'bg-white border border-amber-200',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isOverdue
          ? <AlertCircle className="size-3.5 text-red-500 shrink-0" />
          : isToday
            ? <CalendarCheck className="size-3.5 text-amber-600 shrink-0" />
            : <Clock className="size-3.5 text-amber-500 shrink-0" />
        }
        <span className="truncate font-medium text-gray-900">{item.projectName}</span>
        <span className="text-gray-400 shrink-0">·</span>
        <span className="text-gray-500 shrink-0">Week #{item.payrollNumber}</span>
      </div>
      <span className={cn(
        'text-xs font-medium shrink-0 ml-3',
        isOverdue ? 'text-red-600' : isToday ? 'text-amber-700' : 'text-amber-600',
      )}>
        {daysLabel(item.daysUntil)}
      </span>
    </Link>
  );
}
