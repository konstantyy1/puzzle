/* Daily puzzle: one picture for everyone per Kyiv day, time leaderboard, evening reminders from the bot */
'use strict';
const DailyPz = (() => {
  const $ = id => document.getElementById(id);
  const D = DATA, S = () => Store.S;
  const POOL = [...new Set(D.CH.flatMap(c => c.ids))];
  const signed = () => !!(typeof TG !== 'undefined' && TG && TG.initData);
  const pl = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  const hap = t => { try { UI.hap(t); } catch (e) {} };
  const note = t => '<div class="dz-note">' + t + '</div>';
  function parts(t) {
    const d = new Date(t === undefined ? Date.now() : t);
    try {
      const p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kiev', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
        .formatToParts(d).forEach(x => { p[x.type] = x.value; });
      if (p.year && p.month && p.day) return { day: p.year + '-' + p.month + '-' + p.day, s: ((+p.hour || 0) % 24) * 3600 + (+p.minute || 0) * 60 + (+p.second || 0) };
    } catch (e) {}
    const u = new Date(d.getTime() + 2 * 3600e3);
    return { day: u.toISOString().slice(0, 10), s: u.getUTCHours() * 3600 + u.getUTCMinutes() * 60 + u.getUTCSeconds() };
  }
  const today = () => parts().day;
  const yday = () => parts(Date.now() - 864e5).day;
  const dayNum = k => Math.floor(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 864e5);
  const prevKey = k => new Date((dayNum(k) - 1) * 864e5).toISOString().slice(0, 10);
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  // Same day -> same picture, size and piece layout for every player.
  function cfgOf(k) {
    const n = dayNum(k), L = POOL.length; let s = 73; while (gcd(s, L) !== 1) s++;
    let h = 2166136261; for (const ch of 'dz:' + k) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return { day: k, g: 4 + (n % 3), pid: POOL[(n * s) % L], seed: ((h >>> 0) % 2147483646) + 1 };
  }
  function st() {
    let z = S().dz;
    if (!z || typeof z !== 'object' || Array.isArray(z)) z = S().dz = {};
    if (typeof z.d !== 'string') Object.assign(z, { d: '', t: 0, pos: 0, tot: 0, sn: 0, sl: '', rem: 0, sync: 1 });
    return z;
  }
  const ft = s => { const ds = Math.max(0, Math.round((+s || 0) * 10)), m = Math.floor(ds / 600), r = ds - m * 600; return m + ':' + String(Math.floor(r / 10)).padStart(2, '0') + '.' + (r % 10); };
  async function api(op, body, ms) {
    const ac = window.AbortController ? new AbortController() : null, tm = setTimeout(() => { if (ac) ac.abort(); }, ms || 8000);
    try {
      const r = await fetch('/api/daily', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ac ? ac.signal : undefined,
        body: JSON.stringify(Object.assign({ op, init: signed() ? TG.initData : '' }, body || {})) });
      if (!r.ok) throw new Error('http');
      const j = await r.json(); if (j && j.err) throw new Error(j.err); return j;
    } finally { clearTimeout(tm); }
  }
  /* the first finish of the day goes to the leaderboard; retried later if the network fails */
  let busy = null;
  function submit() {
    if (busy) return busy;
    const z = st();
    if (!z.d || z.sync || !signed()) return Promise.resolve(null);
    if (z.d !== today() && z.d !== yday()) { z.sync = 1; Store.save(); return Promise.resolve(null); }
    busy = api('done', { day: z.d, t: z.t })
      .then(r => { const q = st(); if (q.d === r.day) { q.sync = 1; q.pos = r.pos || 0; q.tot = r.total || 0; if (r.t) q.t = r.t; Store.save(); } return r; })
      .catch(e => { const m = String((e && e.message) || ''); if (m === 'time' || m === 'day' || m === 'auth') { st().sync = 1; Store.save(); return null; } return false; })
      .then(v => { busy = null; return v; });
    return busy;
  }
  function win(cfg, t, r) {
    const z = st(), k = cfg.day || today();
    if (!(k === today() || k === yday()) || (z.d && k <= z.d)) return { day: k, again: 1 };
    z.sn = z.sl === prevKey(k) ? (z.sn || 0) + 1 : 1; z.sl = k;
    z.d = k; z.t = Math.round(t * 10) / 10; z.pos = 0; z.tot = 0; z.sync = 0;
    const c = Prog.addCoins(40 + 10 * Math.min(6, z.sn - 1)), x = Prog.addXP(30);
    if (r) { r.coins = (r.coins || 0) + c; r.xp = (r.xp || 0) + x.xp; if (x.ups && x.ups.length && r.ups) r.ups.push(...x.ups); }
    Store.save();
    return { day: k, fresh: 1, t: z.t, sn: z.sn, coins: c };
  }
  function resultHtml(dz) {
    if (!dz) return '';
    if (dz.again) return '<div class="dz-res"><b>🧩 Пазл дня</b><span>Результат за цей день уже зараховано — ця спроба без рейтингу</span></div>';
    return '<div class="dz-res"><b>🧩 Пазл дня · ' + ft(dz.t) + '</b><span id="dzRank">' + (signed() ? '⏳ Рахую місце в рейтингу…' : 'Рейтинг працює, коли гра відкрита в Telegram') + '</span>' +
      '<span>🎁 Бонус дня +' + dz.coins + ' 🪙 · 🔥 серія ' + dz.sn + ' ' + pl(dz.sn, 'день', 'дні', 'днів') + '</span></div>' +
      '<button class="btn btn-g" data-a="dzOpen">🏆 Рейтинг дня</button>';
  }
  async function afterResult(dz) {
    if (!dz || !dz.fresh || !signed()) return;
    const r = await submit(), el = $('dzRank'); if (!el) return;
    const z = st();
    el.textContent = z.pos ? '🏆 Місце #' + z.pos + ' з ' + z.tot : r === false ? '⚠️ Немає зв’язку — результат відправиться пізніше' : 'Цей результат не потрапив у рейтинг';
  }
  /* leaderboard */
  const heroE = id => (D.HEROES.find(h => h.id === id) || D.HEROES[0]).e;
  const lbRow = (pos, r) => '<div class="lbr' + (r.me ? ' me' : '') + '"><span class="pos' + (pos <= 3 ? ' p' + pos : '') + '">' + (pos <= 3 ? ['🥇', '🥈', '🥉'][pos - 1] : pos) + '</span>' +
    '<span class="lav">' + heroE(r.h) + '</span><span class="ln">' + UI.esc(r.a || '???') + (r.me ? ' · ти' : '') + '<small>' + UI.esc(Prog.title(r.l || 1)) + ' · рів. ' + (r.l || 1) + '</small></span>' +
    '<span class="lsc">' + ft(r.t) + '</span></div>';
  function topHtml(j) {
    if (!j || !Array.isArray(j.list)) return '';
    if (!j.list.length) return note('Сьогодні ще ніхто не зібрав — стань першим! 🚀');
    let x = j.list.map((r, i) => lbRow(i + 1, r)).join('');
    if (j.my && j.my.pos > j.list.length) x += '<div class="dz-gap">⋯</div>' + lbRow(j.my.pos, j.my);
    return x + note('Сьогодні зібрали: ' + j.total + ' ' + pl(j.total, 'гравець', 'гравці', 'гравців'));
  }
  let topCache = null;
  function left() { const s = Math.max(60, 86400 - parts().s), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ' год ' : '') + m + ' хв'; }
  function remBtn() {
    const on = st().rem;
    return '<button class="dz-rem" id="dzRem" data-a="dzRem"><span>' + (on ? '🔔' : '🔕') + '</span><div><b>Нагадування від бота</b><small>' + (on ? 'Увімкнено: бот нагадає ввечері, якщо пазл ще не зібрано' : 'Бот нагадає ввечері, якщо пазл ще не зібрано') + '</small></div><i class="sw' + (on ? ' on' : '') + '"></i></button>';
  }
  function paintTop(j, k) {
    const z = st(); z.rem = j.rem ? 1 : 0;
    if (j.my && z.d === k) { z.pos = j.my.pos; z.tot = j.total; }
    Store.save();
    const el = $('dzTop'); if (el) el.innerHTML = topHtml(j);
    const rb = $('dzRem'); if (rb) rb.outerHTML = remBtn();
    const ps = $('dzPos'); if (ps && z.pos && z.d === k) ps.textContent = ' · місце #' + z.pos + ' з ' + z.tot;
  }
  function open() {
    const k = today(), c = cfgOf(k), z = st(), done = z.d === k;
    const sv = Store.gsave.get(), resume = !!(sv && sv.cfg && sv.cfg.kind === 'dz' && sv.cfg.day === k && !done);
    const sn = z.sl === k || z.sl === yday() ? z.sn || 0 : 0;
    UI.modal('<div class="dz-pic' + (done ? '' : ' blur') + '"><img src="' + D.img(c.pid, 400) + '" alt="" onerror="this.remove()"><span>' + c.g + '×' + c.g + '</span></div>' +
      '<h3>🧩 Пазл дня</h3><p>Одна картинка для всіх гравців. У рейтинг іде перша спроба за день, підказки вимкнені.</p>' +
      (done ? '<div class="dz-me">✅ Твій час <b>' + ft(z.t) + '</b><span id="dzPos">' + (z.pos ? ' · місце #' + z.pos + ' з ' + z.tot : '') + '</span></div>' : '') +
      '<button class="btn ' + (done ? 'btn-s' : 'btn-g') + '" id="dzPlay">' + (resume ? '⏯️ Продовжити' : done ? '🔄 Зіграти ще раз (без рейтингу)' : '▶️ Грати') + '</button>' +
      '<div class="sl">🏆 Рейтинг дня</div><div id="dzTop">' + (signed() ? (topCache && topCache.day === k ? topHtml(topCache) : note('Завантаження…')) : note('Рейтинг працює, коли гра відкрита в Telegram')) + '</div>' +
      (signed() ? remBtn() : '') +
      note('🔥 Серія: ' + sn + ' ' + pl(sn, 'день', 'дні', 'днів') + ' · новий пазл через ' + left()) +
      '<button class="btn btn-s" data-close>Закрити</button>');
    const pb = $('dzPlay');
    if (pb) pb.onclick = () => { UI.closeModal(); if (resume) UI.Ctl.resume(); else play(k); };
    if (!signed()) return;
    Promise.resolve(submit()).then(() => api('top', { day: k })).then(j => { topCache = j; if ($('dzTop')) paintTop(j, k); })
      .catch(() => { const el = $('dzTop'); if (el) el.innerHTML = note('⚠️ Немає зв’язку з сервером'); });
  }
  function play(k) {
    const c = cfgOf(k || today());
    UI.Ctl.play({ kind: 'dz', day: c.day, g: c.g, mode: 'classic', seed: c.seed, src: { t: 'pic', pid: c.pid } });
  }
  /* reminders: the bot needs permission to write to the player */
  function writeAccess() {
    return new Promise(res => {
      const u = TG.initDataUnsafe && TG.initDataUnsafe.user;
      if (u && u.allows_write_to_pm) return res(true);
      try { if (TG.requestWriteAccess && TG.isVersionAtLeast && TG.isVersionAtLeast('6.9')) return TG.requestWriteAccess(ok => res(!!ok)); } catch (e) {}
      res(true);
    });
  }
  let remBusy = false;
  async function toggleRem() {
    if (!signed()) return UI.toast('Нагадування працюють, коли гра відкрита в Telegram');
    if (remBusy) return; remBusy = true;
    try {
      const on = st().rem ? 0 : 1;
      if (on && !(await writeAccess())) { hap('warn'); UI.toast('Без дозволу бот не зможе тобі написати 😕'); return; }
      const r = await api('rem', { on });
      st().rem = r.rem ? 1 : 0; Store.save(); hap('ok');
      UI.toast(r.rem ? '🔔 Готово! Бот нагадає ввечері, якщо пазл ще не зібрано' : '🔕 Нагадування вимкнено');
      const rb = $('dzRem'); if (rb) rb.outerHTML = remBtn();
    } catch (e) { hap('err'); UI.toast('Немає зв’язку з сервером 😕'); }
    finally { remBusy = false; }
  }
  /* home screen card */
  function card() {
    const k = today(), c = cfgOf(k), z = st(), done = z.d === k;
    return '<button class="cta dz-cta' + (done ? ' done' : '') + '" data-a="dzOpen"><span class="ci">🧩</span><div><b>Пазл дня · ' + c.g + '×' + c.g + '</b><span>' +
      (done ? '✅ ' + ft(z.t) + (z.pos ? ' · місце #' + z.pos + ' з ' + z.tot : ' · зараховано') : 'Одна картинка для всіх · рейтинг дня') + '</span></div>' + (done ? '' : '<i class="dz-new">НОВИЙ</i>') + '</button>';
  }
  const home0 = UI.R.home;
  UI.R.home = function () {
    home0.apply(this, arguments);
    try {
      const w = $('homeW'); if (!w || w.querySelector('.dz-cta')) return;
      const ref = w.querySelector('[data-a="duel"]');
      if (ref) ref.insertAdjacentHTML('beforebegin', card()); else w.insertAdjacentHTML('beforeend', card());
    } catch (e) { console.error(e); }
  };
  Object.assign(UI.A, { dzOpen: () => open(), dzRem: () => toggleRem() });
  setTimeout(() => { submit(); }, 6000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) submit(); });
  return { open, play, win, resultHtml, afterResult, submit, today, cfgOf, ft };
})();
