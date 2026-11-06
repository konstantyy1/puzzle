/* Arena: online PvP fights, ranked rating, anonymous leaderboard, bot fallback */
'use strict';
const Arena = (() => {
  const $ = id => document.getElementById(id);
  const D = DATA, F = D.FIGHT, S = () => Store.S;
  const heroE = id => (D.HEROES.find(h => h.id === id) || D.HEROES[0]).e;
  const heroO = id => D.HEROES.find(h => h.id === id) || D.HEROES[0];
  let ranked = true, board = 'rt', online = null, M = null, seq = 0;
  const lb = {}, lbT = {};
  const gid = () => { let g = ''; try { g = localStorage.getItem('pz_gid') || ''; if (!g) { g = Math.random().toString(36).slice(2, 12); localStorage.setItem('pz_gid', g); } } catch (e) { g = 'x' + Date.now(); } return g; };
  async function api(op, body, ms) {
    const ac = window.AbortController ? new AbortController() : null, t = setTimeout(() => ac && ac.abort(), ms || 8000);
    try {
      const r = await fetch('/api/arena', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ac ? ac.signal : undefined,
        body: JSON.stringify(Object.assign({ op, init: (TG && TG.initData) || '', gid: gid() }, body || {})) });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json(); if (j && j.err) throw new Error(j.err); return j;
    } finally { clearTimeout(t); }
  }
  const prof = () => ({ hero: S().hero.id, lvl: Prog.level(), xp: S().xp, hp: Prog.B.hp(), fstats: {heroLevel:Prog.heroLvl().L,puzzles:S().stats.wins,stars:Prog.totalStars(),achievements:D.ACH.reduce((n,a)=>n+(S().ach[a.id]||0),0),teamwins:S().stats.teamwins||0,more:{pieces:S().stats.pieces,perfect:S().stats.perfect,streak:S().streak.best,coinsEarned:S().stats.coinsEarned,minutes:Math.round(S().stats.time/60),games:S().stats.games,arenaGames:S().stats.arena,heroes:S().hero.owned,skills:S().hero.sk,ach:S().ach}} });
  async function sync() {
    try {
      const r = await api('sync', prof(), 6000); online = true;
      if (r && typeof r.rt === 'number') { const a = S().arena; a.rt = r.rt; a.w = r.w || 0; a.l = r.l || 0; a.alias = r.alias || a.alias; S().stats.rmax = Math.max(S().stats.rmax, r.rt); Store.save(); }
      return r;
    } catch (e) { online = false; return null; }
  }
  /* ---------- screen ---------- */
  UI.R.arena = () => {
    const a = S().arena, lg = D.league(a.rt), li = D.LEAGUES.indexOf(lg), nx = D.LEAGUES[li + 1], h = Prog.hero();
    let x = '<div class="h1">Арена</div><div class="sub">Збирай пазл швидше за суперника — кожна деталь б’є!</div>';
    x += '<div class="card league lg-' + lg.id + '"><div class="lg-ic">' + lg.ic + '</div><div class="rmid"><div class="rt">' + lg.n + ' · ' + a.rt + '</div>' +
      '<div class="rd">' + (nx ? 'До ліги «' + nx.n + '» ще ' + (nx.min - a.rt) : 'Найвища ліга!') + '</div>' +
      '<div class="bar"><i style="width:' + (nx ? UI.pct(a.rt - lg.min, nx.min - lg.min) : 100) + '%"></i></div>' +
      '<div class="rd">🏆 ' + a.w + ' · 💔 ' + a.l + (a.alias ? ' · псевдонім «' + UI.esc(a.alias) + '»' : '') + '</div></div></div>';
    x += '<div class="seg"><button class="' + (ranked ? 'on' : '') + '" data-a="arMode" data-v="1">🏆 Рейтинговий</button><button class="' + (ranked ? '' : 'on') + '" data-a="arMode" data-v="0">⚔️ Звичайний</button></div>';
    x += '<button class="btn btn-g" data-a="arFind">⚔️ ' + (ranked ? 'Рейтинговий бій' : 'Знайти суперника') + '</button>';
    x += '<div class="mut small tc mt">' + (ranked ? 'Перемога піднімає рейтинг і лігу, поразка — знижує' : 'Тренувальний бій без зміни рейтингу') +
      (online === false ? '<br>⚠️ Сервер недоступний — бій буде з ботом, без рейтингу' : '') + '</div>';
    x += '<button class="btn btn-s mt" data-a="teamCreate">🤝 Створити бій 2×2</button>';
    x += '<button class="btn btn-s mt" data-go="friends">🤝 Друзі та виклики</button>';
    x += '<div class="card mt"><div class="h2">' + h.e + ' Твій боєць <span class="r">' + h.sp.ic + ' ' + h.sp.n + '</span></div><div class="grid3">' +
      UI.stat(Prog.B.hp(), 'Здоров’я') + UI.stat('×' + Prog.B.atk().toFixed(2), 'Шкода') + UI.stat('+' + Math.round((Prog.B.en() - 1) * 100) + '%', 'Енергія') + '</div>' +
      '<div class="rd mt">' + h.sp.ic + ' ' + h.sp.d + '. Сила, витривалість і енергія прокачуються на вкладці «Герой».</div></div>';
    x += '<div class="card"><div class="h2">📖 Як битися</div><div class="rd">• Кожна вставлена деталь завдає шкоди. Швидка серія — комбо до ×1,5, помилка його скидає.<br>' +
      '• Деталі заряджають ⚡ енергію — тисни кнопку суперудару героя.<br>• Перемога: нокаут, або першим зібрати пазл, або більше здоров’я після 3 хвилин.</div></div>';
    x += '<div class="sl">Таблиця лідерів</div><div class="seg"><button class="' + (board === 'rt' ? 'on' : '') + '" data-a="arBoard" data-v="rt">🏆 Рейтинг</button><button class="' + (board === 'lvl' ? 'on' : '') + '" data-a="arBoard" data-v="lvl">⭐ Рівень</button></div>';
    x += '<div id="lbBox">' + lbHtml() + '</div><div class="mut small tc mt">🕶️ Таблиця анонімна: замість імен — випадкові псевдоніми</div>';
    $('arenaW').innerHTML = x;
    loadLb();
  };
  const lbRow = (pos, r) => '<div class="lbr' + (r.me ? ' me' : '') + '"><span class="pos' + (pos <= 3 ? ' p' + pos : '') + '">' + (pos <= 3 ? ['🥇', '🥈', '🥉'][pos - 1] : pos) + '</span>' +
    '<span class="lav">' + heroE(r.h) + '</span><span class="ln">' + UI.esc(r.a || '???') + (r.me ? ' · ти' : '') + '<small>' + (board === 'rt' ? D.league(r.s).ic + ' ' + D.league(r.s).n + ' · рів. ' + (r.l || 1) : Prog.title(r.l || 1)) + '</small></span>' +
    '<span class="lsc">' + (board === 'rt' ? r.s : 'Рів. ' + (r.l || 1)) + '</span></div>';
  function lbHtml() {
    const d = lb[board];
    if (!d) return '<div class="empty">' + (online === false ? 'Таблиця лідерів недоступна без сервера' : 'Завантаження…') + '</div>';
    if (!d.list.length) return '<div class="empty">Поки порожньо — стань першим!</div>';
    let x = d.list.map((r, i) => lbRow(i + 1, r)).join('');
    if (d.my && d.my.pos > d.list.length) x += '<div class="mut tc">⋯</div>' + lbRow(d.my.pos, Object.assign({ me: 1 }, d.my));
    return x;
  }
  async function loadLb(force) {
    const b = board; if (!force && lb[b] && Date.now() - (lbT[b] || 0) < 30000) return;
    try { const r = await api('top', { board: b }, 7000); online = true; lb[b] = { list: r.list || [], my: r.my || null }; lbT[b] = Date.now(); }
    catch (e) { online = online === null ? false : online; }
    const box = $('lbBox'); if (box && UI.cur === 'arena' && board === b) box.innerHTML = lbHtml();
  }
  /* ---------- matchmaking ---------- */
  const ADJ = ['Швидкий', 'Хоробрий', 'Мудрий', 'Веселий', 'Хитрий', 'Спритний', 'Зоряний', 'Крижаний', 'Вогняний', 'Золотий', 'Таємничий', 'Космічний'];
  const ANI = ['Лис', 'Їжак', 'Ведмідь', 'Вовк', 'Єнот', 'Тигр', 'Лев', 'Дельфін', 'Пінгвін', 'Орел', 'Бобер', 'Кролик'];
  const rnd = n => Math.floor(Math.random() * n);
  function botProfile(rt) {
    const l = Math.max(1, Prog.level() + rnd(5) - 2), hs = D.HEROES.filter(h => h.lvl <= l), h = hs[rnd(hs.length)] || D.HEROES[0];
    return { a: ADJ[rnd(ADJ.length)] + ' ' + ANI[rnd(ANI.length)] + ' ' + (10 + rnd(90)), h: h.id, l, rt: Math.max(100, rt + rnd(121) - 60), hp: F.hp + Math.min(40, l) };
  }
  function localMatch() {
    return { mid: '', local: 1, bot: 1, side: 'a', ranked: 0, seed: (Math.random() * 2147483647) | 0, g: 4, pid: D.GALLERY[rnd(D.GALLERY.length)], opp: botProfile(S().arena.rt) };
  }
  async function find() {
    if (M || find.busy) return; find.busy = true;
    const my = ++seq, t0 = Date.now(), rk = ranked ? 1 : 0; let cancel = false, m = null, r = null;
    const b = UI.modal('<div class="searching"><div class="vs">⚔️</div><h3>' + (rk ? 'Рейтинговий бій' : 'Звичайний бій') + '</h3><p id="srT">Шукаю суперника…</p></div>' +
      '<div class="mut small tc mb">Якщо живого суперника немає, за кілька секунд підберемо бота 🤖</div><button class="btn btn-s" id="srX">Скасувати</button>', { sticky: true, onClose: () => { cancel = true; } });
    b.querySelector('#srX').onclick = () => UI.closeModal();
    const iv = setInterval(() => { const e = $('srT'); if (e) e.textContent = 'Шукаю суперника… ' + Math.round((Date.now() - t0) / 1000) + ' с'; }, 500);
    try {
      r = await api('find', Object.assign({ ranked: rk }, prof()), 8000); online = true;
      while (r && r.wait && !cancel) { await UI.sleep(1300); if (cancel) break; r = await api('poll', { ranked: rk, ws: Date.now() - t0 }, 8000); }
      if (cancel) api('leave', r && r.mid ? { mid: r.mid, side: r.side } : { ranked: rk }).catch(() => {}); else m = r;
    } catch (e) {
      online = false;
      if (!cancel) { await UI.sleep(Math.max(0, 1600 - (Date.now() - t0))); if (!cancel) { m = localMatch(); UI.toast('Сервер недоступний — бій з ботом без рейтингу'); } }
    }
    clearInterval(iv); find.busy = false;
    if (cancel || my !== seq || !m || !m.opp) return;
    UI.closeModal(); start(m);
  }
  function start(m) {
    M = { m, team: !!m.team, mid: m.mid, side: m.side || 'a', bot: !!m.bot, local: !!m.local, ranked: !!m.ranked && !m.local, N: m.g * m.g, opp: m.opp,
      hpMax: Prog.B.hp() + (m.team ? m.ally.hp : 0), opMax: m.opp.hp || F.hp, ally: {p:0,d:0,h:0,e:0,done:0,x:0}, my: { p: 0, d: 0, h: 0, e: 0, k: [], combo: 1, last: 0, claws: 0, done: 0, x: 0 }, op: { p: 0, d: 0, h: 0, e: 0, done: 0, x: 0 },
      seenK: 0, seenKs: [0,0], over: false, started: false, ts: 0, tmr: 0, pt: 0, fx: {}, rt0: S().arena.rt, off: m.now ? m.now - Date.now() : 0 };
    if (M.bot) M.b = botInit(m.opp);
    UI.Ctl.play({ kind: 'fight', team: M.team, g: m.g, seed: m.seed, ranked: M.ranked, src: { t: 'pic', pid: m.pid } });
  }
  const oppName = m => (m || M).opp.a + ((m || M).bot ? ' 🤖' : '');
  async function ready() {
    const m = M; if (!m) return;
    Game.pause(true);
    $('fMeAv').innerHTML = Avatars.face(Avatars.self,Prog.hero().e); $('fOpAv').innerHTML = Avatars.face(m.opp.avatar,heroE(m.opp.h)); hud();
    banner((m.team ? '🤝 Ти + ' + m.m.ally.a : Prog.hero().e + ' Ти') + ' ⚔️ ' + heroE(m.opp.h) + ' ' + oppName(m), 1500);
    const wait = !m.local && m.m.t0 ? m.m.t0 - (Date.now() + m.off) - 2700 : 900;
    if (wait > 0) await UI.sleep(Math.min(wait, 15000));
    if (M !== m) return;
    await UI.Ctl.countdown(3);
    if (M !== m) return;
    Game.pause(false); m.started = true; m.ts = Date.now(); m.lastOk = m.ts;
    m.tmr = setInterval(tick, 200);
    if (!m.bot) pollLoop();
    hud();
  }
  /* ---------- fight logic ---------- */
  const hpMe = (m = M) => Math.max(0, Math.min(m.hpMax, m.hpMax - m.op.d + m.my.h + (m.team ? m.ally.h : 0)));
  const hpOp = (m = M) => Math.max(0, Math.min(m.opMax, m.opMax - m.my.d - (m.team ? m.ally.d : 0) + m.op.h));
  function tick() { const m = M; if (!m || m.over || !m.started) return; if (m.bot) botTick(Date.now()); hud(); check(); }
  function hud() {
    const m = M; if (!m) return;
    const me = hpMe(m), op = hpOp(m), t = m.started ? Math.max(0, F.time - (Date.now() - m.ts) / 1000) : F.time;
    $('fMeHp').style.width = UI.pct(me, m.hpMax) + '%'; $('fMeHp').classList.toggle('low', me < m.hpMax * 0.3);
    $('fOpHp').style.width = UI.pct(op, m.opMax) + '%'; $('fOpHp').classList.toggle('low', op < m.opMax * 0.3);
    $('fMeEn').style.width = m.my.e + '%'; $('fOpEn').style.width = (m.op.e || 0) + '%';
    $('fMeN').textContent = (m.team ? 'Ти + ' + m.m.ally.a : 'Ти') + ' · ❤️' + Math.ceil(me) + (m.my.combo > 1.05 && Date.now() - m.my.last < F.comboWin ? ' · ×' + m.my.combo.toFixed(1) : '');
    $('fOpN').textContent = oppName(m) + ' · ' + m.op.p + '/' + (m.N * (m.team ? 2 : 1));
    $('fTime').textContent = UI.tfmt(t);
    const sk = $('skBtn'), h = Prog.hero(), rdy = m.my.e >= 100 && m.started && !m.over;
    sk.classList.toggle('rdy', rdy);
    sk.innerHTML = h.sp.ic + '<small>' + (rdy ? h.sp.n : Math.floor(m.my.e) + '%') + '</small>';
  }
  function banner(t, ms) {
    const st = $('stage'); if (!st) return; st.querySelectorAll('.banner').forEach(e => e.remove());
    const b = document.createElement('div'); b.className = 'banner'; b.textContent = t; st.appendChild(b); setTimeout(() => b.remove(), ms || 1600);
  }
  function pop(el, t, crit) {
    const r = el.getBoundingClientRect(), d = document.createElement('div'); d.className = 'dmg' + (crit ? ' crit' : ''); d.textContent = t;
    d.style.left = (r.left + r.width / 2 - 14 + (Math.random() * 16 - 8)) + 'px'; d.style.top = (r.top + r.height + 2) + 'px';
    $('gs').appendChild(d); setTimeout(() => d.remove(), 950);
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  }
  function fx(id, ms) { const e = $(id), m = M; e.classList.add('on'); clearTimeout(m.fx[id]); m.fx[id] = setTimeout(() => e.classList.remove('on'), ms); }
  function onPlace() {
    const m = M; if (!m || m.over || !m.started) return;
    const now = Date.now(), my = m.my; my.p++;
    my.combo = my.last && now - my.last < F.comboWin ? Math.min(F.comboMax, my.combo + 0.1) : 1; my.last = now;
    const crit = my.claws > 0 || Math.random() < Prog.B.luck(); if (my.claws > 0) my.claws--;
    const dmg = Math.round(150 / m.N * Prog.B.atk() * my.combo * (crit ? F.crit : 1) * 10) / 10;
    my.d += dmg; my.e = Math.min(100, my.e + F.enPer * Prog.B.en());
    pop($('fOpAv'), '−' + Math.round(dmg) + (crit ? '!' : ''), crit);
    if (my.e >= 100 && my.e - F.enPer * Prog.B.en() < 100) UI.hap('heavy');
    if (my.p >= m.N) my.done = now;
    hud(); check(); pushSoon();
  }
  function onMiss() { if (M) { M.my.combo = 1; M.my.last = 0; } }
  function onFinish() { check(); }
  function special() {
    const m = M; if (!m || m.over || !m.started || m.my.e < 100) return;
    const h = Prog.hero(), id = h.sp.id; m.my.e = 0; m.my.k.push(id);
    if (id === 'shield') m.my.h += F.shield;
    else if (id === 'rainbow') { m.my.h += F.heal; ['fxFog', 'fxFrz'].forEach(i => $(i).classList.remove('on')); if (Game.st) Game.st.frozen = false; }
    else if (id === 'fire') { m.my.d += F.fireDmg; pop($('fOpAv'), '−' + F.fireDmg, true); }
    else if (id === 'claws') m.my.claws = 3;
    if (m.bot) { const b = m.b, now = Date.now(); if (id === 'freeze') b.next = Math.max(b.next, now) + F.frzMs; else if (id === 'fog') b.next = Math.max(b.next, now) + F.fogMs * 0.6; else if (id === 'shuffle') b.next = Math.max(b.next, now) + 1800; }
    banner(h.sp.ic + ' ' + h.sp.n + '!'); Soundscape.play('skill'); UI.hap('heavy'); hud(); check(); pushSoon();
  }
  $('skBtn').onclick = special;
  function oppSkill(id) {
    if (id === 'shuffle') { Game.shuffleTray(); banner('🌀 Суперник перемішав твої деталі!'); }
    else if (id === 'fog') { fx('fxFog', F.fogMs); banner('🌫️ Туман від суперника!'); }
    else if (id === 'freeze') { Game.freeze(F.frzMs); fx('fxFrz', F.frzMs); banner('❄️ Тебе заморожено!'); }
    else if (id === 'fire') banner('🔥 Вогняний подих: −' + F.fireDmg);
    else if (id === 'shield') banner('🛡️ Суперник поставив щит +' + F.shield);
    else if (id === 'rainbow') banner('🌈 Суперник лікується +' + F.heal);
    else if (id === 'claws') banner('🐾 Суперник точить кігті!');
    UI.hap('warn');
  }
  /* bot */
  function botInit(o) {
    const base = Math.max(1.8, 5.2 - ((o.rt || 1000) - 1000) / 290);
    return { spp: base * (0.92 + Math.random() * 0.2), next: 0, combo: 1, last: 0, atk: 1 + Math.min(0.4, (o.l || 1) * 0.008), crit: 0.05, sp: heroO(o.h).sp.id, claws: 0 };
  }
  function botTick(now) {
    const m = M, b = m.b, o = m.op; if (o.p >= m.N) return;
    if (!b.next) b.next = now + b.spp * 1000 * (0.8 + Math.random() * 0.6);
    if (now < b.next) return;
    o.p++;
    b.combo = b.last && now - b.last < F.comboWin && Math.random() > 0.15 ? Math.min(F.comboMax, b.combo + 0.1) : 1; b.last = now;
    const crit = b.claws > 0 || Math.random() < b.crit; if (b.claws > 0) b.claws--;
    const dmg = 150 / m.N * b.atk * b.combo * (crit ? F.crit : 1);
    o.d += dmg; o.e = Math.min(100, o.e + F.enPer);
    pop($('fMeAv'), '−' + Math.round(dmg) + (crit ? '!' : ''), crit);
    if (o.p >= m.N) o.done = now;
    if (o.e >= 100) setTimeout(() => botSpecial(m), 700 + Math.random() * 1800);
    b.next = now + b.spp * 1000 * (0.55 + Math.random() * 0.9);
  }
  function botSpecial(m) {
    if (M !== m || m.over || m.op.e < 100) return;
    const id = m.b.sp, o = m.op; o.e = 0;
    if (id === 'shield') o.h += F.shield; else if (id === 'rainbow') o.h += F.heal; else if (id === 'claws') m.b.claws = 3;
    else if (id === 'fire') { o.d += F.fireDmg; pop($('fMeAv'), '−' + F.fireDmg, true); }
    oppSkill(id); hud(); check();
  }
  /* online sync */
  const stOut = m => ({ p: m.my.p, d: Math.round(m.my.d * 10) / 10, h: m.my.h, e: Math.round(m.my.e), k: m.my.k, f: m.my.done ? 1 : 0, x: m.my.x || 0 });
  function applyOpp(o) {
    const m = M; if (!m || !o) return;
    const pd = m.op.d;
    m.op.p = o.p || 0; m.op.d = o.d || 0; m.op.h = o.h || 0; m.op.e = o.e || 0; m.op.x = o.x || 0; m.op.done = o.f ? (m.op.done || Date.now()) : 0;
    if (m.op.d > pd + 0.05) pop($('fMeAv'), '−' + Math.round(m.op.d - pd), m.op.d - pd > 15);
    const ks = o.k || []; while (m.seenK < ks.length) oppSkill(ks[m.seenK++]);
  }
  function applyTeam(r) {
    const m=M, a=r.ally || {}, enemies=r.enemies || [{},{}], pd=m.op.d;
    m.ally={p:a.p||0,d:a.d||0,h:a.h||0,e:a.e||0,done:a.f?1:0,x:a.x||0};
    const o=m.op; o.p=0;o.d=0;o.h=0;o.e=0;o.x=0;let done=true;
    enemies.forEach((e,i)=>{o.p+=e.p||0;o.d+=e.d||0;o.h+=e.h||0;o.e+=(e.e||0)/2;o.x|=e.x||0;done=done&&!!e.f; const ks=e.k||[];while(m.seenKs[i]<ks.length)oppSkill(ks[m.seenKs[i]++]);});
    o.done=done?1:0;if(o.d>pd+0.05)pop($('fMeAv'),'−'+Math.round(o.d-pd),o.d-pd>15);
  }
  const mapRes = (m, r) => { const side=m.team ? m.side[0] : m.side; return { res: r.w === 'd' ? 'draw' : r.w === side ? 'win' : 'lose', why: r.why === 'left' && r.w !== side ? 'surrender' : r.why, rt: side === 'a' ? r.ra : r.rb, drt: side === 'a' ? r.da : r.db }; };
  async function pollLoop() {
    const m = M; if (!m || m.over || m.bot) return;
    clearTimeout(m.pt); m.inflight = true;
    try {
      const r = m.team ? await Team.api('act', { mid: m.mid, s: stOut(m) }, 5000) : await api('act', { mid: m.mid, side: m.side, s: stOut(m) }, 5000);
      m.inflight = false; m.lastOk = Date.now();
      if (M !== m || m.over) return;
      if (m.team) applyTeam(r); else applyOpp(r.o); hud();
      if (!r.r && m.endAt && !outcome(m)) { m.endAt = 0; if (Game.st) Game.st.frozen = false; }
      if (r.r) { const q = mapRes(m, r.r); return finish(q.res, q.why, q); }
      check();
    } catch (e) {
      m.inflight = false; if (M !== m || m.over) return;
      if (Date.now() - m.lastOk > 15000) { const o = outcome(m); return finish(m.team ? 'draw' : o ? o[0] : 'draw', 'net'); }
    }
    if (M === m && !m.over) m.pt = setTimeout(pollLoop, m.endAt ? 400 : 800);
  }
  function pushSoon() { const m = M; if (!m || m.bot || m.inflight || m.over || !m.started) return; clearTimeout(m.pt); m.pt = setTimeout(pollLoop, 40); }
  function outcome(m) {
    const me = hpMe(m), op = hpOp(m), t = (Date.now() - m.ts) / 1000;
    if (m.my.x) return ['lose', 'surrender'];
    if (m.op.x) return ['win', 'left'];
    if (op <= 0 || me <= 0) return [op <= 0 && me <= 0 ? (m.my.d >= m.op.d ? 'win' : 'lose') : op <= 0 ? 'win' : 'lose', 'ko'];
    if (m.team ? (m.my.done && m.ally.done) || m.op.done : m.my.done || m.op.done) return [m.team ? (m.my.done && m.ally.done ? 'win' : 'lose') : m.my.done && (!m.op.done || m.my.done <= m.op.done) ? 'win' : 'lose', 'done'];
    if (t >= F.time) return [me > op ? 'win' : me < op ? 'lose' : 'draw', 'time'];
    return null;
  }
  function check() {
    const m = M; if (!m || m.over || !m.started) return;
    const o = outcome(m); if (!o) return;
    if (m.bot) return finish(o[0], o[1]);
    if (!m.endAt) { m.endAt = Date.now(); Game.freeze(1e9); pushSoon(); }
    else if (!m.team && Date.now() - m.endAt > 7000) finish(o[0], o[1]);
  }
  async function finish(res, why, rr) {
    const m = M; if (!m || m.over) return; m.over = true; clearInterval(m.tmr); clearTimeout(m.pt);
    Game.freeze(1e9); hud();
    if (m.bot && !m.local && m.mid) { try { rr = await api('end', { mid: m.mid, res }, 6000); } catch (e) { rr = null; } }
    const me = hpMe(m), op = hpOp(m);
    const r = m.team && why === 'net' ? {coins:0,xp:0,ups:[]} : Prog.arenaEnd({ win: res === 'win', draw: res === 'draw', team:m.team, ranked: m.ranked, bot: m.bot, rt: rr && typeof rr.rt === 'number' ? rr.rt : undefined, pieces: m.my.p });
    for (const k in lbT) lbT[k] = 0;
    Soundscape.play(res === 'win' ? 'win' : 'lose'); UI.hap(res === 'win' ? 'ok' : 'err');
    banner(res === 'win' ? '🏆 Перемога!' : res === 'draw' ? '🤝 Нічия' : '💔 Поразка', 1300);
    await UI.sleep(1300);
    if (M !== m) return;
    result({ m, res, why, rr, r, me, op });
  }
  function result(c) {
    const m = c.m, win = c.res === 'win', rr = c.rr;
    const WHY = { ko: win ? 'Нокаут! 💥' : 'Тебе нокаутували 💥', done: m.team ? (win ? 'Твоя команда склала пазли 🧩' : 'Суперники склали пазли 🧩') : win ? 'Ти першим зібрав пазл 🧩' : 'Суперник першим зібрав пазл 🧩', time: 'Час вийшов — переміг той, у кого більше здоров’я ⏱️',
      left: 'Суперник покинув бій 🏃', surrender: 'Ти здався 🏳️', net: 'Зв’язок з сервером втрачено 📡' };
    let x = '<div class="wemo">' + (win ? '🏆' : c.res === 'draw' ? '🤝' : '💔') + '</div><div class="h1">' + (win ? 'Перемога!' : c.res === 'draw' ? 'Нічия' : 'Поразка') + '</div><div class="sub">' + (WHY[c.why] || '') + '</div>';
    x += '<div class="card"><div class="kv"><span>' + Prog.hero().e + ' Ти</span><b>❤️ ' + Math.ceil(c.me) + ' · 🧩 ' + m.my.p + '/' + m.N + ' · 💥 ' + Math.round(m.my.d) + '</b></div>' +
      '<div class="kv"><span>' + heroE(m.opp.h) + ' ' + UI.esc(oppName(m)) + '</span><b>❤️ ' + Math.ceil(c.op) + ' · 🧩 ' + m.op.p + '/' + (m.N * (m.team ? 2 : 1)) + '</b></div></div>';
    if (m.ranked && rr && typeof rr.drt === 'number') {
      const L0 = D.league(m.rt0), L1 = D.league(rr.rt);
      x += '<div class="rew"><span class="pill">🏆 ' + (rr.drt >= 0 ? '+' : '') + rr.drt + ' → ' + rr.rt + '</span></div>';
      if (L1.id !== L0.id) x += '<div class="lvup">' + (rr.rt > m.rt0 ? '🎉 Нова ліга: ' : '⬇️ Ліга: ') + L1.ic + ' <b>' + L1.n + '</b></div>';
    } else x += '<div class="mut small mb">' + (m.team ? 'Командний бій — рейтинг не змінюється' : m.local ? 'Офлайн-бій з ботом — без рейтингу' : m.ranked ? 'Рейтинг не оновився' : 'Звичайний бій — рейтинг не змінюється') + '</div>';
    x += '<div class="rew"><span class="pill"><span class="coin">🪙</span> +' + c.r.coins + '</span><span class="pill">✨ +' + c.r.xp + ' XP</span></div>';
    x += '<button class="btn btn-g" data-a="arFind">⚔️ Ще бій</button><button class="btn btn-s" data-go="arena">🏟️ До Арени</button>';
    $('wsW').innerHTML = x; UI.show('ws'); if (win) UI.confetti();
    if (c.r.ups.length) setTimeout(() => UI.levelUp(c.r.ups), 1300);
  }
  async function surrender() {
    const m = M; if (!m || m.over) return;
    m.my.x = 1; let rr = null;
    if (!m.bot && m.mid) { try { const r = m.team ? await Team.api('leave', {code:m.mid}, 5000) : await api('act', { mid: m.mid, side: m.side, s: stOut(m) }, 5000); if (r && r.r) rr = mapRes(m, r.r); } catch (e) {} }
    if (!m.started) { m.started = true; m.ts = Date.now(); }
    finish('lose', 'surrender', rr);
  }
  function cleanup() {
    const m = M; if (!m) return;
    clearInterval(m.tmr); clearTimeout(m.pt); Object.values(m.fx).forEach(clearTimeout);
    ['fxFog', 'fxFrz'].forEach(i => $(i).classList.remove('on')); document.querySelectorAll('#stage .banner, #gs .dmg').forEach(e => e.remove());
    if (!m.over && !m.bot && m.mid) { m.my.x = 1; (m.team ? Team.api('leave', {code:m.mid}) : api('act', { mid: m.mid, side: m.side, s: stOut(m) })).catch(() => {}); }
    M = null;
  }
  function loadFail() { const m = M; if (m && !m.bot && m.mid) (m.team ? Team.api('leave', {code:m.mid}) : api('leave', { mid: m.mid, side: m.side })).catch(() => {}); if (m) { clearInterval(m.tmr); clearTimeout(m.pt); } M = null; }
  const A = {
    arMode: v => { ranked = v === '1'; UI.hap('sel'); UI.refresh(); },
    arBoard: v => { board = v; UI.hap('sel'); UI.refresh(); },
    arFind: () => find(),
  };
  let snapTimer=0; Prog.on(() => { if (!TG || !TG.initData) return; clearTimeout(snapTimer); snapTimer=setTimeout(() => api('friendSnapshot',prof(),6000).catch(()=>{}),2500); });
  return { A, api, sync, start, ready, onPlace, onMiss, onFinish, surrender, cleanup, loadFail, find, get M() { return M; }, get online() { return online; } };
})();
