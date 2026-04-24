import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  exiting?: boolean;
}

interface ToastContextValue {
  toasts: ToastItem[];
  add: (variant: ToastVariant, message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4000;
const EXIT_MS = 160;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, EXIT_MS);
  }, []);

  const add = useCallback((variant: ToastVariant, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, variant, message }]);
    const timer = setTimeout(() => dismiss(id), DURATION_MS);
    timers.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toasts, add, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return {
    toast: {
      success: (message: string) => ctx.add('success', message),
      error:   (message: string) => ctx.add('error',   message),
      info:    (message: string) => ctx.add('info',    message),
    },
    dismiss: ctx.dismiss,
    toasts: ctx.toasts,
  };
}
