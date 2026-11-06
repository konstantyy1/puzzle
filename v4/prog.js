/* Progression: XP/levels, heroes, upgrades, achievements, daily tasks, streak */
'use strict';
const Prog = (() => {
  const D = DATA, S = () => Store.S;
  const ls = [];
  const emit = () => ls.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  const dstr = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const today = () => dstr(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dstr(d); };
  const need = L => 60 + 40 * L;
  function lvlInfo(xp) { let L = 1, x = xp; while (x >= need(L) && L < 200) { x -= need(L); L++; } return { L, cur: x, need: need(L) }; }
  const level = () => lvlInfo(S().xp).L;
  const title = L => { let t = D.TITLES[0][1]; for (const [l, n] of D.TITLES) if (L >= l) t = n; return t; };
  const hneed = L => 80 + 50 * L;
  function heroLvl(id) { let x = S().hero.xp[id || S().hero.id] || 0, L = 1; while (x >= hneed(L) && L < 30) { x -= hneed(L); L++; } return { L, cur: x, need: hneed(L), max: L >= 30 }; }
  const stage = L => L >= 25 ? 5 : L >= 15 ? 4 : L >= 8 ? 3 : L >= 3 ? 2 : 1;
  const hero = () => D.HEROES.find(h => h.id === S().hero.id) || D.HEROES[0];
  const sk = id => S().hero.sk[id] || 0;
  const hid = () => S().hero.id;
  const B = {
    xp: () => 1 + S().prof.xpb * 0.05 + (hid() === 'uni' ? 0.1 : 0),
    coins: () => 1 + S().prof.coinb * 0.05 + (hid() === 'fox' ? 0.1 : 0),
    luck: () => sk('luck') * 0.04 + (hid() === 'cat' ? 0.06 : 0),
    magnet: () => 1 + sk('magnet') * 0.12 + (hid() === 'robot' ? 0.2 : 0),
    hints: () => 1 + sk('hint') + (hid() === 'owl' ? 1 : 0),
    time: () => sk('time') * 6,
    corners: () => sk('corner'),
    atk: () => 1 + sk('atk') * 0.06 + (hid() === 'dragon' ? 0.1 : 0) + heroLvl().L * 0.004,
    hp: () => D.FIGHT.hp + sk('def') * 10 + (hid() === 'bear' ? 25 : 0) + heroLvl().L,
    en: () => 1 + sk('en') * 0.1,
  };
  function unlockFree() {
    const L = level(), c = S().cos;
    D.FRAMES.forEach(f => { if (!f.cost && f.lvl <= L && !c.frames.includes(f.id)) c.frames.push(f.id); });
    D.THEMES.forEach(t => { if (!t.cost && t.lvl <= L && !c.themes.includes(t.id)) c.themes.push(t.id); });
  }
  function addXP(n) {
    const g = Math.round(n * B.xp()), before = level();
    S().xp += g; S().hero.xp[hid()] = (S().hero.xp[hid()] || 0) + g;
    const after = level(), ups = []; let bonus = 0;
    for (let L = before + 1; L <= after; L++) { ups.push(L); bonus += 40 + 10 * L; }
    if (bonus) addCoins(bonus);
    unlockFree();
    return { xp: g, ups, bonus };
  }
  function addCoins(n, mult) {
    const g = Math.round(n * (mult ? B.coins() : 1));
    S().coins += g; if (g > 0) S().stats.coinsEarned += g; return g;
  }
  function spend(n) { if (S().coins < n) return false; S().coins -= n; return true; }
  const totalStars = () => Object.values(S().camp).reduce((a, b) => a + b, 0);
  const totalSkills = () => Object.values(S().hero.sk).reduce((a, b) => a + b, 0);
  const chUnlocked = ci => totalStars() >= D.CH[ci].need && (ci === 0 || (S().camp[ci * 10] || 0) > 0);
  const lvUnlocked = L => chUnlocked(L.ch) && (L.i === 0 || (S().camp[L.id - 1] || 0) > 0);
  const curLevel = () => D.LEVELS.find(L => lvUnlocked(L) && !S().camp[L.id]) || null;
  /* achievements */
  function achVal(id) {
    const st = S().stats;
    return { pieces: st.pieces, wins: st.wins, stars: totalStars(), perfect: st.perfect, speed: st.speed, big: st.big, streak: S().streak.best, daily: st.dailyDone,
      coins: st.coinsEarned, heroes: S().hero.owned.length, upg: totalSkills(), own: st.own, anim: st.anim, friends: st.friends || 0, duels: st.duels, rating: st.rmax }[id] || 0;
  }
  function achState(a) {
    const v = achVal(a.id), cl = S().ach[a.id] || 0; let r = 0;
    a.t.forEach(t => { if (v >= t) r++; });
    const next = a.t[Math.min(cl, 4)];
    return { v, cl, r, can: r > cl, next, done: cl >= 5, pct: cl >= 5 ? 1 : Math.min(1, v / next) };
  }
  function claimAch(id) {
    const a = D.ACH.find(x => x.id === id), st = achState(a); if (!st.can) return null;
    const t = st.cl; S().ach[id] = t + 1;
    const c = addCoins(D.TIER_COINS[t]), x = addXP(D.TIER_XP[t]); Store.save(); emit();
    return { tier: t, coins: c, xp: x };
  }
  const achBadge = () => D.ACH.filter(a => achState(a).can).length;
  /* daily */
  function rng(seed) { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  function ensureDaily() {
    const d = S().daily, t = today();
    if (d.day === t && d.tasks.length) return;
    const r = rng(t + ':' + Store.uid), pool = D.DAILY.slice(), n = 3 + S().prof.daily, tasks = [];
    while (tasks.length < n && pool.length) { const i = Math.floor(r() * pool.length), tp = pool.splice(i, 1)[0]; tasks.push({ id: tp.id, k: tp.k[Math.floor(r() * tp.k.length)], p: 0, cl: 0 }); }
    S().daily = { day: t, tasks, chest: 0, gift: d.gift || '' }; Store.save();
  }
  function dprog(id, n) {
    ensureDaily(); let ch = false;
    S().daily.tasks.forEach(t => { if (t.id === id && t.p < t.k) { t.p = Math.min(t.k, t.p + (n || 1)); ch = true; if (t.p >= t.k) UI.toast('📋 Завдання виконано: ' + taskName(t)); } });
    return ch;
  }
  const taskTpl = t => D.DAILY.find(x => x.id === t.id);
  const taskName = t => taskTpl(t).n(t.k);
  function claimTask(i) {
    const t = S().daily.tasks[i]; if (!t || t.cl || t.p < t.k) return null;
    const tp = taskTpl(t); t.cl = 1; S().stats.dailyDone++;
    const c = addCoins(tp.c, true), x = addXP(tp.x); Store.save(); emit(); return { coins: c, xp: x };
  }
  const chestReady = () => S().daily.tasks.length && S().daily.tasks.every(t => t.cl) && !S().daily.chest;
  function claimChest() { if (!chestReady()) return null; S().daily.chest = 1; const c = addCoins(150); S().inv.hint += 2; const x = addXP(60); Store.save(); emit(); return { coins: c, xp: x }; }
  const giftReady = () => S().prof.gift > 0 && S().daily.gift !== today();
  function claimGift() { if (!giftReady()) return 0; S().daily.gift = today(); const c = addCoins(S().prof.gift * 20); Store.save(); emit(); return c; }
  function checkStreak() {
    const st = S().streak, t = today();
    if (st.last === t) return;
    st.n = st.last === yesterday() ? st.n + 1 : 1; st.last = t; st.best = Math.max(st.best, st.n); Store.save();
  }
  const streakReady = () => S().streak.claim !== today();
  function claimStreak() { if (!streakReady()) return 0; const st = S().streak; st.claim = today(); const c = addCoins(D.STREAK[(st.n - 1) % 7]); Store.save(); emit(); return c; }
  const dailyBadge = () => (ensureDaily(), S().daily.tasks.filter(t => t.p >= t.k && !t.cl).length + (chestReady() ? 1 : 0) + (giftReady() ? 1 : 0) + (streakReady() ? 1 : 0));
  /* shop / upgrades */
  function buySkill(id) {
    const l = sk(id); if (l >= D.SK_MAX) return 'max'; const c = D.SK_COST[l];
    if (!spend(c)) return 'coins'; S().hero.sk[id] = l + 1; Store.save(); emit(); return 'ok';
  }
  function buyProf(id) {
    const p = D.PROF.find(x => x.id === id), l = S().prof[id]; if (l >= p.max) return 'max';
    if (!spend(p.cost[l])) return 'coins'; S().prof[id] = l + 1; if (id === 'daily') { const d = S().daily; d.day = ''; const old = d.tasks; ensureDaily(); S().daily.tasks.forEach((t, i) => { if (old[i] && old[i].id === t.id) Object.assign(t, old[i]); }); }
    Store.save(); emit(); return 'ok';
  }
  function buyHero(id) {
    const h = D.HEROES.find(x => x.id === id); if (S().hero.owned.includes(id)) return 'own';
    if (level() < h.lvl) return 'lvl'; if (!spend(h.cost)) return 'coins';
    S().hero.owned.push(id); S().hero.xp[id] = S().hero.xp[id] || 0; S().hero.id = id; Store.save(); emit(); return 'ok';
  }
  function setHero(id) { if (!S().hero.owned.includes(id)) return; S().hero.id = id; Store.save(); emit(); }
  function buyCos(kind, id) {
    const list = kind === 'frame' ? D.FRAMES : D.THEMES, it = list.find(x => x.id === id), own = S().cos[kind + 's'];
    if (!own.includes(id)) {
      if (level() < it.lvl) return 'lvl';
      if (it.cost) { if (!spend(it.cost)) return 'coins'; } else if (level() < it.lvl) return 'lvl';
      own.push(id);
    }
    S().cos[kind] = id; Store.save(); emit(); return 'ok';
  }
  function buyHints() { if (!spend(60)) return false; S().inv.hint += 3; Store.save(); emit(); return true; }
  /* game results */
  function gameEnd(r) {
    const st = S().stats, out = { coins: 0, xp: 0, ups: [], doubled: false, first: false, best: false, stars: r.stars || 0 };
    st.games++; st.time += Math.round(r.time || 0); st.pieces += r.pieces || 0;
    if (r.pieces) dprog('pieces', r.pieces);
    if (!r.win) { out.coins = addCoins(2 + Math.round((r.pieces || 0) * 0.3), true); const x = addXP(5 + (r.pieces || 0)); out.xp = x.xp; out.ups = x.ups; Store.save(); emit(); return out; }
    st.wins++; dprog('play');
    if (r.perfect) { st.perfect++; dprog('perfect'); }
    if (r.timed) { st.speed++; dprog('timed'); }
    if (r.g >= 6) st.big++;
    if (r.g >= 5) dprog('big');
    if (r.own) { st.own++; dprog('own'); }
    if (r.anim) { st.anim++; if (!r.own) dprog('own'); }
    let coins = 5 + r.g * r.g * 0.8 + (r.perfect ? 10 : 0) + (r.timed ? 8 : 0);
    let xp = 10 + r.g * r.g * 1.5;
    if (r.kind === 'camp') {
      const L = D.LEVELS.find(l => l.id === r.lvl), prev = S().camp[r.lvl] || 0;
      out.first = !prev; coins = 10 + 5 * L.ch + r.stars * 5 + (out.first ? 20 : 0); xp += out.first ? 15 : 0;
      if (r.stars > prev) S().camp[r.lvl] = r.stars;
      dprog('camp'); if (r.stars === 3) dprog('star3');
    } else {
      const k = r.g + '_' + (r.mode || 'classic'), b = S().rec[k];
      if (!b || r.time < b) { S().rec[k] = Math.round(r.time * 10) / 10; out.best = !!b; }
    }
    if (Math.random() < B.luck()) { coins *= 2; out.doubled = true; }
    out.coins = addCoins(coins, true); const x = addXP(xp); out.xp = x.xp; out.ups = x.ups;
    Store.save(); emit(); return out;
  }
  function arenaEnd(r) {
    const st = S().stats, a = S().arena, out = { coins: 0, xp: 0, ups: [] };
    st.arena++; a.games++; dprog('arena'); if (r.pieces) { st.pieces += r.pieces; dprog('pieces', r.pieces); }
    const m = r.bot ? 0.6 : 1;
    if (r.win) { st.duels++; a.w++; dprog('duelwin'); } else a.l++;
    if (typeof r.rt === 'number') { a.rt = r.rt; st.rmax = Math.max(st.rmax, r.rt); }
    out.coins = addCoins((r.win ? (r.ranked ? 60 : 40) : 12) * m, true);
    const x = addXP((r.win ? 40 : 12) * m); out.xp = x.xp; out.ups = x.ups;
    Store.save(); emit(); return out;
  }
  return { on: f => ls.push(f), emit, today, lvlInfo, level, title, heroLvl, stage, hero, sk, B, addXP, addCoins, spend, totalStars, totalSkills,
    chUnlocked, lvUnlocked, curLevel, achState, claimAch, achBadge, ensureDaily, dprog, taskName, taskTpl, claimTask, chestReady, claimChest,
    giftReady, claimGift, checkStreak, streakReady, claimStreak, dailyBadge, buySkill, buyProf, buyHero, setHero, buyCos, buyHints, gameEnd, arenaEnd, unlockFree };
})();
