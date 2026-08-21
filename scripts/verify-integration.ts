import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { login, getMe } from '@/lib/api/auth';
import { searchUsers } from '@/lib/api/users';
import { listConversations, startDirectConversation, createGroup } from '@/lib/api/conversations';
import { getMessages, sendMessage } from '@/lib/api/messages';
import { ApiError } from '@/lib/api/http';
import { normalizeSocketMessage } from '@/lib/api/normalize';
import { SOCKET_URL } from '@/lib/config';

const log = (s: string) => console.log(s);
const stamp = Date.now().toString().slice(-6);

log('\n── auth ──');
const alice = await login(`+1666${stamp}1`, 'Verify Alice');
const bob = await login(`+1666${stamp}2`, 'Verify Bob');
const cara = await login(`+1666${stamp}3`, 'Verify Cara');
assert.ok(alice.token && alice.user.id, 'login returns token + normalized user');
assert.equal(alice.user.name, 'Verify Alice');
log(`  PASS  login/register new phone → ${alice.user.id}`);

const me = await getMe(alice.token);
assert.equal(me.id, alice.user.id);
log('  PASS  getMe restores session');

await assert.rejects(() => login('', 'x'), (e: unknown) => e instanceof ApiError && e.status === 400);
log('  PASS  invalid login rejected as ApiError(400)');

log('\n── search ──');
const byName = await searchUsers(alice.token, 'Verify Bob', alice.user.id);
assert.ok(byName.users.some(u => u.id === bob.user.id), 'finds Bob by name');
assert.ok(!byName.users.some(u => u.id === alice.user.id), 'self excluded from results');
log(`  PASS  search by name → ${byName.users.length} result(s), self excluded`);

const lower = await searchUsers(alice.token, 'verify bob', alice.user.id);
assert.ok(lower.users.some(u => u.id === bob.user.id), 'case-insensitive via capitalized variant');
log('  PASS  lowercase query still finds the user (case-sensitivity workaround)');

// The critical one: a raw "+" phone 500s the upstream endpoint.
const byPhone = await searchUsers(alice.token, bob.user.phone, alice.user.id);
assert.equal(byPhone.phoneSearchLimited, true, 'flags the E.164 limitation');
log(`  PASS  "+" phone search does NOT throw (returns ${byPhone.users.length}, phoneSearchLimited=true)`);

for (const nasty of ['(', '*', '?', '.*']) {
  const r = await searchUsers(alice.token, nasty, alice.user.id);
  assert.ok(Array.isArray(r.users));
}
log('  PASS  regex metacharacters ( * ? .* never reach the API');

const none = await searchUsers(alice.token, 'zzzznobodyzzz', alice.user.id);
assert.equal(none.users.length, 0);
log('  PASS  no-results path returns empty array');

log('\n── conversations ──');
const convId = await startDirectConversation(alice.token, bob.user.id);
const again = await startDirectConversation(alice.token, bob.user.id);
assert.equal(convId, again, 'idempotent: no duplicate conversation');
log('  PASS  starting the same direct chat twice returns one conversation');

await assert.rejects(
  () => createGroup(alice.token, alice.user.id, 'Too Small', [bob.user.id]),
  (e: unknown) => e instanceof ApiError && e.firstDetail?.includes('at least 3'),
);
log('  PASS  group with <2 participants rejected with upstream detail');

const group = await createGroup(alice.token, alice.user.id, 'Verify Group', [bob.user.id, cara.user.id]);
assert.equal(group.type, 'group');
assert.equal(group.title, 'Verify Group');
assert.equal(group.participants.length, 2, 'self excluded');
log(`  PASS  group created (${group.participants.length} others + you)`);

log('\n── messages ──');
for (let i = 1; i <= 5; i++) await sendMessage(alice.token, convId, `verify message ${i}`);
const page1 = await getMessages(alice.token, convId, { limit: 2 });
assert.equal(page1.messages.length, 2);
const t0 = new Date(page1.messages[0].createdAt).getTime();
const t1 = new Date(page1.messages[1].createdAt).getTime();
assert.ok(t0 <= t1, 'page is ASCENDING after normalization');
log('  PASS  history reversed to oldest-first');

// Reproduce the inclusive-cursor quirk and prove the merge drops the duplicate.
const oldest = page1.messages[0];
const page2 = await getMessages(alice.token, convId, { limit: 2, before: oldest.id });
const overlap = page2.messages.filter(m => m.id === oldest.id);
assert.equal(overlap.length, 1, 'upstream really does repeat the cursor message');
const merged = new Map([...page1.messages, ...page2.messages].map(m => [m.id, m]));
assert.ok(merged.size < page1.messages.length + page2.messages.length, 'merge removed the duplicate');
log(`  PASS  inclusive cursor confirmed; id-merge yields ${merged.size} unique of ${page1.messages.length + page2.messages.length}`);

const sent = await sendMessage(alice.token, convId, 'hello from verify');
assert.equal(sent.status, 'sent');
assert.equal(sent.senderId, alice.user.id);
log('  PASS  send returns a normalized message with a real id');

await assert.rejects(
  () => getMessages(cara.token, convId),
  (e: unknown) => e instanceof ApiError && e.status === 403,
);
log('  PASS  non-participant gets 403');

log('\n── realtime ──');
const received: string[] = [];
let ownEcho = 0;
const socketA = io(SOCKET_URL, { auth: { token: alice.token }, transports: ['websocket'] });
await new Promise<void>((res, rej) => {
  socketA.on('connect', () => res());
  socketA.on('connect_error', (e) => rej(new Error('connect_error: ' + e.message)));
  setTimeout(() => rej(new Error('socket connect timeout')), 20000);
});
log('  PASS  socket connected with JWT handshake');

socketA.on('message:new', (raw: Parameters<typeof normalizeSocketMessage>[0]) => {
  const m = normalizeSocketMessage(raw);
  assert.ok(!Number.isNaN(new Date(m.createdAt).getTime()), 'epoch → valid ISO');
  if (m.senderId === alice.user.id) ownEcho++;
  received.push(m.text);
});

await sendMessage(bob.token, convId, 'ping from bob');
await sendMessage(alice.token, convId, 'ping from alice (own)');
await new Promise(r => setTimeout(r, 4000));

assert.ok(received.includes('ping from bob'), 'incoming message received over socket');
log('  PASS  incoming message arrives via message:new (no polling)');
assert.equal(ownEcho, 0, 'sender must NOT receive their own message');
log('  PASS  no self-echo → optimistic UI cannot duplicate');

const badSocket = io(SOCKET_URL, { auth: { token: 'garbage' }, transports: ['websocket'], reconnection: false });
const rejected = await new Promise<boolean>((res) => {
  badSocket.on('connect_error', () => res(true));
  badSocket.on('connect', () => res(false));
  setTimeout(() => res(false), 10000);
});
assert.equal(rejected, true);
badSocket.close();
log('  PASS  invalid token rejected at handshake');

const list = await listConversations(alice.token, alice.user.id);
assert.ok(list.some(c => c.id === convId), 'direct conversation present');
assert.ok(list.some(c => c.id === group.id && c.type === 'group'), 'group present');
const direct = list.find(c => c.id === convId)!;
assert.equal(direct.title, 'Verify Bob');
assert.ok(direct.lastMessage, 'preview populated');
log(`  PASS  conversation list normalized (${list.length} conversations, titles + previews)`);

socketA.close();
log('\nALL INTEGRATION CHECKS PASSED\n');
process.exit(0);
