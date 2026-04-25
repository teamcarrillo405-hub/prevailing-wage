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
    <div className={cn('text-center py-16', className)}>
      {illustration}
      {Icon && <Icon size={40} className="mx-auto mb-4 text-gray-300" />}
      <p className="font-headline text-lg text-text-primary mb-2">{heading}</p>
      <p className="text-sm text-text-secondary mb-6">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
