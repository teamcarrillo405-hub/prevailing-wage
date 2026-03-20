import React from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  heading: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ heading, message, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-16', className)}>
      <p className="font-headline text-lg text-text-primary mb-2">{heading}</p>
      <p className="text-sm text-text-secondary mb-6">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
