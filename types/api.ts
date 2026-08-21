/**
 * Raw wire shapes returned by the upstream API.
 *
 * These types describe what the server actually sends — including its
 * inconsistencies — and are deliberately kept separate from the domain types in
 * `types/chat.ts`. Only `lib/api/normalize.ts` should import from here.
 *
 * See docs/API.md for the observed responses these were derived from.
 */

/**
 * The upstream error envelope. `code` is usually a string, but the invalid-regex
 * failure from `/users/search` returns a number (`51091`).
 */
export interface ApiErrorBody {
  error: {
    message: string;
    code: string | number;
    details?: Array<{ path: string; message: string }>;
  };
}

export interface RawUser {
  _id: string;
  name: string;
  phone: string;
  createdAt?: string;
}

export interface RawLoginResponse {
  token: string;
  user: RawUser;
}

/** `lastMessage` is `{}` rather than `null` when a conversation has no messages. */
export interface RawLastMessage {
  text?: string;
  sender?: string;
  createdAt?: string;
}

/**
 * Direct conversations carry `participant` (singular, the other user);
 * groups carry `participants` (plural, including you) plus `name`/`admins`/`createdBy`.
 */
export interface RawConversation {
  _id: string;
  type?: 'direct' | 'group';
  name?: string;
  createdBy?: string;
  admins?: string[];
  participant?: RawUser;
  participants?: Array<RawUser | string>;
  lastMessage?: RawLastMessage;
  createdAt?: string;
  updatedAt?: string;
}

/** REST message shape: `_id`, ISO-string `createdAt`, `sender` as a bare id. */
export interface RawMessage {
  _id: string;
  conversation: string;
  sender: string;
  text: string;
  createdAt: string;
}

/** Socket `message:new` shape: `id` (not `_id`) and epoch-millisecond `createdAt`. */
export interface RawSocketMessage {
  id: string;
  conversation: string;
  sender: string;
  text: string;
  createdAt: number;
}

export interface RawMessagePage {
  messages: RawMessage[];
  hasMore: boolean;
}
