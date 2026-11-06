/* A playful collection of in-game rewards. No cash purchases, transfers or redemption. */
'use strict';
const Cases = (() => {
 const boxes=[
  {id:'spark',name:'Іскра',tag:'Перші знахідки',price:75,ic:'💠',style:'spark',items:[
   {name:'2 підказки',ic:'💡',kind:'hint',n:2,p:35,tier:'Звичайна'}, {name:'5 підказок',ic:'💡',kind:'hint',n:5,p:25,tier:'Корисна'},
   {name:'50 монет',ic:'🪙',kind:'coin',n:50,p:20,tier:'Корисна'}, {name:'100 монет',ic:'💰',kind:'coin',n:100,p:15,tier:'Рідкісна'},
   {name:'Тема «Неон»',ic:'🌈',kind:'theme',id:'neon',duplicate:100,p:5,tier:'Особлива'}]},
  {id:'voyage',name:'Мандрівка',tag:'Більше можливостей',price:200,ic:'🧭',style:'voyage',items:[
   {name:'5 підказок',ic:'💡',kind:'hint',n:5,p:30,tier:'Звичайна'}, {name:'100 монет',ic:'🪙',kind:'coin',n:100,p:25,tier:'Корисна'},
   {name:'10 підказок',ic:'🔆',kind:'hint',n:10,p:20,tier:'Корисна'}, {name:'Тема «Захід»',ic:'🌅',kind:'theme',id:'sunset',duplicate:150,p:15,tier:'Рідкісна'},
   {name:'Рамка «Неонова»',ic:'✨',kind:'frame',id:'neon',duplicate:200,p:10,tier:'Особлива'}]},
  {id:'orbit',name:'Орбіта',tag:'Рідкісні кольори',price:450,ic:'🌌',style:'orbit',items:[
   {name:'10 підказок',ic:'🔆',kind:'hint',n:10,p:35,tier:'Звичайна'}, {name:'200 монет',ic:'💰',kind:'coin',n:200,p:25,tier:'Корисна'},
   {name:'Тема «Золото»',ic:'🌟',kind:'theme',id:'gold',duplicate:300,p:20,tier:'Рідкісна'}, {name:'Рамка «Галактика»',ic:'🌌',kind:'frame',id:'galaxy',duplicate:400,p:15,tier:'Особлива'},
   {name:'Рамка «Діамантова»',ic:'💎',kind:'frame',id:'diamond',duplicate:600,p:5,tier:'Легендарна'}]}
 ];
 let selected='spark',busy=false;
 const el=id=>document.getElementById(id), S=()=>Store.S;
 function choose(items){
  if(!window.crypto||!window.crypto.getRandomValues)throw Error('random');
  const buf=new Uint32Array(1);let n;do{window.crypto.getRandomValues(buf);n=buf[0];}while(n>=4294967200);
  let x=n%100;for(const p of items){if(x<p.p)return p;x-=p.p;}throw Error('weights');
 }
 function apply(p){
  if(p.kind==='hint'){S().inv.hint+=p.n;return p.name;}
  if(p.kind==='coin'){Prog.addCoins(p.n);return p.name;}
  const field=p.kind==='frame'?'frames':'themes',own=S().cos[field];
  if(own.includes(p.id)){Prog.addCoins(p.duplicate);return p.name+' · повтор: '+p.duplicate+' 🪙';}
  own.push(p.id);return p.name;
 }
 const prize=p=>'<div class="case-prize"><span class="case-prize-icon">'+p.ic+'</span><span class="case-prize-text"><b>'+p.name+'</b><small>'+p.tier+(p.duplicate?' · повтор: '+p.duplicate+' 🪙':'')+'</small></span><strong>'+p.p+'%</strong></div>';
 UI.R.cases=()=>{
  const box=boxes.find(b=>b.id===selected)||boxes[0],last=S().caseLast;
  let x='<div class="case-heading"><div><div class="case-eyebrow">ФОТО ПАЗЛ · КОЛЕКЦІЯ</div><div class="h1">Майстерня скарбів</div><div class="sub">Обирай кейс та відкривай ігрові нагороди</div></div>'+UI.coinsPill()+'</div>';
  x+='<div class="case-picker" aria-label="Обери кейс">'+boxes.map(b=>'<button class="case-choice '+b.style+(b.id===box.id?' chosen':'')+'" data-a="caseSelect" data-v="'+b.id+'" aria-pressed="'+(b.id===box.id)+'"><span class="case-sigil">'+b.ic+'</span><b>'+b.name+'</b><small>'+b.price+' 🪙</small></button>').join('')+'</div>';
  x+='<div class="case-panel '+box.style+'"><div class="case-panel-top"><div><span class="case-eyebrow">КЕЙС · '+box.tag.toUpperCase()+'</span><h2>'+box.name+'</h2><p>Одна нагорода за кожне відкриття</p></div><div class="case-emblem" aria-hidden="true">'+box.ic+'</div></div>';
  x+='<button class="btn btn-g case-open" data-a="caseOpen">Відкрити за '+box.price+' 🪙</button><div class="case-caption">Тільки ігрові монети · без реальних грошей</div></div>';
  x+='<div class="case-section-head"><b>Що всередині</b><span>Шанс кожної нагороди</span></div><div class="case-prizes">'+box.items.map(prize).join('')+'</div>';
  x+='<div class="case-help">Ймовірності діють на кожне відкриття окремо. Повторна тема чи рамка автоматично перетвориться на зазначені монети. Знайдене оформлення доступне у профілі.</div>';
  if(last&&typeof last.name==='string')x+='<div class="case-last"><span>Остання знахідка</span><b>'+UI.esc(last.name)+'</b></div>';
  x+='<button class="btn btn-s mt" data-go="home">← На головну</button>';el('casesW').innerHTML=x;
 };
 function open(){
  if(busy)return;const box=boxes.find(b=>b.id===selected);if(!box)return;
  if(S().coins<box.price){UI.hap('err');return UI.toast('Не вистачає ігрових монет 🪙');}
  let winner;try{winner=choose(box.items)}catch(_){return UI.toast('Не вдалося відкрити кейс на цьому пристрої');}
  busy=true;Prog.spend(box.price);const description=apply(winner);S().stats.cases=(S().stats.cases||0)+1;S().caseLast={name:description,box:box.id,at:Date.now()};Store.save(true);Prog.emit();
  let closed=false;const seq=Array.from({length:32},(_,i)=>i===25?winner:box.items[Math.floor(Math.random()*box.items.length)]);
  const b=UI.modal('<div class="case-reveal"><div class="case-eyebrow">МАЙСТЕРНЯ СКАРБІВ</div><h3>Відкриваємо «'+box.name+'»</h3><p>Нагороду вже збережено у твоєму прогресі</p><div class="reel-window"><div class="reel-pointer"></div><div class="reel-track">'+seq.map((p,i)=>'<div class="reel-item"'+(i===25?' id="reelWinner"':'')+'><span>'+p.ic+'</span><small>'+p.name+'</small></div>').join('')+'</div></div><div class="case-result" id="caseResult" aria-live="polite">Знаходимо нагороду…</div><button class="btn btn-s" data-close>Закрити</button></div>',{onClose:()=>{closed=true;busy=false;}});
  const track=b.querySelector('.reel-track'), win=b.querySelector('#reelWinner'), windowEl=b.querySelector('.reel-window');
  const target=win.offsetLeft+win.offsetWidth/2-windowEl.clientWidth/2;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{track.style.transform='translateX(-'+target+'px)';}));Soundscape.play('place');
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(()=>{if(closed)return;el('caseResult').innerHTML='<span class="case-result-label">'+winner.tier+' знахідка</span><strong>'+UI.esc(description)+'</strong>';Soundscape.play('reward');UI.hap('ok');UI.confetti(30);busy=false;},reduced?100:3700);
 }
 UI.A.caseSelect=id=>{if(boxes.some(b=>b.id===id)){selected=id;UI.hap('sel');UI.refresh();}};
 UI.A.caseOpen=open;
 return {boxes,open,get busy(){return busy;}};
})();
