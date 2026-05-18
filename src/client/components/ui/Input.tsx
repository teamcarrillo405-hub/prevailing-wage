import React, { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

// ── Shared field wrapper ──────────────────────────────────────────────────

interface FieldWrapperProps {
  label?: string;
  error?: string;
  help?: string;
  required?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

function FieldWrapper({ label, error, help, required, id, className, children }: FieldWrapperProps) {
  const errorId = id ? `${id}-error` : undefined;
  const helpId = id ? `${id}-help` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p id={errorId} className="text-xs text-red-600">{error}</p>}
      {help && !error && <p id={helpId} className="text-xs text-gray-500">{help}</p>}
    </div>
  );
}

// ── <Input> ───────────────────────────────────────────────────────────────

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  help?: string;
  fieldClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, help, required, id, className, fieldClassName, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? (label ? generatedId : undefined);

  return (
    <FieldWrapper
      label={label}
      error={error}
      help={help}
      required={required}
      id={inputId}
      className={fieldClassName}
    >
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && inputId ? `${inputId}-error` : help && inputId ? `${inputId}-help` : undefined}
        className={cn(
          'min-h-11 px-3 py-2 text-sm rounded-sm border bg-white',
          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
          error
            ? 'border-red-500 focus-visible:ring-red-500'
            : 'border-gray-300 hover:border-gray-400',
          className,
        )}
        {...props}
      />
    </FieldWrapper>
  );
});

// ── <Textarea> ────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  help?: string;
  fieldClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, help, required, id, className, fieldClassName, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? (label ? generatedId : undefined);

  return (
    <FieldWrapper
      label={label}
      error={error}
      help={help}
      required={required}
      id={textareaId}
      className={fieldClassName}
    >
      <textarea
        ref={ref}
        id={textareaId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && textareaId ? `${textareaId}-error` : help && textareaId ? `${textareaId}-help` : undefined}
        className={cn(
          'min-h-28 px-3 py-2 text-sm rounded-sm border bg-white',
          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
          error
            ? 'border-red-500 focus-visible:ring-red-500'
            : 'border-gray-300 hover:border-gray-400',
          className,
        )}
        {...props}
      />
    </FieldWrapper>
  );
});

// ── <Select> ──────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  help?: string;
  fieldClassName?: string;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, help, required, id, className, fieldClassName, options, placeholder, children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? (label ? generatedId : undefined);

  return (
    <FieldWrapper
      label={label}
      error={error}
      help={help}
      required={required}
      id={selectId}
      className={fieldClassName}
    >
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && selectId ? `${selectId}-error` : help && selectId ? `${selectId}-help` : undefined}
        className={cn(
          'min-h-11 px-3 py-2 text-sm rounded-sm border bg-white',
          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
          error
            ? 'border-red-500 focus-visible:ring-red-500'
            : 'border-gray-300 hover:border-gray-400',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        {children}
      </select>
    </FieldWrapper>
  );
});
