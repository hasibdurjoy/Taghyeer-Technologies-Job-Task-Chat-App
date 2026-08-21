'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/hooks/useAuth';
import { cx } from '@/lib/utils';

interface StartCtaProps {
  size?: 'md' | 'lg';
  /** `onDark` inverts the button for use on the ink-coloured CTA panel. */
  variant?: 'primary' | 'secondary' | 'onDark';
  className?: string;
}

const VARIANTS: Record<NonNullable<StartCtaProps['variant']>, string> = {
  primary:
    'bg-ink-900 text-white shadow-soft hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-lifted',
  secondary: 'bg-surface text-ink-900 ring-1 ring-inset ring-ink-200 hover:bg-paper-dim',
  onDark: 'bg-white text-ink-950 shadow-soft hover:-translate-y-0.5 hover:bg-white/90',
};

/**
 * Primary call to action.
 *
 * Points signed-in visitors straight at their conversations and everyone else at
 * sign-in, so the button never lands on a screen that immediately redirects.
 */
export function StartCta({ size = 'lg', variant = 'primary', className }: StartCtaProps) {
  const { user, isRestoring } = useAuth();
  const isSignedIn = Boolean(user);

  return (
    <Link
      href={isSignedIn ? '/chat' : '/login'}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all',
        'active:scale-[0.98]',
        size === 'lg' ? 'h-13 px-7 text-base' : 'h-11 px-5 text-[0.9375rem]',
        VARIANTS[variant],
        className,
      )}
    >
      {/* Avoid a label flash during session restore. */}
      {isRestoring ? 'Start messaging' : isSignedIn ? 'Open your messages' : 'Start messaging'}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}
