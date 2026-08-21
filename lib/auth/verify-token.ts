import { getMe } from '@/lib/api/auth';
import { listConversations } from '@/lib/api/conversations';
import type { User } from '@/types/chat';

/**
 * Server-side auth for the typing relay.
 *
 * The upstream JWT is signed with a secret we don't hold, so its signature can't
 * be verified locally — decoding `sub` without verification would let anyone
 * forge a user id. Instead the token is exchanged for a user via upstream
 * `GET /auth/me`, which is authoritative.
 *
 * Both lookups here are cached briefly. Without that, every keystroke that
 * flips the typing flag would cost two upstream round-trips.
 */

const USER_CACHE_TTL_MS = 60_000;
const MEMBERSHIP_CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 500;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const userCache = new Map<string, CacheEntry<User>>();
const membershipCache = new Map<string, CacheEntry<Set<string>>>();

/** Evicts the oldest entry once a cache reaches its ceiling. */
function bound<T>(cache: Map<string, CacheEntry<T>>): void {
  if (cache.size < MAX_CACHE_ENTRIES) return;
  const oldest = cache.keys().next().value;
  if (oldest) cache.delete(oldest);
}

function read<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function extractToken(authorizationHeader: string | null): string | null {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

/** Resolves the authenticated user, or `null` if the token is missing or invalid. */
export async function resolveUser(token: string | null): Promise<User | null> {
  if (!token) return null;

  const cached = read(userCache, token);
  if (cached) return cached;

  try {
    const user = await getMe(token);
    bound(userCache);
    userCache.set(token, { value: user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    return user;
  } catch {
    return null;
  }
}

/**
 * Confirms the caller actually belongs to the conversation.
 *
 * The relay has no idea who is in a conversation, so without this check anyone
 * holding a valid token could subscribe to any conversation id and learn who is
 * typing in it. Membership comes from the upstream API, which is the only
 * authority on it.
 */
export async function isParticipant(
  token: string,
  user: User,
  conversationId: string,
): Promise<boolean> {
  const cached = read(membershipCache, token);
  if (cached) return cached.has(conversationId);

  try {
    const conversations = await listConversations(token, user.id);
    const ids = new Set(conversations.map((conversation) => conversation.id));
    bound(membershipCache);
    membershipCache.set(token, {
      value: ids,
      expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS,
    });
    return ids.has(conversationId);
  } catch {
    // Fail closed: if membership can't be established, don't relay.
    return false;
  }
}
