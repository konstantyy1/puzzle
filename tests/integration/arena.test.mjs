/* Arena API end to end with the in-memory store: sign-in, profiles, matchmaking, bot fights, rating. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initData, call, later, offline } from '../helpers.mjs';

offline();
const arena = (await import('../../api/arena.js')).default;
const { cmd, jget } = await import('../../api/_lib/kv.js');
const A = async (id, body) => (await call(arena, { body: { init: initData(id), ...body } })).body;

/* Searches alone for 9.5 seconds, which brings a bot. */
async function botMatch(id) {
  assert.deepEqual(await A(id, { op: 'find', ranked: 1 }), { wait: true });
  const m = await A(id, { op: 'poll', ranked: 1, ws: 9500 });
  assert.equal(m.bot, 1, 'expected a bot match: ' + JSON.stringify(m));
  return m;
}

test('GET reports that the service is up', async () => {
  const r = await call(arena, { method: 'GET' });
  assert.equal(r.code, 200);
  assert.equal(r.body.ok, 1);
});

test('requests need Telegram sign-in or a guest id', async () => {
  assert.equal((await call(arena, { body: { op: 'sync' } })).body.err, 'auth');
  assert.equal((await call(arena, { body: { op: 'sync', gid: 'abc' } })).body.err, 'auth');
  assert.equal((await call(arena, { body: { op: 'sync', init: 'x=1&hash=00' } })).body.err, 'auth');
  assert.equal((await call(arena, { body: { op: 'sync', gid: 'guest01' } })).body.rt, 1000);
});

test('unknown operations are refused', async () => {
  assert.equal((await A(1, { op: 'zzz' })).err, 'op');
});

test('sync saves the profile and clamps impossible values', async () => {
  const r = await A(11, { op: 'sync', hero: 'owl', lvl: 999, xp: 120 });
  assert.deepEqual([r.rt, r.w, r.l], [1000, 0, 0]);
  assert.ok(r.alias);
  const u = await jget('u:t11');
  assert.deepEqual([u.h, u.lv, u.xp], ['owl', 200, 120]);
  await A(11, { op: 'sync', hero: 'hacker', hp: 99999 });
  const v = await jget('u:t11');
  assert.deepEqual([v.h, v.hp], ['owl', 400]);
});

test('two players searching at the same time get the same match', async () => {
  assert.deepEqual(await A(21, { op: 'find', ranked: 1 }), { wait: true });
  const b = await A(22, { op: 'find', ranked: 1 });
  assert.equal(b.side, 'b');
  assert.ok(!b.bot);
  const a = await A(21, { op: 'poll', ranked: 1, ws: 1000 });
  assert.equal(a.side, 'a');
  assert.equal(a.mid, b.mid);
  assert.deepEqual([a.seed, a.pid, a.g], [b.seed, b.pid, b.g]);
  assert.equal(a.opp.a, (await jget('u:t22')).a);
});

test('a player searching alone gets a bot after about 9 seconds', async () => {
  const m = await botMatch(31);
  assert.equal(m.side, 'a');
  assert.ok(m.opp && m.opp.a, 'the bot has a name');
  assert.ok(m.opp.hp >= 100);
  assert.equal(m.g, 4);
});

test('a bot win right after the start does not change the rating', async () => {
  const m = await botMatch(41);
  assert.deepEqual(await A(41, { op: 'end', mid: m.mid, res: 'win' }), { rt: 1000, drt: 0 });
  assert.equal((await jget('u:t41')).rt, 1000);
});

test('a bot win after a real fight raises the rating, and only once', async () => {
  const m = await botMatch(51);
  const r = await later(60000, () => A(51, { op: 'end', mid: m.mid, res: 'win' }));
  assert.ok(r.drt > 0, JSON.stringify(r));
  assert.equal(r.rt, 1000 + r.drt);
  const u = await jget('u:t51');
  assert.deepEqual([u.rt, u.w], [r.rt, 1]);
  assert.equal(Number(await cmd('ZSCORE', 'lb:rt', 't51')), r.rt);
  assert.deepEqual(await later(61000, () => A(51, { op: 'end', mid: m.mid, res: 'win' })), { rt: r.rt, drt: 0 });
});

test('a bot loss lowers the rating', async () => {
  const m = await botMatch(61);
  const r = await later(60000, () => A(61, { op: 'end', mid: m.mid, res: 'loss' }));
  assert.ok(r.drt < 0, JSON.stringify(r));
  assert.equal((await jget('u:t61')).l, 1);
});

test('only the player can end their bot match, and bot matches take no live moves', async () => {
  const m = await botMatch(71);
  assert.equal((await later(60000, () => A(72, { op: 'end', mid: m.mid, res: 'win' }))).err, 'match');
  assert.equal((await A(71, { op: 'act', mid: m.mid, side: 'a', s: { p: 1 } })).err, 'match');
});

test('in an online match the player who leaves loses, and both ratings change', async () => {
  assert.deepEqual(await A(81, { op: 'find', ranked: 1 }), { wait: true });
  const b = await A(82, { op: 'find', ranked: 1 });
  const a = await A(81, { op: 'poll', ranked: 1, ws: 500 });
  assert.equal(a.mid, b.mid);
  assert.deepEqual(await A(82, { op: 'leave', mid: b.mid, side: 'b' }), { ok: 1 });
  const r = await A(81, { op: 'act', mid: a.mid, side: 'a', s: { p: 3, d: 20 } });
  assert.ok(r && !r.err, JSON.stringify(r));
  const [ua, ub] = [await jget('u:t81'), await jget('u:t82')];
  assert.ok(ua.rt > 1000 && ub.rt < 1000, JSON.stringify({ r, a: ua.rt, b: ub.rt }));
});
