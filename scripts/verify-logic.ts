import assert from 'node:assert/strict';
import { normalizeConversation, normalizeMessage, normalizeSocketMessage } from '@/lib/api/normalize';
import { buildSearchVariants } from '@/lib/api/users';
import { formatDateSeparator, isNewDay } from '@/lib/format';
import { validateLogin, validatePhone } from '@/lib/validation';
import { unwrapData } from '@/lib/api/http';

const results: string[] = [];
function check(name: string, fn: () => void) {
  try { fn(); results.push('  PASS  ' + name); }
  catch (e) { results.push('  FAIL  ' + name + '\n         ' + (e as Error).message); process.exitCode = 1; }
}

const ME = '6a888bc2e5d6aac97523ae13';
const THEM = '6a888bc3e5d6aac97523ae1b';

check('REST message: _id → id, ISO preserved', () => {
  const m = normalizeMessage({ _id: 'm1', conversation: 'c1', sender: THEM, text: 'hi', createdAt: '2026-08-21T17:33:09.103Z' });
  assert.equal(m.id, 'm1');
  assert.equal(m.createdAt, '2026-08-21T17:33:09.103Z');
  assert.equal(m.status, 'sent');
});

check('Socket message: id + epoch number → same shape as REST', () => {
  const m = normalizeSocketMessage({ id: 'm2', conversation: 'c1', sender: THEM, text: 'yo', createdAt: 1787334007888 });
  assert.equal(m.id, 'm2');
  assert.equal(m.createdAt, new Date(1787334007888).toISOString());
  assert.equal(m.senderId, THEM);
});

check('Direct conversation: participant (singular) → title + participants', () => {
  const c = normalizeConversation({
    _id: 'c1', type: 'direct',
    participant: { _id: THEM, name: 'Grace Probe', phone: '+15550209945' },
    lastMessage: { text: 'See you', sender: THEM, createdAt: '2026-08-21T17:33:11.763Z' },
    updatedAt: '2026-08-21T17:33:11.763Z',
  }, ME);
  assert.equal(c.title, 'Grace Probe');
  assert.equal(c.participants.length, 1);
  assert.equal(c.lastMessage?.text, 'See you');
});

check('Group: self excluded from participants, name used as title', () => {
  const c = normalizeConversation({
    _id: 'g1', type: 'group', name: 'Probe Team', admins: [ME],
    participants: [
      { _id: ME, name: 'Ada', phone: '+1555' },
      { _id: THEM, name: 'Grace', phone: '+1556' },
      { _id: 'x3', name: 'Linus', phone: '+1557' },
    ],
    updatedAt: '2026-08-21T17:33:19.123Z',
  }, ME);
  assert.equal(c.title, 'Probe Team');
  assert.equal(c.participants.length, 2, 'self must be excluded');
  assert.ok(!c.participants.some(p => p.id === ME));
  assert.deepEqual(c.adminIds, [ME]);
});

check('QUIRK: lastMessage {} is treated as absent, not a blank message', () => {
  const c = normalizeConversation({ _id: 'c2', type: 'direct', lastMessage: {}, participant: { _id: THEM, name: 'G', phone: '+1' }, updatedAt: '2026-01-01T00:00:00.000Z' }, ME);
  assert.equal(c.lastMessage, null);
});

check('QUIRK: {data:[]} envelope and bare arrays both unwrap', () => {
  assert.deepEqual(unwrapData({ data: [1, 2] }), [1, 2]);
  assert.deepEqual(unwrapData([3, 4]), [3, 4]);
  assert.deepEqual(unwrapData(null), []);
});

check('QUIRK: search variants never contain regex metacharacters', () => {
  const dangerous = ['+15550209945', 'Ada*', '(', 'a?b', '.*', 'x|y'];
  for (const term of dangerous) {
    for (const v of buildSearchVariants(term)) {
      assert.ok(!/[.*+?^${}()|[\]\\]/.test(v), `variant "${v}" from "${term}" would 500 the API`);
    }
  }
});

check('QUIRK: "+8801700000001" yields a digits-only variant (finds users stored without +)', () => {
  const variants = buildSearchVariants('+8801700000001');
  assert.ok(variants.includes('8801700000001'), 'expected digits-only variant, got ' + JSON.stringify(variants));
});

check('QUIRK: lowercase name gets a capitalized variant (search is case-sensitive)', () => {
  const variants = buildSearchVariants('ada lovelace');
  assert.ok(variants.includes('ada lovelace'));
  assert.ok(variants.includes('Ada Lovelace'), 'got ' + JSON.stringify(variants));
});

check('Date separator uses LOCAL calendar days, not UTC days', () => {
  // Built from local components so the assertion holds in any timezone.
  const noon = new Date(2026, 7, 22, 12, 0, 0).toISOString();
  const evening = new Date(2026, 7, 22, 20, 30, 0).toISOString();
  const nextMorning = new Date(2026, 7, 23, 9, 0, 0).toISOString();

  assert.equal(isNewDay(noon, evening), false, 'same local day needs no separator');
  assert.equal(isNewDay(evening, nextMorning), true, 'crossing local midnight needs a separator');
  assert.equal(isNewDay(null, noon), true, 'first message always gets a separator');
  assert.equal(formatDateSeparator(new Date().toISOString()), 'Today');
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  assert.equal(formatDateSeparator(yesterday.toISOString()), 'Yesterday');
});

check('Login validation accepts both API phone formats', () => {
  assert.equal(validatePhone('+15551234567'), undefined);
  assert.equal(validatePhone('01672589498'), undefined);
  assert.ok(validatePhone(''));
  assert.ok(validatePhone('123'));
  assert.ok(validateLogin('+15551234567', 'A').name, 'single-char name should fail');
  assert.deepEqual(validateLogin('+15551234567', 'Ada Lovelace'), {});
});

console.log(results.join('\n'));
console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
