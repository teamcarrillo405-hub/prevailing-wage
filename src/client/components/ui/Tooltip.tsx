// src/client/components/ui/Tooltip.tsx
// Generic tooltip component — CSS hover on desktop, tap-toggle on mobile.
// For inline term definitions in forms, use TermTooltip instead.
import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TooltipProps {
  content: string;
  /** Label for the trigger button (used for screen readers). Defaults to "Help". */
  label?: string;
  className?: string;
  /** Where the tooltip box appears relative to the trigger. Defaults to "top". */
  placement?: 'top' | 'bottom';
}

/**
 * Tooltip — shows a styled dark tooltip box on hover (desktop) or tap (mobile).
 * Renders a small ? icon button as the trigger.
 *
 * Usage:
 *   <label>Wage Determination <Tooltip content="A DOL document specifying..." /></label>
 */
export function Tooltip({ content, label = 'Help', className, placement = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const tooltipPositionClass =
    placement === 'bottom'
      ? 'top-full mt-1'
      : 'bottom-full mb-1';

  return (
    <span ref={containerRef} className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-colors duration-150 hover:text-brand-gold focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={cn(
            'absolute left-0 z-50 w-64 max-w-xs bg-nav-dark text-white text-xs leading-relaxed p-3 rounded-lg shadow-lg pointer-events-none',
            tooltipPositionClass,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
