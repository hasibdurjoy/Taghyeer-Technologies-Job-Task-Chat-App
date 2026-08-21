'use client';

import { CircleAlert, Clock, RotateCw } from 'lucide-react';
import { memo } from 'react';

import { formatFullTimestamp, formatMessageTime } from '@/lib/format';
import { cx } from '@/lib/utils';
import type { Message } from '@/types/chat';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  /** Sender label, shown once per run of messages in group conversations. */
  senderName: string | null;
  isGroupedWithPrevious: boolean;
  onRetry: (clientId: string) => void;
}

/**
 * A single message.
 *
 * Own messages sit right in ink; incoming messages sit left on white with a hairline
 * border. Purely presentational and memoised — a new message arriving must not
 * re-render the entire history.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  senderName,
  isGroupedWithPrevious,
  onRetry,
}: MessageBubbleProps) {
  const isFailed = message.status === 'failed';
  const isSending = message.status === 'sending';

  return (
    <div
      className={cx(
        'flex flex-col',
        isOwn ? 'items-end' : 'items-start',
        isGroupedWithPrevious ? 'mt-0.5' : 'mt-3',
      )}
    >
      {senderName && (
        <span className="mb-1 pl-3 text-xs font-medium text-ink-500">{senderName}</span>
      )}

      <div
        className={cx(
          'group max-w-[85%] px-3.5 py-2 sm:max-w-[75%]',
          'rounded-bubble',
          isOwn
            ? 'bg-ink-900 text-white'
            : 'bg-surface text-ink-900 ring-1 ring-inset ring-ink-100',
          // Tuck the tail corner in on the first message of a run.
          isOwn && !isGroupedWithPrevious && 'rounded-tr-md',
          !isOwn && !isGroupedWithPrevious && 'rounded-tl-md',
          isFailed && 'ring-1 ring-danger',
          isSending && 'opacity-70',
        )}
      >
        {/* `break-words` keeps long unbroken strings (URLs) inside the bubble;
            `whitespace-pre-wrap` preserves the newlines typed with Shift+Enter. */}
        <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">
          {message.text}
        </p>

        <div
          className={cx(
            'mt-1 flex items-center justify-end gap-1',
            isOwn ? 'text-white/55' : 'text-ink-400',
          )}
        >
          {isSending && <Clock aria-hidden className="size-3" />}
          {isFailed && <CircleAlert aria-hidden className="size-3 text-danger" />}
          <time
            dateTime={message.createdAt}
            title={formatFullTimestamp(message.createdAt)}
            className="text-[0.6875rem] tabular-nums"
          >
            {isSending ? 'Sending…' : formatMessageTime(message.createdAt)}
          </time>
        </div>
      </div>

      {isFailed && message.clientId && (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-danger">Not delivered</span>
          <button
            type="button"
            onClick={() => onRetry(message.clientId as string)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-ink-700 transition-colors hover:bg-ink-100"
          >
            <RotateCw aria-hidden className="size-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
});
