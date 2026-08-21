/**
 * A tiny `localStorage`-backed external store.
 *
 * Reading browser storage inside an effect and copying it into state causes a
 * cascading render and needs a hydration guard. Modelling storage as what it
 * actually is — an external store — lets components read it with
 * `useSyncExternalStore`: correct during SSR via the server snapshot, with no
 * extra render, and updated automatically when another tab writes to it.
 */

export interface LocalStore<T> {
  subscribe: (onStoreChange: () => void) => () => void;
  /** Cached so repeated calls return a referentially stable value. */
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  get: () => T;
  set: (value: T) => void;
  clear: () => void;
}

export function createLocalStore<T>(key: string, fallback: T): LocalStore<T> {
  const listeners = new Set<() => void>();

  // `useSyncExternalStore` compares snapshots by identity, so a fresh parse on
  // every call would loop forever. The parsed value is cached against the exact
  // raw string it came from and only recomputed when that string changes.
  let cachedRaw: string | null = null;
  let cachedValue: T = fallback;
  let hasCached = false;

  function read(): T {
    if (typeof window === 'undefined') return fallback;

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      // Storage blocked (private mode, browser settings) — behave as if empty.
      return fallback;
    }

    if (hasCached && raw === cachedRaw) return cachedValue;

    cachedRaw = raw;
    hasCached = true;
    if (raw === null) {
      cachedValue = fallback;
      return cachedValue;
    }

    try {
      cachedValue = JSON.parse(raw) as T;
    } catch {
      cachedValue = fallback;
    }
    return cachedValue;
  }

  function emit(): void {
    for (const listener of listeners) listener();
  }

  return {
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);

      // Keep tabs in sync: `storage` fires in every *other* tab on a write.
      const handleStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== key) return;
        onStoreChange();
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        listeners.delete(onStoreChange);
        window.removeEventListener('storage', handleStorage);
      };
    },

    getSnapshot: read,
    getServerSnapshot: () => fallback,
    get: read,

    set(value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Non-fatal: the value simply won't survive a reload.
      }
      emit();
    },

    clear() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore.
      }
      emit();
    },
  };
}
