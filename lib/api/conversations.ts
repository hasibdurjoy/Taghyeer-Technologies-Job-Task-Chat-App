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

/*
 * Group administration.
 *
 * All four endpoints below return the **complete updated group** — populated
 * participants and admins — and broadcast `conversation:updated` to every
 * current member. Because the response is authoritative, callers apply it
 * directly instead of refetching; the socket event that follows merges to the
 * same state, so the duplication is harmless.
 *
 * Permissions, as enforced upstream (verified, not assumed):
 * - rename / add / promote / remove-someone-else → **admins only**, else 403
 * - removing *yourself* → allowed for any member (this is "leave group")
 */

/** Renames a group. Admins only; an empty name is rejected with 400. */
export async function renameGroup(
  token: string,
  currentUserId: string,
  conversationId: string,
  name: string,
): Promise<Conversation> {
  const raw = await request<RawConversation>(`/conversations/${conversationId}`, {
    method: 'PATCH',
    token,
    body: { name: name.trim() },
  });
  return normalizeConversation({ ...raw, type: 'group' }, currentUserId);
}

/**
 * Adds members to a group. Admins only.
 *
 * Re-adding an existing member is a no-op upstream rather than an error, so the
 * caller doesn't need to filter the list first — though the UI does anyway, to
 * avoid offering a pointless action.
 */
export async function addParticipants(
  token: string,
  currentUserId: string,
  conversationId: string,
  userIds: string[],
): Promise<Conversation> {
  const raw = await request<RawConversation>(`/conversations/${conversationId}/participants`, {
    method: 'POST',
    token,
    body: { userIds },
  });
  return normalizeConversation({ ...raw, type: 'group' }, currentUserId);
}

/**
 * Removes a member, or leaves the group when `userId` is your own.
 *
 * Note the asymmetry: removing someone else needs admin rights, but any member
 * may remove themselves. The upstream group is *not* deleted when it empties —
 * it happily persists with a single member.
 */
export async function removeParticipant(
  token: string,
  currentUserId: string,
  conversationId: string,
  userId: string,
): Promise<Conversation> {
  const raw = await request<RawConversation>(
    `/conversations/${conversationId}/participants/${userId}`,
    { method: 'DELETE', token },
  );
  return normalizeConversation({ ...raw, type: 'group' }, currentUserId);
}

/**
 * Promotes a member to admin. Admins only.
 *
 * There is no matching demote endpoint upstream, so promotion is one-way — the
 * UI says so rather than letting someone discover it after the fact.
 */
export async function promoteToAdmin(
  token: string,
  currentUserId: string,
  conversationId: string,
  userId: string,
): Promise<Conversation> {
  const raw = await request<RawConversation>(`/conversations/${conversationId}/admins`, {
    method: 'POST',
    token,
    body: { userId },
  });
  return normalizeConversation({ ...raw, type: 'group' }, currentUserId);
}
