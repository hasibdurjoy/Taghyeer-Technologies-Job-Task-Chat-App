import { API_BASE_URL } from '@/lib/config';
import type { ApiErrorBody } from '@/types/api';

/**
 * Every failure from the API surfaces as one of these, so UI code never has to
 * inspect a raw response body.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | number;
  readonly details: Array<{ path: string; message: string }>;

  constructor(
    status: number,
    code: string | number,
    message: string,
    details: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * True when the session is no longer usable.
   *
   * Upstream returns 400 `NO_TOKEN` for a missing header and 401 `INVALID_TOKEN`
   * for a bad one — both mean "log in again".
   */
  get isAuthError(): boolean {
    return this.status === 401 || this.code === 'NO_TOKEN' || this.code === 'INVALID_TOKEN';
  }

  /** The upstream invalid-regex error, produced by unescaped input to `/users/search`. */
  get isInvalidRegex(): boolean {
    return this.code === 51091;
  }

  /** First validation detail, if any — useful for inline field errors. */
  get firstDetail(): string | null {
    return this.details[0]?.message ?? null;
  }
}

/** A network/CORS failure, or the free-tier host cold-starting. */
export class NetworkError extends Error {
  constructor(message = 'Could not reach the server. Check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  return typeof error === 'object' && error !== null && 'message' in error;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  /** Override the base URL — used for this app's own routes under `/api`. */
  baseUrl?: string;
}

/**
 * Single entry point for all HTTP traffic.
 *
 * Handles auth headers, query building, error normalization and the upstream's
 * three different success envelopes (see docs/API.md → Conventions).
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, query, signal, baseUrl = API_BASE_URL } = options;

  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // Re-throw aborts untouched so callers can distinguish cancellation.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new NetworkError();
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.details,
      );
    }
    throw new ApiError(response.status, 'UNKNOWN', `Request failed (${response.status})`);
  }

  return payload as T;
}

/**
 * Unwraps the `{ data: [...] }` envelope used by `GET /conversations`.
 * Other list endpoints return a bare array.
 */
export function unwrapData<T>(payload: { data?: T[] } | T[] | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}
