'use client';

import { useEffect, useState } from 'react';

import { searchUsers, type SearchResult } from '@/lib/api/users';
import { SEARCH_DEBOUNCE_MS } from '@/lib/config';
import type { User } from '@/types/chat';

interface UseUserSearchResult {
  results: User[];
  isSearching: boolean;
  error: string | null;
  /** True once a query has actually been sent — distinguishes "no results" from "not searched yet". */
  hasSearched: boolean;
  truncated: boolean;
  phoneSearchLimited: boolean;
  retry: () => void;
}

/**
 * The outcome of one search, tagged with the term it was for.
 *
 * As in `useMessages`, keeping the term in state makes "is a search in flight"
 * a derived value rather than a flag that has to be flipped on and off.
 */
interface SearchState {
  term: string;
  result: SearchResult | null;
  error: string | null;
}

const IDLE: SearchState = { term: '', result: null, error: null };
const EMPTY_RESULT: SearchResult = { users: [], truncated: false, phoneSearchLimited: false };

/**
 * Debounced user search, shared by the new-chat and new-group dialogs.
 *
 * Each keystroke aborts the in-flight request, so a slow response for an earlier
 * term can never overwrite results for the current one.
 */
export function useUserSearch(
  token: string,
  currentUserId: string,
  term: string,
): UseUserSearchResult {
  const [state, setState] = useState<SearchState>(IDLE);
  const [retryKey, setRetryKey] = useState(0);

  const trimmed = term.trim();
  const isSettled = state.term === trimmed;
  const isSearching = trimmed.length > 0 && !isSettled;
  const result = isSettled ? (state.result ?? EMPTY_RESULT) : EMPTY_RESULT;

  useEffect(() => {
    if (!trimmed) return;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      searchUsers(token, trimmed, currentUserId, controller.signal)
        .then((next) => setState({ term: trimmed, result: next, error: null }))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setState({
            term: trimmed,
            result: null,
            error: err instanceof Error ? err.message : 'Search failed. Please try again.',
          });
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [token, currentUserId, trimmed, retryKey]);

  return {
    results: result.users,
    isSearching,
    error: isSettled ? state.error : null,
    hasSearched: isSettled && trimmed.length > 0,
    truncated: result.truncated,
    phoneSearchLimited: result.phoneSearchLimited,
    retry: () => {
      setState(IDLE);
      setRetryKey((key) => key + 1);
    },
  };
}
