import { createLocalStore } from '@/lib/storage/local-store';
import type { User } from '@/types/chat';

/**
 * Session persistence.
 *
 * The upstream API issues a bearer JWT that must be attached to every REST call
 * *and* to the Socket.io handshake — both from the browser — so the token is
 * kept in `localStorage` rather than an httpOnly cookie. A cookie the client
 * cannot read would have to be proxied through our own server for every request
 * and for the socket, which the "use the given API directly" framing argues
 * against. This trade-off is documented in README → Architecture.
 *
 * Exposed as an external store so components read it with
 * `useSyncExternalStore` — no hydration guard, and signing out in one tab signs
 * out the others.
 */

export interface StoredSession {
  token: string;
  user: User;
}

export interface LastLoginHint {
  phone: string;
  name: string;
}

export const sessionStore = createLocalStore<StoredSession | null>('chat.session', null);

/** Remembered across sign-outs purely to pre-fill the login form. */
export const lastLoginStore = createLocalStore<LastLoginHint | null>('chat.lastLogin', null);

export function saveSession(session: StoredSession): void {
  sessionStore.set(session);
  lastLoginStore.set({ phone: session.user.phone, name: session.user.name });
}

export function clearSession(): void {
  sessionStore.clear();
}
