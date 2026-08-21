# API Reference

Documentation for the chat backend at `https://frontend-task-chatapp.onrender.com`.

The upstream Swagger spec (`/docs/`) is **intentionally request-only** — it documents endpoints,
methods, parameters and request bodies, but specifies **no response bodies and no status codes**.
Everything documented below was derived by probing the live API: three throwaway accounts were
created and used to exercise every endpoint, both success and failure paths, plus a real Socket.io
session to observe the real-time events.

- [Conventions](#conventions)
- [Auth](#auth)
- [Users](#users)
- [Conversations](#conversations)
- [Messages](#messages)
- [Groups](#groups)
- [WebSocket (Socket.io)](#websocket-socketio)
- [Error format](#error-format)
- [Known quirks](#known-quirks)

---

## Conventions

| | |
|---|---|
| REST base URL | `https://frontend-task-chatapp.onrender.com/api` |
| Socket.io origin | `https://frontend-task-chatapp.onrender.com` (**root**, not `/api`) |
| Auth header | `Authorization: Bearer <jwt>` |
| IDs | MongoDB ObjectId hex strings, returned as `_id` over REST |
| Timestamps | ISO-8601 UTC strings over REST (`2026-08-21T17:33:09.103Z`) |

Both are configurable in this app via `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SOCKET_URL`.

### Response envelopes are inconsistent

There is no single envelope. Each shape below is real and must be handled:

| Endpoint | Envelope |
|---|---|
| `GET /conversations` | `{ "data": [ … ] }` |
| `GET /conversations/{id}/messages` | `{ "messages": [ … ], "hasMore": bool }` |
| `GET /users/search` | bare array `[ … ]` |
| everything else | bare object |

The frontend normalizes all of these in [`lib/api/http.ts`](../lib/api/http.ts) and
[`lib/api/normalize.ts`](../lib/api/normalize.ts) so that UI code only ever sees the domain types in
[`types/chat.ts`](../types/chat.ts) — notably `_id` is normalized to `id` and all timestamps to ISO strings.

---

## Auth

### `POST /auth/login`

Login and registration in a single step. If the phone number is unknown an account is created; if it
already exists the user is logged in. No separate signup flow exists. **Not authenticated.**

**Request**

```json
{ "phone": "+15551234567", "name": "Ada Lovelace" }
```

Both fields are required.

**Response `200`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "6a888bc2e5d6aac97523ae13",
    "name": "Ada Lovelace",
    "phone": "+15550109945",
    "createdAt": "2026-08-21T17:32:50.428Z"
  }
}
```

The JWT payload is `{ "sub": "<userId>", "iat": …, "exp": … }` with a **7 day** lifetime. It is signed
with a secret we do not hold, so the token can only be validated by calling the API.

**Errors**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error":{"message":"Validation failed","code":"VALIDATION_ERROR","details":[{"path":"name","message":"Required"}]}}` | missing field |
| `400` | `…"details":[{"path":"phone","message":"phone is required"}]` | empty phone |

**Frontend usage** — [`lib/api/auth.ts`](../lib/api/auth.ts) `login()`, called from the login form.
The token and user are persisted to `localStorage` by [`lib/auth/session.ts`](../lib/auth/session.ts).

> **Note:** logging in with an existing phone but a different name **overwrites the stored display
> name**. This is upstream behaviour, not a bug in this app.

### `GET /auth/me`

Returns the user for the bearer token. Used to restore a session on page load and to validate tokens
server-side.

**Response `200`** — a bare user object (no envelope):

```json
{
  "_id": "6a888bc2e5d6aac97523ae13",
  "name": "Ada Lovelace",
  "phone": "+15550109945",
  "createdAt": "2026-08-21T17:32:50.428Z"
}
```

**Errors**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error":{"message":"No token provided","code":"NO_TOKEN"}}` | header absent |
| `401` | `{"error":{"message":"Invalid token","code":"INVALID_TOKEN"}}` | malformed/expired token |

Note the inconsistency: a *missing* token is `400`, not `401`. The app treats both as
"unauthenticated" (see [`lib/api/http.ts`](../lib/api/http.ts)).

**Frontend usage** — [`lib/api/auth.ts`](../lib/api/auth.ts) `getMe()`, called on app boot to
rehydrate the session and revalidate a stored token on boot.

---

## Users

### `GET /users/search?q=<term>`

Searches users by name or phone.

**Response `200`** — bare array, **capped at 50 results**:

```json
[
  { "_id": "6a888bc3e5d6aac97523ae1b", "name": "Grace Probe", "phone": "+15550209945" }
]
```

No results is `200` with `[]`. An **empty or omitted `q` returns the first 50 users** rather than an
error — the app treats a blank query as "don't search".

**Matching semantics** (established by probing — not documented upstream):

| Field | Behaviour | Evidence |
|---|---|---|
| `name` | prefix-anchored regex, **case-sensitive** | `Grace` → 33 hits, `race` → 0, `grace` → 0 |
| `phone` | **exact string equality** | `01672589498` → 1 hit, `0167` → 0, `6725` → 0 |

`q` is interpolated **directly into a MongoDB regex** with no escaping, so regex metacharacters are
executed (`.*` and `^` match everything, `(?i)grace` performs a case-insensitive match) and invalid
patterns crash the server:

| `q` | Status | Body |
|---|---|---|
| `+15550209945` | `500` | `{"error":{"message":"Regular expression is invalid: quantifier does not follow a repeatable item","code":51091}}` |
| `(` | `500` | `…"missing closing parenthesis","code":51091` |
| `*`, `?` | `500` | `…"quantifier does not follow a repeatable item"` |

> **Consequence:** a phone number in E.164 format (`+1555…`) **can never be found**. The leading `+`
> crashes the name-regex compile before the phone equality check is ever reached, and no escaping
> works because the same raw `q` is used for both the regex *and* the exact match. See
> [Known quirks](#known-quirks) for how the frontend mitigates this.

**Frontend usage** — [`lib/api/users.ts`](../lib/api/users.ts) `searchUsers()`. It builds a small set
of safe query variants (raw when regex-safe, a capitalized variant to work around case-sensitivity,
and a digits-only variant for phones), runs them concurrently, and merges results by id.

---

## Conversations

### `GET /conversations`

All conversations the current user belongs to, direct and group, **sorted by `updatedAt` descending**.

**Response `200`**

```json
{
  "data": [
    {
      "_id": "6a888bdfe5d6aac97523af3b",
      "type": "group",
      "name": "Probe Team",
      "createdBy": "6a888bc2e5d6aac97523ae13",
      "admins": ["6a888bc2e5d6aac97523ae13"],
      "participants": [
        { "_id": "6a888bc2e5d6aac97523ae13", "name": "Ada", "phone": "+15550109945" },
        { "_id": "6a888bc3e5d6aac97523ae1b", "name": "Grace", "phone": "+15550209945" }
      ],
      "lastMessage": {
        "text": "Hi group",
        "sender": "6a888bc3e5d6aac97523ae1b",
        "createdAt": "2026-08-21T17:33:21.746Z"
      },
      "updatedAt": "2026-08-21T17:33:21.981Z"
    },
    {
      "_id": "6a888bcfe5d6aac97523ae86",
      "type": "direct",
      "participant": {
        "_id": "6a888bc3e5d6aac97523ae1b",
        "name": "Grace Probe",
        "phone": "+15550209945"
      },
      "lastMessage": { "text": "See you", "sender": "…", "createdAt": "…" },
      "updatedAt": "2026-08-21T17:33:11.763Z"
    }
  ]
}
```

Shape differences that matter:

- `type` is `"direct"` or `"group"`.
- **Direct** conversations carry `participant` (singular, the *other* user, already populated).
  **Group** conversations carry `participants` (plural, includes you) plus `name`, `admins`, `createdBy`.
- `lastMessage` is **`{}` when the conversation has no messages yet**, not `null`.
- `lastMessage.sender` is an **id string**, not a populated user.
- There is **no unread count and no read state** anywhere in this payload.

**Frontend usage** — [`lib/api/conversations.ts`](../lib/api/conversations.ts) `listConversations()`,
consumed by [`hooks/useConversations.ts`](../hooks/useConversations.ts). Normalized into a single
`Conversation` type with a computed `title`, so `ConversationItem` never branches on `type` for data
access.

### `POST /conversations`

Start (or re-open) a 1-to-1 conversation. **Idempotent** — calling it twice with the same `userId`
returns the identical conversation, so the frontend never needs a "does it already exist" check.

**Request** — `{ "userId": "665f0c2a9b1e4a0012ab34cd" }`

**Response `200`** — a **bare, sparse** conversation. Note it has **no `type`, no populated
participant and no `lastMessage`** — it is *not* the same shape as an item from `GET /conversations`:

```json
{
  "_id": "6a888bcfe5d6aac97523ae86",
  "participants": ["6a888bc2e5d6aac97523ae13", "6a888bc3e5d6aac97523ae1b"],
  "createdAt": "2026-08-21T17:33:03.455Z"
}
```

**Errors**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error":{"message":"One or more users do not exist","code":"UNKNOWN_USER"}}` | valid ObjectId, no such user |
| `500` | `{"error":{"message":"Cast to ObjectId failed …","code":"SERVER_ERROR"}}` | malformed id |

**Frontend usage** — [`lib/api/conversations.ts`](../lib/api/conversations.ts) `startDirectConversation()`.
Because the response is sparse, the app refreshes the conversation list after creating one rather than
trying to insert the partial object into the sidebar.

### `GET /conversations/{id}/messages`

See [Messages](#messages).

---

## Messages

### `GET /conversations/{id}/messages?limit=&before=`

Paginated message history.

| Param | In | Required | Notes |
|---|---|---|---|
| `id` | path | yes | conversation id |
| `limit` | query | no | page size |
| `before` | query | no | cursor — a message id |

**Response `200`** — messages are returned **newest-first (descending)**:

```json
{
  "messages": [
    {
      "_id": "6a888bd7e5d6aac97523aef4",
      "conversation": "6a888bcfe5d6aac97523ae86",
      "sender": "6a888bc2e5d6aac97523ae13",
      "text": "Hello",
      "createdAt": "2026-08-21T17:33:11.528Z"
    }
  ],
  "hasMore": true
}
```

`sender` is an **id string**, never a populated user — the frontend resolves names from the
conversation's participants.

**Errors**

| Status | Body | Cause |
|---|---|---|
| `404` | `{"error":{"message":"Conversation not found","code":"NOT_FOUND"}}` | unknown id |
| `403` | `{"error":{"message":"Not a participant of this conversation","code":"FORBIDDEN"}}` | not a member |

**Pagination caveats** — both verified:

- The `before` cursor is **inclusive**: requesting `before=X` returns `X` again as the first item, so
  every page after the first duplicates one message.
- An **invalid `before` is silently ignored** and page 1 is returned again, which would loop forever
  in a naive "load older" implementation.

The frontend handles both in [`hooks/useMessages.ts`](../hooks/useMessages.ts): pages are reversed to
ascending order, merged through an id-keyed map that drops duplicates, and paging stops when a page
yields no genuinely new messages.

**Frontend usage** — [`lib/api/messages.ts`](../lib/api/messages.ts) `getMessages()`.

### `POST /messages`

Send a message to a direct or group conversation.

**Request** — `{ "conversationId": "…", "text": "Hello!" }`

**Response `200`** — the created message, same shape as a history item:

```json
{
  "_id": "6a888bd5e5d6aac97523aecf",
  "conversation": "6a888bcfe5d6aac97523ae86",
  "sender": "6a888bc2e5d6aac97523ae13",
  "text": "Hello from probe 1",
  "createdAt": "2026-08-21T17:33:09.103Z"
}
```

**Errors** — `404 NOT_FOUND` for an unknown conversation, `403 FORBIDDEN` if not a participant.

> **No text validation upstream.** `text: "   "` and `text: ""` are both accepted and stored,
> returning `200`. The frontend rejects empty/whitespace-only input before sending.

**Frontend usage** — [`lib/api/messages.ts`](../lib/api/messages.ts) `sendMessage()`. The app sends
over **REST rather than the socket** because REST returns the created message, which lets an
optimistic bubble be reconciled with its real id. See [WebSocket](#websocket-socketio).

---

## Groups

A conversation is a group when it has **three or more members**. The creator becomes the first admin.

### `POST /conversations/group`

**Request**

```json
{ "name": "Project Team", "participantIds": ["<id>", "<id>"] }
```

`participantIds` excludes you, and must contain **at least 2** ids (3 members total).

**Response `201`** — the full group, with `participants` populated and `admins` set to `[creatorId]`
(same shape as a group item from `GET /conversations`, minus `lastMessage`).

**Errors**

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [{ "path": "participantIds", "message": "a group needs at least 3 members" }]
  }
}
```

**Frontend usage** — [`lib/api/conversations.ts`](../lib/api/conversations.ts) `createGroup()`. The
create-group dialog enforces the ≥2 rule client-side so the error is prevented rather than reported,
and surfaces upstream `details[]` inline if it still occurs.

### Group administration

All admin-only; a non-admin receives `403 FORBIDDEN` (e.g. `"Only admins can rename the group"`).

| Method | Path | Body | Purpose |
|---|---|---|---|
| `POST` | `/conversations/{id}/participants` | `{ "userIds": ["…"] }` | add members |
| `DELETE` | `/conversations/{id}/participants/{userId}` | — | remove a member; **your own id leaves the group** |
| `POST` | `/conversations/{id}/admins` | `{ "userId": "…" }` | promote to admin |
| `PATCH` | `/conversations/{id}` | `{ "name": "…" }` | rename group |

All return the updated group object. Each also broadcasts `conversation:updated` over the socket.

---

## WebSocket (Socket.io)

Real-time is genuine Socket.io — **verified working**, so this app uses **no polling at all**.

Connect to the **root origin**, not the `/api` base (Socket.io serves itself from `/socket.io/`):

```ts
import { io } from 'socket.io-client'
const socket = io('https://frontend-task-chatapp.onrender.com', { auth: { token } })
```

An invalid or missing token is rejected with a `connect_error` carrying `message: "Invalid token"`.

### Events

| Direction | Event | Payload |
|---|---|---|
| client → server | `message:send` | `{ conversationId, text }`, optional ack |
| server → client | `message:new` | the new message |
| server → client | `conversation:updated` | a group you belong to was created/renamed/changed |

**`message:send` ack** — `{ "ok": true }` on success, `{ "ok": false, "error": "Conversation not found" }`
on failure. The ack **does not include the created message**.

**`message:new` payload** — note this differs from every REST message shape:

```json
{
  "id": "6a888d77e5d6aac97523bbce",
  "conversation": "6a888bcfe5d6aac97523ae86",
  "sender": "6a888bc3e5d6aac97523ae1b",
  "text": "REST from B",
  "createdAt": 1787334007888
}
```

`id` instead of `_id`, and `createdAt` is an **epoch-milliseconds number** instead of an ISO string.
[`lib/api/normalize.ts`](../lib/api/normalize.ts) reconciles both into one `Message` type.

**`conversation:updated` payload** — the full group conversation object (with `_id`, `participants`
populated, `admins`), without `lastMessage`. Delivered to all members including the actor.

### Two behaviours that shape the design

1. **The sender never receives their own `message:new`.** Verified in both directions: when A sends,
   only B receives the event, and vice-versa. This means **optimistic UI cannot produce a duplicate
   bubble** — there is no echo to de-duplicate against. It also means the sender must update their own
   sidebar preview locally, because no event will arrive to do it for them.
2. **Messages sent over REST are broadcast identically** to messages sent over the socket. So the app
   sends over REST (which returns the created message with its real id, enabling clean optimistic
   reconciliation) and uses the socket purely for *receiving*.

> The socket does **not** validate text either: `message:send` with `text: ""` returns `{ok:true}` and
> broadcasts an empty message.

**Frontend usage** — [`hooks/useRealtime.ts`](../hooks/useRealtime.ts) owns a single shared connection
for the whole app, exposes connection status, and refetches on reconnect to close any gap of messages
missed while disconnected.

---

## Error format

Errors are consistently shaped, which is genuinely helpful:

```json
{ "error": { "message": "Not a participant of this conversation", "code": "FORBIDDEN" } }
```

Validation errors add `details`:

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [{ "path": "participantIds", "message": "a group needs at least 3 members" }]
  }
}
```

| `code` | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | bad request body; see `details[]` |
| `NO_TOKEN` | **400** | `Authorization` header missing |
| `INVALID_TOKEN` | 401 | malformed or expired JWT |
| `FORBIDDEN` | 403 | not a participant / not an admin |
| `NOT_FOUND` | 404 | unknown conversation or route |
| `UNKNOWN_USER` | 400 | referenced user id does not exist |
| `SERVER_ERROR` | 500 | unhandled upstream error (e.g. ObjectId cast failure) |
| `51091` | 500 | **numeric** code — MongoDB invalid-regex error from `/users/search` |

`code` is therefore `string | number`, typed accordingly in [`types/api.ts`](../types/api.ts). All
error responses are parsed into a single `ApiError` class in [`lib/api/http.ts`](../lib/api/http.ts),
so UI components never inspect raw response bodies.

### `GET /health`

Documented in the Swagger spec under the `/api` server, but actually served at the **root**:
`https://frontend-task-chatapp.onrender.com/health` → `{"status":"ok"}`. Under `/api` it returns
`404 NOT_FOUND`.

---

## Known quirks

A consolidated list of upstream behaviours this frontend works around. Each is handled in exactly one
place so the rest of the codebase stays clean.

| # | Quirk | Handling |
|---|---|---|
| 1 | Socket messages use `id` + epoch `createdAt`; REST uses `_id` + ISO string | single normalizer in `lib/api/normalize.ts` |
| 2 | Three different response envelopes | unwrapped in `lib/api/http.ts` |
| 3 | Message history is newest-first | reversed to ascending once, in `useMessages` |
| 4 | `before` cursor is inclusive → duplicate per page | id-keyed merge drops duplicates |
| 5 | Invalid `before` silently returns page 1 | paging stops when a page adds nothing new |
| 6 | Empty / whitespace-only text is accepted | client-side validation before send |
| 7 | Search `q` is an unescaped regex → `500` on `+ * ? (` | metacharacters stripped for name variants; the numeric `51091` error is caught and shown as a friendly message |
| 8 | Search is case-sensitive and prefix-anchored | a capitalized variant is queried alongside the raw term |
| 9 | **Phone search is impossible for `+`-prefixed numbers** | a digits-only variant is also queried (matches users stored without `+`); the UI explains that a phone must be entered exactly as registered |
| 10 | Search silently caps at 50 results | UI notes when a result set is truncated |
| 11 | Sender receives no `message:new` echo | optimistic send + local sidebar update |
| 12 | `POST /conversations` returns a sparse object | conversation list refreshed after creation |
| 13 | `POST /conversations` with your own id returns an unrelated conversation | self is excluded from search results |
| 14 | `lastMessage` is `{}`, not `null`, when empty | treated as absent during normalization |
| 15 | Missing token is `400`, not `401` | both mapped to "unauthenticated" |
| 16 | Re-login overwrites the display name | documented; the login form pre-fills the last used name |
| 17 | No unread/read state in the API | unread badges are tracked in-session only; see README → Architecture |
