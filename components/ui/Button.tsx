import { Loader2 } from 'lucide-react';

import { cx } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-300 disabled:text-white/80',
  secondary:
    'bg-surface text-ink-900 ring-1 ring-inset ring-ink-200 hover:bg-paper-dim active:bg-ink-100 disabled:text-ink-300',
  ghost: 'text-ink-700 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-300',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95 disabled:bg-ink-300',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[0.9375rem] gap-2',
  lg: 'h-13 px-7 text-base gap-2.5',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      // A button showing a spinner must not accept a second click.
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cx(
        'inline-flex items-center justify-center rounded-full font-medium',
        'transition-[background-color,color,box-shadow,transform] duration-150',
        'active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {isLoading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
