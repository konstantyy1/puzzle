/* Upstash Redis REST (Vercel Marketplace) with in-memory fallback for local dev */
const U = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
export const hasKV = !!(U && T);
const mem = globalThis.__pzmem || (globalThis.__pzmem = { kv: new Map(), z: new Map(), sets: new Map() });
function zsorted(k) { const z = mem.z.get(k) || new Map(); return [...z.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1)); }
function memCmd(a) {
  const c = String(a[0]).toUpperCase(), now = Date.now();
  const get = k => { const e = mem.kv.get(k); if (!e) return null; if (e.x && e.x < now) { mem.kv.delete(k); return null; } return e.v; };
  switch (c) {
    case 'GET': return get(a[1]);
    case 'SET': {
      let nx = false, x = 0;
      for (let i = 3; i < a.length; i++) { const o = String(a[i]).toUpperCase(); if (o === 'NX') nx = true; else if (o === 'EX') x = now + a[++i] * 1000; else if (o === 'PX') x = now + +a[++i]; }
      if (nx && get(a[1]) !== null) return null; mem.kv.set(a[1], { v: String(a[2]), x }); return 'OK';
    }
    case 'GETDEL': { const v = get(a[1]); mem.kv.delete(a[1]); return v; }
    case 'DEL': { let n = 0; for (const k of a.slice(1)) if (mem.kv.delete(k)) n++; return n; }
    case 'MGET': return a.slice(1).map(get);
    case 'EXPIRE': { const e = mem.kv.get(a[1]); if (e) e.x = now + a[2] * 1000; return e ? 1 : 0; }
    case 'SADD': { const ss = mem.sets.get(a[1]) || new Set(); mem.sets.set(a[1], ss); let n = 0; for (const v of a.slice(2)) { if (!ss.has(String(v))) { ss.add(String(v)); n++; } } return n; }
    case 'SREM': { const ss = mem.sets.get(a[1]) || new Set(); let n = 0; for (const v of a.slice(2)) if (ss.delete(String(v))) n++; return n; }
    case 'SMEMBERS': return [...(mem.sets.get(a[1]) || new Set())];
    case 'SISMEMBER': return (mem.sets.get(a[1]) || new Set()).has(String(a[2])) ? 1 : 0;
    case 'ZADD': { const z = mem.z.get(a[1]) || new Map(); mem.z.set(a[1], z); for (let i = 2; i + 1 < a.length; i += 2) z.set(String(a[i + 1]), +a[i]); return 1; }
    case 'ZREVRANGE': { const r = zsorted(a[1]).slice(+a[2], +a[3] + 1); return String(a[4] || '').toUpperCase() === 'WITHSCORES' ? r.flatMap(([m, s]) => [m, String(s)]) : r.map(x => x[0]); }
    case 'ZREVRANK': { const i = zsorted(a[1]).findIndex(x => x[0] === String(a[2])); return i < 0 ? null : i; }
    case 'ZSCORE': { const z = mem.z.get(a[1]); const v = z && z.get(String(a[2])); return v === undefined || v === null ? null : String(v); }
    case 'ZCARD': return (mem.z.get(a[1]) || new Map()).size;
    default: throw new Error('mem: unsupported ' + c);
  }
}
async function post(path, body) {
  const r = await fetch(U + path, { method: 'POST', headers: { Authorization: 'Bearer ' + T, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok && !Array.isArray(j)) throw new Error((j && j.error) || 'kv http ' + r.status); return j;
}
export async function cmd(...a) {
  if (!hasKV) return memCmd(a);
  const j = await post('', a.map(String)); if (j.error) throw new Error(j.error); return j.result;
}
export async function pipe(list) {
  if (!hasKV) return list.map(memCmd);
  const j = await post('/pipeline', list.map(x => x.map(String)));
  return j.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}
export const parse = v => { if (!v) return null; try { return JSON.parse(v); } catch { return null; } };
export const jget = async k => parse(await cmd('GET', k));
export const jset = (k, v, ex) => ex ? cmd('SET', k, JSON.stringify(v), 'EX', ex) : cmd('SET', k, JSON.stringify(v));
