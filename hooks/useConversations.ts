'use client';

import { useCallback, useEffect, useState } from 'react';

import { listConversations } from '@/lib/api/conversations';
import { normalizeConversation } from '@/lib/api/normalize';
import type { RawConversation } from '@/types/api';
import type { Conversation, Message } from '@/types/chat';

interface UseConversationsResult {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  /** Conversation id → number of unread messages. */
  unreadCounts: Record<string, number>;
  refresh: () => Promise<void>;
  /** Applies an incoming message to the sidebar preview and unread badge. */
  applyIncomingMessage: (message: Message, isActive: boolean) => void;
  /** Applies a message the current user sent — no socket echo arrives for these. */
  applyOwnMessage: (message: Message) => void;
  applyConversationUpdate: (raw: RawConversation) => void;
  markRead: (conversationId: string) => void;
}

function sortByRecency(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * Owns the conversation list, its previews and unread badges.
 *
 * Unread counts are tracked **for the current session only**. The API exposes no
 * read state — no unread count, no "last read" marker — and nothing in a
 * conversation payload distinguishes a message you have seen from one you
 * haven't. Counts therefore start empty on load and accumulate from messages
 * that arrive while the app is open, which is honest: marking every existing
 * conversation unread on every reload would be worse than showing no badge.
 */
export function useConversations(token: string, currentUserId: string): UseConversationsResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  /**
   * Which user the list has finished loading for. Comparing it to the current
   * user derives `isLoading` without a flag that must be flipped in the effect
   * body, and correctly re-enters the loading state if the account changes.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const isLoading = loadedFor !== currentUserId;

  // A pure fetch: it deliberately does not touch state, so callers stay in
  // control of when the update happens.
  const load = useCallback(
    (signal?: AbortSignal) => listConversations(token, currentUserId, signal),
    [token, currentUserId],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    load(controller.signal)
      .then((list) => {
        if (cancelled) return;
        setConversations(sortByRecency(list));
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Could not load your conversations.');
      })
      .finally(() => {
        if (!cancelled) setLoadedFor(currentUserId);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [load, currentUserId]);

  const refresh = useCallback(async () => {
    try {
      const list = await load();
      setConversations(sortByRecency(list));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load your conversations.');
    }
  }, [load]);

  /**
   * Updates the sidebar preview in place, moving the conversation to the top.
   * Returns false when the conversation isn't in the list yet.
   */
  const applyPreview = useCallback((message: Message): boolean => {
    let matched = false;

    setConversations((current) => {
      const index = current.findIndex((item) => item.id === message.conversationId);
      if (index === -1) return current;
      matched = true;

      const updated: Conversation = {
        ...current[index],
        lastMessage: {
          text: message.text,
          senderId: message.senderId,
          createdAt: message.createdAt,
        },
        updatedAt: message.createdAt,
      };
      const rest = current.filter((_, i) => i !== index);
      return [updated, ...rest];
    });

    return matched;
  }, []);

  const markRead = useCallback((conversationId: string) => {
    setUnreadCounts((current) => {
      if (!current[conversationId]) return current;
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
  }, []);

  const applyIncomingMessage = useCallback(
    (message: Message, isActive: boolean) => {
      const known = applyPreview(message);

      // A message for a conversation we don't know about is someone starting a
      // new direct chat with us. Only groups announce themselves via
      // `conversation:updated`, so without this the chat would stay invisible
      // until the next manual reload.
      if (!known) void refresh();

      // The conversation is open, so the message is already being read.
      if (isActive) return;

      setUnreadCounts((current) => ({
        ...current,
        [message.conversationId]: (current[message.conversationId] ?? 0) + 1,
      }));
    },
    [applyPreview, refresh],
  );

  /**
   * The server never sends `message:new` back to the sender, so a message the
   * current user sends must update their own sidebar locally.
   */
  const applyOwnMessage = useCallback(
    (message: Message) => {
      applyPreview(message);
    },
    [applyPreview],
  );

  const applyConversationUpdate = useCallback(
    (raw: RawConversation) => {
      const incoming = normalizeConversation(raw, currentUserId);
      setConversations((current) => {
        const index = current.findIndex((item) => item.id === incoming.id);
        if (index === -1) return sortByRecency([incoming, ...current]);

        // The event carries no `lastMessage`; keep the preview we already have.
        const merged: Conversation = {
          ...incoming,
          lastMessage: current[index].lastMessage,
          updatedAt: current[index].updatedAt,
        };
        const next = [...current];
        next[index] = merged;
        return next;
      });
    },
    [currentUserId],
  );

  return {
    conversations,
    isLoading,
    error,
    unreadCounts,
    refresh,
    applyIncomingMessage,
    applyOwnMessage,
    applyConversationUpdate,
    markRead,
  };
}
