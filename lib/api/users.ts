import { ApiError, request } from '@/lib/api/http';
import { normalizeUser } from '@/lib/api/normalize';
import { SEARCH_RESULT_CAP } from '@/lib/config';
import type { RawUser } from '@/types/api';
import type { User } from '@/types/chat';

/** Characters that would be executed as regex by the upstream search, or crash it outright. */
const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/;

export interface SearchResult {
  users: User[];
  /** Upstream silently caps results; the UI tells the user their query was truncated. */
  truncated: boolean;
  /**
   * True when the term is an E.164-style phone number that upstream cannot match.
   * The leading `+` crashes the name-regex compile before the phone equality check
   * runs, and no escaping avoids it — see docs/API.md → Known quirks #9.
   */
  phoneSearchLimited: boolean;
}

const EMPTY_RESULT: SearchResult = { users: [], truncated: false, phoneSearchLimited: false };

function capitalizeWords(value: string): string {
  return value.replace(/(^|\s)(\p{Ll})/gu, (_, lead: string, char: string) => lead + char.toUpperCase());
}

/**
 * Builds the set of queries to run for one search term.
 *
 * Upstream matches names with a prefix-anchored, case-sensitive regex and phones
 * by exact equality, using the same unescaped `q` for both. A single query is
 * therefore a poor search box, so a few safe variants are issued concurrently
 * and merged. Variants containing regex metacharacters are never sent — they
 * would return HTTP 500.
 */
export function buildSearchVariants(term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const variants = new Set<string>();
  const isSafe = (value: string) => value.length > 0 && !REGEX_METACHARACTERS.test(value);

  if (isSafe(trimmed)) variants.add(trimmed);

  // Works around case-sensitive name matching: "ada" also tries "Ada".
  const capitalized = capitalizeWords(trimmed);
  if (capitalized !== trimmed && isSafe(capitalized)) variants.add(capitalized);

  // Phones are matched by exact equality. A "+8801…" term can't be sent, but the
  // digits-only form still finds users who registered without the leading plus.
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length >= 4 && digitsOnly !== trimmed) variants.add(digitsOnly);

  return [...variants];
}

/** Detects a term the user clearly meant as a phone number. */
function looksLikePhone(term: string): boolean {
  return /^\+?[\d\s()-]{4,}$/.test(term.trim());
}

/**
 * Searches users by name or phone, excluding the signed-in user.
 *
 * Self is excluded because `POST /conversations` with your own id returns an
 * unrelated existing conversation rather than an error (docs/API.md → quirk #13).
 */
export async function searchUsers(
  token: string,
  term: string,
  currentUserId: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const trimmed = term.trim();
  if (!trimmed) return EMPTY_RESULT;

  const variants = buildSearchVariants(trimmed);
  const phoneSearchLimited = looksLikePhone(trimmed) && trimmed.includes('+');

  if (variants.length === 0) {
    // Nothing safe to send — the term was made entirely of regex metacharacters.
    return { ...EMPTY_RESULT, phoneSearchLimited };
  }

  const settled = await Promise.allSettled(
    variants.map((q) => request<RawUser[]>('/users/search', { token, query: { q }, signal })),
  );

  const failures = settled.filter((entry) => entry.status === 'rejected');
  // Only surface an error if every variant failed; a partial failure still yields results.
  if (failures.length === settled.length) {
    const reason = (failures[0] as PromiseRejectedResult).reason;
    if (reason instanceof DOMException && reason.name === 'AbortError') throw reason;
    if (reason instanceof ApiError && reason.isInvalidRegex) {
      throw new ApiError(reason.status, reason.code, 'That search term contains characters the server cannot handle.');
    }
    throw reason;
  }

  const byId = new Map<string, User>();
  let truncated = false;

  for (const entry of settled) {
    if (entry.status !== 'fulfilled' || !Array.isArray(entry.value)) continue;
    if (entry.value.length >= SEARCH_RESULT_CAP) truncated = true;
    for (const raw of entry.value) {
      if (raw._id === currentUserId || byId.has(raw._id)) continue;
      byId.set(raw._id, normalizeUser(raw));
    }
  }

  return { users: [...byId.values()], truncated, phoneSearchLimited };
}
