/* Daily puzzle: one picture for everyone per Kyiv day, anonymous time leaderboard, reminder opt-in */
import { cmd, pipe, parse, hasKV } from './_lib/kv.js';
import { checkInit } from './_lib/tg.js';
import { alias, readJson } from './_lib/util.js';
import { kyivDay, dayGrid, okDay } from './_lib/day.js';

const TTL = 86400 * 9;
const rankOf = r => r === null || r === undefined ? 0 : +r + 1;
// Scores are stored as negative deciseconds, so the fastest time has the highest score.
const OPS = {
  async top(uid, b) {
    const day = okDay(b.day) ? b.day : kyivDay(), key = 'dz:' + day;
    const [raw, rank, mine, total, rem] = await pipe([['ZREVRANGE', key, 0, 19, 'WITHSCORES'], ['ZREVRANK', key, uid], ['ZSCORE', key, uid], ['ZCARD', key], ['SISMEMBER', 'rem:on', uid]]);
    const ids = []; for (let i = 0; i + 1 < (raw || []).length; i += 2) ids.push([raw[i], -Number(raw[i + 1])]);
    const us = (await cmd('MGET', ...ids.map(x => 'u:' + x[0]), 'u:' + uid)) || [];
    const who = (id, v) => { const u = parse(v) || {}; return { a: u.a || alias(id), h: u.h || 'fox', l: u.lv || 1 }; };
    const list = ids.map(([id, ds], i) => Object.assign(who(id, us[i]), { t: ds / 10, me: id === uid ? 1 : 0 }));
    const pos = rankOf(rank);
    return { day, g: dayGrid(day), list, my: pos ? Object.assign(who(uid, us[ids.length]), { pos, t: -Number(mine) / 10, me: 1 }) : null, total: +total || 0, rem: rem ? 1 : 0 };
  },
  // Only the first finish of the day counts; replays never change the result.
  async done(uid, b) {
    const day = String(b.day || ''); if (!okDay(day)) return { err: 'day' };
    const g = dayGrid(day), t = Number(b.t);
    if (!Number.isFinite(t) || t < g * g * 0.45 || t > 6 * 3600) return { err: 'time' };
    const ds = Math.round(t * 10), key = 'dz:' + day;
    const fresh = await cmd('SET', 'dzd:' + day + ':' + uid, String(ds), 'NX', 'EX', TTL);
    if (fresh) await pipe([['ZADD', key, -ds, uid], ['EXPIRE', key, TTL]]);
    const [rank, mine, total] = await pipe([['ZREVRANK', key, uid], ['ZSCORE', key, uid], ['ZCARD', key]]);
    return { day, fresh: fresh ? 1 : 0, pos: rankOf(rank), t: mine === null || mine === undefined ? ds / 10 : -Number(mine) / 10, total: +total || 0 };
  },
  async rem(uid, b) {
    const on = b.on ? 1 : 0;
    await cmd(on ? 'SADD' : 'SREM', 'rem:on', uid);
    return { rem: on };
  },
};
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(200).json({ ok: 1, kv: hasKV, day: kyivDay() });
  if (!hasKV && process.env.VERCEL) return res.status(200).json({ err: 'nokv' });
  const b = await readJson(req), u = checkInit(b.init);
  if (!u || !Number.isSafeInteger(u.id)) return res.status(200).json({ err: 'auth' });
  const f = OPS[b.op]; if (!f) return res.status(200).json({ err: 'op' });
  try { res.status(200).json((await f('t' + u.id, b)) || {}); } catch (e) { console.error('daily', b.op, e); res.status(200).json({ err: 'server' }); }
}
