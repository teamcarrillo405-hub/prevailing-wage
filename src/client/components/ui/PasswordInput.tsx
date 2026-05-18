import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: string;
  error?: string;
  help?: string;
  fieldClassName?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, error, help, required, id, className, fieldClassName, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const errorId = id ? `${id}-error` : undefined;
  const helpId = id ? `${id}-help` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', fieldClassName)}>
      <label htmlFor={id} className="text-xs font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          required={required}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : help ? helpId : undefined}
          className={cn(
            'min-h-11 w-full rounded-sm border bg-white py-2 pl-3 pr-12 text-sm',
            'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50',
            error ? 'border-red-500 focus-visible:ring-red-500' : 'border-gray-300 hover:border-gray-400',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-r-sm text-gray-500 hover:text-gray-950 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={errorId} className="text-xs text-red-600">{error}</p>}
      {help && !error && <p id={helpId} className="text-xs text-gray-500">{help}</p>}
    </div>
  );
});
