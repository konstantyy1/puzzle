/* UI: screens, modals, rewards, game controller */
'use strict';
const UI = (() => {
  const $ = id => document.getElementById(id);
  const D = DATA, S = () => Store.S;
  const BOT = 'fotopuzzle_bot';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => { n = Math.round(n || 0); return n >= 100000 ? Math.round(n / 1000) + 'k' : n >= 10000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n); };
  const tfmt = s => { s = Math.max(0, Math.ceil(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const pct = (a, b) => Math.max(0, Math.min(100, b ? a / b * 100 : 0)).toFixed(1);
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const uname = () => esc((Store.user && (Store.user.first_name || Store.user.username)) || 'Гравець');
  function hap(t) {
    const H = TG && TG.HapticFeedback; if (!H || !S().set.haptic || !TG.isVersionAtLeast || !TG.isVersionAtLeast('6.1')) return;
    try {
      if (t === 'ok') H.notificationOccurred('success'); else if (t === 'err') H.notificationOccurred('error'); else if (t === 'warn') H.notificationOccurred('warning');
      else if (t === 'sel') H.selectionChanged(); else H.impactOccurred(t || 'light');
    } catch (e) {}
  }
  let toastT = 0;
  function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 2300); }
  /* modal */
  let mOn = false, mClose = null;
  function modal(html, o) {
    o = o || {}; const m = $('modal'), b = $('mbox');
    if (mOn && mClose) { const f = mClose; mClose = null; f(); }
    b.innerHTML = html; b.scrollTop = 0; m.classList.add('on'); mOn = true; mClose = o.onClose || null;
    m.onclick = e => { if (e.target === m && !o.sticky) closeModal(); };
    b.querySelectorAll('[data-close]').forEach(x => { x.onclick = () => closeModal(); });
    backBtn(); return b;
  }
  function closeModal() { if (!mOn) return; $('modal').classList.remove('on'); mOn = false; const f = mClose; mClose = null; if (f) f(); backBtn(); }
  function ask(o) {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      const b = modal('<div class="mic">' + (o.ic || '❓') + '</div><h3>' + esc(o.t) + '</h3>' + (o.d ? '<p>' + o.d + '</p>' : '') +
        '<button class="btn ' + (o.danger ? 'btn-d' : 'btn-g') + '" id="mOk">' + esc(o.ok || 'Так') + '</button>' +
        (o.cancel === false ? '' : '<button class="btn btn-s" id="mNo">' + esc(o.cancel || 'Скасувати') + '</button>'), { onClose: () => fin(false), sticky: o.sticky });
      b.querySelector('#mOk').onclick = () => { fin(true); closeModal(); };
      const no = b.querySelector('#mNo'); if (no) no.onclick = () => closeModal();
    });
  }
  function confetti(n) {
    const w = $('cfw'), cols = ['#fbbf24', '#f472b6', '#60a5fa', '#4ade80', '#a78bfa', '#fb923c'];
    for (let i = 0; i < (n || 70); i++) {
      const c = document.createElement('i'); c.className = 'cf';
      c.style.left = (Math.random() * 100) + '%'; c.style.background = cols[i % cols.length];
      c.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; c.style.animationDelay = (Math.random() * 0.5) + 's';
      w.appendChild(c); setTimeout(() => c.remove(), 4200);
    }
  }
  /* reward feedback */
  function rewardToast(r, pre) {
    if (!r) return;
    Soundscape.play('reward');
    const c = typeof r === 'number' ? r : r.coins, x = r.xp && (r.xp.xp != null ? r.xp.xp : r.xp);
    toast((pre ? pre + ' ' : '') + (c ? '+' + c + ' 🪙' : '') + (x ? '  +' + x + ' XP' : ''));
    hap('ok'); const ups = r.xp && r.xp.ups; if (ups && ups.length) setTimeout(() => levelUp(ups), 900);
  }
  function levelUp(ups) {
    const L = ups[ups.length - 1], bonus = ups.reduce((a, l) => a + 40 + 10 * l, 0);
    const hs = D.HEROES.filter(h => ups.includes(h.lvl)), fr = D.FRAMES.filter(f => ups.includes(f.lvl)), th = D.THEMES.filter(t => ups.includes(t.lvl));
    const un = [...hs.map(h => h.e + ' ' + h.n), ...fr.map(f => '🖼️ рамка «' + f.n + '»'), ...th.map(t => '🎨 тема «' + t.n + '»')];
    confetti(50); hap('ok');
    modal('<div class="mic">🎊</div><h3>Рівень ' + L + '!</h3><p>' + Prog.title(L) + ' · бонус +' + bonus + ' 🪙</p>' +
      (un.length ? '<div class="card">' + un.map(u => '<div class="kv"><span>Відкрито</span><b>' + esc(u) + '</b></div>').join('') + '</div>' : '') +
      '<button class="btn btn-g" data-close>Чудово!</button>');
  }
  /* navigation */
  const TABS = ['home', 'levels', 'arena', 'hero', 'profile'];
  const R = {};
  let cur = '', backTo = 'home';
  function show(id, o) {
    o = o || {};
    if (cur === 'gs' && id !== 'gs') Ctl.leave();
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    cur = id; if (typeof Backgrounds !== 'undefined') Backgrounds.apply(); if (id !== 'gs') Soundscape.setScene('menu'); if (TABS.includes(id)) backTo = id;
    $('tabbar').classList.toggle('hide', !TABS.includes(id));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.t === id));
    if (R[id]) R[id]();
    if (!o.keep) $(id).scrollTop = 0;
    badges(); backBtn();
  }
  function refresh() { if (!R[cur] || cur === 'gs' || cur === 'ws') return badges(); const el = $(cur), sc = el.scrollTop; R[cur](); el.scrollTop = sc; badges(); }
  function backBtn() { const B = TG && TG.BackButton; if (!B || !TG.isVersionAtLeast || !TG.isVersionAtLeast('6.1')) return; try { (mOn || cur !== 'home') ? B.show() : B.hide(); } catch (e) {} }
  function back() {
    if (mOn) return closeModal();
    if (cur === 'gs') return Ctl.askQuit();
    if (cur === 'ws') return show(Ctl.backTo());
    if (cur === 'friendpage') return show('friends');
    if (cur !== 'home') return show('home');
  }
  function go(where) {
    if (where === 'ach') { show('profile'); const a = $('achS'); if (a) $('profile').scrollTop = a.offsetTop - 70; return; }
    if (where === 'bot') { try { TG && TG.openTelegramLink ? TG.openTelegramLink('https://t.me/' + BOT) : window.open('https://t.me/' + BOT); } catch (e) {} return; }
    show(where);
  }
  const heroBadge = () => D.SKILLS.some(k => Prog.sk(k.id) < D.SK_MAX && S().coins >= D.SK_COST[Prog.sk(k.id)]) ? 1 : 0;
  function badges() {
    const set = (t, n, txt) => { const b = $('bd-' + t); if (!b) return; b.textContent = txt || (n > 9 ? '9+' : n); b.classList.toggle('on', n > 0); };
    set('home', Prog.dailyBadge()); set('profile', Prog.achBadge());
    set('hero', heroBadge(), '!'); set('arena', 0); set('levels', 0);
    const th = $('tabHero'); if (th) th.textContent = Prog.hero().e;
  }
  function applyTheme() { D.THEMES.forEach(t => t.id && document.body.classList.remove('t-' + t.id)); const t = S().cos.theme; if (t) document.body.classList.add('t-' + t); }
  /* shared bits */
  function avatar(big) {
    const u = Store.user, fr = S().cos.frame, e = Prog.hero().e;
    const inner = (typeof Avatars !== 'undefined' && Avatars.self) ? Avatars.face(Avatars.self, '<span>' + e + '</span>') : (u && /^https:\/\//i.test(u.photo_url || '') ? '<img src="' + esc(u.photo_url) + '" alt="" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'\'"><span style="display:none">' + e + '</span>' : '<span>' + e + '</span>');
    return '<div class="av' + (big ? ' big' : '') + (fr ? ' fr-' + fr : '') + '">' + inner + '<span class="lv">' + Prog.level() + '</span></div>';
  }
  const coinsPill = () => '<span class="pill"><span class="coin">🪙</span><b>' + fmt(S().coins) + '</b></span>';
  const STAGES = ['Малюк', 'Учень', 'Боєць', 'Чемпіон', 'Легенда'];
  function heroFace(h, L, big) { const st = Prog.stage(L); return '<div class="hero-face' + (big ? ' big float' : '') + ' st' + st + '">' + h.e + (st >= 5 ? '<span style="position:absolute;top:-14px;font-size:' + (big ? 34 : 20) + 'px">👑</span>' : '') + '<span class="hlv">' + L + '</span></div>'; }
  const row = (ic, t, d, right, cls) => '<div class="row' + (cls ? ' ' + cls : '') + '"><div class="ric">' + ic + '</div><div class="rmid"><div class="rt">' + t + '</div>' + (d ? '<div class="rd">' + d + '</div>' : '') + '</div>' + (right || '') + '</div>';
  const stat = (v, l) => '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>';
  /* ---------- HOME ---------- */
  const tile = (go, ic, t, d, n) => '<button class="tile" data-go="' + go + '"><div class="tic">' + ic + '</div><b>' + t + '</b><span>' + d + '</span>' + (n ? '<span class="badge on">' + n + '</span>' : '') + '</button>';
  const KIND = { p: '📷 Фото', s: '✨ Стікер', v: '🎞️ Стікер', l: '🎞️ Стікер', g: '🎬 GIF' };
  function mediaItems(list, selD) {
    return list.map((m, i) => {
      const th = Media.thumbUrl(m), k = Media.kindOf(m);
      return '<button class="gi' + (selD === m.d ? ' on' : '') + '" data-a="media" data-v="' + i + '">' + (th ? '<img loading="lazy" src="' + esc(th) + '" alt="" onerror="this.remove()">' : '') +
        '<span class="kind">' + KIND[k] + '</span></button>';
    }).join('');
  }
  R.home = () => {
    Prog.ensureDaily();
    const L = Prog.lvlInfo(S().xp), h = Prog.hero(), hl = Prog.heroLvl(), lv = Prog.curLevel(), sv = Store.gsave.get(), a = S().arena, lg = D.league(a.rt);
    let x = '<header class="brand"><img src="assets/mark.svg" alt=""><div><b>Фото Пазл</b><span>Збирай свою історію</span></div><span class="brand-tag">MINI APP</span><span class="head-controls">' + [['music','🎵','Музика'],['sfx','🔊','Звук'],['hapt','📳','Вібрація']].map(([a,ic,label]) => { const on = S().set[a === 'hapt' ? 'haptic' : a]; return '<button class="head-control' + (on ? ' on' : '') + '" data-a="' + a + '" aria-pressed="' + !!on + '" aria-label="' + label + ': ' + (on ? 'увімкнено' : 'вимкнено') + '" title="' + label + '">' + ic + '<span>' + (on ? '✓' : '×') + '</span></button>'; }).join('') + '</span></header><div class="topbar">' + avatar() + '<div class="pinfo"><div class="pname">' + uname() + '</div><div class="ptitle">' + Prog.title(L.L) + ' · рівень ' + L.L + '</div>' +
      '<div class="bar"><i style="width:' + pct(L.cur, L.need) + '%"></i></div></div>' + coinsPill() + '</div>';
    x += '<div class="card hero-mini" data-go="hero">' + heroFace(h, hl.L) + '<div class="rmid"><div class="rt">' + h.n + '</div><div class="rd">Герой ' + hl.L + ' рівня · ' + h.sp.ic + ' ' + h.sp.n + '</div>' +
      '<div class="bar"><i style="width:' + (hl.max ? 100 : pct(hl.cur, hl.need)) + '%"></i></div></div><span class="mut" style="font-size:20px">›</span></div>';
    if (sv && sv.cfg) x += '<button class="cta s2" data-a="resume"><span class="ci">⏯️</span><div><b>Продовжити пазл</b><span>' + esc(sv.title || '') + ' · ' + sv.placed.length + '/' + (sv.cfg.g * sv.cfg.g) + ' деталей</span></div></button>';
    x += lv ? '<button class="cta" data-a="lvl" data-v="' + lv.id + '"><span class="ci">' + D.CH[lv.ch].ic + '</span><div><b>Рівень ' + lv.id + ' · ' + lv.g + '×' + lv.g + '</b><span>' + D.CH[lv.ch].n + (lv.timed ? ' · ⏱️ на час' : '') + ' · ⭐ ' + Prog.totalStars() + '/' + D.LEVELS.length * 3 + '</span></div></button>'
      : '<button class="cta" data-go="levels"><span class="ci">👑</span><div><b>Кампанію пройдено!</b><span>Збери всі ⭐ ' + Prog.totalStars() + '/' + D.LEVELS.length * 3 + '</span></div></button>';
    x += '<button class="cta s2" data-a="duel"><span class="ci">⚔️</span><div><b>Бій онлайн</b><span>' + lg.ic + ' ' + lg.n + ' · рейтинг ' + a.rt + '</span></div></button>';
    x += '<button class="friend-link" data-go="showcase"><span>🖼️ Публічна вітрина</span><span>›</span></button>';
    x += '<button class="friend-link" data-go="friends"><span>🤝 Друзі та виклики</span><span>›</span></button>';
    x += '<button class="case-entry" data-go="cases"><span class="case-entry-icon">🧰</span><span><b>Майстерня скарбів</b><small>Кейси, нагороди та колекція</small></span><span class="case-entry-arrow">›</span></button>';
    const st = S().streak;
    x += '<div class="tiles">' + tile('daily', '📋', 'Щоденні', '🔥 ' + st.n + ' ' + plural(st.n, 'день', 'дні', 'днів') + ' поспіль', Prog.dailyBadge()) +
      tile('free', '🖼️', 'Свій пазл', 'Фото, стікер або GIF') + tile('ach', '🏆', 'Досягнення', D.ACH.reduce((s, q) => s + (S().ach[q.id] || 0), 0) + '/' + D.ACH.length * 5 + ' рівнів', Prog.achBadge()) +
      tile('arena', '📊', 'Лідери', 'Анонімна таблиця') + '</div>';
    x += '<div class="card mediahint"><span class="mi">🎞️</span><div class="rmid"><div class="rt">Стікер або GIF → пазл</div><div class="rd">Надішли боту @' + BOT + ' стікер, GIF або фото — він пришле кнопку, і картинка стане пазлом. Анімовані стікери рухаються прямо в деталях!</div></div></div>';
    if (S().media.length) x += '<div class="sl">Останні з бота</div><div class="mlist">' + mediaItems(S().media.slice(0, 8)) + '</div>';
    $('homeW').innerHTML = x;
  };
  /* ---------- LEVELS ---------- */
  R.levels = () => {
    const ts = Prog.totalStars(), cl = Prog.curLevel();
    let x = '<div class="h1">Рівні</div><div class="sub">⭐ ' + ts + ' / ' + (D.LEVELS.length * 3) + ' · ⏱️ — рівень на час</div>';
    D.CH.forEach((c, ci) => {
      const un = Prog.chUnlocked(ci), lv = D.LEVELS.filter(l => l.ch === ci), st = lv.reduce((a, l) => a + (S().camp[l.id] || 0), 0);
      const g0 = lv[0].g, g1 = lv[9].g;
      x += '<div class="chap' + (un ? '' : ' lock') + '"><div class="chap-h"><span class="ci">' + c.ic + '</span><div><b>' + (ci + 1) + '. ' + c.n + '</b><span>Пазли ' + g0 + '×' + g0 + (g1 !== g0 ? ' – ' + g1 + '×' + g1 : '') + '</span></div><span class="r">⭐ ' + st + '/30</span></div>';
      if (!un) x += '<div class="chap-lock">🔒 ' + (ts < c.need ? 'Потрібно ⭐ ' + c.need + ' (зараз ' + ts + ')' : 'Пройди рівень ' + (ci * 10) + ', щоб відкрити розділ') + '</div>';
      x += '<div class="lvgrid">' + lv.map(l => {
        const s = S().camp[l.id] || 0, op = Prog.lvUnlocked(l);
        return '<button class="lvn' + (s ? ' done' : '') + (cl && cl.id === l.id ? ' cur' : '') + (op ? '' : ' lock') + '" data-a="lvl" data-v="' + l.id + '">' + (op ? l.id : '🔒') +
          '<span class="stx">' + (s ? '⭐'.repeat(s) : '') + '</span>' + (l.timed ? '<span class="tag">⏱️</span>' : '') + '</button>';
      }).join('') + '</div></div>';
    });
    $('levelsW').innerHTML = x;
  };
  function levelModal(id) {
    const L = D.LEVELS.find(l => l.id === +id); if (!L) return;
    if (!Prog.lvUnlocked(L)) { hap('warn'); return toast(Prog.chUnlocked(L.ch) ? '🔒 Спершу пройди рівень ' + (L.id - 1) : '🔒 Розділ ще закритий'); }
    const s = S().camp[L.id] || 0, lim = L.timed ? L.limit + Prog.B.time() : 0;
    const b = modal('<img src="' + D.img(L.pid, 400) + '" alt="" style="width:150px;height:150px;object-fit:cover;border-radius:18px;display:block;margin:0 auto 12px;box-shadow:0 8px 30px rgba(0,0,0,.5)">' +
      '<h3>Рівень ' + L.id + ' · ' + L.g + '×' + L.g + '</h3><p>' + D.CH[L.ch].ic + ' ' + D.CH[L.ch].n + (s ? ' · найкраще ' + '⭐'.repeat(s) : '') + '</p>' +
      '<div class="card">' + (lim ? '<div class="kv"><span>⏱️ Ліміт часу</span><b>' + tfmt(lim) + '</b></div>' : '') +
      '<div class="kv"><span>⭐⭐⭐</span><b>до ' + tfmt(L.par) + '</b></div><div class="kv"><span>⭐⭐</span><b>до ' + tfmt(L.par * 1.8) + '</b></div><div class="kv"><span>⭐</span><b>' + (lim ? 'до ' + tfmt(lim) : 'будь-який час') + '</b></div></div>' +
      '<button class="btn btn-g" id="mPlay">▶️ Грати</button><button class="btn btn-s" data-close>Закрити</button>');
    b.querySelector('#mPlay').onclick = () => { closeModal(); Ctl.play({ kind: 'camp', lvl: L.id, g: L.g, mode: L.timed ? 'timed' : 'classic', src: { t: 'pic', pid: L.pid } }); };
  }
  /* ---------- DAILY ---------- */
  R.daily = () => {
    Prog.ensureDaily(); const d = S().daily, st = S().streak, di = Math.max(0, (st.n - 1) % 7), sr = Prog.streakReady();
    let x = '<div class="h1">Щоденні завдання</div><div class="sub">Нові завдання щодня опівночі</div>';
    if (Prog.dailyBadge()) x += '<button class="btn btn-g claim-all" data-a="dailyAll">🎁 Забрати все доступне</button>';
    x += '<div class="card"><div class="h2">🔥 Серія входів <span class="r">' + st.n + ' ' + plural(st.n, 'день', 'дні', 'днів') + ' · рекорд ' + st.best + '</span></div><div class="week">' +
      D.STREAK.map((c, i) => '<div class="wd' + (i < di || (i === di && !sr) ? ' done' : i === di ? ' cur' : '') + '">День ' + (i + 1) + '<b>' + c + '</b></div>').join('') + '</div>' +
      (sr ? '<button class="btn btn-g mt" data-a="streak">Забрати ' + D.STREAK[di] + ' 🪙</button>' : '<div class="mut small tc mt">✓ Нагороду за сьогодні отримано. Заходь завтра!</div>') + '</div>';
    x += S().prof.gift ? row('🎁', 'Щоденний подарунок', S().prof.gift * 20 + ' 🪙 щодня', Prog.giftReady() ? '<button class="sbtn" data-a="gift">Забрати</button>' : '<span class="sbtn done">✓</span>')
      : row('🎁', 'Щоденний подарунок', 'Відкривається в профілі → прокачка профілю', '<button class="sbtn s2" data-go="profile">Відкрити</button>');
    x += '<div class="sl">Завдання на сьогодні</div>';
    x += d.tasks.map((t, i) => {
      const tp = Prog.taskTpl(t), ok = t.p >= t.k;
      return row(tp.ic, Prog.taskName(t), '+' + tp.c + ' 🪙 · +' + tp.x + ' XP<div class="bar"><i style="width:' + pct(t.p, t.k) + '%"></i></div>',
        t.cl ? '<span class="sbtn done">✓</span>' : ok ? '<button class="sbtn" data-a="task" data-v="' + i + '">Забрати</button>' : '<span class="mut small">' + t.p + '/' + t.k + '</span>', ok && !t.cl ? 'hl' : '');
    }).join('');
    const nd = d.tasks.filter(t => t.cl).length;
    x += '<div class="card tc mt"><div style="font-size:46px">' + (d.chest ? '📭' : '🎁') + '</div><div class="rt">Скриня дня</div><div class="rd">Забери нагороди за всі завдання: 150 🪙 + 2 💡 + 60 XP</div>' +
      (Prog.chestReady() ? '<button class="btn btn-g mt" data-a="chest">Відкрити скриню</button>' : d.chest ? '<div class="ok mt">✓ Відкрито</div>' : '<div class="bar mt"><i style="width:' + pct(nd, d.tasks.length) + '%"></i></div><div class="mut small mt">' + nd + '/' + d.tasks.length + '</div>') + '</div>';
    $('dailyW').innerHTML = x;
  };
  /* ---------- HERO ---------- */
  R.hero = () => {
    const h = Prog.hero(), hl = Prog.heroLvl(), sg = Prog.stage(hl.L), B = Prog.B;
    const nextSt = [3, 8, 15, 25].find(l => l > hl.L);
    let x = '<div class="card tc" style="padding-top:22px">' + heroFace(h, hl.L, true) + '<div class="h1" style="margin-top:18px">' + h.n + '</div>' +
      '<div class="sub" style="margin-bottom:8px">Стадія ' + sg + '/5 · ' + STAGES[sg - 1] + (nextSt ? ' · наступна з ' + nextSt + ' рівня' : '') + '</div>' +
      '<div class="bar big"><i style="width:' + (hl.max ? 100 : pct(hl.cur, hl.need)) + '%"></i></div><div class="xpl"><span>Рівень героя ' + hl.L + '</span><span>' + (hl.max ? 'MAX' : hl.cur + '/' + hl.need + ' XP') + '</span></div>' +
      '<div class="grid2 mt"><div class="stat"><b>' + h.sp.ic + '</b><span>' + h.sp.n + ': ' + h.sp.d + '</span></div><div class="stat"><b>✨</b><span>' + h.pas + '</span></div></div></div>';
    x += '<div class="card"><div class="h2">⚔️ Сила на Арені</div><div class="grid3">' + stat(B.hp(), 'Здоров’я') + stat('×' + B.atk().toFixed(2), 'Шкода') + stat(Math.round(B.luck() * 100) + '%', 'Крит / удача') + '</div>' +
      '<div class="mut small tc mt">Досвід з ігор прокачує і профіль, і обраного героя</div></div>';
    x += '<div class="sl">Прокачка навичок · ' + coinsPill() + '</div>';
    x += D.SKILLS.map(k => {
      const l = Prog.sk(k.id), mx = l >= D.SK_MAX, c = D.SK_COST[l];
      return row(k.ic, k.n + ' <span class="mut small">' + l + '/' + D.SK_MAX + '</span>', (mx ? k.d(l) : (l ? 'Далі: ' : '') + k.d(l + 1)) +
        '<div class="skl">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= l ? 'on' : '') + '"></i>').join('') + '</div>',
        mx ? '<span class="sbtn done">MAX</span>' : '<button class="sbtn' + (S().coins >= c ? '' : ' s2') + '" data-a="sk" data-v="' + k.id + '">' + c + ' 🪙</button>');
    }).join('');
    x += '<div class="sl">Герої</div><div class="heroes">' + D.HEROES.map(q => {
      const own = S().hero.owned.includes(q.id), on = S().hero.id === q.id, ok = Prog.level() >= q.lvl;
      return '<button class="hc' + (on ? ' on' : '') + (own ? '' : ' lock') + '" data-a="hero" data-v="' + q.id + '"><div class="he">' + q.e + '</div><b>' + q.n.split(' ')[0] + '</b><span>' +
        (on ? '✓ Обраний' : own ? 'Рів. ' + Prog.heroLvl(q.id).L : !ok ? '🔒 з ' + q.lvl + ' рів.' : q.cost + ' 🪙') + '</span></button>';
    }).join('') + '</div>';
    $('heroW').innerHTML = x;
  };
  function heroModal(id) {
    const h = D.HEROES.find(q => q.id === id); if (!h) return;
    const own = S().hero.owned.includes(id), on = S().hero.id === id, hl = Prog.heroLvl(id);
    const b = modal(heroFace(h, hl.L, true) + '<h3 style="margin-top:16px">' + h.n + '</h3><p>' + (own ? 'Рівень героя ' + hl.L : 'Відкривається з ' + h.lvl + ' рівня профілю') + '</p>' +
      '<div class="card"><div class="kv"><span>✨ Пасивка</span><b>' + h.pas + '</b></div><div class="kv"><span>' + h.sp.ic + ' ' + h.sp.n + '</span><b>' + h.sp.d + '</b></div></div>' +
      (on ? '<button class="btn btn-s" data-close>Вже обраний</button>' : own ? '<button class="btn btn-g" id="mH">Обрати героя</button>' :
        '<button class="btn btn-g" id="mH"' + (Prog.level() < h.lvl ? ' disabled' : '') + '>Відкрити за ' + h.cost + ' 🪙</button>') + '<button class="btn btn-s" data-close>Закрити</button>');
    const bt = b.querySelector('#mH'); if (!bt) return;
    bt.onclick = () => {
      if (own) { Prog.setHero(id); closeModal(); hap('ok'); toast(h.e + ' ' + h.n + ' обраний!'); return; }
      const r = Prog.buyHero(id);
      if (r === 'ok') { closeModal(); confetti(40); hap('ok'); toast('🎉 Новий герой: ' + h.n); } else { hap('err'); toast(r === 'lvl' ? '🔒 Потрібен ' + h.lvl + ' рівень' : 'Не вистачає монет 🪙'); }
    };
  }
  /* ---------- PROFILE ---------- */
  R.profile = () => {
    const L = Prog.lvlInfo(S().xp), st = S().stats, a = S().arena;
    let x = '<div class="card profile-hero"><div class="ph"><button class="avatar-edit" data-a="avatarMenu" aria-label="Змінити аватарку або рамку">' + avatar(true) + '<span class="avatar-edit-badge">📷</span></button><div class="pinfo"><div class="pname">' + uname() + '</div><div class="ptitle">' + Prog.title(L.L) + '</div>' +
      '<div class="bar big"><i style="width:' + pct(L.cur, L.need) + '%"></i></div><div class="xpl"><span>Рівень ' + L.L + '</span><span>' + L.cur + '/' + L.need + ' XP</span></div></div></div></div>';
    x += '<div class="profile-insights"><div class="profile-insights-head"><div><span>ТВОЯ ІСТОРІЯ</span><h3>Ігровий шлях</h3></div><b>⭐ '+fmt(Prog.totalStars())+' зірок</b></div><div class="profile-key-stats"><div><strong>'+fmt(st.wins)+'</strong><span>складено пазлів</span></div><div><strong>'+fmt(st.pieces)+'</strong><span>деталей на місці</span></div></div><div class="profile-stat-lines"><div><span>🎯 Без помилок</span><b>'+fmt(st.perfect)+'</b></div><div><span>🔥 Найкраща серія</span><b>'+fmt(S().streak.best)+' '+plural(S().streak.best,'день','дні','днів')+'</b></div><div><span>⚔️ Перемоги у боях</span><b>'+fmt(st.duels)+'</b></div><div><span>🏅 Рейтинг</span><b>'+fmt(a.rt)+'</b></div><div><span>🪙 Зароблено монет</span><b>'+fmt(st.coinsEarned)+'</b></div><div><span>⏱ Час у грі</span><b>'+fmt(Math.round(st.time/60))+' хв</b></div></div></div>';
    x += '<div class="sl">Вітрина</div><div class="card"><div class="rd">Публічний перегляд тимчасово призупинений. Збережені роботи залишаються у твоїй вітрині.</div><button class="btn btn-s mt" data-a="showMineOpen">🖼️ Моя вітрина</button></div>';
    x += '<div class="sl">Прокачка профілю · ' + coinsPill() + '</div>';
    x += D.PROF.map(p => {
      const l = S().prof[p.id], mx = l >= p.max, c = p.cost[l];
      return row(p.ic, p.n + ' <span class="mut small">' + l + '/' + p.max + '</span>', (mx ? p.d(l) : (l ? 'Далі: ' : '') + p.d(l + 1)) +
        '<div class="skl">' + Array.from({ length: p.max }, (_, i) => '<i class="' + (i < l ? 'on' : '') + '"></i>').join('') + '</div>',
        mx ? '<span class="sbtn done">MAX</span>' : '<button class="sbtn' + (S().coins >= c ? '' : ' s2') + '" data-a="prof" data-v="' + p.id + '">' + c + ' 🪙</button>');
    }).join('');
    const tot = D.ACH.reduce((s, q) => s + (S().ach[q.id] || 0), 0);
    x += '<div class="sl" id="achS">Досягнення · ' + tot + '/' + D.ACH.length * 5 + '</div>';
    if (Prog.achBadge()) x += '<button class="btn btn-g claim-all" data-a="achAll">🏆 Забрати всі досягнення</button>';
    x += D.ACH.map(q => {
      const s = Prog.achState(q), t = Math.min(s.cl, 4);
      return row(q.ic + (s.cl ? '<span class="tier">' + D.TIER_IC[s.cl - 1] + '</span>' : ''), q.n + ' · <span class="mut small">' + (s.done ? 'MAX' : D.TIER_IC[t] + ' ' + D.TIERS[t]) + '</span>',
        q.d + ': ' + fmt(s.v) + (s.done ? '' : ' / ' + fmt(s.next)) + '<div class="bar"><i style="width:' + (s.pct * 100).toFixed(1) + '%"></i></div>',
        s.can ? '<button class="sbtn" data-a="ach" data-v="' + q.id + '">+' + D.TIER_COINS[s.cl] + ' 🪙</button>' : s.done ? '<span class="sbtn done">✓</span>' : '<span class="mut small">+' + D.TIER_COINS[t] + '🪙</span>', s.can ? 'hl' : '');
    }).join('');
    const c = S().cos, lv = Prog.level();
    x += '<div class="sl" id="framesS">Рамка аватара</div><div class="chips frames-list">' + D.FRAMES.map(f => {
      const own = c.frames.includes(f.id);
      return '<button class="chip' + (c.frame === f.id ? ' on' : '') + (own || (!f.caseOnly && lv >= f.lvl) ? '' : ' lock') + '" data-a="frame" data-v="' + f.id + '" style="position:relative">' + f.n +
        (own ? '' : '<span class="lk">' + (f.caseOnly ? '🎁 кейс' : lv < f.lvl ? '🔒' + f.lvl : '🪙' + f.cost) + '</span>') + '</button>';
    }).join('') + '</div>';
    x += '<div class="sl">Тема</div><div class="themes">' + D.THEMES.map(t => {
      const own = c.themes.includes(t.id);
      return '<button class="th' + (c.theme === t.id ? ' on' : '') + '" data-a="theme" data-v="' + t.id + '" style="background:' + t.c + '">' + t.n +
        (own ? '' : '<span class="lk">' + (t.caseOnly ? '🎁 кейс' : lv < t.lvl ? '🔒' + t.lvl : '🪙' + t.cost) + '</span>') + '</button>';
    }).join('') + '</div>';
    x += '<div class="sl">Налаштування</div><div class="mut small">Звук, музика та вібрація — у верхній частині головної сторінки.</div><div class="mut small tc mt">Прогрес зберігається в Telegram і синхронізується між пристроями</div>';
    $('profileW').innerHTML = x;
  };
  /* ---------- FREE PLAY ---------- */
  let fsel = { t: 'pic', pid: D.GALLERY[0] }, fg = 4, fmode = 'classic';
  R.free = () => {
    const ft = fsel.t === 'file';
    let x = '<div class="h1">Свій пазл</div><div class="sub">Обери картинку, розмір і режим</div>';
    x += '<button class="upl' + (ft ? ' on' : '') + '" data-a="upload" style="width:100%;text-align:left"><div class="uth"' + (ft && fsel.url ? ' style="background-image:url(' + fsel.url + ')"' : '') + '>' + (ft ? '' : '📷') + '</div><div><b>' + (ft ? 'Твоє фото обрано ✓' : 'Своє фото') + '</b><span>' + (ft ? 'Натисни, щоб вибрати інше' : 'З галереї телефону або камери') + '</span></div></button>';
    x += '<div class="sl">Стікери, GIF і фото з бота</div>';
    x += S().media.length ? '<div class="mlist">' + mediaItems(S().media, fsel.t === 'bot' ? fsel.m.d : '') + '</div>'
      : '<div class="card mediahint"><span class="mi">🎞️</span><div class="rmid"><div class="rt">Тут будуть твої стікери</div><div class="rd">Надішли боту стікер, GIF або фото — він пришле кнопку «Зібрати пазл».</div></div><button class="sbtn s2" data-go="bot">Чат</button></div>';
    x += '<div class="sl">Галерея</div><div class="gal">' + D.GALLERY.map(pid => '<button class="gi' + (fsel.t === 'pic' && fsel.pid === pid ? ' on' : '') + '" data-a="pic" data-v="' + pid + '"><img loading="lazy" src="' + D.img(pid, 200) + '" alt=""></button>').join('') + '</div>';
    x += '<div class="sl">Розмір</div><div class="chips">' + [3, 4, 5, 6, 7, 8].map(g => '<button class="chip' + (g === fg ? ' on' : '') + '" data-a="fg" data-v="' + g + '">' + g + '×' + g + '</button>').join('') + '</div>';
    x += '<div class="sl">Режим</div><div class="modes">' + Object.entries(D.MODES).map(([k, m]) => '<button class="mode' + (k === fmode ? ' on' : '') + '" data-a="fmode" data-v="' + k + '"><span class="mi">' + m.ic + '</span><b>' + m.n + '</b><span>' + m.d + (m.limit && Prog.B.time() ? ' +' + Prog.B.time() + ' с' : '') + '</span></button>').join('') + '</div>';
    const rec = S().rec[fg + '_' + fmode];
    x += '<button class="btn btn-g mt" data-a="fplay">▶️ Грати' + (rec ? ' · рекорд ' + tfmt(rec) : '') + '</button>';
    $('freeW').innerHTML = x;
  };
  function addMedia(m) {
    if (!m || !m.d || !m.s) return null;
    const it = { d: m.d, s: m.s, t: Date.now() };
    S().media = [it, ...S().media.filter(q => q.d !== m.d)].slice(0, 16); Store.save(); return it;
  }
  function openMedia(m) {
    const it = addMedia(m); if (!it) return;
    const g = Math.max(3, Math.min(8, +m.g || 4));
    Ctl.play({ kind: 'free', g, mode: 'classic', src: { t: 'bot', m: { d: it.d, s: it.s } } });
  }
  $('fileIn').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const src = await Media.fromFile(f), c = document.createElement('canvas'), k = 124 / Math.min(src.w, src.h);
      c.width = Math.round(src.w * k); c.height = Math.round(src.h * k); c.getContext('2d').drawImage(src.el, 0, 0, c.width, c.height);
      fsel = { t: 'file', src, url: c.toDataURL('image/jpeg', 0.7) }; hap('ok'); if (cur === 'free') refresh(); else show('free');
    } catch (er) { toast('Не вдалося відкрити фото 😕'); }
  });
  /* ---------- actions ---------- */
  const res = (r, okMsg) => {
    if (r === 'ok') { hap('ok'); if (okMsg) toast(okMsg); return true; }
    hap('err'); toast(r === 'coins' ? 'Не вистачає монет 🪙' : r === 'max' ? 'Вже максимум' : r === 'lvl' ? '🔒 Потрібен вищий рівень' : 'Недоступно'); return false;
  };
  async function buyCos(kind, id) {
    const list = kind === 'frame' ? D.FRAMES : D.THEMES, it = list.find(q => q.id === id), own = S().cos[kind + 's'].includes(id);
    if (!own) {
      if (it.caseOnly) return toast('Знайди це оформлення в кейсах 🎁');
      if (Prog.level() < it.lvl) { hap('warn'); return toast('🔒 Відкриється на ' + it.lvl + ' рівні'); }
      if (it.cost && !(await ask({ ic: kind === 'frame' ? '🖼️' : '🎨', t: (kind === 'frame' ? 'Рамка' : 'Тема') + ' «' + it.n + '»', d: 'Купити за ' + it.cost + ' 🪙?', ok: 'Купити' }))) return;
    }
    if (res(Prog.buyCos(kind, id), own ? '' : '🎉 Відкрито!') && kind === 'theme') applyTheme();
  }
  const A = {
    lvl: v => levelModal(v),
    resume: () => Ctl.resume(),
    duel: () => show('arena'),
    dailyAll: () => { const r=Prog.claimAllDaily(); if(r){ confetti(40); rewardToast(r, r.hints ? '🎁 +2 💡' : '🎁'); } },
    achAll: () => { const r=Prog.claimAllAchievements(); if(r){ confetti(40); rewardToast(r, '🏆'); } },
    streak: () => rewardToast(Prog.claimStreak(), '🔥'),
    gift: () => rewardToast(Prog.claimGift(), '🎁'),
    task: v => rewardToast(Prog.claimTask(+v), '📋'),
    chest: () => { const r = Prog.claimChest(); if (r) { confetti(60); rewardToast(r, '🎁 +2 💡'); } },
    sk: v => res(Prog.buySkill(v), '⬆️ Навичку покращено!'),
    prof: v => res(Prog.buyProf(v), '⬆️ Профіль покращено!'),
    ach: v => { const r = Prog.claimAch(v); if (r) { confetti(30); rewardToast(r, D.TIER_IC[r.tier]); } },
    hero: v => heroModal(v),
    frame: v => buyCos('frame', v),
    theme: v => buyCos('theme', v),
    music: () => { S().set.music = S().set.music ? 0 : 1; Store.save(); Soundscape.unlock(); Soundscape.update(); refresh(); },
    sfx: () => { S().set.sfx = S().set.sfx ? 0 : 1; Store.save(); Soundscape.unlock(); Soundscape.play('tap'); refresh(); },
    hapt: () => { S().set.haptic = S().set.haptic ? 0 : 1; Store.save(); hap('ok'); refresh(); },
    reset: async () => { if (await ask({ ic: '⚠️', t: 'Скинути прогрес?', d: 'Рівні, монети, герої й досягнення буде видалено назавжди. Публічні роботи залишаться у вітрині: прибери їх окремо перед скиданням.', ok: 'Скинути', danger: 1 })) { Store.reset(); Prog.ensureDaily(); applyTheme(); show('home'); toast('Прогрес скинуто'); } },
    upload: () => $('fileIn').click(),
    pic: v => { fsel = { t: 'pic', pid: +v }; hap('sel'); refresh(); },
    media: v => { const m = S().media[+v]; if (!m) return; if (cur === 'home') return Ctl.play({ kind: 'free', g: 4, mode: 'classic', src: { t: 'bot', m: { d: m.d, s: m.s } } }); fsel = { t: 'bot', m: { d: m.d, s: m.s } }; hap('sel'); refresh(); },
    fg: v => { fg = +v; hap('sel'); refresh(); },
    fmode: v => { fmode = v; hap('sel'); refresh(); },
    fplay: () => Ctl.play({ kind: 'free', g: fg, mode: fmode, src: fsel }),
  };
  document.addEventListener('click', e => {
    if (e.target.closest('button,[data-go]')) Soundscape.play('tap');
    const g = e.target.closest('[data-go]'); if (g) { hap('sel'); if (g.closest('#mbox')) closeModal(); return go(g.dataset.go); }
    const a = e.target.closest('[data-a]'); if (!a) return;
    const f = A[a.dataset.a] || (Arena.A && Arena.A[a.dataset.a]); if (f) f(a.dataset.v, a, e);
  });
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { hap('sel'); show(t.dataset.t); }));
  /* ---------- GAME CONTROLLER ---------- */
  const Ctl = (() => {
    let C = null, tmr = 0, tok = 0, cache = null, last = null;
    const el = () => C ? C.acc + (C.run ? (Date.now() - C.run) / 1000 : 0) : 0;
    const srcKey = s => s.t === 'pic' ? 'p' + s.pid : s.t === 'bot' ? 'b' + s.m.d : 'f';
    const srcKind = s => s.t === 'file' ? 'own' : s.t === 'bot' ? (Media.kindOf(s.m) === 'p' ? 'own' : 'anim') : '';
    async function loadSrc(s) {
      if (s.t === 'file') return s.src;
      const key = srcKey(s); if (cache && cache.key === key) return cache.src;
      const src = s.t === 'pic' ? await Media.fromUrl(D.img(s.pid, 1000)) : await Media.fromBot(s.m);
      if (cache) { try { cache.src.destroy(); } catch (e) {} }
      cache = { key, src }; return src;
    }
    const title = c => c.kind === 'camp' ? 'Рівень ' + c.lvl : c.kind === 'fight' ? (c.team ? '🤝 Бій 2×2' : c.ranked ? '🏆 Рейтинг' : '⚔️ Бій') : (D.MODES[c.mode] || D.MODES.classic).n + ' ' + c.g + '×' + c.g;
    function limitOf(c) {
      if (c.kind === 'camp') { const L = D.LEVELS.find(l => l.id === c.lvl); return L && L.timed ? L.limit + Prog.B.time() : 0; }
      if (c.kind === 'free') { const m = D.MODES[c.mode]; return m && m.limit ? m.limit + Prog.B.time() : 0; }
      return 0;
    }
    async function countdown(n) {
      const cv = $('cov'), sp = cv.querySelector('span'); cv.classList.add('on');
      const pop = t => { sp.textContent = t; sp.style.animation = 'none'; void sp.offsetWidth; sp.style.animation = ''; };
      sp.style.fontSize = '';
      for (let i = n; i > 0; i--) { pop(i); Soundscape.play('countdown'); hap('light'); await sleep(750); }
      sp.style.fontSize = '54px'; pop('Старт!'); Soundscape.play('start'); hap('heavy'); await sleep(450); cv.classList.remove('on'); sp.style.fontSize = '';
    }
    async function play(cfg) {
      const my = ++tok; end(); last = cfg;
      show('gs');
      const fight = cfg.kind === 'fight'; Soundscape.setScene(fight ? 'fight' : 'game');
      $('fhud').classList.toggle('on', fight); $('gTime').classList.toggle('hidden', fight);
      ['gHint', 'gGhost'].forEach(id => $(id).classList.toggle('hidden', fight));
      $('skBtn').classList.toggle('hidden', !fight); $('fxFog').classList.remove('on'); $('fxFrz').classList.remove('on');
      $('gBack').textContent = fight ? '🏳️' : '⏸️'; $('gLvl').textContent = title(cfg); $('gTime').textContent = '0:00'; $('gTime').classList.remove('warn');
      $('gBar').style.width = '0%'; $('gPct').textContent = '';
      $('gload').classList.add('on'); $('gloadMsg').textContent = cfg.src.t === 'bot' ? 'Завантажую з Telegram…' : 'Завантаження…';
      let src;
      try { src = await loadSrc(cfg.src); } catch (e) {
        if (my !== tok) return; $('gload').classList.remove('on'); toast('Не вдалося завантажити картинку 😕');
        if (fight) Arena.loadFail(); show(cfg.kind === 'camp' ? 'levels' : fight ? 'arena' : 'free'); return;
      }
      if (my !== tok || cur !== 'gs') return;
      $('gload').classList.remove('on');
      const rs = cfg.restore;
      C = { cfg, src, acc: rs ? rs.el || 0 : 0, run: 0, limit: limitOf(cfg), hf: fight ? 0 : Prog.B.hints(), used: rs ? rs.used || 0 : 0, hintUsed: !!(rs && rs.hu), user: 0, over: false, started: false,
        seed: cfg.seed || (rs && rs.seed) || ((Math.random() * 2147483647) | 0), back: cfg.kind === 'camp' ? 'levels' : fight ? 'arena' : 'free' };
      Game.start({ src, g: cfg.g, seed: C.seed, ghost: cfg.mode === 'zen', magnet: Prog.B.magnet(), corners: fight ? 0 : Prog.B.corners(), restore: rs && rs.placed, onPlace, onMiss, onWin, haptic: hap });
      if (rs && Game.st) Game.st.miss = rs.miss || 0;
      $('gGhost').classList.toggle('off', cfg.mode !== 'zen');
      hud();
      if (fight) return Arena.ready(C);
      if (C.limit && !rs) { Game.pause(true); await countdown(3); if (my !== tok || !C) return; Game.pause(false); }
      C.started = true; C.run = Date.now(); clearInterval(tmr); tmr = setInterval(tick, 250); tick();
    }
    function tick() {
      if (!C || C.over || !C.started) return;
      const t = el();
      if (C.limit) { const left = C.limit - t; $('gTime').textContent = '⏱️ ' + tfmt(left); $('gTime').classList.toggle('warn', left <= 15); if (left <= 0) lose(); }
      else $('gTime').textContent = tfmt(t);
    }
    function pauseT(v) {
      if (!C || C.over || !C.started || C.cfg.kind === 'fight') return;
      if (v) { if (C.run) { C.acc += (Date.now() - C.run) / 1000; C.run = 0; } Game.pause(true); }
      else { if (!C.run) C.run = Date.now(); Game.pause(false); }
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseT(true); save(); } else if (C && !mOn) pauseT(false); });
    const hintsLeft = () => C ? Math.max(0, C.hf - C.used) + S().inv.hint : 0;
    function hud() {
      const s = Game.st; if (!s) return; const n = s.placed.length, N = s.P.length;
      $('gBar').style.width = pct(n, N) + '%'; $('gPct').textContent = n + '/' + N;
      const h = hintsLeft(); $('gHintN').textContent = h > 99 ? '99+' : h; $('gHint').classList.toggle('off', !h);
    }
    function onPlace(i) { if (!C) return; if (!i.hint) C.user++; Soundscape.play(i.hint ? 'hint' : 'place'); hap(i.hint ? 'light' : 'medium'); hud(); save(); if (C.cfg.kind === 'fight') Arena.onPlace(i); }
    function onMiss() { if (!C) return; Soundscape.play('miss'); hap('warn'); if (C.cfg.kind === 'fight') Arena.onMiss(); }
    function save() {
      if (!C || C.over || C.cfg.kind === 'fight' || C.cfg.src.t === 'file' || !Game.st) return;
      const s = Game.st; if (s.placed.length >= s.P.length) return;
      const cf = Object.assign({}, C.cfg); delete cf.restore; delete cf.seed;
      Store.gsave.set({ cfg: cf, seed: C.seed, placed: s.placed.slice(), miss: s.miss, el: el(), used: C.used, hu: C.hintUsed, title: title(C.cfg), ts: Date.now() });
    }
    function resume() { const sv = Store.gsave.get(); if (!sv || !sv.cfg) return; play(Object.assign({}, sv.cfg, { seed: sv.seed, restore: sv })); }
    async function useHint() {
      if (!C || C.over || !C.started || C.cfg.kind === 'fight') return;
      if (!hintsLeft()) {
        pauseT(true);
        const ok = await ask({ ic: '💡', t: 'Підказки закінчились', d: '3 підказки за 60 🪙 (у тебе ' + fmt(S().coins) + ' 🪙)', ok: 'Купити', cancel: 'Не треба' });
        if (ok) { if (Prog.buyHints()) toast('💡 +3 підказки'); else toast('Не вистачає монет 🪙'); }
        pauseT(false); hud(); return;
      }
      if (!Game.hint()) return;
      if (C.used < C.hf) C.used++; else { S().inv.hint = Math.max(0, S().inv.hint - 1); Store.save(); }
      C.hintUsed = true; hud(); save();
    }
    function onWin() {
      if (!C || C.over) return;
      if (C.cfg.kind === 'fight') return Arena.onFinish();
      C.over = true; clearInterval(tmr); const t = el(); Store.gsave.set(null);
      const cfg = C.cfg, s = Game.st, perfect = s.miss === 0 && !C.hintUsed;
      let stars = 0;
      if (cfg.kind === 'camp') { const L = D.LEVELS.find(l => l.id === cfg.lvl); stars = t <= L.par ? 3 : t <= L.par * 1.8 ? 2 : 1; }
      const k = srcKind(cfg.src);
      const r = Prog.gameEnd({ kind: cfg.kind, lvl: cfg.lvl, g: cfg.g, mode: cfg.mode, time: t, pieces: C.user, win: true, stars, perfect, timed: !!C.limit, own: k === 'own', anim: k === 'anim' });
      Soundscape.play('win'); hap('ok'); confetti(); result({ win: true, t, stars, perfect, r });
    }
    function lose() {
      if (!C || C.over) return; C.over = true; clearInterval(tmr); Store.gsave.set(null); Game.freeze(1e9);
      const cfg = C.cfg, r = Prog.gameEnd({ kind: cfg.kind, lvl: cfg.lvl, g: cfg.g, mode: cfg.mode, time: el(), pieces: C.user, win: false });
      Soundscape.play('lose'); hap('err'); $('gTime').textContent = '⏱️ 0:00';
      setTimeout(() => { if (C && C.cfg === cfg) result({ win: false, r }); }, 700);
    }
    function result(o) {
      const cfg = C.cfg, r = o.r, L = cfg.kind === 'camp' ? D.LEVELS.find(l => l.id === cfg.lvl) : null, nx = L ? D.LEVELS.find(l => l.id === L.id + 1) : null;
      const nxOk = o.win && nx && Prog.lvUnlocked(nx);
      let x = o.win ? '<canvas id="wsPic" style="border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.5);max-width:72%;display:block;margin:4px auto 6px"></canvas>' : '<div class="wemo">⏰</div>';
      x += '<div class="h1">' + (o.win ? (o.perfect ? 'Ідеально! 🎯' : 'Пазл зібрано! 🎉') : 'Час вийшов!') + '</div>';
      if (L && o.win) x += '<div class="stars">' + [1, 2, 3].map(i => '<i class="' + (i <= o.stars ? 'on' : '') + '">⭐</i>').join('') + '</div>';
      x += '<div class="sub">' + (o.win ? '⏱️ ' + tfmt(o.t) + (r.best ? ' · 🏅 новий рекорд!' : '') + (r.first ? ' · перше проходження' : '') + (L && o.stars < 3 ? '<br>⭐⭐⭐ — до ' + tfmt(L.par) : '') : 'Спробуй ще раз — у тебе вийде!') + '</div>';
      x += '<div class="rew"><span class="pill"><span class="coin">🪙</span> +' + r.coins + (r.doubled ? ' 🍀×2' : '') + '</span><span class="pill">✨ +' + r.xp + ' XP</span></div>';
      if (r.ups.length) x += '<div class="lvup">🎊 Новий рівень профілю — <b>' + r.ups[r.ups.length - 1] + '</b> · ' + Prog.title(r.ups[r.ups.length - 1]) + '</div>';
      if (o.win && cfg.src && (cfg.src.t === 'pic' || cfg.src.t === 'file' || (cfg.src.t === 'bot' && ['p','g'].includes(Media.kindOf(cfg.src.m))))) x += '<button class="btn btn-s" data-a="wsPublish">🖼️ Додати до публічної вітрини</button>';
      if (nxOk) x += '<button class="btn btn-g" data-a="wsNext">▶️ Рівень ' + nx.id + '</button>';
      x += '<button class="btn ' + (nxOk ? 'btn-s' : 'btn-g') + '" data-a="wsAgain">🔄 Ще раз</button><button class="btn btn-s" data-a="wsMenu">' + (L ? '🗺️ До рівнів' : '🏠 Меню') + '</button>';
      $('wsW').innerHTML = x;
      const pc = $('wsPic'), fi = $('fullImg');
      if (pc && fi.width) { const w = Math.max(120, Math.min(260, Math.round(window.innerHeight * 0.36 * fi.width / fi.height))), h = Math.round(w * fi.height / fi.width), d = Math.min(2, window.devicePixelRatio || 1); pc.width = w * d; pc.height = h * d; pc.style.width = w + 'px'; pc.style.height = h + 'px'; try { pc.getContext('2d').drawImage(fi, 0, 0, w * d, h * d); } catch (e) {} }
      A.wsPublish = () => Showcase.publish(cfg.src);
      A.wsNext = () => Ctl.play({ kind: 'camp', lvl: nx.id, g: nx.g, mode: nx.timed ? 'timed' : 'classic', src: { t: 'pic', pid: nx.pid } });
      A.wsAgain = () => { const c = Object.assign({}, cfg); delete c.restore; delete c.seed; Ctl.play(c); };
      A.wsMenu = () => show(cfg.kind === 'camp' ? 'levels' : 'home');
      show('ws');
      if (r.ups.length) setTimeout(() => levelUp(r.ups), 1300);
    }
    function end() { clearInterval(tmr); tmr = 0; if (C && C.cfg.kind === 'fight' && Arena.cleanup) Arena.cleanup(); Game.stop(); C = null; $('cov').classList.remove('on'); $('gload').classList.remove('on'); }
    function leave() { if (C && !C.over) save(); tok++; end(); }
    async function askQuit() {
      if (!C) return show('home');
      if (C.cfg.kind === 'fight') { if (await ask({ ic: '🏳️', t: 'Здатися?', d: 'Бій буде зараховано як поразку.', ok: 'Здатися', cancel: 'Битися далі', danger: 1 })) Arena.surrender(); return; }
      if (C.over) return;
      pauseT(true);
      const keep = C.cfg.src.t !== 'file';
      const ok = await ask({ ic: '⏸️', t: 'Пауза', d: keep ? 'Прогрес збережеться — продовжиш з головного екрана.' : 'Пазл зі свого фото не зберігається після виходу.', ok: 'Вийти', cancel: 'Продовжити гру' });
      if (ok) show(C ? C.back : 'home'); else pauseT(false);
    }
    $('gBack').onclick = () => askQuit();
    $('gHint').onclick = () => useHint();
    $('gGhost').onclick = () => { if (C && C.cfg.kind !== 'fight') { $('gGhost').classList.toggle('off', !Game.toggleGhost()); hap('sel'); } };
    $('gShuf').onclick = () => { Game.shuffleTray(); hap('sel'); };
    $('gPrev').onclick = () => { Game.togglePreview(); hap('sel'); };
    $('prevBig').onclick = () => Game.togglePreview();
    $('stage').addEventListener('pointerdown', () => { const s = Game.st; if (s && s.src.anim && !s.paused) s.src.play(); }, true);
    return { play, resume, askQuit, leave, end, countdown, hud, el, get C() { return C; }, backTo: () => (last && last.kind === 'camp' ? 'levels' : last && last.kind === 'fight' ? 'arena' : 'home') };
  })();
  Prog.on(refresh);
  return { show, refresh, back, go, toast, modal, closeModal, ask, confetti, hap, esc, fmt, tfmt, pct, plural, sleep, avatar, heroFace, row, stat, coinsPill, rewardToast, levelUp,
    applyTheme, addMedia, openMedia, badges, Ctl, R, A, BOT, uname, get cur() { return cur; }, get modalOn() { return mOn; } };
})();
