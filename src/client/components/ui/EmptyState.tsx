import React from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  illustration?: React.ReactNode;
  heading: string;
  message: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export function EmptyState({ illustration, heading, message, action, className, icon }: EmptyStateProps) {
  const Icon = icon;
  return (
    <div
      className={cn(
        'flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-5 py-12 text-center',
        className,
      )}
    >
      {illustration && <div className="mb-4">{illustration}</div>}
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-gray-50 text-gray-400 ring-1 ring-gray-200">
          <Icon size={28} className="text-gray-400" />
        </span>
      )}
      <p className="font-headline text-lg text-gray-950">{heading}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">{message}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
