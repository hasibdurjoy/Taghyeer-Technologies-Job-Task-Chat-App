import { useId } from 'react';

import { cx } from '@/lib/utils';

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Renders the label for screen readers only — for compact surfaces like search. */
  hideLabel?: boolean;
  leadingIcon?: React.ReactNode;
}

/** Labelled text input with inline validation messaging wired up for assistive tech. */
export function TextField({
  label,
  hint,
  error,
  hideLabel = false,
  leadingIcon,
  className,
  ...props
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className={cx(
          'mb-1.5 block text-sm font-medium text-ink-700',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>

      <div className="relative">
        {leadingIcon && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          >
            {leadingIcon}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(error ? errorId : undefined, hint ? hintId : undefined) || undefined}
          className={cx(
            'h-11 w-full rounded-xl bg-surface px-3.5 text-[0.9375rem] text-ink-900',
            'ring-1 ring-inset transition-shadow placeholder:text-ink-400',
            'focus:outline-none focus:ring-2',
            Boolean(leadingIcon) && 'pl-10',
            error
              ? 'ring-danger focus:ring-danger'
              : 'ring-ink-200 focus:ring-ink-900',
            className,
          )}
          {...props}
        />
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="mt-1.5 text-sm text-ink-400">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
