/* Sign-in: the server trusts only initData signed by Telegram for this bot (api/_lib/tg.js checkInit). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initData, offline } from '../helpers.mjs';

offline();
const { checkInit } = await import('../../api/_lib/tg.js');
const now = () => Math.floor(Date.now() / 1000);

test('accepts initData signed with the bot token', () => {
  assert.equal(checkInit(initData(42)).id, 42);
});

test('rejects initData whose user was changed after signing', () => {
  const p = new URLSearchParams(initData(42));
  p.set('user', JSON.stringify({ id: 43, first_name: 'U42' }));
  assert.equal(checkInit(p.toString()), null);
});

test('rejects a missing or wrong signature', () => {
  const p = new URLSearchParams(initData(42));
  p.delete('hash');
  assert.equal(checkInit(p.toString()), null);
  p.set('hash', '0'.repeat(64));
  assert.equal(checkInit(p.toString()), null);
  assert.equal(checkInit('x=1&hash=00'), null);
});

test('rejects initData signed for another bot', () => {
  assert.equal(checkInit(initData(42, { token: '999:OTHER_BOT' })), null);
});

test('rejects sign-ins older than 30 days', () => {
  assert.equal(checkInit(initData(42, { authDate: now() - 31 * 86400 })), null);
  assert.equal(checkInit(initData(42, { authDate: now() - 29 * 86400 })).id, 42);
});

test('rejects empty, non-text and oversized input', () => {
  for (const v of [undefined, null, '', 42, {}, 'a'.repeat(5000)]) assert.equal(checkInit(v), null);
});
