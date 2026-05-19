import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, CalendarCheck, ChevronRight, CheckCircle } from 'lucide-react';
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

type Urgency = 'error' | 'warning' | 'muted';

function getUrgency(daysUntil: number): Urgency {
  if (daysUntil <= 1) return 'error';
  if (daysUntil <= 3) return 'warning';
  return 'muted';
}

function getRelativeLabel(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil === 0) return 'Due today';
  if (daysUntil === 1) return 'Due tomorrow';
  return `Due in ${daysUntil} days`;
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

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-green-400">All payroll is current</p>
          <p className="text-xs text-surface-muted mt-0.5">No deadlines due this week.</p>
        </div>
      </div>
    );
  }

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
  const urgency = getUrgency(item.daysUntil);
  const isOverdue = item.status === 'overdue';
  const isToday = item.status === 'due-today';

  return (
    <Link
      to={`/projects/${item.projectId}/payroll/${item.weekId}`}
      aria-label={`Open payroll week ${item.payrollNumber} for ${item.projectName}, ${getRelativeLabel(item.daysUntil)}`}
      title={`Open payroll week ${item.payrollNumber} for ${item.projectName}`}
      className={cn(
        'group flex min-h-11 items-center justify-between rounded-lg px-3.5 py-2.5 text-sm transition-all duration-150',
        'hover:shadow-sm',
        urgency === 'error'
          ? 'bg-red-500/10 border border-red-500/20 hover:border-red-500/40'
          : urgency === 'warning'
            ? 'bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40'
            : 'bg-surface-card border border-gray-100 hover:border-amber-200',
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
          urgency === 'error' ? 'text-red-400' : urgency === 'warning' ? 'text-amber-400' : 'text-surface-muted',
        )}>
          {getRelativeLabel(item.daysUntil)}
        </span>
        <ChevronRight className="size-3.5 text-gray-300 group-hover:text-gray-400 transition-colors" aria-hidden="true" />
      </div>
    </Link>
  );
}
