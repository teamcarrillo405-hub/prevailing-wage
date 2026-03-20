import React from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'compliant' | 'violation' | 'warning' | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

// IMPORTANT: 'neutral' uses built-in Tailwind bg-gray-100/text-gray-600.
// --color-status-neutral does NOT exist in @theme — never use bg-status-neutral.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  compliant: 'bg-status-compliant/10 text-status-compliant border border-status-compliant/30',
  violation: 'bg-status-violation/10 text-status-violation border border-status-violation/30',
  warning: 'bg-status-warning/10 text-status-warning border border-status-warning/30',
  neutral: 'bg-gray-100 text-gray-600 border border-gray-300',
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block text-xs font-medium px-2 py-0.5 rounded-sm',
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
