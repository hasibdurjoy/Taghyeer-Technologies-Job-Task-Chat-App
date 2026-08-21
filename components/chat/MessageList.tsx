'use client';

import { ArrowDown, MessagesSquare } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingBubble } from '@/components/chat/TypingIndicator';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, MessageSkeleton } from '@/components/ui/StateViews';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { formatDateSeparator, isNewDay } from '@/lib/format';
import { cx } from '@/lib/utils';
import type { Conversation, Message, TypingUser } from '@/types/chat';

interface MessageListProps {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onReload: () => void;
  onLoadOlder: () => Promise<void>;
  onRetryMessage: (clientId: string) => void;
  /** Participants currently typing, shown as a bubble below the last message. */
  typingUsers: TypingUser[];
}

interface RenderRow {
  message: Message;
  isOwn: boolean;
  /** Date heading to render above this message, if the day changed. */
  daySeparator: string | null;
  /** Group chats label the sender once per run of consecutive messages. */
  showSenderName: boolean;
  /** Consecutive messages from one person are tucked closer together. */
  isGroupedWithPrevious: boolean;
}

export function MessageList({
  conversation,
  messages,
  currentUserId,
  isLoading,
  error,
  hasMore,
  isLoadingMore,
  onReload,
  onLoadOlder,
  onRetryMessage,
  typingUsers,
}: MessageListProps) {
  const { scrollRef, newMessageCount, isPinnedToBottom, scrollToBottom, handleScroll } =
    useAutoScroll({
      conversationId: conversation.id,
      messages,
      currentUserId,
      // The bubble adds height below the last message; auto-scroll needs to know
      // so a reader sitting at the bottom stays there when it appears.
      extraBottomContent: typingUsers.length > 0,
    });

  /**
   * Prepending older messages would otherwise push the reader's position down
   * the page. Measuring the distance from the *bottom* before the fetch and
   * restoring it afterwards keeps the message they were reading exactly where
   * it was.
   */
  const handleLoadOlder = useCallback(async () => {
    const container = scrollRef.current;
    const distanceFromBottom = container ? container.scrollHeight - container.scrollTop : 0;

    await onLoadOlder();

    requestAnimationFrame(() => {
      if (!container) return;
      container.scrollTop = container.scrollHeight - distanceFromBottom;
    });
  }, [onLoadOlder, scrollRef]);

  const senderNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const participant of conversation.participants) names.set(participant.id, participant.name);
    return names;
  }, [conversation.participants]);

  /**
   * Grouping and date separators are derived once per render rather than inside
   * the bubble, so each bubble stays a pure presentational component.
   */
  const rows = useMemo<RenderRow[]>(() => {
    return messages.map((message, index) => {
      const previous = index > 0 ? messages[index - 1] : null;
      const isOwn = message.senderId === currentUserId;
      const startsNewDay = isNewDay(previous?.createdAt ?? null, message.createdAt);

      const sameSenderAsPrevious = previous?.senderId === message.senderId;
      const withinGroupingWindow = previous
        ? new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 300_000
        : false;
      const isGroupedWithPrevious = Boolean(
        sameSenderAsPrevious && withinGroupingWindow && !startsNewDay,
      );

      return {
        message,
        isOwn,
        daySeparator: startsNewDay ? formatDateSeparator(message.createdAt) : null,
        showSenderName:
          conversation.type === 'group' && !isOwn && !isGroupedWithPrevious,
        isGroupedWithPrevious,
      };
    });
  }, [messages, currentUserId, conversation.type]);

  const showEmptyState = !isLoading && !error && messages.length === 0;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scroll-subtle h-full overflow-y-auto overscroll-contain"
        // The log role lets assistive tech announce new messages as they arrive.
        role="log"
        aria-live="polite"
        aria-label={`Messages in ${conversation.title}`}
        aria-busy={isLoading || undefined}
      >
        {isLoading && messages.length === 0 && <MessageSkeleton />}

        {error && messages.length === 0 && (
          <ErrorState
            title="Couldn't load messages"
            message={error}
            onRetry={onReload}
            className="py-16"
          />
        )}

        {showEmptyState && (
          <>
            <EmptyState
              icon={<MessagesSquare className="size-5" />}
              title={`This is the start of your conversation with ${conversation.title}`}
              description="Send a message to get things going."
              className="py-16"
            />
            {typingUsers.length > 0 && (
              <div className="mx-auto max-w-3xl px-4 sm:px-6">
                <TypingBubble users={typingUsers} />
              </div>
            )}
          </>
        )}

        {messages.length > 0 && (
          <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
            {hasMore && (
              <div className="mb-4 flex justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLoadOlder}
                  isLoading={isLoadingMore}
                >
                  {isLoadingMore ? 'Loading…' : 'Load earlier messages'}
                </Button>
              </div>
            )}

            <ol className="space-y-0.5">
              {rows.map((row) => (
                <li key={row.message.clientId ?? row.message.id}>
                  {row.daySeparator && <DateSeparator label={row.daySeparator} />}
                  <MessageBubble
                    message={row.message}
                    isOwn={row.isOwn}
                    senderName={
                      row.showSenderName
                        ? (senderNames.get(row.message.senderId) ?? 'Unknown')
                        : null
                    }
                    isGroupedWithPrevious={row.isGroupedWithPrevious}
                    onRetry={onRetryMessage}
                  />
                </li>
              ))}
            </ol>

            <TypingBubble users={typingUsers} />

            {/* An error while history is already on screen shouldn't hide it. */}
            {error && (
              <div className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-danger-soft px-4 py-3">
                <p className="text-sm text-danger">{error}</p>
                <Button variant="secondary" size="sm" onClick={onReload}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <NewMessagesPill
        count={newMessageCount}
        isPinnedToBottom={isPinnedToBottom}
        onClick={() => scrollToBottom('smooth')}
      />
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-ink-100" />
      <span className="rounded-full bg-paper-dim px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </span>
      <span className="h-px flex-1 bg-ink-100" />
    </div>
  );
}

/**
 * The "N new messages" affordance.
 *
 * Appears only when messages arrived while the user was reading further up. If
 * the user is simply scrolled up with nothing new, a plain scroll-to-bottom
 * control is offered instead — useful, but visually quieter.
 */
function NewMessagesPill({
  count,
  isPinnedToBottom,
  onClick,
}: {
  count: number;
  isPinnedToBottom: boolean;
  onClick: () => void;
}) {
  const hasNew = count > 0;
  if (isPinnedToBottom) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
      <button
        type="button"
        onClick={onClick}
        className={cx(
          'pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lifted',
          'animate-pop transition-transform hover:-translate-y-0.5',
          hasNew
            ? 'bg-accent text-white'
            : 'bg-surface text-ink-700 ring-1 ring-inset ring-ink-200',
        )}
      >
        {hasNew
          ? `${count} new ${count === 1 ? 'message' : 'messages'}`
          : 'Jump to latest'}
        <ArrowDown aria-hidden className="size-4" />
      </button>
    </div>
  );
}
