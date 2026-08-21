import { request, unwrapData } from '@/lib/api/http';
import { normalizeConversation } from '@/lib/api/normalize';
import type { RawConversation } from '@/types/api';
import type { Conversation } from '@/types/chat';

/** All conversations for the current user, already sorted by `updatedAt` descending upstream. */
export async function listConversations(
  token: string,
  currentUserId: string,
  signal?: AbortSignal,
): Promise<Conversation[]> {
  const payload = await request<{ data: RawConversation[] }>('/conversations', { token, signal });
  return unwrapData(payload).map((raw) => normalizeConversation(raw, currentUserId));
}

/**
 * Opens a 1-to-1 conversation. Idempotent upstream — calling it for an existing
 * pair returns that conversation, so no duplicate check is needed here.
 *
 * Only the id is returned: the response is a sparse object without `type`,
 * populated participants or `lastMessage`, so callers refresh the list rather
 * than inserting this into the sidebar (docs/API.md → quirk #12).
 */
export async function startDirectConversation(token: string, userId: string): Promise<string> {
  const raw = await request<RawConversation>('/conversations', {
    method: 'POST',
    token,
    body: { userId },
  });
  return raw._id;
}

/**
 * Creates a group. `participantIds` excludes the creator and must hold at least
 * two ids — upstream requires three total members.
 */
export async function createGroup(
  token: string,
  currentUserId: string,
  name: string,
  participantIds: string[],
): Promise<Conversation> {
  const raw = await request<RawConversation>('/conversations/group', {
    method: 'POST',
    token,
    body: { name: name.trim(), participantIds },
  });
  return normalizeConversation({ ...raw, type: 'group' }, currentUserId);
}
