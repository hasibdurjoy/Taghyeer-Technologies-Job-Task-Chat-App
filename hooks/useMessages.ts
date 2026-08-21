'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getMessages, sendMessage } from '@/lib/api/messages';
import type { Message } from '@/types/chat';

interface UseMessagesResult {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  reload: () => void;
  loadOlder: () => Promise<void>;
  send: (text: string) => Promise<Message | null>;
  /** Re-sends a failed message using its stored text — no retyping needed. */
  retry: (clientId: string) => Promise<Message | null>;
  /** Adds a message that arrived over the socket, ignoring duplicates. */
  receive: (message: Message) => void;
}

/**
 * Everything belonging to one conversation's history, stored together and keyed
 * by the conversation it was loaded for.
 *
 * Keeping the key *inside* the state is what makes `isLoading` a derived value:
 * if the state's key doesn't match the conversation being rendered, the history
 * on screen is stale and a load is in flight. That avoids resetting four pieces
 * of state whenever the user switches conversation, and removes any window where
 * a previous conversation's messages could be shown as if they were the new one's.
 */
interface HistoryState {
  key: string | null;
  messages: Message[];
  hasMore: boolean;
  error: string | null;
}

const EMPTY_HISTORY: HistoryState = { key: null, messages: [], hasMore: false, error: null };

function sortByTime(messages: Message[]): Message[] {
  return messages.sort((a, b) => {
    const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    // Ties are broken by id so ordering stays stable across re-renders.
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}

/**
 * Merges pages/events into the list, keyed by id.
 *
 * De-duplication is required because the `before` cursor is inclusive: every
 * page after the first repeats its cursor message (docs/API.md → quirk #4).
 */
function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) {
    if (byId.has(message.id)) continue;
    byId.set(message.id, message);
  }
  return sortByTime([...byId.values()]);
}

let clientIdCounter = 0;
function nextClientId(): string {
  clientIdCounter += 1;
  return `local-${Date.now()}-${clientIdCounter}`;
}

/**
 * Owns the message history for the active conversation.
 *
 * Optimistic sending is safe here for a specific, verified reason: the server
 * never echoes `message:new` back to the sender, so an optimistic bubble cannot
 * collide with a realtime copy of itself.
 */
export function useMessages(
  token: string,
  currentUserId: string,
  conversationId: string | null,
): UseMessagesResult {
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Guards against a stale response from a previous conversation overwriting the
  // current one when the user switches quickly.
  const requestIdRef = useRef(0);
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const isCurrent = history.key === conversationId;
  const messages = isCurrent ? history.messages : [];
  const isLoading = conversationId !== null && !isCurrent;

  useEffect(() => {
    // With no conversation open there is nothing to fetch. Any previous history
    // still in state is inert — it no longer matches the key being rendered.
    if (!conversationId) return;

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    getMessages(token, conversationId, { signal: controller.signal })
      .then((page) => {
        if (requestId !== requestIdRef.current) return;
        setHistory({
          key: conversationId,
          messages: sortByTime(page.messages),
          hasMore: page.hasMore,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (requestId !== requestIdRef.current) return;
        setHistory({
          key: conversationId,
          messages: [],
          hasMore: false,
          error: err instanceof Error ? err.message : 'Could not load this conversation.',
        });
      });

    return () => controller.abort();
  }, [token, conversationId, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const loadOlder = useCallback(async () => {
    const current = historyRef.current;
    if (!conversationId || isLoadingMore || !current.hasMore || current.key !== conversationId) {
      return;
    }

    const oldest = current.messages.find((message) => message.status === 'sent');
    if (!oldest) return;

    setIsLoadingMore(true);
    try {
      const page = await getMessages(token, conversationId, { before: oldest.id });
      setHistory((state) => {
        if (state.key !== conversationId) return state;
        const merged = mergeMessages(state.messages, page.messages);
        // An invalid cursor is silently ignored upstream and returns page 1
        // again, so stop paging when a page contributes nothing new — otherwise
        // "load older" would loop forever (docs/API.md → quirk #5).
        const gainedNothing = merged.length === state.messages.length;
        return { ...state, messages: merged, hasMore: gainedNothing ? false : page.hasMore };
      });
    } catch {
      // Leave `hasMore` set so the user can try again.
    } finally {
      setIsLoadingMore(false);
    }
  }, [token, conversationId, isLoadingMore]);

  const receive = useCallback((message: Message) => {
    setHistory((state) => {
      if (state.key !== message.conversationId) return state;
      return { ...state, messages: mergeMessages(state.messages, [message]) };
    });
  }, []);

  /** Shared by `send` and `retry`: swaps an optimistic bubble for the server's copy. */
  const dispatchSend = useCallback(
    async (
      targetConversationId: string,
      text: string,
      clientId: string,
    ): Promise<Message | null> => {
      try {
        const saved = await sendMessage(token, targetConversationId, text);
        setHistory((state) => {
          if (state.key !== targetConversationId) return state;
          return {
            ...state,
            messages: sortByTime(
              state.messages.map((message) =>
                message.clientId === clientId ? { ...saved, clientId } : message,
              ),
            ),
          };
        });
        return saved;
      } catch {
        setHistory((state) => {
          if (state.key !== targetConversationId) return state;
          return {
            ...state,
            messages: state.messages.map((message) =>
              message.clientId === clientId ? { ...message, status: 'failed' as const } : message,
            ),
          };
        });
        return null;
      }
    },
    [token],
  );

  const send = useCallback(
    async (text: string): Promise<Message | null> => {
      const trimmed = text.trim();
      // Upstream accepts empty and whitespace-only text, so this is enforced here.
      if (!trimmed || !conversationId) return null;

      const clientId = nextClientId();
      const optimistic: Message = {
        id: clientId,
        conversationId,
        senderId: currentUserId,
        text: trimmed,
        createdAt: new Date().toISOString(),
        status: 'sending',
        clientId,
      };

      setHistory((state) => {
        if (state.key !== conversationId) return state;
        return { ...state, messages: sortByTime([...state.messages, optimistic]) };
      });

      return dispatchSend(conversationId, trimmed, clientId);
    },
    [conversationId, currentUserId, dispatchSend],
  );

  const retry = useCallback(
    async (clientId: string): Promise<Message | null> => {
      const target = historyRef.current.messages.find((message) => message.clientId === clientId);
      if (!target || target.status !== 'failed' || !conversationId) return null;

      setHistory((state) => {
        if (state.key !== conversationId) return state;
        return {
          ...state,
          messages: state.messages.map((message) =>
            message.clientId === clientId ? { ...message, status: 'sending' as const } : message,
          ),
        };
      });

      return dispatchSend(conversationId, target.text, clientId);
    },
    [conversationId, dispatchSend],
  );

  return {
    messages,
    isLoading,
    error: isCurrent ? history.error : null,
    hasMore: isCurrent && history.hasMore,
    isLoadingMore,
    reload,
    loadOlder,
    send,
    retry,
    receive,
  };
}
