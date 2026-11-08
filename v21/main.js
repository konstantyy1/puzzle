/* Boot */
'use strict';
(async () => {
  const $ = id => document.getElementById(id);
  const V = v => TG && TG.isVersionAtLeast && TG.isVersionAtLeast(v);
  if (TG) {
    try { TG.ready(); } catch (e) {}
    try { TG.expand(); } catch (e) {}
    try { if (V('7.7')) TG.disableVerticalSwipes(); } catch (e) {}
    try { if (V('6.1')) { TG.setHeaderColor('#0a1424'); TG.setBackgroundColor('#0a1424'); } if (V('7.10')) TG.setBottomBarColor('#0a1424'); } catch (e) {}
    try { if (V('6.1')) TG.BackButton.onClick(() => UI.back()); } catch (e) {}
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.back(); });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  try { await Promise.race([Store.syncCloud(), new Promise(r => setTimeout(r, 1800))]); } catch (e) {}
  Prog.checkStreak(); Prog.ensureDaily(); Prog.unlockFree(); Store.save();
  UI.applyTheme();
  const q = new URLSearchParams(location.search);
  const friend = q.get('friend'), duel = q.get('duel'), team = q.get('team'), dz = q.get('dz');
  const media = q.get('src') && q.get('sig') ? { d: q.get('src'), s: q.get('sig'), g: +q.get('g') || 4 } : null;
  UI.show('home'); Backgrounds.init(); Avatars.init(); PuzzleInbox.start();
  $('loader').classList.add('off'); setTimeout(() => { const l = $('loader'); if (l) l.remove(); }, 500);
  const S = Store.S;
  function dailyPopup() {
    const st = S.streak, di = Math.max(0, (st.n - 1) % 7);
    const b = UI.modal('<div class="mic">🔥</div><h3>' + st.n + '-й день поспіль!</h3><p>Нагорода за щоденний вхід. Не пропускай — у 7-й день буде 150 🪙</p><div class="week">' +
      DATA.STREAK.map((c, i) => '<div class="wd' + (i < di ? ' done' : i === di ? ' cur' : '') + '">День ' + (i + 1) + '<b>' + c + '</b></div>').join('') +
      '</div><button class="btn btn-g mt" id="dpOk">Забрати ' + DATA.STREAK[di] + ' 🪙</button>');
    b.querySelector('#dpOk').onclick = () => { UI.closeModal(); UI.rewardToast(Prog.claimStreak(), '🔥'); UI.confetti(40); };
  }
  function welcome() {
    S.seen.tut = 1; Store.save();
    const b = UI.modal('<div class="mic">🧩</div><h3>Вітаю у Фото Пазлі!</h3><p>Перетягуй деталі з лотка на поле — правильна деталь сама стане на місце. Проходь рівні, збирай ⭐, бийся на Арені й прокачуй героя.<br><br>' +
      '🎞️ Надішли боту стікер, GIF або фото — і збирай його як пазл!</p><button class="btn btn-g" id="wOk">Почати!</button>', { onClose: () => { if (Prog.streakReady()) setTimeout(dailyPopup, 300); } });
    b.querySelector('#wOk').onclick = () => UI.closeModal();
  }
  if (friend || duel || team) {
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    if (friend) Social.acceptFriend(friend); else if (duel) Social.acceptDuel(duel); else Team.accept(team);
  } else if (media) {
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    UI.openMedia(media);
  } else if (dz && typeof DailyPz !== 'undefined') {
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    setTimeout(() => DailyPz.open(), 350);
  } else if (!S.seen.tut && !S.stats.games) setTimeout(welcome, 400);
  else if (Prog.streakReady()) setTimeout(dailyPopup, 600);
  Arena.sync().then(() => { if (UI.cur === 'arena' || UI.cur === 'home') UI.refresh(); });
})();
