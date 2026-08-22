'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tracks a CSS media query from JavaScript.
 *
 * Modelled as an external store rather than state synced in an effect: the match
 * lives in the browser, not in React, so `useSyncExternalStore` reads it without
 * an extra render and gives a defined server snapshot for SSR.
 *
 * Returns `false` during server rendering, so callers should treat `false` as
 * "not known to match" — safe for progressive enhancement, where the layout is
 * driven by CSS and this only decides behaviour.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
