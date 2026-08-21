'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import { getMe, login as loginRequest } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/http';
import { clearSession, saveSession, sessionStore } from '@/lib/auth/session';
import type { User } from '@/types/chat';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** True until the stored session has been revalidated against the API. */
  isRestoring: boolean;
  login: (phone: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the session for the whole app.
 *
 * The session is read straight from its store, so the stored user is available
 * on the very first client render with no hydration mismatch. In the background
 * the token is revalidated against `GET /auth/me`, which expires dead sessions
 * and picks up a display name changed by a later sign-in elsewhere.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getServerSnapshot,
  );

  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const stored = sessionStore.get();
    if (!stored) {
      // No session to validate; resolving asynchronously keeps this out of the
      // render pass that mounted the effect.
      const timer = setTimeout(() => setIsRestoring(false), 0);
      return () => clearTimeout(timer);
    }

    const controller = new AbortController();

    getMe(stored.token, controller.signal)
      .then((fresh) => saveSession({ token: stored.token, user: fresh }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Only drop the session on a genuine auth failure — a network blip or a
        // cold-starting host must not sign the user out.
        if (error instanceof ApiError && error.isAuthError) clearSession();
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRestoring(false);
      });

    return () => controller.abort();
  }, []);

  const login = useCallback(async (phone: string, name: string) => {
    const result = await loginRequest(phone, name);
    saveSession(result);
  }, []);

  const logout = useCallback(() => clearSession(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isRestoring,
      login,
      logout,
    }),
    [session, isRestoring, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
