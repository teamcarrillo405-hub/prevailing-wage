import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, CalendarCheck, ChevronRight } from 'lucide-react';
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
  if (days === 0) return 'Due today';
  return `${days}d`;
}

export function DueSoonPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['payroll-due-soon'],
    queryFn: fetchDueSoon,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="mb-6 rounded-lg border border-amber-200/60 bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-40 bg-gray-100 rounded mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-gray-50" />)}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const overdue = data.filter((d) => d.status === 'overdue');
  const upcoming = data.filter((d) => d.status !== 'overdue');

  return (
    <div className="mb-6 rounded-lg border border-amber-200/80 bg-white p-5 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50">
            <AlertCircle className="size-4 text-amber-500" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Payroll Action Needed</h3>
          </div>
        </div>
        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
          {data.length} week{data.length !== 1 ? 's' : ''} pending
        </span>
      </div>

      <div className="space-y-1.5">
        {overdue.length > 0 && (
          <>
            <div className="text-[11px] font-semibold text-red-500 uppercase tracking-widest px-1 mb-1.5">
              Overdue
            </div>
            {overdue.map((item) => <DueSoonRow key={item.weekId} item={item} />)}
          </>
        )}
        {upcoming.length > 0 && (
          <>
            {overdue.length > 0 && <div className="pt-2" />}
            <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-widest px-1 mb-1.5">
              Due This Week
            </div>
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
      to={`/projects/${item.projectId}/payroll/${item.weekId}`}
      aria-label={`Open payroll week ${item.payrollNumber} for ${item.projectName}, ${daysLabel(item.daysUntil)}`}
      title={`Open payroll week ${item.payrollNumber} for ${item.projectName}`}
      className={cn(
        'group flex min-h-11 items-center justify-between rounded-lg px-3.5 py-2.5 text-sm transition-all duration-150',
        'hover:shadow-sm',
        isOverdue
          ? 'bg-red-50 border border-red-100 hover:border-red-200'
          : 'bg-gray-50 border border-gray-100 hover:border-amber-200 hover:bg-amber-50/40',
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isOverdue
          ? <AlertCircle className="size-3.5 text-red-500 shrink-0" aria-hidden="true" />
          : isToday
            ? <CalendarCheck className="size-3.5 text-amber-500 shrink-0" aria-hidden="true" />
            : <Clock className="size-3.5 text-amber-400 shrink-0" aria-hidden="true" />
        }
        <span className="font-medium text-gray-900 truncate">{item.projectName}</span>
        <span className="text-gray-300 shrink-0" aria-hidden="true">·</span>
        <span className="text-gray-500 shrink-0 text-xs">Week #{item.payrollNumber}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-3">
        <span className={cn(
          'text-xs font-semibold',
          isOverdue ? 'text-red-600' : isToday ? 'text-amber-600' : 'text-amber-500',
        )}>
          {daysLabel(item.daysUntil)}
        </span>
        <ChevronRight className="size-3.5 text-gray-300 group-hover:text-gray-400 transition-colors" aria-hidden="true" />
      </div>
    </Link>
  );
}
