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
        'mb-5 flex items-start gap-3 rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-4',
        className
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-black ring-1 ring-brand-gold/50">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="font-body text-sm font-bold text-gray-950">{title}</p>
        <p className="mt-1 font-body text-sm leading-6 text-gray-700">{body}</p>
      </div>
    </div>
  );
}
