/* Public showcase is paused; existing works remain stored and removable by their owner. */
'use strict';
const Showcase=(()=>{
 const esc=UI.esc, signed=()=>!!(TG&&TG.initData);let list=null,loading=false,error='';
 async function request(op,data){const r=await fetch('/api/showcase',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({op,init:TG&&TG.initData||''},data||{}))});const j=await r.json();if(!r.ok||j.err)throw Error(j.err||'network');return j;}
 async function load(){if(loading||!signed())return;loading=true;error='';try{const j=await request('mine');list=j.list||[];}catch(e){error='Не вдалося завантажити список. Перевір з’єднання.';list=[];}finally{loading=false;if(UI.cur==='showcase')UI.refresh();}}
 function publish(){UI.toast('Публікацію тимчасово призупинено до впровадження перевірки.',4500);}
 UI.R.showcase=()=>{let x='<div class="h1">Вітрина на паузі</div><div class="show-note">Публічна вітрина та нові публікації тимчасово призупинені до впровадження перевірки. Роботи не видалено. Грати у власні пазли, як і раніше, можна.</div>';
 if(!signed())x+='<div class="empty">Відкрий гру в Telegram, щоб побачити список своїх робіт.</div>';
 else if(error)x+='<div class="empty">'+esc(error)+'<button class="btn btn-s mt" data-a="showReload">Повторити</button></div>';
 else if(list===null)x+='<div class="empty">Завантаження…</div>';
 else if(!list.length)x+='<div class="empty">У твоїй вітрині поки немає робіт.</div>';
 else x+='<div class="sl">Мої збережені роботи · '+list.length+'</div><div class="show-grid">'+list.map((w,i)=>'<article class="show-card"><div class="show-hidden">Перегляд призупинено</div><div class="show-meta"><span>'+(w.kind==='botGif'?'GIF':'Фото')+(w.hidden?' · приховано після скарг':'')+'</span></div><div class="show-actions"><button data-a="showRemove" data-v="'+i+'">Прибрати</button></div></article>').join('')+'</div>';
 x+='<button class="btn btn-s mt" data-go="home">← На головну</button>';document.getElementById('showcaseW').innerHTML=x;if(list===null&&!loading&&signed())load();};
 async function remove(i){const w=list&&list[+i];if(!w)return;if(!await UI.ask({ic:'🗑️',t:'Прибрати роботу?',d:'Роботу буде видалено з вітрини. Копії, які інші зберегли раніше, можуть залишитися.',ok:'Прибрати',danger:1}))return;try{await request('remove',{id:w.id});UI.toast('Роботу прибрано');list=null;load();UI.refresh();}catch(e){UI.toast('Не вдалося прибрати роботу');}}
 Object.assign(UI.A,{showMineOpen:()=>{list=null;error='';UI.show('showcase');},showRemove:remove,showReload:()=>{list=null;load();UI.refresh();}});
 async function getProfile(id){const r=await fetch('/api/showcase?op=profile&id='+encodeURIComponent(id),{cache:'no-store'}),j=await r.json();if(!r.ok||j.err)throw Error(j.err||'network');return j;}
 function renderImage(){return '<div class="show-hidden">Перегляд призупинено</div>';}
 return {publish,getProfile,renderImage};
})();
