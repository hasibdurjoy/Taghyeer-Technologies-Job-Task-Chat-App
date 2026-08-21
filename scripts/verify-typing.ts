/**
 * End-to-end check of the typing relay.
 *
 * Runs against a locally running instance (`npm run dev` or `npm start`) plus
 * the live upstream API for authentication. It proves signals actually travel
 * between two different users, are withheld from non-participants, and are never
 * echoed back to their author.
 */
import assert from 'node:assert/strict';

import { login } from '@/lib/api/auth';
import { startDirectConversation } from '@/lib/api/conversations';
import type { TypingEvent } from '@/types/chat';

const APP = process.env.APP_URL ?? 'http://localhost:3000';
const results: string[] = [];
const pass = (name: string) => results.push('  PASS  ' + name);

/** Opens the SSE stream and collects events until aborted. */
function collect(token: string, conversationId: string, signal: AbortSignal): TypingEvent[] {
  const seen: TypingEvent[] = [];
  void (async () => {
    try {
      const res = await fetch(
        `${APP}/api/typing/stream?conversationId=${encodeURIComponent(conversationId)}`,
        { headers: { Authorization: `Bearer ${token}` }, signal },
      );
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          for (const line of frame.split('\n')) {
            if (line.startsWith('data:')) seen.push(JSON.parse(line.slice(5).trim()));
          }
        }
      }
    } catch {
      // Aborted.
    }
  })();
  return seen;
}

const post = (token: string, body: unknown) =>
  fetch(`${APP}/api/typing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now().toString().slice(-6);

console.log(`\nRelay under test: ${APP}\n`);

const alice = await login(`+1888${stamp}1`, 'Typing Alice');
const bob = await login(`+1888${stamp}2`, 'Typing Bob');
const carol = await login(`+1888${stamp}3`, 'Typing Carol');
const conversationId = await startDirectConversation(alice.token, bob.user.id);
pass('two users + a shared conversation');

// Bob and Alice both listen; Carol is not a participant.
const controller = new AbortController();
const bobSaw = collect(bob.token, conversationId, controller.signal);
const aliceSaw = collect(alice.token, conversationId, controller.signal);
await wait(1200);

// --- the core behaviour ---
const started = await post(alice.token, { conversationId, isTyping: true });
assert.equal(started.status, 204, 'publish accepted');
await wait(900);

assert.equal(bobSaw.length, 1, `Bob should have received exactly 1 event, got ${bobSaw.length}`);
assert.equal(bobSaw[0].isTyping, true);
assert.equal(bobSaw[0].userId, alice.user.id);
assert.equal(bobSaw[0].name, 'Typing Alice');
assert.equal(bobSaw[0].conversationId, conversationId);
pass("Alice types → Bob receives it, with her name (REAL cross-user delivery)");

assert.equal(aliceSaw.length, 0, 'the author must not receive their own signal');
pass('no self-echo — Alice does not see her own typing');

const stopped = await post(alice.token, { conversationId, isTyping: false });
assert.equal(stopped.status, 204);
await wait(900);
assert.equal(bobSaw.length, 2);
assert.equal(bobSaw[1].isTyping, false);
pass('stop signal propagates');

// --- authorization ---
const carolPost = await post(carol.token, { conversationId, isTyping: true });
assert.equal(carolPost.status, 403, `non-participant publish should be 403, got ${carolPost.status}`);
pass('non-participant cannot publish into a conversation');

const carolStream = await fetch(
  `${APP}/api/typing/stream?conversationId=${encodeURIComponent(conversationId)}`,
  { headers: { Authorization: `Bearer ${carol.token}` } },
);
assert.equal(carolStream.status, 403, `non-participant subscribe should be 403, got ${carolStream.status}`);
pass('non-participant cannot subscribe (no typing leak)');

const noAuth = await post('', { conversationId, isTyping: true });
assert.equal(noAuth.status, 401);
const badAuth = await post('garbage', { conversationId, isTyping: true });
assert.equal(badAuth.status, 401);
pass('missing / invalid token rejected with 401');

const badBody = await post(alice.token, { conversationId });
assert.equal(badBody.status, 400);
pass('malformed body rejected with 400');

await wait(300);
assert.equal(bobSaw.length, 2, 'no stray events leaked in from the rejected requests');
pass('rejected requests published nothing');

controller.abort();
console.log(results.join('\n'));
console.log('\nALL TYPING RELAY CHECKS PASSED\n');
process.exit(0);
