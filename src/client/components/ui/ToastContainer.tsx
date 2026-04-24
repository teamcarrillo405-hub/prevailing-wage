import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToast, type ToastVariant } from '../../contexts/ToastContext';

const VARIANT_STYLES: Record<ToastVariant, { bar: string; icon: string; IconComp: React.ElementType }> = {
  success: { bar: 'bg-status-compliant', icon: 'text-status-compliant', IconComp: CheckCircle },
  error:   { bar: 'bg-status-violation', icon: 'text-status-violation', IconComp: XCircle },
  info:    { bar: 'bg-brand-gold',       icon: 'text-brand-gold',       IconComp: Info },
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
    >
      {toasts.map(toast => {
        const { bar, icon, IconComp } = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            role="alert"
            className={`${toast.exiting ? 'toast-exit' : 'toast-enter'} flex items-start gap-3 bg-surface-card border border-border-default rounded-card shadow-card-elevated px-4 py-3 overflow-hidden relative`}
          >
            {/* Left accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar} rounded-l-card`} aria-hidden="true" />

            <IconComp className={`w-4 h-4 mt-0.5 flex-shrink-0 ${icon}`} aria-hidden="true" />

            <p className="text-sm text-text-primary flex-1 leading-snug">{toast.message}</p>

            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="flex-shrink-0 text-text-secondary hover:text-text-primary transition-colors ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
