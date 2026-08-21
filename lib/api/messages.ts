import { request } from '@/lib/api/http';
import { normalizeMessage } from '@/lib/api/normalize';
import { MESSAGE_PAGE_SIZE } from '@/lib/config';
import type { RawMessage, RawMessagePage } from '@/types/api';
import type { Message } from '@/types/chat';

export interface MessagePage {
  /** Ascending (oldest first) — upstream returns newest first. */
  messages: Message[];
  hasMore: boolean;
}

/**
 * Fetches one page of history, oldest-first.
 *
 * Callers must still de-duplicate: the `before` cursor is inclusive, so each
 * page after the first repeats the cursor message (docs/API.md → quirk #4).
 */
export async function getMessages(
  token: string,
  conversationId: string,
  options: { before?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<MessagePage> {
  const { before, limit = MESSAGE_PAGE_SIZE, signal } = options;

  const payload = await request<RawMessagePage>(`/conversations/${conversationId}/messages`, {
    token,
    query: { limit, before },
    signal,
  });

  const messages = (payload.messages ?? []).map(normalizeMessage).reverse();
  return { messages, hasMore: Boolean(payload.hasMore) };
}

/**
 * Sends a message over REST rather than the socket.
 *
 * REST returns the created message with its real id, which lets an optimistic
 * bubble be reconciled cleanly; the socket's ack carries only `{ ok: true }`.
 * Both paths broadcast identically to other participants.
 */
export async function sendMessage(
  token: string,
  conversationId: string,
  text: string,
): Promise<Message> {
  const raw = await request<RawMessage>('/messages', {
    method: 'POST',
    token,
    body: { conversationId, text },
  });
  return normalizeMessage(raw);
}
