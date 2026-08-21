import { request } from '@/lib/api/http';
import { normalizeUser } from '@/lib/api/normalize';
import type { RawLoginResponse, RawUser } from '@/types/api';
import type { User } from '@/types/chat';

export interface LoginResult {
  token: string;
  user: User;
}

/**
 * Login and registration in one call — an unknown phone number is registered
 * automatically, a known one logs in.
 *
 * Note: signing in with an existing phone but a different name overwrites the
 * stored display name. That is upstream behaviour (docs/API.md → Auth).
 */
export async function login(phone: string, name: string): Promise<LoginResult> {
  const raw = await request<RawLoginResponse>('/auth/login', {
    method: 'POST',
    body: { phone: phone.trim(), name: name.trim() },
  });
  return { token: raw.token, user: normalizeUser(raw.user) };
}

/** Resolves the user behind a token. Used to restore a session and to validate tokens server-side. */
export async function getMe(token: string, signal?: AbortSignal): Promise<User> {
  const raw = await request<RawUser>('/auth/me', { token, signal });
  return normalizeUser(raw);
}
