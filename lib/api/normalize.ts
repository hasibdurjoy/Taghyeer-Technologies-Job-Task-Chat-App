import type {
  RawConversation,
  RawMessage,
  RawSocketMessage,
  RawUser,
} from '@/types/api';
import type { Conversation, LastMessagePreview, Message, User } from '@/types/chat';

/**
 * The single place where upstream wire shapes become domain types.
 *
 * The API is inconsistent in ways that would otherwise leak everywhere: `_id`
 * vs `id`, ISO strings vs epoch numbers, `participant` vs `participants`, and
 * `{}` standing in for a missing last message. All of that stops here.
 */

export function normalizeUser(raw: RawUser): User {
  return { id: raw._id, name: raw.name, phone: raw.phone };
}

/** REST messages arrive with `_id` and an ISO `createdAt`. */
export function normalizeMessage(raw: RawMessage): Message {
  return {
    id: raw._id,
    conversationId: raw.conversation,
    senderId: raw.sender,
    text: raw.text,
    createdAt: raw.createdAt,
    status: 'sent',
  };
}

/** Socket messages arrive with `id` and epoch-millisecond `createdAt`. */
export function normalizeSocketMessage(raw: RawSocketMessage): Message {
  return {
    id: raw.id,
    conversationId: raw.conversation,
    senderId: raw.sender,
    text: raw.text,
    createdAt: new Date(raw.createdAt).toISOString(),
    status: 'sent',
  };
}

/** `lastMessage` is `{}` — not `null` — for a conversation with no messages yet. */
function normalizeLastMessage(raw: RawConversation['lastMessage']): LastMessagePreview | null {
  if (!raw?.createdAt || raw.text === undefined) return null;
  return { text: raw.text, senderId: raw.sender ?? '', createdAt: raw.createdAt };
}

/**
 * Flattens both conversation shapes into one.
 *
 * `participants` excludes the current user so the UI can render titles and
 * avatars without repeating that filter at every call site. Group participants
 * may arrive as bare id strings on some payloads, so those are dropped rather
 * than rendered as objects with missing names.
 */
export function normalizeConversation(raw: RawConversation, currentUserId: string): Conversation {
  const type = raw.type ?? (raw.name || (raw.participants?.length ?? 0) > 2 ? 'group' : 'direct');

  const others: User[] = [];
  if (raw.participant) {
    others.push(normalizeUser(raw.participant));
  }
  for (const entry of raw.participants ?? []) {
    if (typeof entry === 'string') continue;
    if (entry._id === currentUserId) continue;
    if (others.some((user) => user.id === entry._id)) continue;
    others.push(normalizeUser(entry));
  }

  const title =
    type === 'group'
      ? raw.name?.trim() || 'Unnamed group'
      : others[0]?.name?.trim() || 'Unknown contact';

  return {
    id: raw._id,
    type,
    title,
    participants: others,
    adminIds: raw.admins ?? [],
    lastMessage: normalizeLastMessage(raw.lastMessage),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
  };
}
