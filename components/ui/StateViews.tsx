import { RotateCw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/utils';

/**
 * Shared loading / empty / error presentations.
 *
 * Centralised so every surface in the app fails and empties the same way,
 * rather than each screen inventing its own.
 */

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-10 text-center', className)}>
      <span
        aria-hidden
        className="mb-4 flex size-12 items-center justify-center rounded-full bg-ink-100 text-ink-500"
      >
        {icon}
      </span>
      <p className="text-[0.9375rem] font-medium text-ink-900">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-10 text-center', className)}>
      <span
        aria-hidden
        className="mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger"
      >
        <TriangleAlert className="size-5" />
      </span>
      <p className="text-[0.9375rem] font-medium text-ink-900">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-5">
          <RotateCw aria-hidden className="size-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/** Skeleton rows matching the shape of a conversation list item. */
export function ConversationSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="space-y-1 p-2" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <span className="size-11 shrink-0 animate-pulse rounded-full bg-ink-100" />
          <span className="min-w-0 flex-1 space-y-2">
            <span
              className="block h-3 animate-pulse rounded-full bg-ink-100"
              style={{ width: `${55 + ((index * 13) % 30)}%` }}
            />
            <span
              className="block h-2.5 animate-pulse rounded-full bg-ink-100/70"
              style={{ width: `${35 + ((index * 17) % 45)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Skeleton bubbles alternating sides, matching the message list rhythm. */
export function MessageSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4 py-6 sm:px-6" aria-hidden>
      {Array.from({ length: count }, (_, index) => {
        const isOwn = index % 3 === 0;
        return (
          <div key={index} className={cx('flex', isOwn ? 'justify-end' : 'justify-start')}>
            <span
              className="block h-10 animate-pulse rounded-bubble bg-ink-100"
              style={{ width: `${40 + ((index * 19) % 40)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
