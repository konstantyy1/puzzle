/* Player-uploaded avatars are visible only to mutually confirmed friends. */
'use strict';
const Avatars=(()=>{
 let self='', generation=0, busy=false;const cache={};
 const src=x=>typeof x==='string'&&x.length>=20&&x.length<=40000&&/^[A-Za-z0-9+/]+={0,2}$/.test(x)?'data:image/jpeg;base64,'+x:'';
 const face=(x,fallback)=>src(x)?'<img src="'+src(x)+'" alt="">':fallback;
 async function init(){if(!TG||!TG.initData)return;const g=++generation;try{const r=await Arena.api('avatarGet',{});if(g!==generation)return;self=(r.avatars||{})['t'+Store.uid]||'';if(UI.cur==='home'||UI.cur==='profile')UI.refresh();}catch(e){}}
 async function loadFriends(ids){if(!ids.length)return;try{for(let i=0;i<ids.length;i+=20){const group=ids.slice(i,i+20), r=await Arena.api('avatarGet',{ids:group});group.forEach(id=>delete cache[id]);Object.assign(cache,r.avatars||{});}}catch(e){} }
 function selected(){if(!TG||!TG.initData)return UI.toast('Відкрий гру через Telegram');if(busy)return;document.getElementById('avatarFile').click();}
 function menu(){
  const b=UI.modal('<div class="mic">🖼️</div><h3>Твій аватар</h3><p>Власне фото бачать лише підтверджені друзі. Для інших гравців залишається твій герой.</p><button class="btn btn-g" id="avatarChoose">'+(self?'Змінити фото':'Обрати фото')+'</button><button class="btn btn-s" id="avatarFrames">Обрати рамку</button>'+(self?'<button class="btn btn-s" id="avatarDelete">Видалити фото</button>':'')+'<button class="btn btn-s" data-close>Закрити</button>');
  b.querySelector('#avatarChoose').onclick=()=>{UI.closeModal();selected();};
  b.querySelector('#avatarFrames').onclick=()=>{UI.closeModal();if(UI.cur!=='profile')UI.show('profile');requestAnimationFrame(()=>{const x=document.getElementById('framesS');if(x)x.scrollIntoView({behavior:'smooth',block:'start'});});};
  if(self)b.querySelector('#avatarDelete').onclick=()=>{UI.closeModal();remove();};
 }
 async function saveFile(file){
  if(!file||busy)return;
  if(!/^image\//i.test(file.type)||file.size>12*1024*1024)return UI.toast('Обери зображення до 12 МБ');
  const url=URL.createObjectURL(file),im=new Image();
  try{await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=url;});if(!im.naturalWidth||!im.naturalHeight||im.naturalWidth*im.naturalHeight>60000000)throw Error('file');}
  catch(e){URL.revokeObjectURL(url);return UI.toast('Не вдалося відкрити зображення');}
  const b=UI.modal('<h3>Налаштуй аватар</h3><p>Посунь зображення і зміни масштаб. Друзі побачать результат у колі.</p><canvas class="avatar-crop-preview" id="avatarPreview" width="240" height="240" aria-label="Попередній перегляд аватарки"></canvas><label class="avatar-slider">Масштаб<input id="avatarZoom" type="range" min="1" max="3" step="0.01" value="1"></label><label class="avatar-slider">Горизонтально<input id="avatarX" type="range" min="0" max="100" value="50"></label><label class="avatar-slider">Вертикально<input id="avatarY" type="range" min="0" max="100" value="50"></label><div class="avatar-note">Анімоване зображення зберігається як статичний кадр.</div><button class="btn btn-g mt" id="avatarSave">Зберегти</button><button class="btn btn-s" data-close>Скасувати</button>',{onClose:()=>URL.revokeObjectURL(url)});
  const zoom=b.querySelector('#avatarZoom'),px=b.querySelector('#avatarX'),py=b.querySelector('#avatarY'),preview=b.querySelector('#avatarPreview');
  function draw(canvas){const w=im.naturalWidth,h=im.naturalHeight,crop=Math.min(w,h)/Number(zoom.value),sx=(w-crop)*Number(px.value)/100,sy=(h-crop)*Number(py.value)/100,ctx=canvas.getContext('2d');ctx.fillStyle='#111e34';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,sx,sy,crop,crop,0,0,canvas.width,canvas.height);}
  [zoom,px,py].forEach(x=>x.addEventListener('input',()=>draw(preview)));draw(preview);
  b.querySelector('#avatarSave').onclick=async()=>{if(busy)return;busy=true;b.querySelector('#avatarSave').disabled=true;try{let image='';for(const size of [192,160,128]){for(const quality of [.8,.65,.5]){const c=document.createElement('canvas');c.width=c.height=size;draw(c);const d=c.toDataURL('image/jpeg',quality);if(d.startsWith('data:image/jpeg;base64,')&&d.length<=40022){image=d.slice(23);break;}}if(image)break;}if(!image)throw Error('file');await Arena.api('avatarSet',{image},12000);++generation;self=image;UI.closeModal();UI.refresh();UI.toast('Аватарку збережено. Її бачать лише друзі.');}catch(e){UI.toast(e.message==='busy'?'Зачекай кілька секунд і спробуй знову':'Не вдалося зберегти аватарку');b.querySelector('#avatarSave').disabled=false;}finally{busy=false;}};
 }
 async function remove(){
  if(!self||busy)return;
  if(!(await UI.ask({ic:'🖼️',t:'Видалити аватарку?',d:'Друзі знову бачитимуть іконку твого героя.',ok:'Видалити',danger:1})))return;
  busy=true;try{await Arena.api('avatarDelete');++generation;self='';UI.refresh();UI.toast('Аватарку видалено');}catch(e){UI.toast('Не вдалося видалити аватарку');}finally{busy=false;}
 }
 const input=document.getElementById('avatarFile');input.addEventListener('change',()=>{const f=input.files&&input.files[0];input.value='';saveFile(f);});
 Object.assign(UI.A,{avatarMenu:menu,avatarPick:selected,avatarRemove:remove});
 return {init,loadFriends,face,src,get self(){return self;},get cache(){return cache;}};
})();
