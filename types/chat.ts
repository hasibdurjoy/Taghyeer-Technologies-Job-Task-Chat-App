/**
 * Domain types used throughout the UI.
 *
 * Everything here is already normalized: ids are `id` (never `_id`), timestamps
 * are ISO strings, and direct/group conversations expose one consistent shape.
 */

export interface User {
  id: string;
  name: string;
  phone: string;
}

export type ConversationType = 'direct' | 'group';

export interface LastMessagePreview {
  text: string;
  senderId: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  /** Display name: the group name, or the other participant's name for a direct chat. */
  title: string;
  /** Everyone in the conversation except the current user. */
  participants: User[];
  /** Group only — ids of members who can administer the group. */
  adminIds: string[];
  lastMessage: LastMessagePreview | null;
  updatedAt: string;
}

/**
 * Lifecycle of an outgoing message.
 *
 * The upstream API never echoes a `message:new` back to the sender, so an
 * optimistic bubble can never collide with a realtime duplicate.
 */
export type MessageStatus = 'sent' | 'sending' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  status: MessageStatus;
  /** Set on optimistic messages so a failed send can be retried without retyping. */
  clientId?: string;
}

/** Per-conversation read marker, persisted by this app's own MongoDB layer. */
export interface ReadState {
  conversationId: string;
  lastReadAt: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
