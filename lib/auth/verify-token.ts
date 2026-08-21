import { getMe } from '@/lib/api/auth';

/**
 * Server-side token validation for this app's own route handlers.
 *
 * The upstream JWT is signed with a secret we do not hold, so the signature
 * cannot be verified locally — decoding `sub` without verification would let
 * anyone forge a user id. Instead the token is exchanged for a user via upstream
 * `GET /auth/me`, which is authoritative.
 *
 * Results are cached briefly so a burst of read-state writes does not cause an
 * upstream round-trip each time. The cache is per-process and intentionally
 * short-lived; a revoked token stops working within `CACHE_TTL_MS`.
 */

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 500;

interface CacheEntry {
  userId: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Returns the authenticated user id, or `null` if the token is missing or invalid. */
export async function resolveUserId(authorizationHeader: string | null): Promise<string | null> {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const cached = cache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.userId;
  if (cached) cache.delete(token);

  try {
    const user = await getMe(token);

    // Bound the cache so a long-running process can't grow it without limit.
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(token, { userId: user.id, expiresAt: Date.now() + CACHE_TTL_MS });
    return user.id;
  } catch {
    return null;
  }
}
