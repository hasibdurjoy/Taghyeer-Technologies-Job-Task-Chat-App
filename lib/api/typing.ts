import type { TypingEvent } from '@/types/chat';

/**
 * Client for the typing relay (this app's own routes, not the upstream API).
 *
 * Typing signals are best-effort by nature: a dropped one costs a moment of a
 * stale indicator, which the receiver's expiry timer clears anyway. So nothing
 * here throws — failures are swallowed rather than surfaced as errors the user
 * would have to care about.
 */

/** Announces that the current user started or stopped typing. */
export async function publishTyping(
  token: string,
  conversationId: string,
  isTyping: boolean,
): Promise<void> {
  try {
    await fetch('/api/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversationId, isTyping }),
      // Survives the page being closed mid-request, so a "stopped typing"
      // signal still lands when the user navigates away.
      keepalive: true,
    });
  } catch {
    // Best-effort.
  }
}

/**
 * Opens the SSE stream for a conversation and invokes `onEvent` for each signal.
 *
 * Read with `fetch` rather than `EventSource` so the bearer token travels in a
 * header instead of the query string. That costs us `EventSource`'s automatic
 * reconnection, which `useTypingIndicator` supplies instead.
 */
export async function streamTyping(
  token: string,
  conversationId: string,
  signal: AbortSignal,
  onEvent: (event: TypingEvent) => void,
): Promise<void> {
  const response = await fetch(
    `/api/typing/stream?conversationId=${encodeURIComponent(conversationId)}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal,
    },
  );

  if (!response.ok || !response.body) {
    throw new Error(`Typing stream unavailable (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; anything after the last one is
    // a partial frame and stays in the buffer until the rest arrives.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        // Lines starting with ':' are comments — the handshake and heartbeats.
        if (!line.startsWith('data:')) continue;
        try {
          onEvent(JSON.parse(line.slice(5).trim()) as TypingEvent);
        } catch {
          // Ignore a malformed frame rather than tearing down the stream.
        }
      }
    }
  }
}
