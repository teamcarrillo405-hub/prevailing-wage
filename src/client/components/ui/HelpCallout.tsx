import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

interface HelpCalloutProps {
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
  className?: string;
}

export function HelpCallout({ icon: Icon, title, body, className }: HelpCalloutProps) {
  return (
    <div
      className={cn(
        'bg-surface-card rounded-card shadow-card border border-border-default border-l-4 border-l-brand-gold',
        'p-4 flex gap-3 items-start mb-4',
        className
      )}
    >
      <Icon className="w-4 h-4 text-brand-gold flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-body text-sm font-bold text-text-primary">{title}</p>
        <p className="font-body text-sm text-text-secondary leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
