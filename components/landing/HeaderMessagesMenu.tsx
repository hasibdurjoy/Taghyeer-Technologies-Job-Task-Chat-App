'use client';

import { ArrowRight, MessageSquare, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { ConversationSkeleton, EmptyState, ErrorState } from '@/components/ui/StateViews';
import { listConversations } from '@/lib/api/conversations';
import { formatRelativeTimestamp } from '@/lib/format';
import { cx } from '@/lib/utils';
import type { Conversation, User } from '@/types/chat';

interface HeaderMessagesMenuProps {
  currentUser: User;
  token: string;
}

/**
 * The conversation list, as a dropdown in the landing page's header.
 *
 * Conversations are fetched on first open rather than on mount: most visitors
 * to the landing page never open this, and a signed-in session shouldn't cost a
 * request just for loading the marketing page.
 */
export function HeaderMessagesMenu({ currentUser, token }: HeaderMessagesMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const list = await listConversations(token, currentUser.id, controller.signal);
      if (!controller.signal.aborted) setConversations(list);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Could not load your conversations.');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [token, currentUser.id]);

  // Fetching from the click rather than an effect keyed on `isOpen`: the open
  // itself is the trigger, and it keeps the request out of the render cycle.
  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && conversations === null && !isLoading) void load();
  };

  // Dismissal is a document-level concern — a click anywhere else, or Escape.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      // Escape should leave focus somewhere sensible, not on the document.
      buttonRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? 'Hide your messages' : 'Show your messages'}
        className={cx(
          'inline-flex size-10 items-center justify-center rounded-full transition-colors',
          isOpen ? 'bg-ink-100 text-ink-950' : 'text-ink-700 hover:bg-ink-100 hover:text-ink-950',
        )}
      >
        <MessageSquare aria-hidden className="size-5" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Your messages"
          className={cx(
            'absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))]',
            'overflow-hidden rounded-2xl bg-surface shadow-lifted ring-1 ring-ink-100',
            'animate-pop origin-top-right',
          )}
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-950">Messages</h2>
            {conversations && conversations.length > 0 && (
              <span className="text-xs text-ink-400">{conversations.length}</span>
            )}
          </div>

          <div className="scroll-subtle max-h-[min(24rem,60vh)] overflow-y-auto">
            {isLoading && conversations === null && <ConversationSkeleton count={4} />}

            {error && conversations === null && (
              <ErrorState
                title="Couldn't load your chats"
                message={error}
                onRetry={() => void load()}
                className="py-10"
              />
            )}

            {conversations?.length === 0 && (
              <EmptyState
                icon={<MessageSquare className="size-5" />}
                title="No conversations yet"
                description="Start one and it will show up here."
                className="py-10"
              />
            )}

            {conversations && conversations.length > 0 && (
              <ul className="p-2">
                {conversations.map((conversation) => (
                  <MenuRow key={conversation.id} conversation={conversation} />
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-ink-100 p-2">
            <Link
              href="/chat"
              onClick={() => setIsOpen(false)}
              className={cx(
                'flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5',
                'text-sm font-medium text-white transition-colors hover:bg-ink-800',
              )}
            >
              Open all in Messengo
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** One conversation, linking straight into that chat. */
function MenuRow({ conversation }: { conversation: Conversation }) {
  const { id, title, type, participants, lastMessage, updatedAt } = conversation;
  const isGroup = type === 'group';

  const preview = lastMessage?.text.trim()
    ? lastMessage.text
    : lastMessage
      ? 'Message'
      : 'No messages yet';

  return (
    <li>
      {/* A real link, so it can be opened in a new tab like any other. */}
      <Link
        href={`/chat?c=${id}`}
        className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-paper-dim"
      >
        <Avatar
          name={title}
          seed={isGroup ? id : (participants[0]?.id ?? title)}
          isGroup={isGroup}
          size="sm"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium leading-tight text-ink-950">{title}</span>
            <span className="shrink-0 text-[0.6875rem] text-ink-400">
              {formatRelativeTimestamp(updatedAt)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
            {isGroup && <Users aria-hidden className="size-3 shrink-0" />}
            <span className="truncate">{preview}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
