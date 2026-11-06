/* Player-uploaded avatars are visible only to mutually confirmed friends. */
'use strict';
const Avatars=(()=>{
 let self='', generation=0, busy=false;const cache={};
 const src=x=>typeof x==='string'&&x.length>=20&&x.length<=40000&&/^[A-Za-z0-9+/]+={0,2}$/.test(x)?'data:image/jpeg;base64,'+x:'';
 const face=(x,fallback)=>src(x)?'<img src="'+src(x)+'" alt="">':fallback;
 async function init(){if(!TG||!TG.initData)return;const g=++generation;try{const r=await Arena.api('avatarGet',{});if(g!==generation)return;self=(r.avatars||{})['t'+Store.uid]||'';if(UI.cur==='home'||UI.cur==='profile')UI.refresh();}catch(e){}}
 async function loadFriends(ids){if(!ids.length)return;try{for(let i=0;i<ids.length;i+=20){const group=ids.slice(i,i+20), r=await Arena.api('avatarGet',{ids:group});group.forEach(id=>delete cache[id]);Object.assign(cache,r.avatars||{});}}catch(e){} }
 function selected(){if(!TG||!TG.initData)return UI.toast('Відкрий гру через Telegram');if(busy)return;document.getElementById('avatarFile').click();}
 async function compress(file){
  if(!file || !/^image\//i.test(file.type) || file.size>12*1024*1024)throw Error('file');
  const url=URL.createObjectURL(file),im=new Image();
  try{await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=url;});
   const w=im.naturalWidth,h=im.naturalHeight;if(!w||!h||w*h>60000000)throw Error('file');
   const crop=Math.min(w,h),sx=(w-crop)/2,sy=(h-crop)/2;
   for(const size of [192,160,128])for(const quality of [.8,.65,.5]){
    const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');if(!ctx)throw Error('file');
    ctx.fillStyle='#111e34';ctx.fillRect(0,0,size,size);ctx.drawImage(im,sx,sy,crop,crop,0,0,size,size);
    const d=c.toDataURL('image/jpeg',quality);if(d.startsWith('data:image/jpeg;base64,')&&d.length<=40022)return d.slice(23);
   }throw Error('file');
  }finally{URL.revokeObjectURL(url);}
 }
 async function saveFile(file){
  if(!file||busy)return;busy=true;
  try{const image=await compress(file);await Arena.api('avatarSet',{image},12000);++generation;self=image;UI.refresh();UI.toast('Аватарку збережено. Її бачать лише друзі.');}
  catch(e){UI.toast(e.message==='busy'?'Зачекай кілька секунд і спробуй знову':e.message==='file'?'Обери зображення до 12 МБ, яке підтримує пристрій':'Не вдалося зберегти аватарку');}
  finally{busy=false;}
 }
 async function remove(){
  if(!self||busy)return;
  if(!(await UI.ask({ic:'🖼️',t:'Видалити аватарку?',d:'Друзі знову бачитимуть іконку твого героя.',ok:'Видалити',danger:1})))return;
  busy=true;try{await Arena.api('avatarDelete');++generation;self='';UI.refresh();UI.toast('Аватарку видалено');}catch(e){UI.toast('Не вдалося видалити аватарку');}finally{busy=false;}
 }
 const input=document.getElementById('avatarFile');input.addEventListener('change',()=>{const f=input.files&&input.files[0];input.value='';saveFile(f);});
 Object.assign(UI.A,{avatarPick:selected,avatarRemove:remove});
 return {init,loadFriends,face,src,get self(){return self;},get cache(){return cache;}};
})();
