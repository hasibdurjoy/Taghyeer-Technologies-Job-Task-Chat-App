'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { createLocalStore } from '@/lib/storage/local-store';

type DraftMap = Record<string, string>;

const draftsStore = createLocalStore<DraftMap>('chat.drafts', {});

/**
 * Preserves an unsent message per conversation.
 *
 * Switching conversations mid-sentence — or reloading the page — is a common way
 * to lose a message. The API has nowhere to put an unsent draft, and drafts are
 * per-device by nature, so `localStorage` is the right home for them.
 */
export function useDrafts(): {
  getDraft: (conversationId: string) => string;
  setDraft: (conversationId: string, value: string) => void;
  clearDraft: (conversationId: string) => void;
} {
  const drafts = useSyncExternalStore(
    draftsStore.subscribe,
    draftsStore.getSnapshot,
    draftsStore.getServerSnapshot,
  );

  const getDraft = useCallback(
    (conversationId: string) => drafts[conversationId] ?? '',
    [drafts],
  );

  const setDraft = useCallback((conversationId: string, value: string) => {
    const current = draftsStore.get();
    if (current[conversationId] === value) return;

    if (!value) {
      if (!(conversationId in current)) return;
      const next = { ...current };
      delete next[conversationId];
      draftsStore.set(next);
      return;
    }

    draftsStore.set({ ...current, [conversationId]: value });
  }, []);

  const clearDraft = useCallback(
    (conversationId: string) => setDraft(conversationId, ''),
    [setDraft],
  );

  return { getDraft, setDraft, clearDraft };
}
