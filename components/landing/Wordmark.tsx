import { cx } from '@/lib/utils';

/**
 * The product mark: two overlapping speech shapes, drawn inline so it stays
 * crisp at any size and needs no image request.
 */
export function Wordmark({ className, isOnDark = false }: { className?: string; isOnDark?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 28 28"
        aria-hidden
        className={cx('size-7 shrink-0', isOnDark ? 'text-white' : 'text-ink-950')}
      >
        <path
          d="M4 9.5A5.5 5.5 0 0 1 9.5 4h6A5.5 5.5 0 0 1 21 9.5v2A5.5 5.5 0 0 1 15.5 17H11l-4.6 3.9A.6.6 0 0 1 5.4 20.4L6 17h-.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="19.5" cy="18.5" r="4.5" fill="var(--color-accent)" />
      </svg>
      <span
        className={cx(
          'font-display text-[1.35rem] leading-none tracking-tight',
          isOnDark ? 'text-white' : 'text-ink-950',
        )}
      >
        Parley
      </span>
    </span>
  );
}
