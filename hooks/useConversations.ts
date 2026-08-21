'use client';

import { useCallback, useEffect, useState } from 'react';

import { listConversations } from '@/lib/api/conversations';
import { normalizeConversation } from '@/lib/api/normalize';
import { fetchReadStates, markConversationRead } from '@/lib/api/read-state';
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
 * Unread counts are this app's own feature — the upstream API exposes no read
 * state at all. Persisted markers come from MongoDB and are merged with live
 * counts so badges survive a reload; if that store is unavailable the counts
 * simply reset per session.
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

  // Initial load: conversations plus any persisted read markers, so unread
  // badges are correct on first paint rather than flashing in afterwards.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    Promise.all([load(controller.signal), fetchReadStates(token, controller.signal)])
      .then(([list, readStates]) => {
        if (cancelled) return;
        setConversations(sortByRecency(list));

        const readAtByConversation = new Map(
          readStates.map((state) => [state.conversationId, state.lastReadAt]),
        );
        const counts: Record<string, number> = {};
        for (const conversation of list) {
          const last = conversation.lastMessage;
          if (!last || last.senderId === currentUserId) continue;
          const readAt = readAtByConversation.get(conversation.id);
          // Without per-message read tracking upstream, an unread conversation
          // starts at a badge of 1 and increments as live messages arrive.
          if (!readAt || new Date(last.createdAt) > new Date(readAt)) counts[conversation.id] = 1;
        }
        setUnreadCounts(counts);
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
  }, [load, token, currentUserId]);

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

  const markRead = useCallback(
    (conversationId: string) => {
      setUnreadCounts((current) => {
        if (!current[conversationId]) return current;
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      void markConversationRead(token, conversationId, new Date().toISOString());
    },
    [token],
  );

  const applyIncomingMessage = useCallback(
    (message: Message, isActive: boolean) => {
      const known = applyPreview(message);

      // A message for a conversation we don't know about is someone starting a
      // new direct chat with us. Only groups announce themselves via
      // `conversation:updated`, so without this the chat would stay invisible
      // until the next manual reload.
      if (!known) void refresh();

      if (isActive) {
        // Reading it now — keep the persisted marker moving forward.
        void markConversationRead(token, message.conversationId, message.createdAt);
        return;
      }
      setUnreadCounts((current) => ({
        ...current,
        [message.conversationId]: (current[message.conversationId] ?? 0) + 1,
      }));
    },
    [applyPreview, refresh, token],
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
