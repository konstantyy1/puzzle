/* Friends and opt-in, unranked friend duels. Telegram identity is verified server-side. */
'use strict';
const Social = (() => {
  const $ = id => document.getElementById(id);
  let list = null, loading = false, error = '', challenge = null;
  const signedIn = () => !!(TG && TG.initData);
  const esc = UI.esc;
  const friendName = f => f.name || (f.username ? '@' + f.username : f.a);
  const hero = id => (DATA.HEROES.find(h => h.id === id) || DATA.HEROES[0]).e;
  const prof = () => ({ hero: Store.S.hero.id, lvl: Prog.level(), xp: Store.S.xp, hp: Prog.B.hp() });
  const link = (kind, code) => 'https://t.me/' + UI.BOT + '?start=' + kind + '_' + code;
  function share(url, text) {
    const target = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
    try { if (TG && TG.openTelegramLink) TG.openTelegramLink(target); else window.open(target, '_blank', 'noopener'); }
    catch (_) { UI.toast('Не вдалося відкрити Telegram'); }
  }
  async function load(force) {
    if (loading || (!force && list !== null)) return;
    loading = true; error = '';
    try {
      const r = await Arena.api('friends'); list = r.list || [];
      Store.S.stats.friends = Math.max(Store.S.stats.friends || 0, list.length); Store.save();
    } catch (e) { error = e.message === 'telegram' ? 'Відкрий гру через бота в Telegram.' : 'Не вдалося завантажити друзів. Перевір з’єднання.'; list = []; }
    loading = false; if (UI.cur === 'friends') UI.refresh();
  }
  UI.R.friends = () => {
    let x = '<div class="h1">Друзі</div><div class="sub">Запроси друга й зіграйте разом</div>';
    if (!signedIn()) x += '<div class="card"><b>Друзі доступні в Telegram</b><div class="rd">Відкрий мінігру через @' + UI.BOT + ', щоб підтвердити акаунт.</div></div>';
    else {
      x += '<div class="card"><div class="h2">🤝 Твоя команда</div><div class="rd">Друзі бачать імена, @username та ігрові профілі одне одного. Для інших гравців залишаються псевдоніми.</div><button class="btn btn-g mt" data-a="friendInvite">＋ Запросити друга</button></div>';
      if (error) x += '<div class="card">' + esc(error) + '<button class="sbtn s2 mt" data-a="friendsReload">Повторити</button></div>';
      else if (list === null || loading) x += '<div class="empty">Завантаження друзів…</div>';
      else if (!list.length) x += '<div class="empty">Тут з’являться друзі після прийняття запрошення.</div>';
      else x += '<div class="sl">Друзі · ' + list.length + '</div>' + list.map((f,i) => '<div class="friend-card"><button class="friend-identity" data-a="friendProfile" data-v="' + i + '" aria-label="Відкрити профіль ' + esc(friendName(f)) + '"><span class="ric">' + hero(f.h) + '</span><span class="rmid"><span class="rt">' + esc(friendName(f)) + '</span><span class="rd">' + (f.username && f.name ? '@' + esc(f.username) + ' · ' : '') + 'Рівень ' + (Number(f.l) || 1) + (!f.name && !f.username ? ' · ім’я з’явиться після входу друга' : '') + '</span></span><span class="friend-chevron">›</span></button><div class="friend-actions"><button class="sbtn s2" data-a="friendProfile" data-v="' + i + '">👤 Профіль</button><button class="sbtn" data-a="friendDuel" data-v="' + i + '">⚔️ Дуель</button><button class="ib" aria-label="Видалити друга" data-a="friendRemove" data-v="' + i + '">×</button></div></div>').join('');
    }
    x += '<button class="btn btn-s mt" data-go="arena">← До Арени</button>';
    $('friendsW').innerHTML = x;
    if (signedIn() && list === null && !loading) load();
  };
  async function openProfile(i) {
    const f=list && list[+i];if(!f)return;
    try {
      const r=await Arena.api('friendProfile',{id:f.id}), p=r.profile;
      if(!p)return UI.toast('Не вдалося завантажити профіль');
      const h=DATA.HEROES.find(x=>x.id===p.hero)||DATA.HEROES[0], lg=DATA.league(Number(p.rating)||1000);
      const val=x=>x===null||x===undefined?'—':UI.fmt(Number(x)||0);
      const label=p.name|| (p.username?'@'+p.username:p.alias||f.a), user=p.name&&p.username?'@'+p.username:'';
      const stat=(v,n)=>'<div class="friend-stat"><strong>'+val(v)+'</strong><span>'+n+'</span></div>';
      let x='<div class="friend-profile-head"><div class="friend-profile-avatar">'+h.e+'</div><div class="friend-profile-name"><div class="friend-kicker">ПРОФІЛЬ ДРУГА</div><h3>'+esc(label)+'</h3>'+(user?'<div class="friend-handle">'+esc(user)+'</div>':'')+'<div class="friend-level">'+esc(Prog.title(Number(p.level)||1))+' · рівень '+val(p.level)+'</div></div></div>';
      x+='<div class="friend-hero"><span class="friend-hero-icon">'+h.e+'</span><span><b>'+esc(h.n)+'</b><small>Герой · '+(p.heroLevel===null?'рівень недоступний':'рівень '+val(p.heroLevel))+'</small></span><span class="friend-league">'+lg.ic+' '+esc(lg.n)+'</span></div>';
      x+='<div class="friend-stats">'+stat(p.rating,'Рейтинг')+stat(p.arenaWins,'Перемог на Арені')+stat(p.puzzles,'Складено пазлів')+stat(p.stars,'Зірок')+stat(p.achievements,'Досягнень')+stat(p.teamwins,'Перемог 2×2')+'</div>';
      x+='<div class="friend-profile-note">'+(p.updated?'Дані останнього оновлення профілю. Видно лише друзям.':'Деякі дані з’являться, коли друг відкриє оновлену гру.')+'</div><button class="btn btn-g" id="fpDuel">⚔️ Викликати на дуель</button><button class="btn btn-s" data-close>Закрити</button>';
      const box=UI.modal(x);box.querySelector('#fpDuel').onclick=()=>{UI.closeModal();duel(i);};
    }catch(e){UI.toast(e.message==='friend'?'Профіль доступний лише друзям':'Не вдалося завантажити профіль');}
  }
  async function invite() {
    try {
      const r = await Arena.api('friendInvite'), url = link('f', r.code);
      const b = UI.modal('<div class="mic">🤝</div><h3>Запросити друга</h3><p>Надішли посилання другові в Telegram. Воно одноразове та діє 7 днів. Друзі бачитимуть твоє ім’я, @username та ігровий профіль.</p><button class="btn btn-g" id="shareFriend">Поділитися в Telegram</button><button class="btn btn-s" data-close>Готово</button>');
      b.querySelector('#shareFriend').onclick = () => share(url, 'Додавайся у друзі в Фото Пазлі 🧩');
    } catch (e) { UI.toast('Не вдалося створити запрошення'); }
  }
  async function acceptFriend(code) {
    if (!signedIn()) return UI.toast('Відкрий посилання в Telegram');
    if (!(await UI.ask({ ic:'🤝', t:'Запрошення в друзі', d:'Додати гравця? Ви обоє бачитимете імена, @username (якщо є) та ігрові профілі.', ok:'Додати' }))) return;
    try { const r = await Arena.api('friendAccept', { code }); list = null; UI.show('friends'); UI.toast('🤝 Тепер ви друзі: ' + r.a); Soundscape.play('reward'); }
    catch (e) { UI.toast(({self:'Не можна додати себе',expired:'Запрошення вже використано або його термін минув',telegram:'Відкрий гру через Telegram'})[e.message] || 'Не вдалося прийняти запрошення'); }
  }
  async function remove(i) {
    const f = list && list[+i]; if (!f) return;
    if (!(await UI.ask({ ic:'🤝', t:'Видалити друга?', d: esc(friendName(f)) + ' зникне з твого списку, а ти — з його.', ok:'Видалити', danger:1 }))) return;
    try { await Arena.api('friendRemove', { id:f.id }); list = null; UI.refresh(); } catch (_) { UI.toast('Не вдалося видалити друга'); }
  }
  async function duel(i) {
    const f = list && list[+i]; if (!f || challenge) return;
    try {
      const r = await Arena.api('duelCreate', Object.assign({ id: f.id }, prof()));
      const q = challenge = { code:r.code, closed:false, matched:false, running:false };
      const b = UI.modal('<div class="mic">⚔️</div><h3>Дуель з другом</h3><p>Надішли виклик гравцю <b>' + esc(friendName(f)) + '</b> і повернися в гру. Лише цей друг може його прийняти. Рейтинг не зміниться.</p><button class="btn btn-g" id="shareDuel">Надіслати виклик</button><div class="mut small tc mt" id="duelState">Очікуємо друга · до 10 хвилин</div><button class="btn btn-s mt" data-close>Скасувати</button>', { onClose: () => { q.closed = true; if (!q.matched) Arena.api('duelCancel', { code:q.code }).catch(() => {}); if (challenge === q) challenge = null; } });
      b.querySelector('#shareDuel').onclick = () => share(link('d', r.code), 'Викликаю тебе на дуель у Фото Пазлі! ⚔️');
      const poll = async () => {
        if (q.closed || q.running) return; q.running = true;
        try {
          const p = await Arena.api('duelPoll', { code:q.code }, 7000); q.running = false;
          if (q.closed) return;
          if (p && p.mid) { q.matched = true; UI.closeModal(); Arena.start(p); return; }
        } catch (e) { q.running = false; if (q.closed) return; if (e.message === 'expired') { UI.closeModal(); return UI.toast('Термін виклику минув'); } }
        if (!q.closed) setTimeout(poll, 1800);
      }; poll();
    } catch (_) { UI.toast('Не вдалося створити виклик'); }
  }
  async function acceptDuel(code) {
    if (!signedIn()) return UI.toast('Відкрий посилання в Telegram');
    if (!(await UI.ask({ ic:'⚔️', t:'Виклик на дуель', d:'Прийняти виклик? Це дружній бій без зміни рейтингу.', ok:'Прийняти' }))) return;
    try { const m = await Arena.api('duelJoin', Object.assign({code}, prof())); if (m.mid) Arena.start(m); }
    catch (e) { UI.toast(({recipient:'Цей виклик адресований іншому гравцю',expired:'Виклик уже використано або термін минув',friend:'Гравці більше не в списку друзів'})[e.message] || 'Не вдалося прийняти виклик'); }
  }
  Object.assign(UI.A, { friendProfile:openProfile, friendInvite:invite, friendDuel:duel, friendRemove:remove, friendsReload:() => { list = null; load(true); UI.refresh(); } });
  return { acceptFriend, acceptDuel };
})();
