/* Telegram chat selections are delivered to a running Mini App without opening another webview. */
'use strict';
const PuzzleInbox=(()=>{
 let checking=false,lastNotice='',done='',ackPending='';
 async function call(op,extra){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),8000);try{const r=await fetch('/api/queue',{method:'POST',headers:{'content-type':'application/json'},signal:ac.signal,body:JSON.stringify(Object.assign({op,init:TG&&TG.initData||''},extra||{}))});if(!r.ok)throw Error('network');return await r.json();}finally{clearTimeout(t);}}
 async function check(){
  if(checking||!TG||!TG.initData||document.hidden||TG.isActive===false)return;checking=true;
  try{if(ackPending){try{await call('ack',{id:ackPending});ackPending='';}catch(e){}}const r=await call('poll'),p=r.pending;if(!p||p.id===done)return;
   if(UI.cur!=='home'||UI.modalOn||Arena.M||Cases.busy){if(lastNotice!==p.id){lastNotice=p.id;UI.toast('🧩 Новий пазл чекає на головній');}return;}
   done=p.id;UI.openMedia(p);ackPending=p.id;try{await call('ack',{id:p.id});ackPending='';}catch(e){}
  }catch(e){}finally{checking=false;}
 }
 function start(){if(!TG||!TG.initData)return;setTimeout(check,1500);setInterval(check,6000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});try{if(TG.onEvent)TG.onEvent('activated',check);}catch(e){}}
 return {start,check};
})();
