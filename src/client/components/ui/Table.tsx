import React from 'react';
import { cn } from '../../lib/utils';

// Generic table primitives that codify the app's table styling in one place.
// Replaces the hardcoded Tailwind class soup scattered across ReportsPage,
// PayrollWeekDetailPage, WorkersPage, etc.

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-sm">
      <table className={cn('min-w-full text-sm', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-gray-50 border-b border-gray-200', className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-gray-100', className)} {...props} />;
}

export function TFoot({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn('bg-gray-50 border-t border-gray-200 font-semibold', className)} {...props} />;
}

interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  striped?: boolean;
}
export function Tr({ className, striped, ...props }: TrProps) {
  return <tr className={cn(striped && 'odd:bg-white even:bg-gray-50', 'hover:bg-gray-50', className)} {...props} />;
}

interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
}
export function Th({ className, align = 'left', ...props }: ThProps) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600',
        align === 'right'  && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  );
}

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
}
export function Td({ className, align, numeric, ...props }: TdProps) {
  const computedAlign = align ?? (numeric ? 'right' : 'left');
  return (
    <td
      className={cn(
        'px-3 py-2 text-gray-900',
        computedAlign === 'right'  && 'text-right',
        computedAlign === 'center' && 'text-center',
        numeric && 'tabular-nums',
        className,
      )}
      {...props}
    />
  );
}
