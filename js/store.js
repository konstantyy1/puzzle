/* State + persistence (localStorage + Telegram CloudStorage) */
'use strict';
const TG = (window.Telegram && window.Telegram.WebApp) || null;
const Store = (() => {
  const user = (TG && TG.initDataUnsafe && TG.initDataUnsafe.user) || null;
  const uid = user ? String(user.id) : 'guest';
  const LK = 'pz2_' + uid, SK = 'pz2s_' + uid;
  const DEF = () => ({
    v: 2, rev: 0, ts: 0, xp: 0, coins: 150,
    stats: { pieces: 0, wins: 0, perfect: 0, speed: 0, big: 0, own: 0, anim: 0, duels: 0, games: 0, coinsEarned: 0, dailyDone: 0, arena: 0, rmax: 1000, time: 0 },
    camp: {}, rec: {}, ach: {},
    hero: { id: 'fox', owned: ['fox'], sk: { magnet: 0, hint: 0, time: 0, luck: 0, corner: 0, atk: 0, def: 0, en: 0 }, xp: { fox: 0 } },
    prof: { xpb: 0, coinb: 0, daily: 0, gift: 0 },
    cos: { frame: '', frames: [''], theme: '', themes: [''] },
    inv: { hint: 3 },
    daily: { day: '', tasks: [], chest: 0, gift: '' },
    streak: { last: '', n: 0, best: 0, claim: '' },
    arena: { rt: 1000, w: 0, l: 0, games: 0, alias: '' },
    media: [], set: { haptic: 1 }, seen: {},
  });
  const merge = (d, s) => {
    if (!s || typeof s !== 'object') return d;
    for (const k in d) {
      if (!(k in s)) continue;
      const a = d[k], b = s[k];
      if (a && typeof a === 'object' && !Array.isArray(a) && b && typeof b === 'object' && !Array.isArray(b)) d[k] = merge(a, b);
      else if (typeof b === typeof a || a === null) d[k] = b;
    }
    for (const k in s) if (!(k in d)) d[k] = s[k];
    return d;
  };
  let S = DEF();
  try { const raw = localStorage.getItem(LK); if (raw) S = merge(DEF(), JSON.parse(raw)); } catch (e) {}
  const cs = () => (TG && TG.CloudStorage && TG.isVersionAtLeast && TG.isVersionAtLeast('6.9')) ? TG.CloudStorage : null;
  const cget = keys => new Promise(res => { const c = cs(); if (!c) return res(null); try { c.getItems(keys, (e, v) => res(e ? null : v)); } catch (e) { res(null); } });
  const cset = (k, v) => new Promise(res => { const c = cs(); if (!c) return res(false); try { c.setItem(k, v, (e, ok) => res(!e && ok)); } catch (e) { res(false); } });
  let cloudT = 0, dirty = false;
  async function pushCloud() {
    cloudT = 0; if (!cs() || !dirty) return; dirty = false;
    const str = JSON.stringify(S), n = Math.ceil(str.length / 3500);
    for (let i = 0; i < n; i++) await cset('pz' + i, str.slice(i * 3500, (i + 1) * 3500));
    await cset('pzh', JSON.stringify({ n, rev: S.rev, ts: S.ts }));
  }
  function save(now) {
    S.rev++; S.ts = Date.now();
    try { localStorage.setItem(LK, JSON.stringify(S)); } catch (e) {}
    dirty = true;
    if (cloudT) clearTimeout(cloudT);
    if (now) pushCloud(); else cloudT = setTimeout(pushCloud, 2500);
  }
  async function syncCloud() {
    const h = await cget(['pzh']); if (!h || !h.pzh) { if (cs()) { dirty = true; pushCloud(); } return false; }
    let hd; try { hd = JSON.parse(h.pzh); } catch (e) { return false; }
    if (!hd || hd.rev <= S.rev) { if (hd && hd.rev < S.rev) { dirty = true; pushCloud(); } return false; }
    const keys = []; for (let i = 0; i < hd.n; i++) keys.push('pz' + i);
    const v = await cget(keys); if (!v) return false;
    try { const obj = JSON.parse(keys.map(k => v[k] || '').join('')); S = merge(DEF(), obj); localStorage.setItem(LK, JSON.stringify(S)); return true; } catch (e) { return false; }
  }
  function flush() { if (dirty) pushCloud(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  const gsave = { get() { try { return JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) { return null; } },
    set(v) { try { v ? localStorage.setItem(SK, JSON.stringify(v)) : localStorage.removeItem(SK); } catch (e) {} } };
  function reset() { S = DEF(); save(true); gsave.set(null); }
  return { get S() { return S; }, save, syncCloud, flush, gsave, reset, uid, user };
})();
