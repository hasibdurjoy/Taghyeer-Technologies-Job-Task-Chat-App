'use client';

import { Minus, SendHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { MessageBubble } from '@/components/chat/MessageBubble';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState, MessageSkeleton } from '@/components/ui/StateViews';
import { useMessages } from '@/hooks/useMessages';
import { cx } from '@/lib/utils';
import type { Conversation, Message, User } from '@/types/chat';

interface FloatingChatWindowProps {
  conversation: Conversation;
  currentUser: User;
  token: string;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
  /** Publishes this window's `receive` to the shared socket; returns an unsubscribe. */
  registerReceiver: (conversationId: string, receive: (message: Message) => void) => () => void;
}

/**
 * One docked conversation.
 *
 * Owns its own history through `useMessages` — the same hook the full chat uses,
 * so sending, optimistic bubbles and failed-send retries all behave identically
 * here. It does not own a socket: the provider holds the one connection and
 * hands messages down through the receiver registry.
 */
export function FloatingChatWindow({
  conversation,
  currentUser,
  token,
  isMinimized,
  onToggleMinimize,
  onClose,
  registerReceiver,
}: FloatingChatWindowProps) {
  const { messages, isLoading, error, reload, send, retry, receive } = useMessages(
    token,
    currentUser.id,
    conversation.id,
  );

  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isGroup = conversation.type === 'group';

  // `receive` is recreated on each render, so this re-registers with the latest
  // one; the map is keyed by conversation, so it overwrites rather than stacks.
  useEffect(() => registerReceiver(conversation.id, receive), [
    registerReceiver,
    conversation.id,
    receive,
  ]);

  // A docked window is small enough that it is always pinned to the newest
  // message — there is no "scrolled up reading history" case to protect here.
  useEffect(() => {
    if (isMinimized) return;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, isMinimized]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    setIsSending(true);
    try {
      await send(text);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section
      aria-label={`Chat with ${conversation.title}`}
      className={cx(
        'pointer-events-auto flex w-80 flex-col overflow-hidden rounded-t-2xl bg-surface',
        'shadow-lifted ring-1 ring-ink-100',
      )}
    >
      <header className="flex items-center gap-2 border-b border-ink-100 bg-surface px-2.5 py-2">
        {/* The whole title area toggles, matching how these docks usually behave. */}
        <button
          type="button"
          onClick={onToggleMinimize}
          aria-expanded={!isMinimized}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-paper-dim"
        >
          <Avatar
            name={conversation.title}
            seed={isGroup ? conversation.id : (conversation.participants[0]?.id ?? conversation.id)}
            isGroup={isGroup}
            size="sm"
            className="size-7 text-[0.625rem]"
          />
          <span className="truncate text-sm font-semibold text-ink-950">{conversation.title}</span>
        </button>

        <button
          type="button"
          onClick={onToggleMinimize}
          aria-label={isMinimized ? 'Expand conversation' : 'Minimise conversation'}
          className="shrink-0 rounded-full p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close conversation"
          className="shrink-0 rounded-full p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>

      {!isMinimized && (
        <>
          <div ref={scrollRef} className="scroll-subtle h-72 overflow-y-auto bg-paper px-3 py-2">
            {isLoading && messages.length === 0 && <MessageSkeleton count={4} />}

            {error && messages.length === 0 && (
              <ErrorState
                title="Couldn't load"
                message={error}
                onRetry={reload}
                className="py-8"
              />
            )}

            {!isLoading && !error && messages.length === 0 && (
              <p className="py-8 text-center text-xs text-ink-400">
                No messages yet — say something.
              </p>
            )}

            {messages.map((message, index) => {
              const previous = index > 0 ? messages[index - 1] : null;
              const isOwn = message.senderId === currentUser.id;
              const isGroupedWithPrevious = previous?.senderId === message.senderId;

              return (
                <MessageBubble
                  key={message.clientId ?? message.id}
                  message={message}
                  isOwn={isOwn}
                  senderName={
                    isGroup && !isOwn && !isGroupedWithPrevious
                      ? (conversation.participants.find((p) => p.id === message.senderId)?.name ??
                        null)
                      : null
                  }
                  isGroupedWithPrevious={isGroupedWithPrevious}
                  onRetry={(clientId) => void retry(clientId)}
                />
              );
            })}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="flex items-end gap-1.5 border-t border-ink-100 bg-surface px-2.5 py-2"
          >
            <label htmlFor={`composer-${conversation.id}`} className="sr-only">
              Message {conversation.title}
            </label>
            <textarea
              id={`composer-${conversation.id}`}
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                void submit();
              }}
              placeholder="Aa"
              className={cx(
                'scroll-subtle max-h-24 min-h-9 flex-1 resize-none rounded-2xl bg-paper px-3 py-2',
                // 16px so iOS doesn't zoom the viewport on focus.
                'text-base leading-snug text-ink-900 ring-1 ring-inset ring-ink-200',
                'placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-900',
              )}
            />
            <button
              type="submit"
              disabled={!draft.trim() || isSending}
              aria-label="Send message"
              className={cx(
                'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
                draft.trim() && !isSending
                  ? 'bg-ink-900 text-white hover:bg-ink-800'
                  : 'bg-ink-100 text-ink-300',
              )}
            >
              <SendHorizontal aria-hidden className="size-4" />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
