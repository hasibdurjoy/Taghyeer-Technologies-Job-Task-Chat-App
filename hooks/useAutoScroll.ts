'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { Message } from '@/types/chat';

/** How close to the bottom still counts as "following the conversation", in pixels. */
const NEAR_BOTTOM_THRESHOLD = 120;

interface UseAutoScrollOptions {
  /** Resets pinning and jumps to the latest message when this changes. */
  conversationId: string;
  messages: Message[];
  currentUserId: string;
}

interface UseAutoScrollResult {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Number of messages that arrived while the user was reading further up. */
  newMessageCount: number;
  /** True while the user is following the bottom of the conversation. */
  isPinnedToBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  handleScroll: () => void;
}

/**
 * Keeps the message list pinned to the newest message without ever yanking the
 * user away from history they are reading.
 *
 * Rules:
 * - opening a conversation jumps to the latest message (no animation)
 * - sending a message always scrolls down
 * - an incoming message scrolls down only if the user is already near the bottom
 * - otherwise it is counted, and the caller shows a "N new messages" pill that
 *   scrolls down when clicked
 *
 * The unread counter is **derived, not incremented**. Scrolling away from the
 * bottom drops an anchor at the message that was last visible; the count is
 * simply how many messages now sit after that anchor. That keeps the count
 * honest no matter how messages arrive — one at a time, in a burst, or as a page
 * of history — and means no effect has to mutate a running total.
 */
export function useAutoScroll({
  conversationId,
  messages,
  currentUserId,
}: UseAutoScrollOptions): UseAutoScrollResult {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /** The message the user was at when they scrolled up; `null` while following. */
  const [anchorId, setAnchorId] = useState<string | null>(null);

  const lastMessage = messages.at(-1) ?? null;
  const previousLastIdRef = useRef<string | null>(null);
  const previousConversationIdRef = useRef<string | null>(null);

  const newMessageCount = useMemo(() => {
    if (!anchorId) return 0;
    const anchorIndex = messages.findIndex((message) => message.id === anchorId);
    if (anchorIndex === -1) return 0;
    return messages.length - 1 - anchorIndex;
  }, [anchorId, messages]);

  /**
   * Measures the scroll position from the DOM rather than from React state.
   * When a message arrives, the decision to follow it must reflect where the
   * user is *right now*; state may not have caught up with a scroll that
   * happened moments earlier.
   */
  const isNearBottom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return true;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollRef.current;
    if (!container) return;

    // Scrolling the container directly (rather than `scrollIntoView`) keeps the
    // page itself from moving when the list sits inside a fixed layout.
    container.scrollTo({ top: container.scrollHeight, behavior });
    setAnchorId(null);
  }, []);

  const handleScroll = useCallback(() => {
    if (isNearBottom()) {
      // Back at the bottom: everything below has now been seen.
      setAnchorId(null);
      return;
    }

    // Leaving the bottom drops an anchor; scrolling further up keeps the first.
    setAnchorId((current) => current ?? lastMessage?.id ?? null);
  }, [isNearBottom, lastMessage]);

  // Layout effect: positioning happens before the browser paints, so opening a
  // conversation never flashes the top of the history before jumping down.
  useLayoutEffect(() => {
    if (!lastMessage) {
      previousLastIdRef.current = null;
      return;
    }

    const conversationChanged = previousConversationIdRef.current !== conversationId;
    const isFirstRenderOfConversation = previousLastIdRef.current === null;

    if (conversationChanged || isFirstRenderOfConversation) {
      previousConversationIdRef.current = conversationId;
      previousLastIdRef.current = lastMessage.id;
      // Jump instantly on open — animating history into place looks broken.
      // `scrollToBottom` also clears the anchor, so the counter resets.
      scrollToBottom('auto');
      return;
    }

    // Unchanged tail: a page of older history was prepended, not a new message.
    if (previousLastIdRef.current === lastMessage.id) return;
    previousLastIdRef.current = lastMessage.id;

    const isOwnMessage = lastMessage.senderId === currentUserId;

    // Anything else is left alone: the anchor is already set, so the new message
    // is counted by `newMessageCount` without this effect touching state.
    if (isOwnMessage || isNearBottom()) {
      scrollToBottom(isOwnMessage ? 'smooth' : 'auto');
    }
  }, [lastMessage, conversationId, currentUserId, scrollToBottom, isNearBottom]);

  return {
    scrollRef,
    newMessageCount,
    isPinnedToBottom: anchorId === null,
    scrollToBottom,
    handleScroll,
  };
}
