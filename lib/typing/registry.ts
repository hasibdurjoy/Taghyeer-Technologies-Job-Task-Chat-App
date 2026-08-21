import type { TypingEvent } from '@/types/chat';

/**
 * In-process pub/sub for typing events.
 *
 * The provided chat API has no typing or presence channel (verified — see
 * docs/API.md → "There is no typing / presence channel"), so this app runs a
 * minimal relay of its own. It stores nothing and persists nothing: an event is
 * handed to whoever is currently listening on that conversation and then
 * forgotten.
 *
 * IMPORTANT: this is process-local. It works on any single long-running Node
 * server (`next start`, Docker, Render, Railway, a VPS). It does **not** work
 * across serverless instances, where each invocation has its own memory — that
 * deployment target needs an external broker (Redis pub/sub, Ably, Pusher)
 * plugged in behind this same interface.
 */

type Subscriber = (event: TypingEvent) => void;

interface Registry {
  channels: Map<string, Set<Subscriber>>;
}

/**
 * Held on `globalThis` so a hot reload in development doesn't orphan existing
 * subscribers behind a fresh module instance.
 */
declare global {
  var __typingRegistry: Registry | undefined;
}

function getRegistry(): Registry {
  if (!global.__typingRegistry) {
    global.__typingRegistry = { channels: new Map() };
  }
  return global.__typingRegistry;
}

/** Adds a listener for one conversation. Returns the unsubscribe function. */
export function subscribe(conversationId: string, subscriber: Subscriber): () => void {
  const { channels } = getRegistry();

  let listeners = channels.get(conversationId);
  if (!listeners) {
    listeners = new Set();
    channels.set(conversationId, listeners);
  }
  listeners.add(subscriber);

  return () => {
    const current = channels.get(conversationId);
    if (!current) return;
    current.delete(subscriber);
    // Drop empty channels so the map can't grow without bound.
    if (current.size === 0) channels.delete(conversationId);
  };
}

/** Fans an event out to everyone listening on the conversation except its author. */
export function publish(event: TypingEvent): void {
  const listeners = getRegistry().channels.get(event.conversationId);
  if (!listeners) return;

  for (const subscriber of listeners) {
    try {
      subscriber(event);
    } catch {
      // One broken stream must not stop delivery to the others.
    }
  }
}
