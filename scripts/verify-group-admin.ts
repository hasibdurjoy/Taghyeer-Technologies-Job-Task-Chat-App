/**
 * End-to-end check of group administration against the LIVE API.
 *
 * Exercises the four admin endpoints through this app's API layer, asserting the
 * permission model and — most importantly — the removal quirk that
 * `rawHasParticipant` exists to handle.
 */
import assert from 'node:assert/strict';

import { login } from '@/lib/api/auth';
import {
  addParticipants,
  createGroup,
  listConversations,
  promoteToAdmin,
  removeParticipant,
  renameGroup,
} from '@/lib/api/conversations';
import { ApiError } from '@/lib/api/http';
import { rawHasParticipant } from '@/lib/api/normalize';
import { getMessages } from '@/lib/api/messages';

const results: string[] = [];
const pass = (name: string) => results.push('  PASS  ' + name);
const stamp = Date.now().toString().slice(-6);

const ann = await login(`+1444${stamp}1`, 'Ann Admin');
const bob = await login(`+1444${stamp}2`, 'Bob Member');
const cid = await login(`+1444${stamp}3`, 'Cid Member');
const dee = await login(`+1444${stamp}4`, 'Dee Outsider');

const group = await createGroup(ann.token, ann.user.id, 'Admin Suite', [bob.user.id, cid.user.id]);
assert.equal(group.type, 'group');
assert.deepEqual(group.adminIds, [ann.user.id]);
pass('group created with the creator as sole admin');

// ---- rename ----
const renamed = await renameGroup(ann.token, ann.user.id, group.id, 'Renamed Suite');
assert.equal(renamed.title, 'Renamed Suite');
pass('admin renames the group; response carries the new title');

await assert.rejects(
  () => renameGroup(bob.token, bob.user.id, group.id, 'Nope'),
  (e: unknown) => e instanceof ApiError && e.status === 403,
);
pass('non-admin rename rejected with 403');

await assert.rejects(
  () => renameGroup(ann.token, ann.user.id, group.id, '   '),
  (e: unknown) => e instanceof ApiError && e.status === 400,
);
pass('blank rename rejected with 400');

// ---- add participants ----
const withDee = await addParticipants(ann.token, ann.user.id, group.id, [dee.user.id]);
assert.equal(withDee.participants.length, 3, 'Ann sees Bob, Cid, Dee');
assert.ok(withDee.participants.some((p) => p.id === dee.user.id));
pass('admin adds a member; response is the full updated group');

await assert.rejects(
  () => addParticipants(bob.token, bob.user.id, group.id, [dee.user.id]),
  (e: unknown) => e instanceof ApiError && e.status === 403,
);
pass('non-admin add rejected with 403');

// ---- promote ----
const promoted = await promoteToAdmin(ann.token, ann.user.id, group.id, bob.user.id);
assert.ok(promoted.adminIds.includes(bob.user.id));
assert.equal(promoted.adminIds.length, 2);
pass('admin promotes a member; both admins present in the response');

await assert.rejects(
  () => promoteToAdmin(cid.token, cid.user.id, group.id, cid.user.id),
  (e: unknown) => e instanceof ApiError && e.status === 403,
);
pass('non-admin promote rejected with 403');

// Bob is now an admin, so his rename should succeed.
const bobRenamed = await renameGroup(bob.token, bob.user.id, group.id, 'Bob Was Promoted');
assert.equal(bobRenamed.title, 'Bob Was Promoted');
pass('a newly promoted admin can immediately administer the group');

// ---- remove ----
await assert.rejects(
  () => removeParticipant(cid.token, cid.user.id, group.id, ann.user.id),
  (e: unknown) => e instanceof ApiError && e.status === 403,
);
pass('non-admin cannot remove someone else (403)');

const afterRemoval = await removeParticipant(ann.token, ann.user.id, group.id, dee.user.id);
assert.ok(!afterRemoval.participants.some((p) => p.id === dee.user.id));
pass('admin removes a member');

// The quirk `rawHasParticipant` guards: the removed user is no longer in the
// payload they still receive over the socket.
const rawAfterRemoval = {
  _id: group.id,
  participants: [
    { _id: ann.user.id, name: ann.user.name, phone: ann.user.phone },
    { _id: bob.user.id, name: bob.user.name, phone: bob.user.phone },
    { _id: cid.user.id, name: cid.user.name, phone: cid.user.phone },
  ],
};
assert.equal(rawHasParticipant(rawAfterRemoval, dee.user.id), false, 'removed user detected');
assert.equal(rawHasParticipant(rawAfterRemoval, ann.user.id), true, 'remaining member detected');
assert.equal(rawHasParticipant({ _id: group.id }, dee.user.id), true, 'unknown shape fails open');
pass('rawHasParticipant distinguishes removal from a normal update');

const deeList = await listConversations(dee.token, dee.user.id);
assert.ok(!deeList.some((c) => c.id === group.id), 'group gone from the removed user’s list');
pass('removed user no longer lists the group');

await assert.rejects(
  () => getMessages(dee.token, group.id),
  (e: unknown) => e instanceof ApiError && e.status === 403,
);
pass('removed user gets 403 reading the group (why the sidebar must drop it)');

// ---- leave ----
await removeParticipant(cid.token, cid.user.id, group.id, cid.user.id);
const cidList = await listConversations(cid.token, cid.user.id);
assert.ok(!cidList.some((c) => c.id === group.id));
pass('any member can leave by removing themselves');

const annList = await listConversations(ann.token, ann.user.id);
const remaining = annList.find((c) => c.id === group.id);
assert.ok(remaining, 'group survives for the members who stayed');
assert.equal(remaining.participants.length, 1, 'only Bob left alongside Ann');
pass('group persists for remaining members after others leave');

console.log(results.join('\n'));
console.log('\nALL GROUP ADMIN CHECKS PASSED\n');
process.exit(0);
