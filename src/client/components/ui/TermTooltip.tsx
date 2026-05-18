import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TermTooltipProps {
  term: string;
  definition: string;
  className?: string;
}

export function TermTooltip({ term, definition, className }: TermTooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <span ref={containerRef} className={cn('relative inline-flex items-baseline gap-0.5', className)}>
      {term}
      <button
        type="button"
        aria-label={`Definition of ${term}`}
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="-my-2 inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:text-brand-gold focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 mb-1 z-50 max-w-xs bg-nav-dark text-white text-xs leading-relaxed p-3 rounded-sm shadow-card"
        >
          {definition}
        </span>
      )}
    </span>
  );
}
