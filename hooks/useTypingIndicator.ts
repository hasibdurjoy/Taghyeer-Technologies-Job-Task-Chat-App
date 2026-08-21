'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { publishTyping, streamTyping } from '@/lib/api/typing';
import type { TypingUser } from '@/types/chat';

/**
 * How long a "started typing" signal stays valid without being refreshed.
 * Slightly longer than the sender's refresh interval, so a single dropped
 * signal doesn't make the indicator flicker.
 */
const TYPING_TTL_MS = 6_000;

/** Minimum gap between outgoing "still typing" signals — one per keystroke would be absurd. */
const REFRESH_INTERVAL_MS = 3_000;

/** Silence after which the sender is considered to have stopped. */
const IDLE_TIMEOUT_MS = 2_500;

/** How often expired entries are swept out of the local view. */
const SWEEP_INTERVAL_MS = 1_000;

interface UseTypingIndicatorResult {
  /** Everyone currently typing in this conversation, excluding the current user. */
  typingUsers: TypingUser[];
  /** Call on each keystroke; throttling and the stop signal are handled internally. */
  notifyTyping: () => void;
  /** Call after sending a message, so the indicator clears immediately. */
  clearTyping: () => void;
}

/**
 * Real-time typing indicators.
 *
 * The provided chat API has no typing channel of any kind — ten candidate socket
 * events and five REST paths were probed and none exist (docs/API.md → "There is
 * no typing / presence channel"). These signals therefore travel over this app's
 * own SSE relay rather than the upstream socket, and nothing about them is
 * simulated: what you see is another user's keystrokes.
 *
 * Entries expire on a timer rather than relying on a "stopped" signal arriving,
 * because a closed tab or a dropped connection never sends one.
 */
export function useTypingIndicator(
  token: string,
  conversationId: string | null,
): UseTypingIndicatorResult {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  /** userId → { name, expiresAt }, the source of truth behind `typingUsers`. */
  const activeRef = useRef(new Map<string, { name: string; expiresAt: number }>());
  const lastSentAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationIdRef = useRef(conversationId);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  /** Publishes the current state, but only when it actually differs. */
  const syncFromActive = useCallback(() => {
    const next: TypingUser[] = [];
    const now = Date.now();

    for (const [id, entry] of activeRef.current) {
      if (entry.expiresAt <= now) {
        activeRef.current.delete(id);
        continue;
      }
      next.push({ id, name: entry.name });
    }

    setTypingUsers((current) => {
      if (
        current.length === next.length &&
        current.every((user, index) => user.id === next[index]?.id)
      ) {
        return current;
      }
      return next;
    });
  }, []);

  // Subscribe to the conversation's stream, reconnecting if it drops.
  useEffect(() => {
    if (!conversationId) {
      activeRef.current.clear();
      return;
    }

    const controller = new AbortController();
    const active = activeRef.current;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = async () => {
      try {
        attempt += 1;
        await streamTyping(token, conversationId, controller.signal, (event) => {
          if (event.conversationId !== conversationId) return;

          attempt = 0;
          if (event.isTyping) {
            activeRef.current.set(event.userId, {
              name: event.name,
              expiresAt: Date.now() + TYPING_TTL_MS,
            });
          } else {
            activeRef.current.delete(event.userId);
          }
          syncFromActive();
        });
      } catch {
        // Fall through to the retry below.
      }

      if (controller.signal.aborted) return;

      // The stream ended or failed — back off, then reconnect. Typing is a
      // nicety, so this stays quiet rather than surfacing an error.
      const delay = Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 15_000);
      retryTimer = setTimeout(connect, delay);
    };

    void connect();

    return () => {
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
      active.clear();
      setTypingUsers([]);
    };
  }, [token, conversationId, syncFromActive]);

  // Expire stale entries even when no further events arrive.
  useEffect(() => {
    if (!conversationId) return;
    const sweep = setInterval(syncFromActive, SWEEP_INTERVAL_MS);
    return () => clearInterval(sweep);
  }, [conversationId, syncFromActive]);

  const sendStop = useCallback(() => {
    const id = conversationIdRef.current;
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!id || lastSentAtRef.current === 0) return;
    lastSentAtRef.current = 0;
    void publishTyping(token, id, false);
  }, [token]);

  const notifyTyping = useCallback(() => {
    const id = conversationIdRef.current;
    if (!id) return;

    const now = Date.now();
    // Refresh at most once per interval; the receiver's TTL covers the gaps.
    if (now - lastSentAtRef.current > REFRESH_INTERVAL_MS) {
      lastSentAtRef.current = now;
      void publishTyping(token, id, true);
    }

    // Each keystroke pushes the "stopped typing" signal further out.
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(sendStop, IDLE_TIMEOUT_MS);
  }, [token, sendStop]);

  // Stop signalling when the conversation changes or the component unmounts, so
  // the other side doesn't see a typing bubble that never clears.
  useEffect(() => {
    return () => sendStop();
  }, [conversationId, sendStop]);

  return { typingUsers, notifyTyping, clearTyping: sendStop };
}
