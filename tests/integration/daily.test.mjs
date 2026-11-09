/* Daily Puzzle API, evening reminder and bot commands - end to end with the in-memory store and a fake Telegram. */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { initData, call, frozenAt, offline } from '../helpers.mjs';

/* A fake Telegram Bot API: records every call; chat 4 has blocked the bot. */
const tgCalls = [];
const fakeTelegram = http.createServer((req, res) => {
  let raw = '';
  req.on('data', c => { raw += c; });
  req.on('end', () => {
    let p = {};
    try { p = JSON.parse(raw || '{}'); } catch (e) { p = {}; }
    const m = req.url.split('/').pop();
    tgCalls.push({ m, p });
    res.setHeader('content-type', 'application/json');
    if (m === 'sendMessage' && Number(p.chat_id) === 4) return res.end(JSON.stringify({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }));
    res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
  });
});
await new Promise(r => fakeTelegram.listen(0, '127.0.0.1', r));
after(() => { fakeTelegram.closeAllConnections(); fakeTelegram.close(); });

offline();
process.env.APP_URL = 'https://game.example';
process.env.TG_API = 'http://127.0.0.1:' + fakeTelegram.address().port;
const daily = (await import('../../api/daily.js')).default;
const remind = (await import('../../api/remind.js')).default;
const bot = (await import('../../api/bot.js')).default;
const { hookSecret } = await import('../../api/_lib/util.js');
const { kyivDay, kyivHour, dayGrid } = await import('../../api/_lib/day.js');
const { cmd } = await import('../../api/_lib/kv.js');

const day = kyivDay();
const D = async (id, body) => (await call(daily, { body: { init: initData(id), ...body } })).body;
const sentTo = () => tgCalls.filter(c => c.m === 'sendMessage').map(c => Number(c.p.chat_id));
const members = async () => ((await cmd('SMEMBERS', 'rem:on')) || []).slice().sort();
/* A moment of today at the given Kyiv hour. */
function kyivAt(hour) {
  const [y, m, d] = day.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d, 0, 0);
  while (kyivHour(t) !== hour || kyivDay(t) !== day) t += 3600e3;
  return t;
}

test('GET reports that the service is up', async () => {
  const r = await call(daily, { method: 'GET' });
  assert.equal(r.code, 200);
  assert.ok(r.body.ok);
});

test('requests without valid Telegram data are refused', async () => {
  for (const init of ['x=1&hash=00', '', undefined]) assert.equal((await call(daily, { body: { op: 'top', day, init } })).body.err, 'auth', String(init));
});

test('a new day starts with an empty ranking and the grid of the day', async () => {
  const r = await D(1, { op: 'top', day });
  assert.deepEqual(r.list, []);
  assert.equal(r.total, 0);
  assert.ok(!r.my);
  assert.equal(r.g, dayGrid(day));
});

test('impossible times and other days are rejected', async () => {
  assert.equal((await D(1, { op: 'done', day, t: 1 })).err, 'time');
  assert.equal((await D(1, { op: 'done', day: '2020-01-01', t: 100 })).err, 'day');
});

test('only the first attempt of the day counts', async () => {
  const first = await D(1, { op: 'done', day, t: 100.04 });
  assert.equal(first.fresh, 1);
  assert.equal(first.t, 100);
  assert.equal(first.pos, 1);
  const again = await D(1, { op: 'done', day, t: 50 });
  assert.equal(again.fresh, 0);
  assert.equal(again.t, 100);
});

test('faster players rank higher; the board shows the top 20 plus your own place', async () => {
  assert.equal((await D(2, { op: 'done', day, t: 60.3 })).pos, 1);
  for (let i = 0; i < 22; i++) await D(100 + i, { op: 'done', day, t: 30 + i });
  const top = await D(1, { op: 'top', day });
  assert.equal(top.list.length, 20);
  assert.equal(top.total, 24);
  assert.equal(top.list[0].t, 30);
  for (let i = 1; i < top.list.length; i++) assert.ok(top.list[i].t >= top.list[i - 1].t, 'sorted at ' + i);
  assert.equal(top.my.pos, 24);
  assert.equal(top.my.t, 100);
});

