/* Arena API: matchmaking, PvP state sync, ELO rating, anonymous leaderboards */
import { cmd, pipe, jget, jset, parse, hasKV } from './_lib/kv.js';
import { checkInit } from './_lib/tg.js';
import { alias, rid, rnd, readJson } from './_lib/util.js';
import { refreshFriendIdentity, friendIdentities, friendLabel } from './_lib/friend-identity.js';

const PIDS = [1069, 896, 525, 287, 1015, 701, 28, 976, 360, 429, 503, 639, 859, 376, 857, 164, 133, 437, 979, 799, 951, 165, 881, 580, 585, 34, 955, 402, 464, 21, 855];
const HEROES = [['fox', 1], ['owl', 3], ['bear', 5], ['cat', 8], ['robot', 12], ['dragon', 18], ['uni', 25]];
const SKS = ['shuffle', 'fog', 'shield', 'claws', 'freeze', 'fire', 'rainbow'];
const FTIME = 180, now = () => Date.now();
const num = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

function who(b, u) {
  if (u && u.id) return 't' + u.id;
  const g = String(b.gid || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
  return g.length >= 6 ? 'g' + g : null;
}
async function user(uid) {
  return (await jget('u:' + uid)) || { rt: 1000, w: 0, l: 0, d: 0, g: 0, a: alias(uid), h: 'fox', lv: 1, xp: 0, hp: 100 };
}
function applyProf(u, b) {
  if (HEROES.some(h => h[0] === b.hero)) u.h = b.hero;
  if (b.lvl) u.lv = num(b.lvl, 1, 200); if (b.xp !== undefined) u.xp = num(b.xp, 0, 1e9); if (b.hp) u.hp = num(b.hp, 50, 400);
  u.ts = now();
}
async function saveFriendSnapshot(uid,b) {
  const d=b.fstats;if (!uid.startsWith('t') || !d || typeof d !== 'object' || Array.isArray(d)) return;
  const n=(v,max)=>Math.floor(num(v,0,max));
  const snap={hero:HEROES.some(h=>h[0]===b.hero)?b.hero:'fox',level:Math.max(1,n(b.lvl,200)),heroLevel:Math.max(1,n(d.heroLevel,30)),puzzles:n(d.puzzles,10000000),stars:n(d.stars,150),achievements:n(d.achievements,85),teamwins:n(d.teamwins,10000000),ts:now()};
  await jset('friendstats:'+uid,snap);
}
const pub = u => ({ a: u.a, h: u.h, l: u.lv || 1, rt: u.rt, hp: u.hp || 100 });
const view = (m, side) => { const o = side === 'a' ? m.b : m.a; return { mid: m.id, side, seed: m.seed, g: m.g, pid: m.pid, ranked: m.rk, bot: m.bot, t0: m.t0, now: now(), opp: { a: o.a, h: o.h, l: o.l, rt: o.rt, hp: o.hp } }; };
const friendView = async (m, side, uid) => { const o=side==='a'?m.b:m.a, out=view(m,side), ids=await friendIdentities(uid,[o.uid]); out.opp.a=friendLabel(ids[o.uid],o.a); return out; };
const newMatch = (rk, bot, a, b, delay) => ({ id: rid(10), rk, bot, seed: rnd(2147483647), g: rk && (a.rt + b.rt) / 2 >= 1300 ? 5 : 4, pid: PIDS[rnd(PIDS.length)], t0: now() + delay, a, b });

async function tryMatch(uid, tk, waited) {
  const q = 'q:' + tk.rk, o = parse(await cmd('GETDEL', q));
  if (o && o.uid !== uid && now() - o.t < 8000) {
    const m = newMatch(tk.rk, 0, Object.assign({ uid: o.uid }, o.p), Object.assign({ uid }, tk.p), 5500);
    await pipe([['SET', 'm:' + m.id, JSON.stringify(m), 'EX', 900], ['SET', 'pm:' + o.uid, JSON.stringify({ mid: m.id, side: 'a' }), 'EX', 30], ['DEL', 'tk:' + uid]]);
    return view(m, 'b');
  }
  if (waited >= 9000) {
    const lv = Math.max(1, (tk.p.l || 1) + rnd(5) - 2), hs = HEROES.filter(h => h[1] <= Math.max(lv, 8)), h = hs[rnd(hs.length)][0];
    const bot = { uid: 'bot', a: alias('bot' + rid(6)), h, l: lv, rt: Math.max(100, tk.p.rt + rnd(121) - 60), hp: 100 + Math.min(40, lv) };
    const m = newMatch(tk.rk, 1, Object.assign({ uid }, tk.p), bot, 3000);
    await pipe([['SET', 'm:' + m.id, JSON.stringify(m), 'EX', 900], ['DEL', 'tk:' + uid]]);
    return view(m, 'a');
  }
  await cmd('SET', q, JSON.stringify(Object.assign({}, tk, { t: now() })), 'EX', 10);
  return { wait: true };
}
function clean(s, m, prev) {
  s = s && typeof s === 'object' ? s : {}; prev = prev || {};
  const N = m.g * m.g, k = Array.isArray(s.k) ? s.k.filter(x => SKS.includes(x)).slice(0, 30) : [];
  const out = { p: num(s.p, prev.p || 0, N), d: num(s.d, prev.d || 0, 1500), h: num(s.h, prev.h || 0, 400), e: num(s.e, 0, 100), k: k.length >= (prev.k || []).length ? k : prev.k || [],
    x: prev.x || (s.x ? 1 : 0), fT: prev.fT || 0, seen: now() };
  if (s.f && out.p >= N && !out.fT) out.fT = now();
  return out;
}
const pubS = s => s ? { p: s.p, d: s.d, h: s.h, e: s.e, k: s.k, f: s.fT ? 1 : 0, x: s.x } : null;
async function decide(m, A, B) {
  const t = now(); A = A || {}; B = B || {};
  const hpA = Math.min(m.a.hp, m.a.hp - (B.d || 0) + (A.h || 0)), hpB = Math.min(m.b.hp, m.b.hp - (A.d || 0) + (B.h || 0));
  const gone = S => S.x || (t > m.t0 + 15000 && (!S.seen || t - S.seen > 15000));
  let w = null, why = '';
  const ga = gone(A), gb = gone(B);
  if (ga || gb) { w = ga && gb ? 'd' : ga ? 'b' : 'a'; why = 'left'; }
  else if (hpA <= 0 || hpB <= 0) { w = hpA <= 0 && hpB <= 0 ? ((A.d || 0) >= (B.d || 0) ? 'a' : 'b') : hpB <= 0 ? 'a' : 'b'; why = 'ko'; }
  else if (A.fT || B.fT) { w = A.fT && (!B.fT || A.fT <= B.fT) ? 'a' : 'b'; why = 'done'; }
  else if (t > m.t0 + (FTIME + 6) * 1000) { w = hpA > hpB ? 'a' : hpB > hpA ? 'b' : 'd'; why = 'time'; }
  if (!w) return null;
  const res = { w, why, ra: m.a.rt, rb: m.b.rt, da: 0, db: 0 }, rk = 'm:' + m.id + ':r';
  if (!(await cmd('SET', rk, JSON.stringify(res), 'NX', 'EX', 900))) return parse(await cmd('GET', rk));
  const [ua, ub] = await Promise.all([user(m.a.uid), user(m.b.uid)]);
  const sa = w === 'a' ? 1 : w === 'd' ? 0.5 : 0;
  if (m.rk) {
    const ea = 1 / (1 + 10 ** ((ub.rt - ua.rt) / 400)), dA = Math.round(32 * (sa - ea));
    const na = Math.max(100, ua.rt + dA), nb = Math.max(100, ub.rt - dA);
    res.da = na - ua.rt; res.db = nb - ub.rt; ua.rt = na; ub.rt = nb; ua.g = (ua.g || 0) + 1; ub.g = (ub.g || 0) + 1;
  }
  if (w === 'd') { ua.d = (ua.d || 0) + 1; ub.d = (ub.d || 0) + 1; } else if (w === 'a') { ua.w++; ub.l++; } else { ub.w++; ua.l++; }
  res.ra = ua.rt; res.rb = ub.rt;
  const ops = [['SET', 'u:' + m.a.uid, JSON.stringify(ua)], ['SET', 'u:' + m.b.uid, JSON.stringify(ub)], ['SET', rk, JSON.stringify(res), 'EX', 900]];
  if (m.rk) ops.push(['ZADD', 'lb:rt', ua.rt, m.a.uid], ['ZADD', 'lb:rt', ub.rt, m.b.uid]);
  await pipe(ops);
  return res;
}
const OPS = {
  // Social operations accept only Telegram-signed identities, never guest IDs.
  async friends(uid) {
    if (!uid.startsWith('t')) return { err: 'telegram' };
    const ids = (await cmd('SMEMBERS', 'friends:' + uid)).slice(0, 100);
    const rows = ids.length ? await cmd('MGET', ...ids.map(id => 'u:' + id)) : [];
    const identities = await friendIdentities(uid,ids);
    return { list: ids.map((id, i) => { const u = parse(rows[i]) || {}, p = identities[id] || {}; return { id, a: u.a || alias(id), name:p.name || '', username:p.username || '', h: u.h || 'fox', l: u.lv || 1 }; }) };
  },
  async friendProfile(uid,b) {
    if (!uid.startsWith('t')) return {err:'telegram'};
    const id=String(b.id||''); if(!/^t[0-9]+$/.test(id) || id===uid) return {err:'friend'};
    const checks=await pipe([['SISMEMBER','friends:'+uid,id],['SISMEMBER','friends:'+id,uid]]);
    if(!checks[0] || !checks[1])return {err:'friend'};
    const [u,stats,ids]=await Promise.all([user(id),jget('friendstats:'+id),friendIdentities(uid,[id])]);
    const identity=ids[id]||{};
    return {profile:{name:identity.name||'',username:identity.username||'',alias:u.a||alias(id),hero:stats?.hero||u.h||'fox',level:stats?.level||u.lv||1,rating:u.rt||1000,arenaWins:u.w||0,heroLevel:stats?.heroLevel??null,puzzles:stats?.puzzles??null,stars:stats?.stars??null,achievements:stats?.achievements??null,teamwins:stats?.teamwins??null,updated:stats?.ts||null}};
  },
  async friendSnapshot(uid,b) {
    if (!uid.startsWith('t')) return {err:'telegram'};
    await saveFriendSnapshot(uid,b); return {ok:1};
  },
  async friendInvite(uid) {
    if (!uid.startsWith('t')) return { err: 'telegram' };
    const id = rid(24); await jset('fi:' + id, { uid }, 7 * 86400); return { code: id };
  },
  async friendAccept(uid, b) {
    if (!uid.startsWith('t')) return { err: 'telegram' };
    const code = String(b.code || ''); if (!/^[A-Za-z0-9]{24}$/.test(code)) return { err: 'invite' };
    const key = 'fi:' + code, v = await jget(key);
    if (!v || !v.uid || !v.uid.startsWith('t')) return { err: 'expired' };
    if (v.uid === uid) return { err: 'self' };
    const taken = parse(await cmd('GETDEL', key)); if (!taken || taken.uid !== v.uid) return { err: 'expired' };
    await pipe([['SADD', 'friends:' + uid, v.uid], ['SADD', 'friends:' + v.uid, uid]]);
    const ids = await friendIdentities(uid,[v.uid]); return { ok: 1, a: friendLabel(ids[v.uid], (await user(v.uid)).a) };
  },
  async friendRemove(uid, b) {
    if (!uid.startsWith('t')) return { err: 'telegram' };
    const id = String(b.id || ''); if (!/^t[0-9]+$/.test(id) || id === uid) return { err: 'friend' };
    await pipe([['SREM', 'friends:' + uid, id], ['SREM', 'friends:' + id, uid]]); return { ok: 1 };
  },
  async duelCreate(uid, b) {
    if (!uid.startsWith('t')) return { err: 'telegram' };
    const target = String(b.id || '');
    if (!/^t[0-9]+$/.test(target) || !(await cmd('SISMEMBER', 'friends:' + uid, target))) return { err: 'friend' };
    const u = await user(uid); applyProf(u, b); await jset('u:' + uid, u);
    const code = rid(24); await jset('di:' + code, { uid, target, p: pub(u) }, 600);
    return { code };
  },
  async duelJoin(uid, b) {
    if (!uid.startsWith('t')) return { err: 'telegram' };
    const code = String(b.code || ''); if (!/^[A-Za-z0-9]{24}$/.test(code)) return { err: 'invite' };
    const key = 'di:' + code, invite = await jget(key);
    if (!invite) return { err: 'expired' };
    if (invite.uid === uid || invite.target !== uid) return { err: 'recipient' };
    if (!(await cmd('SISMEMBER', 'friends:' + uid, invite.uid))) return { err: 'friend' };
    const taken = parse(await cmd('GETDEL', key)); if (!taken || taken.uid !== invite.uid) return { err: 'expired' };
    const u = await user(uid); applyProf(u, b); await jset('u:' + uid, u);
    const m = newMatch(0, 0, Object.assign({ uid: invite.uid }, invite.p), Object.assign({ uid }, pub(u)), 12000);
    await pipe([['SET', 'm:' + m.id, JSON.stringify(m), 'EX', 900], ['SET', 'diresult:' + code, JSON.stringify({ mid: m.id, side: 'a', uid: invite.uid }), 'EX', 90]]);
    return friendView(m, 'b', uid);
  },
  async duelPoll(uid, b) {
    if (!uid.startsWith('t')) return { err: 'telegram' };
    const code = String(b.code || ''); if (!/^[A-Za-z0-9]{24}$/.test(code)) return { err: 'invite' };
    const done = await jget('diresult:' + code);
    if (done && done.uid === uid) { const m = await jget('m:' + done.mid); return m ? friendView(m, 'a', uid) : { err: 'expired' }; }
    const inv = await jget('di:' + code); if (!inv || inv.uid !== uid) return { err: 'expired' };
    return { wait: true };
  },
  async duelCancel(uid, b) {
    if (!uid.startsWith('t')) return { err: 'telegram' };
    const code = String(b.code || ''); if (!/^[A-Za-z0-9]{24}$/.test(code)) return { err: 'invite' };
    const inv = await jget('di:' + code); if (inv && inv.uid === uid) await cmd('DEL', 'di:' + code);
    return { ok: 1 };
  },
  async sync(uid, b) {
    const u = await user(uid); applyProf(u, b);
    await pipe([['SET', 'u:' + uid, JSON.stringify(u)], ['ZADD', 'lb:lvl', u.xp || 0, uid]]);
    await saveFriendSnapshot(uid,b);
    return { rt: u.rt, w: u.w, l: u.l, alias: u.a, kv: hasKV };
  },
  async top(uid, b) {
    const bd = b.board === 'lvl' ? 'lvl' : 'rt', key = 'lb:' + bd;
    const [raw, rank] = await pipe([['ZREVRANGE', key, 0, 29, 'WITHSCORES'], ['ZREVRANK', key, uid]]);
    const ids = []; for (let i = 0; i < (raw || []).length; i += 2) ids.push([raw[i], +raw[i + 1]]);
    const us = ids.length ? await cmd('MGET', ...ids.map(x => 'u:' + x[0])) : [];
    const list = ids.map(([id, sc], i) => { const u = parse(us[i]) || {}; return { a: u.a || '???', h: u.h || 'fox', l: u.lv || 1, s: bd === 'rt' ? Math.round(sc) : u.lv || 1, me: id === uid ? 1 : 0 }; });
    let my = null;
    if (rank !== null && rank !== undefined) { const u = await user(uid); my = { pos: +rank + 1, a: u.a, h: u.h, l: u.lv, s: bd === 'rt' ? u.rt : u.lv }; }
    return { list, my };
  },
  async find(uid, b) {
    const u = await user(uid); applyProf(u, b);
    const tk = { uid, t: now(), rk: b.ranked ? 1 : 0, p: pub(u) };
    await pipe([['SET', 'u:' + uid, JSON.stringify(u)], ['SET', 'tk:' + uid, JSON.stringify(tk), 'EX', 60], ['DEL', 'pm:' + uid]]);
    return tryMatch(uid, tk, 0);
  },
  async poll(uid, b) {
    const pm = parse(await cmd('GETDEL', 'pm:' + uid));
    if (pm) { const m = await jget('m:' + pm.mid); if (m) return view(m, pm.side); }
    let tk = await jget('tk:' + uid);
    if (!tk) { const u = await user(uid); tk = { uid, t: now(), rk: b.ranked ? 1 : 0, p: pub(u) }; }
    return tryMatch(uid, tk, num(b.ws, 0, 600000));
  },
  async leave(uid, b) {
    if (b.mid) {
      const side = b.side === 'b' ? 'b' : 'a', m = await jget('m:' + b.mid);
      if (m && m[side] && m[side].uid === uid) { const k = 'm:' + m.id + ':' + side, s = (await jget(k)) || {}; s.x = 1; s.seen = now(); await jset(k, s, 900); }
      return { ok: 1 };
    }
    const q = 'q:' + (b.ranked ? 1 : 0), o = parse(await cmd('GETDEL', q));
    if (o && o.uid !== uid) await cmd('SET', q, JSON.stringify(o), 'EX', 10);
    await cmd('DEL', 'tk:' + uid);
    return { ok: 1 };
  },
  async act(uid, b) {
    const mid = String(b.mid || '').slice(0, 20), side = b.side === 'b' ? 'b' : 'a', os = side === 'a' ? 'b' : 'a', K = 'm:' + mid;
    const [mr, rr, orw, mine] = await cmd('MGET', K, K + ':r', K + ':' + os, K + ':' + side);
    const m = parse(mr); if (!m || !m[side] || m[side].uid !== uid || m.bot) return { err: 'match' };
    const s = clean(b.s, m, parse(mine)), o = parse(orw), res = parse(rr);
    await jset(K + ':' + side, s, 900);
    if (res) return { o: pubS(o), r: res };
    return { o: pubS(o), r: await decide(m, side === 'a' ? s : o, side === 'b' ? s : o) };
  },
  async end(uid, b) {
    const m = await jget('m:' + String(b.mid || '').slice(0, 20));
    if (!m || !m.bot || m.a.uid !== uid) return { err: 'match' };
    const u = await user(uid), sc = b.res === 'win' ? 1 : b.res === 'draw' ? 0.5 : 0;
    if (now() - m.t0 < 12000 && sc > 0) return { rt: u.rt, drt: 0 };
    if (!(await cmd('SET', 'm:' + m.id + ':r', '1', 'NX', 'EX', 900))) return { rt: u.rt, drt: 0 };
    let drt = 0;
    if (m.rk) { const e = 1 / (1 + 10 ** ((m.b.rt - u.rt) / 400)), nr = Math.max(100, Math.round(u.rt + 16 * (sc - e))); drt = nr - u.rt; u.rt = nr; u.g = (u.g || 0) + 1; }
    if (sc === 1) u.w++; else if (sc === 0) u.l++; else u.d = (u.d || 0) + 1;
    const ops = [['SET', 'u:' + uid, JSON.stringify(u)]]; if (m.rk) ops.push(['ZADD', 'lb:rt', u.rt, uid]);
    await pipe(ops);
    return { rt: u.rt, drt };
  },
};
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(200).json({ ok: 1, kv: hasKV });
  if (!hasKV && process.env.VERCEL) return res.status(200).json({ err: 'nokv' }); // no Redis on Vercel -> client plays offline vs bot
  const b = await readJson(req), tgu=checkInit(b.init), uid = who(b, tgu);
  if (!uid) return res.status(200).json({ err: 'auth' });
  const f = OPS[b.op]; if (!f) return res.status(200).json({ err: 'op' });
  try { if (tgu && ['sync','friendInvite','friendAccept','friends','duelCreate','duelJoin'].includes(b.op)) await refreshFriendIdentity(uid,tgu); res.status(200).json((await f(uid, b)) || {}); } catch (e) { console.error('arena', b.op, e); res.status(200).json({ err: 'server' }); }
}
