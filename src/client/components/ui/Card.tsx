import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  padding?: 'default' | 'sm' | 'none';
  className?: string;
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  default: 'p-6',
  sm: 'p-4',
  none: 'p-0',
};

export function Card({ children, padding = 'default', className }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-card rounded-card shadow-card border border-border-default',
        PADDING_CLASSES[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