test('reminders can be switched on and off', async () => {
  assert.equal((await D(5, { op: 'rem', on: 1 })).rem, 1);
  assert.equal((await D(5, { op: 'top', day })).rem, 1);
  assert.equal((await D(5, { op: 'rem', on: 0 })).rem, 0);
  assert.equal((await D(5, { op: 'top', day })).rem, 0);
});

test('unknown operations are refused', async () => {
  assert.equal((await D(1, { op: 'zzz' })).err, 'op');
});

test('the evening reminder goes once a day, only to players who switched it on and have not played', async () => {
  for (const id of [1, 3, 4]) assert.equal((await D(id, { op: 'rem', on: 1 })).rem, 1);
  tgCalls.length = 0;
  const r = (await frozenAt(kyivAt(18), () => call(remind, { method: 'GET' }))).body;
  assert.deepEqual([r.total, r.played, r.sent, r.gone, r.failed], [3, 1, 1, 1, 0], JSON.stringify(r));
  assert.deepEqual(sentTo().sort(), [3, 4]);
  assert.equal((await frozenAt(kyivAt(19), () => call(remind, { method: 'GET' }))).body.skip, 'done');
  assert.deepEqual(await members(), ['t1', 't3']);
});

test('outside the evening the reminder does nothing', async () => {
  const r = (await frozenAt(kyivAt(12), () => call(remind, { method: 'GET' }))).body;
  assert.equal(r.skip, 'hour');
  assert.equal(r.h, 12);
});

test('with a cron secret set, the reminder refuses calls without it', async () => {
  process.env.CRON_SECRET = 'sekret';
  try {
    assert.equal((await call(remind, { method: 'GET' })).code, 401);
    assert.equal((await call(remind, { method: 'GET', headers: { authorization: 'Bearer wrong' } })).code, 401);
    assert.equal((await frozenAt(kyivAt(12), () => call(remind, { method: 'GET', headers: { authorization: 'Bearer sekret' } }))).code, 200);
  } finally {
    delete process.env.CRON_SECRET;
  }
});

const hook = () => ({ 'x-telegram-bot-api-secret-token': hookSecret() });
const msg = (id, text, n) => ({ update_id: n, message: { message_id: n, date: Math.floor(Date.now() / 1000), chat: { id, type: 'private', first_name: 'U' + id }, from: { id, is_bot: false, first_name: 'U' + id }, text } });

test('the bot webhook refuses calls without its secret', async () => {
  assert.equal((await call(bot, { body: msg(7, '/start', 70) })).code, 401);
  assert.equal((await call(bot, { body: msg(7, '/start', 71), headers: { 'x-telegram-bot-api-secret-token': 'wrong' } })).code, 401);
});

test('bot commands answer, and /stop switches the reminder off', async () => {
  assert.equal((await D(7, { op: 'rem', on: 1 })).rem, 1);
  tgCalls.length = 0;
  let n = 72;
  for (const text of ['/start', '/help', '/daily', '/stop']) assert.equal((await call(bot, { body: msg(7, text, n++), headers: hook() })).code, 200, text);
  assert.equal(sentTo().filter(id => id === 7).length, 4);
  assert.ok(!(await members()).includes('t7'));
});

test('the button under the reminder switches it off', async () => {
  assert.equal((await D(8, { op: 'rem', on: 1 })).rem, 1);
  const cb = { update_id: 90, callback_query: { id: 'cb8', from: { id: 8, is_bot: false, first_name: 'U8' }, data: 'rem_off', message: { message_id: 9, date: Math.floor(Date.now() / 1000), chat: { id: 8, type: 'private' } } } };
  assert.equal((await call(bot, { body: cb, headers: hook() })).code, 200);
  assert.ok(!(await members()).includes('t8'));
});
