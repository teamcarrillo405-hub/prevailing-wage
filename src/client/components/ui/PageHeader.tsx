import React from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-headline text-2xl leading-tight text-gray-950 sm:text-3xl">{title}</h1>
        {subtitle && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{action}</div>
      )}
    </header>
  );
}
