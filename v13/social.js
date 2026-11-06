/* Friends and opt-in, unranked friend duels. Telegram identity is verified server-side. */
'use strict';
const Social = (() => {
  const $ = id => document.getElementById(id);
  let list = null, loading = false, error = '', challenge = null, lastLoad = 0, fp = null;
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
      const r = await Arena.api('friends'); list = r.list || []; await Avatars.loadFriends(list.map(f=>f.id));
      Store.S.stats.friends = Math.max(Store.S.stats.friends || 0, list.length); Store.save();
    } catch (e) { error = e.message === 'telegram' ? 'Відкрий гру через бота в Telegram.' : 'Не вдалося завантажити друзів. Перевір з’єднання.'; list = []; }
    loading = false; lastLoad = Date.now(); if (UI.cur === 'friends') UI.refresh();
  }
  UI.R.friends = () => {
    let x = '<div class="h1">Друзі</div><div class="sub">Запроси друга й зіграйте разом</div>';
    if (!signedIn()) x += '<div class="card"><b>Друзі доступні в Telegram</b><div class="rd">Відкрий мінігру через @' + UI.BOT + ', щоб підтвердити акаунт.</div></div>';
    else {
      x += '<div class="card"><div class="h2">🤝 Твоя команда</div><div class="rd">Друзі бачать імена, аватарки, @username та ігрові профілі одне одного. Для інших гравців залишаються псевдоніми.</div><button class="btn btn-g mt" data-a="friendInvite">＋ Запросити друга</button></div>';
      if (error) x += '<div class="card">' + esc(error) + '<button class="sbtn s2 mt" data-a="friendsReload">Повторити</button></div>';
      else if (list === null || loading) x += '<div class="empty">Завантаження друзів…</div>';
      else if (!list.length) x += '<div class="empty">Тут з’являться друзі після прийняття запрошення.</div>';
      else x += '<div class="sl">Друзі · ' + list.length + '</div>' + list.map((f,i) => '<div class="friend-card"><button class="friend-identity" data-a="friendProfile" data-v="' + i + '" aria-label="Відкрити профіль ' + esc(friendName(f)) + '"><span class="ric">' + Avatars.face(Avatars.cache[f.id],hero(f.h)) + '</span><span class="rmid"><span class="rt">' + esc(friendName(f)) + '</span><span class="rd">' + (f.username && f.name ? '@' + esc(f.username) + ' · ' : '') + 'Рівень ' + (Number(f.l) || 1) + (!f.name && !f.username ? ' · ім’я з’явиться після входу друга' : '') + '</span></span><span class="friend-chevron">›</span></button><div class="friend-actions"><button class="sbtn s2" data-a="friendProfile" data-v="' + i + '">👤 Профіль</button><button class="sbtn" data-a="friendDuel" data-v="' + i + '">⚔️ Дуель</button><button class="ib" aria-label="Видалити друга" data-a="friendRemove" data-v="' + i + '">×</button></div></div>').join('');
    }
    x += '<button class="btn btn-s mt" data-go="arena">← До Арени</button>';
    $('friendsW').innerHTML = x;
    if (signedIn() && !loading && (list === null || Date.now() - lastLoad > 30000)) load(true);
  };
  async function openProfile(i) {
    const f=list && list[+i];if(!f)return;
    try {
      const r=await Arena.api('friendProfile',{id:f.id});if(!r.profile)return UI.toast('Не вдалося завантажити профіль');
      fp={id:f.id,p:r.profile,tab:'profile',works:null,featured:null,err:'',stamp:Date.now()};UI.show('friendpage');loadWorks(fp);
    }catch(e){UI.toast(e.message==='friend'?'Профіль доступний лише друзям':'Не вдалося завантажити профіль');}
  }
  async function loadWorks(page){
    if(!page.p.publicId){page.works=[];if(fp===page&&UI.cur==='friendpage')UI.refresh();return;}
    try{const r=await Showcase.getProfile(page.p.publicId);if(fp!==page)return;page.works=r.list||[];page.featured=r.featured||null;page.err='';}
    catch(e){if(fp!==page)return;page.err='Не вдалося завантажити вітрину.';page.works=[];}
    if(fp===page&&UI.cur==='friendpage')UI.refresh();
  }
  async function refreshFriend(){
    const page=fp;if(!page||UI.cur!=='friendpage'||page.refreshing)return;page.refreshing=true;
    try{const r=await Arena.api('friendProfile',{id:page.id});if(fp!==page)return;page.p=r.profile;page.stamp=Date.now();await loadWorks(page);}
    catch(e){if(fp!==page)return;if(e.message==='friend'){fp=null;UI.show('friends');UI.toast('Профіль більше недоступний');}else UI.toast('Не вдалося оновити профіль');}
    finally{page.refreshing=false;}
  }
  UI.R.friendpage=()=>{
    if(!fp){$('friendpageW').innerHTML='<div class="empty">Профіль недоступний.</div><button class="btn btn-s" data-go="friends">← До друзів</button>';return;}
    const p=fp.p,h=DATA.HEROES.find(x=>x.id===p.hero)||DATA.HEROES[0],lg=DATA.league(Number(p.rating)||1000),val=x=>x===null||x===undefined?'—':UI.fmt(Number(x)||0), label=p.name||(p.username?'@'+p.username:p.alias||'Гравець'),user=p.name&&p.username?'@'+p.username:'',d=p.details||{};
    const stat=(v,n)=>'<div class="friend-stat"><strong>'+val(v)+'</strong><span>'+n+'</span></div>';
    let x='<button class="fp-back" data-go="friends">← Друзі</button><div class="card fp-identity"><div class="friend-profile-head"><div class="friend-profile-avatar">'+Avatars.face(p.avatar,h.e)+'</div><div class="friend-profile-name"><div class="friend-kicker">ПРОФІЛЬ ДРУГА</div><h3>'+esc(label)+'</h3>'+(user?'<div class="friend-handle">'+esc(user)+'</div>':'')+'<div class="friend-level">'+esc(Prog.title(Number(p.level)||1))+' · рівень '+val(p.level)+'</div></div></div><div class="friend-hero"><span class="friend-hero-icon">'+h.e+'</span><span><b>'+esc(h.n)+'</b><small>Герой · '+(p.heroLevel===null?'рівень недоступний':'рівень '+val(p.heroLevel))+'</small></span><span class="friend-league">'+lg.ic+' '+esc(lg.n)+'</span></div></div>';
    x+='<div class="seg fp-tabs"><button data-a="fpTab" data-v="profile" class="'+(fp.tab==='profile'?'on':'')+'">👤 Профіль</button><button data-a="fpTab" data-v="works" class="'+(fp.tab==='works'?'on':'')+'">🖼️ Вітрини'+(fp.works?' · '+fp.works.length:'')+'</button></div>';
    if(fp.tab==='profile'){
      x+='<div class="sl">Статистика</div><div class="friend-stats">'+stat(p.rating,'Рейтинг')+stat(p.arenaWins,'Перемоги на Арені')+stat(p.puzzles,'Складено пазлів')+stat(p.stars,'Зірок')+stat(p.achievements,'Досягнень')+stat(p.teamwins,'Перемоги 2×2')+stat(d.pieces,'Деталей')+stat(d.perfect,'Без помилок')+stat(d.streak,'Серія днів')+stat(d.coinsEarned,'Зароблено монет')+stat(d.minutes,'Хвилин у грі')+stat(d.games,'Зіграно пазлів')+'</div>';
      x+='<button class="btn btn-s mt" data-a="fpTab" data-v="works">🖼️ Переглянути всі роботи</button>';
      if(d.heroes){x+='<div class="sl">Герої · '+d.heroes.length+'</div><div class="card fp-collection">'+d.heroes.map(id=>{const q=DATA.HEROES.find(a=>a.id===id);return q?'<span>'+q.e+' '+esc(q.n)+'</span>':'';}).join('')+'</div>';}
      if(d.skills){x+='<div class="sl">Навички героя</div><div class="card">'+DATA.SKILLS.map(k=>'<div class="kv"><span>'+k.ic+' '+esc(k.n)+'</span><b>'+val(d.skills[k.id])+'/'+DATA.SK_MAX+'</b></div>').join('')+'</div>';}
      if(d.ach){x+='<div class="sl">Досягнення</div><div class="card">'+DATA.ACH.filter(q=>d.ach[q.id]>0).map(q=>'<div class="kv"><span>'+q.ic+' '+esc(q.n)+'</span><b>'+val(d.ach[q.id])+'/5</b></div>').join('')+(Object.values(d.ach).some(v=>v>0)?'':'<div class="rd">Поки немає отриманих досягнень.</div>')+'</div>';}
      x+='<div class="friend-profile-note">'+(p.updated?'Дані останнього оновлення профілю. Ім’я, аватарка і статистика доступні лише друзям.':'Дані з’являться, коли друг відкриє гру.')+'</div><button class="btn btn-g" data-a="fpDuel">⚔️ Викликати на дуель</button>';
    }else{
      x+='<div class="show-note">Опубліковані роботи бачать усі. Ім’я та аватарка друга видно лише підтвердженим друзям.</div>';
      if(fp.err)x+='<div class="empty">'+esc(fp.err)+'</div>';else if(fp.works===null)x+='<div class="empty">Завантаження…</div>';else if(!fp.works.length)x+='<div class="empty">Друг ще не опублікував робіт.</div>';else x+='<div class="show-grid">'+fp.works.map((w,i)=>'<button class="show-card fp-work" data-a="fpPreview" data-v="'+i+'">'+Showcase.renderImage(w)+'<span>'+(w.kind==='botGif'?'GIF':'Фото')+'</span></button>').join('')+'</div>';
    }
    x+='<button class="btn btn-s mt" data-go="friends">← До друзів</button>';$('friendpageW').innerHTML=x;
  };
  function fpPreview(i){const w=fp&&fp.works&&fp.works[+i];if(!w)return;UI.modal('<div class="show-feature fp-large">'+Showcase.renderImage(w)+'</div><p>Публічна робота · '+(w.kind==='botGif'?'GIF':'Фото')+'</p><button class="btn btn-s" data-close>Закрити</button>');}
  function fpDuel(){const i=fp&&list&&list.findIndex(f=>f.id===fp.id);if(i===null||i===undefined||i<0)return UI.toast('Онови список друзів');duel(i);}
  async function invite() {
    try {
      const r = await Arena.api('friendInvite'), url = link('f', r.code);
      const b = UI.modal('<div class="mic">🤝</div><h3>Запросити друга</h3><p>Надішли посилання другові в Telegram. Воно одноразове та діє 7 днів. Друзі бачитимуть твоє ім’я, аватарку, @username та ігровий профіль.</p><button class="btn btn-g" id="shareFriend">Поділитися в Telegram</button><button class="btn btn-s" data-close>Готово</button>');
      b.querySelector('#shareFriend').onclick = () => share(url, 'Додавайся у друзі в Фото Пазлі 🧩');
    } catch (e) { UI.toast('Не вдалося створити запрошення'); }
  }
  async function acceptFriend(code) {
    if (!signedIn()) return UI.toast('Відкрий посилання в Telegram');
    if (!(await UI.ask({ ic:'🤝', t:'Запрошення в друзі', d:'Додати гравця? Ви обоє бачитимете імена, аватарки, @username (якщо є) та ігрові профілі.', ok:'Додати' }))) return;
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
  Object.assign(UI.A, { fpTab:v=>{if(fp){fp.tab=v==='works'?'works':'profile';UI.refresh();$('friendpage').scrollTop=0;}}, fpPreview, fpDuel, friendProfile:openProfile, friendInvite:invite, friendDuel:duel, friendRemove:remove, friendsReload:() => { list = null; load(true); UI.refresh(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && signedIn() && UI.cur === 'friends') load(true); if(!document.hidden&&signedIn()&&UI.cur==='friendpage')refreshFriend(); });
  setInterval(() => { if (!document.hidden && signedIn() && UI.cur === 'friends' && Date.now() - lastLoad > 30000) load(true); }, 30000);
  setInterval(()=>{if(!document.hidden&&fp&&UI.cur==='friendpage'&&Date.now()-fp.stamp>30000)refreshFriend();},30000);
  return { acceptFriend, acceptDuel };
})();
