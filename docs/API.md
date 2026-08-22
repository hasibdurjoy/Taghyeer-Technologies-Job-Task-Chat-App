# API Reference

The chat backend at `https://frontend-task-chatapp.onrender.com`.

The upstream Swagger spec at `/docs/` lists endpoints, methods and request bodies — but **no response
bodies and no status codes**. Everything below was found by probing the live API: three throwaway
accounts exercising every endpoint on both success and failure paths, plus a real Socket.io session
to watch the events.

- [Quick reference](#quick-reference)
- [Conventions](#conventions)
- [Auth](#auth) · [Users](#users) · [Conversations](#conversations) · [Messages](#messages) · [Groups](#groups)
- [Realtime](#realtime-socketio) · [There is no typing / presence channel](#there-is-no-typing--presence-channel)
- [This app's own endpoints](#this-apps-own-endpoints)
- [Errors](#errors) · [Known quirks](#known-quirks) · [Where each endpoint is used](#where-each-endpoint-is-used)

---

## Quick reference

Every endpoint, at a glance. All need `Authorization: Bearer <jwt>` except login.

| Method | Path | Does | Returns |
|---|---|---|---|
| `POST` | `/auth/login` | log in **or** register | `{token, user}` |
| `GET` | `/auth/me` | current user from token | bare user |
| `GET` | `/users/search?q=` | find people | bare array, max 50 |
| `GET` | `/conversations` | your conversations | `{data: [...]}` |
| `POST` | `/conversations` | start a 1-to-1 | sparse conversation |
| `POST` | `/conversations/group` | create a group | full group |
| `GET` | `/conversations/{id}/messages` | history, newest-first | `{messages, hasMore}` |
| `POST` | `/messages` | send a message | the created message |
| `PATCH` | `/conversations/{id}` | rename a group | updated group |
| `POST` | `/conversations/{id}/participants` | add members | updated group |
| `DELETE` | `/conversations/{id}/participants/{userId}` | remove a member | updated group |
| `POST` | `/conversations/{id}/admins` | promote to admin | updated group |
| `GET` | `/health` | health check (**at the root, not `/api`**) | `{status:"ok"}` |

Socket.io, on the root origin: `message:new` and `conversation:updated` come down, `message:send`
goes up.

---

## Conventions

| | |
|---|---|
| REST base | `https://frontend-task-chatapp.onrender.com/api` |
| Socket.io | `https://frontend-task-chatapp.onrender.com` — the **root**, no `/api` |
| Auth | `Authorization: Bearer <jwt>` |
| IDs | Mongo ObjectId hex strings, sent as `_id` |
| Timestamps | ISO-8601 UTC over REST — but **epoch milliseconds over the socket** |

Both URLs are configurable here via `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SOCKET_URL`.

**There is no single response envelope.** Four shapes are in play:

| Endpoint | Wrapped in |
|---|---|
| `GET /conversations` | `{"data": [...]}` |
| `GET /conversations/{id}/messages` | `{"messages": [...], "hasMore": bool}` |
| `GET /users/search` | a bare array |
| everything else | a bare object |

All four are unwrapped in [`lib/api/http.ts`](../lib/api/http.ts), and `_id` → `id` plus timestamp
normalization happen in [`lib/api/normalize.ts`](../lib/api/normalize.ts). UI code only ever sees the
types in [`types/chat.ts`](../types/chat.ts).

---

## Auth

### `POST /auth/login`

Login and registration in one call. Unknown phone → account created. Known phone → logged in. There
is no separate signup. **No auth required.**

```jsonc
→ { "phone": "+15551234567", "name": "Ada Lovelace" }

← 200
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "_id": "6a888bc2...", "name": "Ada Lovelace",
            "phone": "+15550109945", "createdAt": "2026-08-21T17:32:50.428Z" }
}
```

- JWT payload is `{sub, iat, exp}`, **7-day** lifetime. It is signed with a secret we don't hold, so
  a token can only be validated by calling the API.
- `400 VALIDATION_ERROR` — a missing or empty field, with the offending field in `details[]`.

> ⚠️ Logging in with an existing phone but a **different name overwrites the stored display name**.
> Upstream behaviour, not a bug here.

### `GET /auth/me`

The user behind the token. Used to restore a session on load.

```jsonc
← 200  { "_id": "...", "name": "...", "phone": "...", "createdAt": "..." }   // bare, no envelope
```

- `400 NO_TOKEN` — header absent. Note: **not** a `401`.
- `401 INVALID_TOKEN` — malformed or expired.

---

## Users

### `GET /users/search?q=<term>`

```jsonc
← 200  [ { "_id": "...", "name": "Grace Probe", "phone": "+15550209945" } ]   // bare array
```

Capped at **50 results**, silently. No matches is `200` with `[]`. An **empty `q` returns the first
50 users** rather than an error.

**How matching actually works** — probed, not documented:

| Field | Behaviour | Evidence |
|---|---|---|
| `name` | prefix-anchored regex, **case-sensitive** | `Grace` → 33 hits · `race` → 0 · `grace` → 0 |
| `phone` | **exact string equality** | `01672589498` → 1 hit · `0167` → 0 |

**`q` goes straight into a MongoDB regex unescaped.** Metacharacters execute, and invalid patterns
crash the server with a *numeric* code:

| `q` | Result |
|---|---|
| `+15550209945` | `500` — `"quantifier does not follow a repeatable item"`, code `51091` |
| `(` | `500` — `"missing closing parenthesis"` |
| `.*` or `^` | matches everything |

> ⚠️ **A `+`-prefixed phone number can never be found.** The `+` crashes the regex compile before the
> phone equality check is reached, and escaping doesn't help — the same raw `q` feeds both the regex
> *and* the exact match. Mitigation in [quirk #9](#known-quirks).

---

## Conversations

### `GET /conversations`

Everything you belong to, direct and group, sorted by `updatedAt` descending.

```jsonc
← 200
{ "data": [
    { "_id": "...", "type": "group", "name": "Probe Team",
      "createdBy": "...", "admins": ["..."],
      "participants": [ {"_id":"...", "name":"Ada", "phone":"..."}, ... ],   // includes you
      "lastMessage": { "text": "Hi group", "sender": "<id>", "createdAt": "..." },
      "updatedAt": "..." },

    { "_id": "...", "type": "direct",
      "participant": { "_id":"...", "name":"Grace Probe", "phone":"..." },   // singular, the OTHER user
      "lastMessage": { ... }, "updatedAt": "..." }
] }
```

Four things to watch:

- **Direct** carries `participant` (singular, the other person). **Group** carries `participants`
  (plural, includes you) plus `name`, `admins`, `createdBy`.
- `lastMessage` is **`{}` when there are no messages** — not `null`.
- `lastMessage.sender` is an **id string**, never a populated user.
- There is **no unread count and no read state** anywhere.

### `POST /conversations`

Start or re-open a 1-to-1. **Idempotent** — same `userId` twice returns the same conversation, so no
"does it exist already" check is needed.

```jsonc
→ { "userId": "665f0c2a9b1e4a0012ab34cd" }

← 200  { "_id": "...", "participants": ["<id>","<id>"], "createdAt": "..." }
```

> ⚠️ That response is **sparse** — no `type`, no populated participant, no `lastMessage`. It is *not*
> the shape `GET /conversations` returns, so it can't be dropped straight into the sidebar
> ([quirk #12](#known-quirks)).

- `400 UNKNOWN_USER` — well-formed id, no such user.
- `500 SERVER_ERROR` — malformed id (`Cast to ObjectId failed`).

---

## Messages

### `GET /conversations/{id}/messages?limit=&before=`

`limit` is the page size, `before` is a message id used as a cursor. Both optional.

```jsonc
← 200
{ "messages": [
    { "_id": "...", "conversation": "...", "sender": "<id>",
      "text": "Hello", "createdAt": "2026-08-21T17:33:11.528Z" }
  ],
  "hasMore": true }
```

Messages come back **newest-first**. `sender` is an id, never populated — names are resolved from the
conversation's participants.

> ⚠️ **Two pagination traps, both verified.** `before=X` is **inclusive**, so X comes back again as
> the first item of the next page ([quirk #4](#known-quirks)). And an **invalid `before` is silently
> ignored**, returning page 1 again — a naive "load older" loop would never terminate
> ([quirk #5](#known-quirks)).

- `404 NOT_FOUND` — unknown conversation · `403 FORBIDDEN` — not a member.

### `POST /messages`

```jsonc
→ { "conversationId": "...", "text": "Hello!" }

← 200  { "_id": "...", "conversation": "...", "sender": "...", "text": "Hello!", "createdAt": "..." }
```

Same shape as a history item — which is why this app sends over **REST rather than the socket**: the
real id comes straight back, so an optimistic bubble can be reconciled cleanly.

> ⚠️ **No text validation upstream.** `""` and `"   "` are both accepted and stored, returning `200`.

- `404 NOT_FOUND` · `403 FORBIDDEN`.

---

## Groups

A conversation is a group at **three or more members**. The creator becomes the first admin.

### `POST /conversations/group`

```jsonc
→ { "name": "Project Team", "participantIds": ["<id>", "<id>"] }   // excludes you, min 2

← 201  full group, participants populated, admins: [creatorId]
```

Fewer than 2 ids gives `400 VALIDATION_ERROR` with
`details: [{path: "participantIds", message: "a group needs at least 3 members"}]`.

### Group administration

All four return the **complete updated group** — populated `participants` and `admins` — with `200`,
and broadcast `conversation:updated` to every current member.

| Method | Path | Body | Does | Who may |
|---|---|---|---|---|
| `PATCH` | `/conversations/{id}` | `{name}` | rename | admins |
| `POST` | `/conversations/{id}/participants` | `{userIds: []}` | add members | admins |
| `DELETE` | `/conversations/{id}/participants/{userId}` | — | remove a member | admins — **but any member may pass their own id, which is "leave group"** |
| `POST` | `/conversations/{id}/admins` | `{userId}` | promote to admin | admins |

**Errors**, all verified:

| Status | Body | Cause |
|---|---|---|
| `403` | `…"Only admins can rename the group","code":"FORBIDDEN"` | non-admin rename |
| `403` | `…"Only admins can add participants"` | non-admin add |
| `403` | `…"Only admins can remove other members"` | non-admin removing **someone else** |
| `403` | `…"Only admins can promote members"` | non-admin promote |
| `400` | `…"VALIDATION_ERROR","details":[{"path":"name","message":"name is required"}]` | blank rename |
| `400` | `…"VALIDATION_ERROR","details":[{"path":"userIds","message":"userIds is required"}]` | empty `userIds` |
| `400` | `{"error":{"message":"One or more users do not exist","code":"UNKNOWN_USER"}}` | unknown id in `userIds` |
| `400` | `{"error":{"message":"Target user is not a member of this group","code":"NOT_A_MEMBER"}}` | promoting a non-member |

Behaviours established by probing, not assumed:

- **Re-adding an existing member is a no-op**, not an error — `200`, member list unchanged.
- **Promoting an existing admin is also a no-op** — `200`, admins unchanged.
- **There is no demote endpoint and no delete-group endpoint.** Promotion is one-way and a group
  cannot be disbanded; the UI says so rather than letting a user find out afterwards.
- **A group is never auto-deleted.** It survives down to one remaining member and still appears in
  that member's list.
- **Leaving is asymmetric with removing.** `DELETE …/participants/{yourOwnId}` works for any member;
  the same call aimed at someone else needs admin rights.

**Frontend usage** — `renameGroup`, `addParticipants`, `removeParticipant` and `promoteToAdmin` in
[`lib/api/conversations.ts`](../lib/api/conversations.ts), wrapped by
[`hooks/useGroupAdmin.ts`](../hooks/useGroupAdmin.ts) for pending state and one error path. Each
response is authoritative, so it is applied directly rather than triggering a refetch — the
`conversation:updated` that follows merges to the same state.

---

## Realtime (Socket.io)

Real Socket.io, verified working — so this app does **no polling at all**. Connect to the root
origin; Socket.io serves itself from `/socket.io/`.

```ts
const socket = io('https://frontend-task-chatapp.onrender.com', { auth: { token } })
```

A bad or missing token is rejected at the handshake with `connect_error` / `"Invalid token"`.

| Direction | Event | Payload |
|---|---|---|
| → server | `message:send` | `{conversationId, text}`, optional ack |
| ← server | `message:new` | the new message |
| ← server | `conversation:updated` | a group you're in was created, renamed or changed |

The `message:send` ack is `{ok: true}` or `{ok: false, error}` — it does **not** include the created
message.

```jsonc
// message:new — note this differs from every REST message shape
{ "id": "...", "conversation": "...", "sender": "...", "text": "REST from B",
  "createdAt": 1787334007888 }        // ← `id` not `_id`, epoch ms not ISO
```

**Two behaviours that shaped the whole design:**

1. **The sender never receives their own `message:new`.** Verified both directions. So optimistic UI
   **cannot** produce a duplicate — there's no echo to de-duplicate against. It also means the sender
   has to update their own sidebar preview locally, since no event will arrive to do it.
2. **REST-sent messages broadcast identically** to socket-sent ones. So this app sends over REST and
   uses the socket purely for receiving.

> The socket doesn't validate text either — `message:send` with `text: ""` returns `{ok:true}` and
> broadcasts an empty message.

### Removal still delivers the event to the removed user

When you are removed from a group — or leave one — the server broadcasts the resulting
`conversation:updated` **including to you**, and only then drops you from the room. The last event
you receive therefore describes a group whose `participants` no longer contain you.

Taken at face value it would put a group you can no longer open straight back into your sidebar,
where `GET /conversations` omits it and `GET /conversations/{id}/messages` answers `403`. The
frontend checks membership on the **raw** payload — `rawHasParticipant` in
[`lib/api/normalize.ts`](../lib/api/normalize.ts), because `normalizeConversation` filters you out of
`participants` by design and so can't be checked afterwards — and drops the conversation instead.

### There is no typing / presence channel

Worth recording in full, because "user is typing…" is the obvious next feature and the API cannot
carry it. This was **probed, not assumed**:

- **Socket** — ten candidate events emitted with ack callbacks from an authenticated connection:
  `typing`, `typing:start`, `typing:stop`, `user:typing`, `message:typing`, `conversation:typing`,
  `startTyping`, `stopTyping`, `typing:new`, `is-typing`. **Every one got no ack**, and a second
  socket belonging to the other participant, listening with `onAny`, received **nothing** in any
  case. The server does not relay arbitrary client events.
- **REST** — `POST /typing`, `/conversations/{id}/typing`, `/conversations/{id}/presence`,
  `/presence` and `/events` all return `404`. There is no SSE stream either.

The only member-wide broadcast a client can trigger is `PATCH /conversations/{id}` → but it renames
the group as a side effect, so it's useless as a signalling channel.

**So a typing indicator cannot be built on this API alone.** Since the feature was wanted, this app
runs a small relay of its own, below. Nothing is simulated — what one user sees is another user's
keystrokes — and all chat data still goes through the provided API untouched.

---

## This app's own endpoints

**Not part of the upstream API.** They exist only because of the gap above, and they carry **typing
signals only** — no user, conversation or message data, and nothing is stored. A signal is fanned out
to whoever is listening right now, then discarded.

| Method | Path | Does |
|---|---|---|
| `POST` | `/api/typing` | announce you started or stopped typing |
| `GET` | `/api/typing/stream?conversationId=` | SSE stream of *other* participants' signals |

Both take the same bearer token. It's validated by calling upstream `GET /auth/me` (we hold no
signing secret), and membership is checked against upstream `GET /conversations`. Both are cached
in-process — 60s and 30s — so a burst of keystrokes doesn't become a burst of upstream requests.

```jsonc
// POST /api/typing
→ { "conversationId": "...", "isTyping": true }
← 204   no body — fire and forget
        400 bad conversationId or non-boolean isTyping · 401 bad token · 403 not a participant

// GET /api/typing/stream?conversationId=...
← data: {"conversationId":"...","userId":"...","name":"Ada Lovelace","isTyping":true}
```

Comment frames (`: connected`, `: ping`) go out on open and every 25s so intermediaries don't drop an
idle connection. **A signal never goes back to its author** — the same rule the upstream socket
follows for `message:new`, which keeps client logic uniform.

The client reads this with `fetch` and a stream reader rather than `EventSource`, because
`EventSource` can't set an `Authorization` header, and a JWT in the query string would leak into
access logs and browser history.

> **Deployment note.** Subscribers live in process memory, so this needs a **single long-running Node
> server** — `next start`, Docker, Render, Railway, a VPS. On serverless the publisher and subscriber
> can land on different instances and signals are never delivered. Confirmed on the live Vercel
> deployment; see the README's Deployment section. The fix is an external broker (Redis, Ably,
> Pusher) behind the same interface in [`lib/typing/registry.ts`](../lib/typing/registry.ts).

---

## Errors

Consistently shaped, which is genuinely helpful:

```jsonc
{ "error": { "message": "Not a participant of this conversation", "code": "FORBIDDEN" } }

// validation errors add details[]
{ "error": { "message": "Validation failed", "code": "VALIDATION_ERROR",
             "details": [{ "path": "participantIds", "message": "a group needs at least 3 members" }] } }
```

| `code` | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | bad body — see `details[]` |
| `NO_TOKEN` | **400** | `Authorization` header missing |
| `INVALID_TOKEN` | 401 | malformed or expired JWT |
| `FORBIDDEN` | 403 | not a participant, or not an admin |
| `NOT_FOUND` | 404 | unknown conversation or route |
| `UNKNOWN_USER` | 400 | referenced user id doesn't exist |
| `SERVER_ERROR` | 500 | unhandled upstream error |
| `51091` | 500 | **numeric** — Mongo invalid-regex, from `/users/search` |

`code` is therefore `string | number`, typed that way in [`types/api.ts`](../types/api.ts). Every
error is parsed into one `ApiError` class in [`lib/api/http.ts`](../lib/api/http.ts), so no component
ever inspects a raw response body.

---

## Known quirks

Every upstream behaviour this frontend works around. Each is handled in exactly one place, so the
rest of the codebase stays clean.

| # | Quirk | Handled by |
|---|---|---|
| 1 | Socket uses `id` + epoch `createdAt`; REST uses `_id` + ISO | one normalizer, `lib/api/normalize.ts` |
| 2 | Three different response envelopes | unwrapped in `lib/api/http.ts` |
| 3 | History is newest-first | reversed once, in `useMessages` |
| 4 | `before` cursor is inclusive → a duplicate per page | id-keyed merge drops duplicates |
| 5 | Invalid `before` silently returns page 1 | paging stops when a page adds nothing new |
| 6 | Empty / whitespace text accepted | client-side validation before send |
| 7 | Search `q` is an unescaped regex → `500` on `+ * ? (` | metacharacters stripped; numeric `51091` caught and shown as a friendly message |
| 8 | Search is case-sensitive, prefix-anchored | a capitalized variant queried alongside the raw term |
| 9 | **`+`-prefixed phones are unfindable** | a digits-only variant is queried too; UI explains the number must match how it was registered |
| 10 | Search silently caps at 50 | UI says when results are truncated |
| 11 | Sender gets no `message:new` echo | optimistic send + local sidebar update |
| 12 | `POST /conversations` returns a sparse object | list refreshed after creation, not patched |
| 13 | `POST /conversations` with your own id returns an unrelated conversation | self excluded from search results |
| 14 | `lastMessage` is `{}`, not `null` | treated as absent in normalization |
| 15 | Missing token is `400`, not `401` | both mapped to "unauthenticated" |
| 16 | Re-login overwrites the display name | documented; login form pre-fills the last used name |
| 17 | No unread or read state in the API | unread badges tracked in-session only |
| 18 | No typing / presence channel at all | this app's own SSE relay |
| 19 | Removal broadcasts `conversation:updated` **to the removed user** | membership checked on the raw payload; conversation dropped from the sidebar |

---

## Where each endpoint is used

| Endpoint | Client function | Consumed by |
|---|---|---|
| `POST /auth/login` | `login()` — [`lib/api/auth.ts`](../lib/api/auth.ts) | login form; session stored by [`lib/auth/session.ts`](../lib/auth/session.ts) |
| `GET /auth/me` | `getMe()` — [`lib/api/auth.ts`](../lib/api/auth.ts) | boot, to rehydrate and revalidate |
| `GET /users/search` | `searchUsers()` — [`lib/api/users.ts`](../lib/api/users.ts) | new-chat and group dialogs |
| `GET /conversations` | `listConversations()` — [`lib/api/conversations.ts`](../lib/api/conversations.ts) | [`hooks/useConversations.ts`](../hooks/useConversations.ts) |
| `POST /conversations` | `startDirectConversation()` | new-chat dialog |
| `POST /conversations/group` | `createGroup()` | create-group dialog |
| `GET .../messages` | `getMessages()` — [`lib/api/messages.ts`](../lib/api/messages.ts) | [`hooks/useMessages.ts`](../hooks/useMessages.ts) |
| `POST /messages` | `sendMessage()` — [`lib/api/messages.ts`](../lib/api/messages.ts) | composer, with optimistic bubbles |
| Socket.io | — | [`hooks/useRealtime.ts`](../hooks/useRealtime.ts), one shared connection |
| `/api/typing*` | [`lib/api/typing.ts`](../lib/api/typing.ts) | [`hooks/useTypingIndicator.ts`](../hooks/useTypingIndicator.ts) |
