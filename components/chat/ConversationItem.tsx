'use client';

import { Users } from 'lucide-react';
import { memo } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { formatRelativeTimestamp } from '@/lib/format';
import { cx } from '@/lib/utils';
import type { Conversation } from '@/types/chat';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  unreadCount: number;
  onSelect: (conversationId: string) => void;
}

/**
 * A single row in the conversation list.
 *
 * Memoised because a realtime message re-renders the list on every arrival, and
 * only the affected row's props actually change.
 */
export const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  unreadCount,
  onSelect,
}: ConversationItemProps) {
  const { lastMessage, type, title, participants } = conversation;
  const isGroup = type === 'group';
  const hasUnread = unreadCount > 0;

  const preview = lastMessage?.text.trim()
    ? lastMessage.text
    : lastMessage
      ? 'Message'
      : 'No messages yet';

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        aria-current={isActive ? 'true' : undefined}
        className={cx(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
          isActive ? 'bg-ink-900 text-white' : 'hover:bg-paper-dim active:bg-ink-100',
        )}
      >
        <Avatar name={title} seed={isGroup ? conversation.id : (participants[0]?.id ?? title)} isGroup={isGroup} />

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cx(
                'truncate text-[0.9375rem] leading-tight',
                hasUnread && !isActive ? 'font-semibold text-ink-950' : 'font-medium',
                isActive && 'text-white',
              )}
            >
              {title}
            </span>
            {lastMessage && (
              <time
                dateTime={lastMessage.createdAt}
                className={cx(
                  'shrink-0 text-xs tabular-nums',
                  isActive ? 'text-white/60' : hasUnread ? 'text-accent-deep' : 'text-ink-400',
                )}
              >
                {formatRelativeTimestamp(lastMessage.createdAt)}
              </time>
            )}
          </span>

          <span className="mt-1 flex items-center gap-1.5">
            {isGroup && (
              <Users
                aria-hidden
                className={cx('size-3.5 shrink-0', isActive ? 'text-white/60' : 'text-ink-400')}
              />
            )}
            <span
              className={cx(
                'truncate text-sm',
                isActive
                  ? 'text-white/70'
                  : hasUnread
                    ? 'font-medium text-ink-700'
                    : 'text-ink-500',
                !lastMessage && 'italic',
              )}
            >
              {preview}
            </span>

            {hasUnread && !isActive && (
              <span
                className="ml-auto shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.6875rem] font-semibold leading-none text-white tabular-nums"
                aria-label={`${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
});
