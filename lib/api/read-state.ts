import { request, unwrapData } from '@/lib/api/http';
import type { ReadState } from '@/types/chat';

/**
 * Client for this app's own read-state routes (not the upstream API).
 *
 * Unread badges are a nicety, never a blocker: if MongoDB is unconfigured or
 * down the routes answer 503 and these helpers fail quietly, leaving the caller
 * with session-local unread tracking.
 */

const LOCAL_BASE = '/api';

export async function fetchReadStates(token: string, signal?: AbortSignal): Promise<ReadState[]> {
  try {
    const payload = await request<{ data: ReadState[] }>('/read-state', {
      token,
      baseUrl: LOCAL_BASE,
      signal,
    });
    return unwrapData(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return [];
  }
}

export async function markConversationRead(
  token: string,
  conversationId: string,
  lastReadAt: string,
): Promise<void> {
  try {
    await request('/read-state', {
      method: 'PUT',
      token,
      baseUrl: LOCAL_BASE,
      body: { conversationId, lastReadAt },
    });
  } catch {
    // Persisting the marker is best-effort; unread state stays correct in-session.
  }
}
