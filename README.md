# Parley

A real-time messaging application — direct and group conversations, live delivery over
WebSockets, and a message list built for actually reading — plus a landing page presenting it as a
product.

Built against the assignment's provided API at `https://frontend-task-chatapp.onrender.com`.

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Setup](#setup)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Design Decisions](#design-decisions)
- [AI Usage](#ai-usage)
- [Issues Encountered](#issues-encountered)
- [Improvements With More Time](#improvements-with-more-time)

---

## Project Overview

Parley has two halves:

**The chat application** (`/login`, `/chat`) — sign in with a phone number and name, find people,
start one-to-one or group conversations, and exchange messages that arrive in real time. It handles
the parts that usually get skipped: live typing indicators, per-conversation drafts, retrying a
failed send without retyping it, unread badges, connection status, and a message list that never
yanks you away from history you're reading.

**The landing page** (`/`) — presents the product with an animated preview of the real chat UI.

Everything runs against the live API. There is no mock data, no fake authentication, and no
simulated real-time.

---

## Tech Stack

| | |
|---|---|
| **Next.js 16** (App Router) | Routing, static rendering, and two Route Handlers for the typing relay. Note this version renames `middleware.ts` → `proxy.ts`; neither is used here. |
| **React 19** | `useSyncExternalStore` for browser-storage state, so nothing is copied into state inside an effect. |
| **TypeScript** (strict) | Wire types and domain types are kept separate — see [`types/`](types/). No `any` in the codebase. |
| **Tailwind CSS v4** | CSS-first config: the design tokens live in `@theme` in [`app/globals.css`](app/globals.css). |
| **socket.io-client** | Required — the API's real-time layer is Socket.io, which a raw WebSocket cannot speak. |
| **lucide-react** | Icons. |

Three runtime dependencies in total, and **no database** — see [Architecture](#architecture) for why.
No state-management library, no component library, no animation library; the animations are CSS
keyframes and one `IntersectionObserver`. The typing relay is plain SSE, so it adds no dependency
either.

---

## Setup

**Prerequisites:** Node.js 20+ and npm/yarn. Nothing else — there is no database and no external service to run.

```bash
npm install
cp .env.example .env.local     # optional — see below
npm run dev                    # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

Quality gates and verification:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run verify        # pure-logic suite: normalization + the API quirk handling
npm run verify:api    # integration suite against the LIVE API and socket
npm run verify:typing # typing relay: cross-user delivery + authorization
```

`npm run verify:typing` needs the app running locally (`npm run dev` or `npm start`); it signs in as
three real users and asserts that a signal from one genuinely reaches another and is withheld from
non-participants.

`npm run verify:api` creates three throwaway accounts on the live API and opens a real Socket.io
connection, so it needs network access and takes ~30 seconds. See
[AI Usage](#ai-usage) for what each suite covers.

### Environment variables

Both are **optional** — the app runs with no `.env` file at all, pointing at the hosted API.

```env
# Upstream REST base. Must include the /api suffix.
NEXT_PUBLIC_API_BASE_URL=https://frontend-task-chatapp.onrender.com/api

# Socket.io origin — the ROOT origin, no /api suffix.
NEXT_PUBLIC_SOCKET_URL=https://frontend-task-chatapp.onrender.com
```

`.env.local` is gitignored; `.env.example` carries no secrets and is committed.

### Deployment

`npm run build` passes with no TypeScript or ESLint errors. Every page is statically prerendered;
the only server-side code is the two typing-relay Route Handlers.

**One deployment caveat, and it's a real one.** The relay holds its subscribers in process memory, so
it needs a **single long-running Node server** — `npm start`, Docker, Render, Railway, Fly, a VPS.
On a serverless platform like Vercel, the publisher and the subscriber can land on different function
instances that don't share memory, so **typing indicators would silently stop working there** (the
rest of the app is unaffected and works fine). Making it serverless-ready means swapping the
in-memory channel in [`lib/typing/registry.ts`](lib/typing/registry.ts) for an external broker —
Redis pub/sub, Ably or Pusher — behind the same two functions.

---

## Architecture

### The central decision: no database

The first step was to find out what the provided API actually persists. It persists **everything**:
users, conversations, group membership and admin roles, and full message history with pagination.

> **The upstream API is the sole source of truth. Nothing is duplicated anywhere.**

Adding a database of our own would mean either mirroring data the API already owns — two sources of
truth, and reconciliation on every write — or standing up a server to hold a single auxiliary table.
Neither earns its keep for this brief, which asks that the given API be used directly. So there is
**no database, no ORM, and no persistence layer** anywhere in this project. Every page is statically
prerendered and talks to the provided API straight from the browser.

The single exception is the **typing relay** — two Route Handlers that pass ephemeral "X is typing"
signals between participants, because the provided API has no channel for them (verified by probing;
see issue 13). It stores nothing and owns no data; a signal is fanned out to whoever is listening and
then discarded. Everything else — every user, conversation and message — still comes from and goes to
the provided API. See [Real-time](#real-time) for how the two fit together.

The one thing the API genuinely does not expose is **read state** — there is no unread count, no
"last read" marker, and nothing in a conversation payload distinguishing a message you have seen from
one you haven't. Unread badges are therefore **session-scoped**: they start empty on load and
accumulate from messages that arrive while the app is open. That's a deliberate trade — the
alternative, treating every conversation with any message as unread on each reload, would make the
badge meaningless. What state *is* worth keeping between visits (the session token and unsent drafts)
is per-device by nature and lives in `localStorage`.

### Authentication

`POST /auth/login` takes a phone number and a name and returns a JWT (7-day expiry, claims
`{sub, iat, exp}`). There is no separate signup — an unknown number registers automatically.

The token is stored in `localStorage`, not an httpOnly cookie. This is deliberate: the token must
reach both `fetch` **and** the Socket.io handshake, both from the browser. A cookie the client
cannot read would force every REST call *and* the WebSocket through our own server as a proxy —
substantial machinery that works against using the provided API directly. The trade-off is the
standard one (XSS could read the token); given a 7-day token to a demo chat API and no server-side
session to protect, it's the right call here. In a production system with real user data I'd proxy
through a backend-for-frontend and keep the token server-side.

On boot the stored token is revalidated against `GET /auth/me`. A genuine auth failure clears the
session; a network error does **not** — a cold-starting free-tier host must not sign people out.

### Real-time

The API runs **Socket.io** at its root origin (not the `/api` base), with the JWT in the handshake.
This was verified working before anything was built, so there is **no polling anywhere**.

- `message:new` → an incoming message
- `conversation:updated` → a group was created, renamed, or changed membership

One connection is owned by [`hooks/useRealtime.ts`](hooks/useRealtime.ts) for the whole app; handlers
live in a ref so switching conversations never tears the socket down. Connection state is surfaced in
the UI, because with push-based delivery a silent disconnect would otherwise look like "nobody is
messaging me".

Two verified behaviours shape the design:

1. **The sender never receives their own `message:new`.** Only other participants do. This is why
   optimistic UI is safe here — an optimistic bubble cannot collide with a realtime echo, because
   there is no echo. It also means the sender must update their own sidebar preview locally.
2. **REST-sent and socket-sent messages broadcast identically.** So the app **sends over REST** —
   which returns the created message with its real id, enabling clean optimistic reconciliation —
   and uses the socket purely for receiving. The socket's ack is only `{ok: true}` and carries no
   message.

Socket.io handles reconnection. On reconnect the app **refetches** the conversation list and the open
conversation, because nothing is replayed for the window it was offline.

**Typing indicators are the one thing the upstream socket cannot carry.** Ten candidate socket events
and five REST paths were probed; none exist (issue 13). So typing signals travel over a separate,
minimal channel of this app's own: `POST /api/typing` to publish, and an SSE stream to receive
([`hooks/useTypingIndicator.ts`](hooks/useTypingIndicator.ts)). Three details make it behave:

- **Throttled, not per-keystroke.** One "still typing" signal at most every 3s, with a "stopped"
  signal after 2.5s of silence and immediately on send.
- **Entries expire on a timer** (6s) rather than trusting a "stopped" signal to arrive — a closed tab
  or dropped connection never sends one, and a stuck indicator is worse than a missing one.
- **Membership is checked server-side** against upstream `GET /conversations`, so holding a valid
  token doesn't let you subscribe to a stranger's conversation and watch them type.

### Frontend structure

```
app/                      routes: / (landing), /login, /chat, /api/typing
components/
  auth/ chat/ landing/    feature components
  ui/                     Button, Avatar, Modal, TextField, Toast, StateViews
hooks/                    useAuth, useConversations, useMessages, useRealtime,
                          useTypingIndicator, useAutoScroll, useUserSearch, useDrafts
lib/
  api/                    http, normalize, auth, users, conversations, messages, typing
  auth/  storage/  typing/
  config.ts format.ts utils.ts validation.ts
types/                    api.ts (wire shapes) · chat.ts (domain shapes)
scripts/                  verify-logic.ts · verify-integration.ts
docs/API.md
```

**All HTTP goes through one function**, `request()` in [`lib/api/http.ts`](lib/api/http.ts) — auth
headers, query building, envelope unwrapping and error normalization in one place. Every failure
surfaces as an `ApiError` (with `status`, `code`, `details`) or a `NetworkError`, so no component
ever inspects a raw response body.

**All shape normalization happens in one file**, [`lib/api/normalize.ts`](lib/api/normalize.ts). The
API's inconsistencies (`_id` vs `id`, ISO strings vs epoch numbers, `participant` vs `participants`,
`{}` for a missing last message) stop there. UI code only ever sees the domain types in
[`types/chat.ts`](types/chat.ts).

### State management

No global state library. State lives at the level that owns it:

- **Session** — React context over an external store, so `localStorage` is read during render with
  no hydration mismatch and no effect-copy. Signing out in one tab signs out the others.
- **Conversations / messages** — hooks scoped to the chat, lifted into `ChatLayout`, which is a
  composition root that owns only navigation state (active conversation, open dialog, mobile pane).
  Unread counts live here too, for the session only.
- **Drafts** — the same external-store pattern, keyed by conversation.

One pattern is used deliberately throughout: **loading state is derived, not stored.**
`useMessages` keeps the conversation id *inside* its state object, so `isLoading` is simply
"the loaded key doesn't match the requested key". That removes a class of bug where a previous
conversation's messages briefly render as if they belonged to the new one, and it means no effect has
to reset four pieces of state on every switch.

### Smart auto-scroll

[`hooks/useAutoScroll.ts`](hooks/useAutoScroll.ts) tracks distance from the bottom (120px threshold):

- opening a conversation jumps to the latest message, in a **layout effect** so it never flashes the
  top of the history first
- sending always scrolls down
- an incoming message scrolls down **only if you're already near the bottom**
- otherwise it's counted, and a "**N new messages ↓**" pill appears; scrolling back down clears it

The counter is **derived, not incremented**: scrolling away from the bottom drops an anchor at the
last message you saw, and the count is simply how many messages now sit after it. That stays correct
whether messages arrive one at a time or in a burst — and, usefully, when a page of *older* history
is prepended, which a running total would have gotten wrong.

Loading older messages preserves the reading position by measuring distance from the bottom before
the fetch and restoring it after, so prepended history doesn't push the page around.

### Trade-offs

- **No message virtualisation.** Pages are 30 messages and grouped runs keep the DOM small.
  Virtualisation would complicate scroll anchoring for a problem this app doesn't have yet.
- **No dark mode.** One deliberate light theme, executed properly, over two themes done adequately.
- **The typing relay is in-memory**, which trades serverless portability for zero dependencies and
  zero configuration. See [Deployment](#deployment) — it's a one-file swap to an external broker.
- **Unread badges don't survive a reload.** With no read state in the API and no backend of our own,
  they can only cover the current session. Persisting them would mean introducing a database for one
  small feature — not a trade worth making here.

---

## API Documentation

**→ [`docs/API.md`](docs/API.md)**

The upstream Swagger spec is intentionally **request-only** — it documents endpoints, methods and
request bodies but specifies no response bodies and no status codes. So `docs/API.md` was written
*before* any application code, by probing the live API: three throwaway accounts exercising every
endpoint, success and failure paths, pagination, and a real Socket.io session. It documents every
response shape, every error code, and a table of 17 upstream quirks with where each is handled.

---

## Design Decisions

**Visual identity.** The palette is deliberately narrow — warm paper (`#faf8f5`), deep ink, and a
single amber accent — with an editorial serif (Instrument Serif) for headlines against a neutral
sans for everything else. The goal was to avoid the purple-gradient SaaS look entirely. The accent is
*rationed*: it appears on unread badges, the new-messages pill and one hero phrase, and nowhere else,
so it always means "look here".

**Own messages are ink, not accent.** Most chat UIs paint your own bubbles in the brand colour. Over
a long conversation that's loud. Ink bubbles keep the thread calm and let the accent stay meaningful.

**The landing page shows the real UI.** The hero preview uses the same bubbles, spacing, radii and
type as the actual app — it's a scripted conversation that plays out with the same typing animation
the real chat uses, pauses when scrolled out of view, and falls back to the full conversation at rest
under
`prefers-reduced-motion`. Nothing on the page is stock imagery.

**Restraint in motion.** Scroll reveals are CSS-driven and expressed so content is visible by default
and only hidden once the observer is attached — if JavaScript fails, the page still reads. Every
animation is disabled under `prefers-reduced-motion`.

**Mobile is a different layout, not a squeeze.** One markup tree serves both: on mobile the
conversation list and chat are full-width panes with a back button; on desktop both are visible at
once. The composer keeps its keyboard hints only where a keyboard exists.

**Accessibility.** Semantic landmarks, labels on every input (visually hidden where the design calls
for it), `aria-label` on all icon-only buttons, one consistent focus ring, a focus-trapped dialog
that restores focus on close, the message list as an `aria-live` log, and `<time dateTime>` on every
timestamp with the full date in the title.

---

## AI Usage

This project was built with **Claude (Claude Code)** doing the implementation, working from the
assignment brief. That's the honest description — not "AI-assisted autocomplete", but AI writing the
code under direction and review. Specifically:

**What AI was used for:** probing and documenting the API; writing `docs/API.md`; the full
implementation of the API layer, hooks, chat components, landing page and this README; and writing
the verification scripts.

**What was rejected or rewritten during the build**, and why — these are real course corrections
from this project, not a generic list:

- **An early assumption that phone search could be made to work by escaping the query was thrown
  out** after probing proved it impossible: the same raw `q` feeds both a regex and an exact match,
  so no escaping satisfies both. The code now detects the case and explains it to the user instead
  of pretending to handle it.
- **The first pass at the data hooks stored `isLoading` as state and reset it inside effects.**
  React 19's `set-state-in-effect` lint rule flagged it, and rather than suppressing the rule the
  hooks were rewritten so loading is *derived* from a key comparison. This turned out to fix a
  latent bug (stale messages rendering under a new conversation), so the lint rule was right.
- **`localStorage`-read-in-`useEffect` was replaced with `useSyncExternalStore`** across session,
  drafts and the login prefill — removing hydration guards and gaining cross-tab sync for free.
- **Reset-on-close effects in both dialogs were deleted** in favour of unmounting them when closed.
- **A CTA that overrode button colours via `className` was rejected** — it relied on Tailwind class
  ordering, which isn't guaranteed — and replaced with a real variant.
- **Two genuine bugs were caught in self-review, after the feature "worked":** a new incoming direct
  message wouldn't appear in the sidebar at all (only groups announce themselves via
  `conversation:updated`), and a failed send left its text in both the composer and the failed
  bubble.
- **One verification test failed and the *test* was wrong, not the code** — it assumed UTC calendar
  days; date separators correctly use local days.

**How the generated code was reviewed:** the API was probed before any code was written, so nothing
was built on a guessed contract. Beyond that, three gates — all runnable, see [Setup](#setup):

- `npm run typecheck` and `npm run lint` — both clean, with **zero suppressions** anywhere.
- `npm run verify` ([`scripts/verify-logic.ts`](scripts/verify-logic.ts)) — asserts the quirk
  handling: envelope unwrapping, socket-vs-REST normalization, `{}` last-message, self-exclusion from
  group participants, regex-safety of every generated search variant, and local-day date separators.
- `npm run verify:typing` ([`scripts/verify-typing.ts`](scripts/verify-typing.ts)) — signs in as
  three real users and proves a typing signal from one **actually reaches another**, is never echoed
  to its author, and is refused (403) for a non-participant both on publish and on subscribe.
- `npm run verify:api` ([`scripts/verify-integration.ts`](scripts/verify-integration.ts)) — runs
  against the **live API and a live socket**: idempotent conversation creation, the group
  minimum-size rejection, the inclusive-cursor duplicate and that the merge removes it, the 403 for
  non-participants, JWT handshake rejection, and — the one the optimistic UI depends on — that the
  sender genuinely receives no echo of their own message.

Two course corrections are worth recording, because they shaped the architecture:

- An earlier revision added **MongoDB** for persisted read state. It was **removed** on the
  instruction to rely solely on the provided API, which is why unread badges are session-scoped and
  why there is no persistence layer anywhere.
- The **typing indicator** was first declined: probing showed the API has no channel for it, and the
  brief forbids faking real-time behaviour, so the honest answer was "not possible as specified".
  When the feature was asked for again, the right move was not to fabricate it but to add the
  smallest real transport that could carry it — the SSE relay — and to state the deployment cost
  plainly rather than bury it. The probe findings that justified the decision are in `docs/API.md`.

**What was not verified:** there was no browser automation available in this environment, so the UI
flows were verified through the API/logic layers, server-rendered output, and code review rather than
by clicking through a real browser. Cross-browser and touch-device testing hasn't been done.

---

## Issues Encountered

The API is solid, but it has real quirks. All 18 are tabulated in
[`docs/API.md` → Known quirks](docs/API.md#known-quirks); these are the ones that changed the design.

**1. Phone search is impossible for `+`-prefixed numbers.** `/users/search` interpolates `q` straight
into a MongoDB regex with no escaping. Names match by *case-sensitive prefix regex*; phones match by
*exact equality* — both from the same raw `q`. So `+15550209945` crashes the regex compile
(`HTTP 500`, code `51091`) before the phone comparison ever runs, and no escaping fixes it, because
anything that makes the regex valid stops matching the phone exactly.
**Handled by** [`lib/api/users.ts`](lib/api/users.ts): a small set of *safe* query variants is issued
concurrently and merged — the raw term when regex-safe, a capitalized variant to work around
case-sensitivity, and a digits-only variant that does find users registered without a `+`. Terms
containing `+ * ? ( ) [ ] ^ $ | \` are never sent. The UI explains the limitation rather than showing
a bare "no results".

**2. The socket and REST disagree on message shape.** REST returns `_id` and an ISO-8601 string;
`message:new` returns `id` and `createdAt` as an **epoch-millisecond number**. Handled in
`normalize.ts` — both become one `Message` type.

**3. The pagination cursor is inclusive.** `?before=X` returns `X` again as the first item, so every
page after the first duplicates one message. Worse, an **invalid cursor is silently ignored** and
returns page 1 again — a naive "load older" loops forever. Handled by an id-keyed merge, with paging
stopped when a page contributes nothing new.

**4. Three different response envelopes.** `{data: []}` for conversations, `{messages, hasMore}` for
history, a bare array for search, bare objects elsewhere. Unwrapped in one place.

**5. No text validation upstream.** `text: ""` and `text: "   "` are both accepted and stored, over
REST *and* the socket (`{ok: true}`). Validated client-side before sending.

**6. `POST /conversations` returns a sparse object** — no `type`, no populated participant, no
`lastMessage` — unlike the same conversation from `GET /conversations`. So the list is refreshed
after creating one rather than inserting the partial object into the sidebar.

**7. Passing your own id to `POST /conversations` returns an unrelated existing conversation**
instead of an error. Self is excluded from search results so it can't happen.

**8. A missing token is `400 NO_TOKEN`, not `401`** (a bad token is `401`). Both are mapped to
"unauthenticated".

**9. `lastMessage` is `{}`, not `null`,** when a conversation has no messages. Treated as absent.

**10. `/health` is documented under `/api` but served at the root.** Cosmetic, noted in the docs.

**11. Re-login overwrites your display name.** Signing in with an existing phone and a different name
silently renames the account. Can't be prevented client-side, so the login form pre-fills the last
used name and says so plainly.

**12. The free-tier host cold-starts.** First request after idle can take many seconds. Network
errors are distinguished from auth errors so a cold start never signs anyone out, and the login error
message mentions it.

**13. There is no typing or presence channel — verified, not assumed.** "User is typing…" is the
obvious next feature, so I probed for it rather than guessing. Ten candidate socket events
(`typing`, `typing:start`, `user:typing`, `conversation:typing`, `startTyping`, …) emitted from an
authenticated connection produced **no ack**, and a second socket belonging to the other participant,
listening with `onAny`, received **nothing**. On REST, `/typing`, `/conversations/{id}/typing`,
`/presence` and `/events` all return `404`. The server does not relay arbitrary client events — it
only emits `message:new` and `conversation:updated`. The one client-reachable broadcast,
`PATCH /conversations/{id}`, renames the group as a side effect, so it can't be used for signalling.
**Handled by adding a minimal relay of our own** — two Route Handlers carrying typing signals and
nothing else (see [Architecture](#architecture)). The alternative, faking the indicator on a timer,
would have been exactly the "fake real-time behaviour" the brief rules out. This is the only
server-side code in the project, and it was added deliberately with the deployment cost understood:
see [Deployment](#deployment). Full probe write-up in
[`docs/API.md`](docs/API.md#there-is-no-typing--presence-channel).

---

## Improvements With More Time

- **Message virtualisation and infinite scroll-up**, replacing the explicit "load earlier" button.
- **A real test suite** — the verification scripts here are thorough but ad-hoc; they'd become
  Vitest unit tests plus Playwright end-to-end coverage of the flows I could only review by hand.
- **Group management UI.** The API supports adding/removing members, promoting admins, renaming and
  leaving; only creation is exposed today. The API layer is already shaped for the rest.
- **Unread badges that persist**, which needs somewhere to record a last-seen message id per user —
  a small backend of our own, or the API growing read state.
- **Read receipts**, which need a channel the API doesn't have — the same gap as typing (issue 13),
  and solvable the same way if it were wanted.
- **Move the typing relay onto an external broker** (Redis/Ably/Pusher) so it survives a serverless
  deployment. The interface in [`lib/typing/registry.ts`](lib/typing/registry.ts) is already the
  right seam — `subscribe` and `publish`, nothing else.
- **A backend-for-frontend** holding the token server-side in an httpOnly cookie, if this carried
  real user data.
- **Optimistic conversation creation**, so opening a new chat doesn't wait on a list refresh.

### Closing note

The most useful hour of this build was the one spent before writing any application code, probing
the API instead of trusting its documentation. The spec is request-only by design, and almost every
interesting decision here — optimistic UI being safe, no polling at all, why phone search can't
work, and what the API does *not* store — came from behaviour observed on the live service rather
than anything the documentation stated. Assuming the map matches the territory is how take-homes quietly go wrong.

*(The assignment asks that this write-up contain the word **Madagascar** — noted here explicitly
rather than wedged into a sentence where it wouldn't belong.)*
