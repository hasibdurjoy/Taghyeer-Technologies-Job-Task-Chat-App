const UPSTREAM_ORIGIN = 'https://frontend-task-chatapp.onrender.com';

/** REST base. The upstream API is served under `/api`. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? `${UPSTREAM_ORIGIN}/api`;

/**
 * Socket.io lives at the *root* origin, not under `/api` — Socket.io serves
 * itself from `/socket.io/`. Pointing this at the REST base silently fails.
 */
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, '') ?? UPSTREAM_ORIGIN;

/** Page size for message history requests. */
export const MESSAGE_PAGE_SIZE = 30;

/** Debounce before a search query is sent, in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Upstream caps `/users/search` at this many results with no indication in the payload. */
export const SEARCH_RESULT_CAP = 50;
