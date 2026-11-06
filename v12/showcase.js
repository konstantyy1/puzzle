/* Public, opt-in puzzle showcase. Never displays Telegram identity or private avatars. */
'use strict';
const Showcase=(()=>{
 const esc=UI.esc, signed=()=>!!(TG&&TG.initData); let mode='feed', profile='', list=null, loading=false, error='', last=0, token=0, busy=false;
 const messages={telegram:'Відкрий гру через Telegram.',limit:'У вітрині максимум 12 робіт. Прибери одну, щоб додати нову.',busy:'Зачекай кілька секунд і спробуй ще раз.',image:'Не вдалося підготувати зображення.',nokv:'Сховище вітрини недоступне.'};
 async function request(op,data){const r=await fetch('/api/showcase',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({op,init:TG&&TG.initData||''},data||{}))});const j=await r.json();if(!r.ok||j.err)throw Error(j.err||'network');return j;}
 async function load(){if(loading)return; const current=++token, m=mode, p=profile;loading=true;error='';try{let j;if(m==='mine')j=await request('mine');else {const q=m==='profile'?'profile&id='+encodeURIComponent(p):'feed';const r=await fetch('/api/showcase?op='+q,{cache:'no-store'});j=await r.json();if(!r.ok||j.err)throw Error(j.err||'network');}if(current===token)list=j.list||[];}catch(e){if(current===token){error=messages[e.message]||'Не вдалося завантажити вітрину. Перевір з’єднання.';list=[];}}finally{loading=false;last=Date.now();if(UI.cur==='showcase')UI.refresh();}}
 function switchTo(m,p){mode=m;profile=p||'';list=null;error='';token++; if(!loading)load();UI.refresh();}
 function jpeg(src){const el=src.src.el,w=src.src.w,h=src.src.h,k=Math.min(1,600/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(el,0,0,c.width,c.height);for(const q of [.78,.65,.5,.35]){const s=c.toDataURL('image/jpeg',q).split(',')[1];if(s.length<=133300)return s;}throw Error('image');}
 async function publish(src){
  if(!signed())return UI.toast('Публікація доступна в Telegram'); if(busy)return;
  const yes=await UI.ask({ic:'🌍',t:'Опублікувати роботу?',d:'Це фото або GIF побачать усі гравці, не лише друзі. Переконайся, що маєш право ним ділитися і воно не містить того, що хочеш приховати. Ім’я Telegram та особиста аватарка не показуються. Після видалення копії можуть залишитися в інших.',ok:'Опублікувати',cancel:'Скасувати'});if(!yes)return;
  busy=true;try{let b={hero:Store.S.hero.id};if(src.t==='file'){b.kind='file';b.image=jpeg(src);}else if(src.t==='pic'){b.kind='pic';b.pid=src.pid;}else if(src.t==='bot'){b.kind=Media.kindOf(src.m)==='g'?'botGif':'botPhoto';b.d=src.m.d;b.s=src.m.s;}else throw Error('image');await request('publish',b);UI.toast('🖼️ Роботу додано до публічної вітрини');mode='mine';list=null;last=0;}catch(e){UI.toast(messages[e.message]||'Не вдалося опублікувати. Спробуй ще раз.');}finally{busy=false;}
 }
 const hero=h=>(DATA.HEROES.find(x=>x.id===h)||DATA.HEROES[0]).e;
 const image=x=>x.kind==='pic'?DATA.img(x.pid,600):'/api/showcase?op=media&id='+encodeURIComponent(x.id);
 UI.R.showcase=()=>{
  let title=mode==='mine'?'Моя вітрина':mode==='profile'?'Вітрина гравця':'Публічна вітрина';
  let html='<div class="h1">'+title+'</div><div class="sub">Роботи гравців видно всім. Імена та особисті аватарки залишаються приватними. Публікуй лише доречні роботи, якими маєш право ділитися.</div><div class="seg"><button data-a="showFeed" class="'+(mode==='feed'?'on':'')+'">🌍 Усі роботи</button><button data-a="showMine" class="'+(mode==='mine'?'on':'')+'">🖼️ Мої роботи</button></div>';
  if(mode==='mine')html+='<div class="show-note">Додай роботу після успішного складання пазла. До 12 робіт; будь-яку можна прибрати. Старі фото, які не були збережені, треба скласти знову.</div>';
  if(error)html+='<div class="empty">'+esc(error)+'<button class="btn btn-s mt" data-a="showReload">Повторити</button></div>';
  else if(list===null)html+='<div class="empty">Завантаження…</div>';
  else if(!list.length)html+='<div class="empty">Тут поки немає робіт.</div>';
  else html+='<div class="show-grid">'+list.map((x,i)=>'<article class="show-card">'+(x.hidden?'<div class="show-hidden">Приховано після скарг</div>':x.kind==='botGif'?'<video muted loop autoplay playsinline preload="metadata" src="'+esc(image(x))+'"></video>':'<img loading="lazy" src="'+esc(image(x))+'" alt="Складений пазл">')+'<div class="show-meta"><button class="show-author" data-a="showProfile" data-v="'+i+'">'+hero(x.hero)+' '+esc(x.alias)+'</button><span>'+(x.kind==='botGif'?'GIF':'Фото')+'</span></div><div class="show-actions">'+(mode==='mine'?'<button data-a="showRemove" data-v="'+i+'">Прибрати</button>':'<button data-a="showReport" data-v="'+i+'">Поскаржитись</button>')+'</div></article>').join('')+'</div>';
  if(mode==='profile')html+='<button class="btn btn-s mt" data-a="showFeed">← Усі роботи</button>';
  html+='<button class="btn btn-s mt" data-go="home">← На головну</button>';document.getElementById('showcaseW').innerHTML=html;
  if(list===null&&!loading)load();
 };
 async function remove(i){const x=list&&list[+i];if(!x)return;if(!await UI.ask({ic:'🗑️',t:'Прибрати роботу?',d:'Її буде прибрано з вітрини. В інших користувачів можуть залишитися копії.',ok:'Прибрати',danger:1}))return;try{await request('remove',{id:x.id});UI.toast('Роботу прибрано');list=null;load();UI.refresh();}catch(e){UI.toast('Не вдалося прибрати роботу');}}
 async function report(i){const x=list&&list[+i];if(!x)return;if(!signed())return UI.toast('Відкрий гру в Telegram, щоб надіслати скаргу');if(!await UI.ask({ic:'🚩',t:'Поскаржитися на роботу?',d:'Скарга допоможе приховати неприйнятний контент.',ok:'Надіслати скаргу'}))return;try{await request('report',{id:x.id});UI.toast('Скаргу надіслано');list=null;load();}catch(e){UI.toast('Не вдалося надіслати скаргу');}}
 Object.assign(UI.A,{showMineOpen:()=>{if(!signed())return UI.toast('Відкрий гру через Telegram');mode='mine';profile='';list=null;error='';token++;UI.show('showcase');},showFeed:()=>switchTo('feed'),showMine:()=>signed()?switchTo('mine'):UI.toast('Відкрий гру через Telegram'),showProfile:i=>{const x=list&&list[+i];if(x)switchTo('profile',x.profile);},showRemove:remove,showReport:report,showReload:()=>{list=null;load();UI.refresh();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&UI.cur==='showcase')load();});setInterval(()=>{if(!document.hidden&&UI.cur==='showcase'&&Date.now()-last>30000)load();},30000);
 return {publish};
})();
