/* Activate new code only when the player is safely idle at home. */
'use strict';
const GameUpdate=(()=>{
 const VERSION='17';let pending=false,lastAction=Date.now(),checking=false;
 for(const name of ['pointerdown','keydown','touchstart'])document.addEventListener(name,()=>{lastAction=Date.now();},{passive:true,capture:true});
 async function check(){
  if(checking||document.hidden)return;checking=true;
  try{const r=await fetch('/version.json?check='+Date.now(),{cache:'no-store'});if(!r.ok)return;const v=await r.json();if(v&&typeof v.version==='string'&&v.version!==VERSION)pending=true;}catch(_){}finally{checking=false;}
 }
 function apply(){
  if(!pending||document.hidden||UI.cur!=='home'||UI.modalOn||Arena.M||Cases.busy||Date.now()-lastAction<30000)return;
  Store.flush();location.reload();
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){check();if(typeof Avatars!=='undefined')Avatars.init();}});
 setInterval(()=>{check();apply();},30000);setTimeout(check,12000);
 return {check,apply,get pending(){return pending;}};
})();
