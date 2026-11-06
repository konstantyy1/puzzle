/* Case rewards use in-game progress only: no real-money purchases, transfer or redemption. */
'use strict';
const Cases=(()=>{
 const h=(n,w)=>({name:n+' '+UI.plural(n,'підказка','підказки','підказок'),ic:'💡',kind:'hint',n,w});
 const c=(n,w)=>({name:n+' монет',ic:'🪙',kind:'coin',n,w});
 const x=(n,w)=>({name:n+' XP',ic:'✨',kind:'xp',n,w});
 const t=(id,name,ic,w,duplicate)=>({name:'Тема «'+name+'»',ic,kind:'theme',id,w,duplicate});
 const f=(id,name,ic,w,duplicate)=>({name:'Рамка «'+name+'»',ic,kind:'frame',id,w,duplicate});
 const g=(id,name,ic,w,duplicate)=>({name:'Герой «'+name+'»',ic,kind:'hero',id,w,duplicate});
 // Integer weights out of 1,000,000 keep published probabilities exact.
 const boxes=[
  {id:'spark',name:'Іскра',tag:'Перші знахідки',price:75,ic:'💠',style:'spark',items:[h(2,3500),h(5,2500),c(50,2000),x(45,1300),c(100,500),t('neon','Неон','🌈',180,100),f('prism','Призма','🔷',19,200),f('aurora','Аврора','🌌',1,400)]},
  {id:'grove',name:'Ліс',tag:'Тихі скарби',price:120,ic:'🌿',style:'grove',items:[h(4,3500),c(80,2500),x(60,2000),h(8,1300),t('lagoon','Лагуна','🌊',500,140),g('owl','Сова Мудрила','🦉',180,250),f('prism','Призма','🔷',19,200),t('stardust','Зоряний пил','🌠',1,500)]},
  {id:'voyage',name:'Мандрівка',tag:'Нові горизонти',price:200,ic:'🧭',style:'voyage',items:[h(5,3000),c(100,2500),x(100,2200),h(10,1400),t('sunset','Захід','🌅',600,150),f('neon','Неонова','✨',250,200),g('cat','Кіт Мурчик','🐱',45,450),t('nebula','Туманність','🌌',5,600)]},
  {id:'ember',name:'Жар',tag:'Вогняні знахідки',price:350,ic:'🔥',style:'ember',items:[h(8,3000),c(200,2500),x(160,2200),h(15,1400),t('ember','Жар','🔥',600,250),f('fire','Вогняна','🌋',250,400),g('bear','Ведмідь Бурмило','🐻',45,400),f('eclipse','Затемнення','🌑',5,800)]},
  {id:'orbit',name:'Орбіта',tag:'Космічна колекція',price:450,ic:'🌌',style:'orbit',items:[h(10,3000),c(240,2500),x(200,2200),h(20,1400),t('nebula','Туманність','🌌',600,350),f('galaxy','Галактика','🌠',250,500),f('diamond','Діамантова','💎',45,700),t('darkmatter','Темна матерія','🌑',5,1000)]},
  {id:'prism',name:'Призма',tag:'Гра кольорів',price:700,ic:'🔮',style:'prism',items:[h(15,2500),c(350,2500),x(300,2200),h(25,1500),t('stardust','Зоряний пил','🌠',800,500),f('prism','Призма','🔷',400,350),g('robot','Робот Біп','🤖',90,650),f('aurora','Аврора','🌌',10,850)]},
  {id:'myth',name:'Міф',tag:'Легенди чекають',price:1200,ic:'🐉',style:'myth',items:[h(25,2500),c(600,2500),x(500,2200),h(40,1500),f('eclipse','Затемнення','🌑',800,750),t('gold','Золото','🌟',400,500),g('dragon','Дракон Жар','🐉',90,1000),t('darkmatter','Темна матерія','🌑',10,1200)]},
  {id:'singularity',name:'Космос',tag:'За межами відомого',price:2500,ic:'🌠',style:'singularity',items:[h(45,2500),c(1200,2500),x(1000,2200),h(70,1500),f('aurora','Аврора','🌌',800,1200),t('stardust','Зоряний пил','🌠',400,1000),g('uni','Єдиноріг Мрія','🦄',90,1600),f('singularity','Сингулярність','💫',10,2500)]}
 ];
 // Convert common tiers to millionths, then set ultra-rare odds.
 for(const box of boxes) for(const item of box.items) item.w*=100;
 for(const [id,weight] of [['myth',10],['singularity',1]]){const b=boxes.find(x=>x.id===id),item=b.items[b.items.length-1];b.items[0].w+=item.w-weight;item.w=weight;}
 let selected='spark',busy=false;
 const el=id=>document.getElementById(id), S=()=>Store.S;
 const chance=p=>String(p.w/10000).replace('.',',')+'%';
 const rarity=p=>p.w<=1?'Унікальна':p.w<=10?'Міфічна':p.w<=1000?'Легендарна':p.w<=5000?'Епічна':p.w<=50000?'Рідкісна':'Звичайна';
 function roll(items){
  if(!window.crypto||!window.crypto.getRandomValues)throw Error('random');
  const buf=new Uint32Array(1);let n;do{window.crypto.getRandomValues(buf);n=buf[0];}while(n>=4294000000);
  let r=n%1000000;for(const p of items){if(r<p.w)return p;r-=p.w;}throw Error('weights');
 }
 function apply(p){
  if(p.kind==='hint'){S().inv.hint+=p.n;return {text:p.name};}
  if(p.kind==='coin'){Prog.addCoins(p.n);return {text:p.name};}
  if(p.kind==='xp'){const a=Prog.addXP(p.n);return {text:'+'+a.xp+' XP',ups:a.ups};}
  const own=p.kind==='hero'?S().hero.owned:S().cos[p.kind==='frame'?'frames':'themes'];
  if(own.includes(p.id)){Prog.addCoins(p.duplicate);return {text:p.name+' · повтор: '+p.duplicate+' 🪙'};}
  own.push(p.id);if(p.kind==='hero')S().hero.xp[p.id]=S().hero.xp[p.id]||0;return {text:p.name};
 }
 const prize=p=>'<div class="case-prize"><span class="case-prize-icon">'+p.ic+'</span><span class="case-prize-text"><b>'+p.name+'</b><small>'+rarity(p)+(p.duplicate?' · повтор: '+p.duplicate+' 🪙':'')+'</small></span><strong>'+chance(p)+'</strong></div>';
 UI.R.cases=()=>{
  const box=boxes.find(b=>b.id===selected)||boxes[0],last=S().caseLast,mode=S().set.caseMotion||'auto';
  let out='<div class="case-heading"><div><div class="case-eyebrow">ФОТО ПАЗЛ · КОЛЕКЦІЯ</div><div class="h1">Майстерня скарбів</div><div class="sub">8 кейсів · від звичайних до унікальних знахідок</div></div>'+UI.coinsPill()+'</div>';
  out+='<div class="case-picker" aria-label="Обери кейс">'+boxes.map(b=>'<button class="case-choice '+b.style+(b.id===box.id?' chosen':'')+'" data-a="caseSelect" data-v="'+b.id+'" aria-pressed="'+(b.id===box.id)+'"><span class="case-sigil">'+b.ic+'</span><b>'+b.name+'</b><small>'+b.price+' 🪙</small></button>').join('')+'</div>';
  out+='<div class="case-panel '+box.style+'"><div class="case-panel-top"><div><span class="case-eyebrow">КЕЙС · '+box.tag.toUpperCase()+'</span><h2>'+box.name+'</h2><p>Одна нагорода за відкриття</p></div><div class="case-emblem" aria-hidden="true">'+box.ic+'</div></div>';
  out+='<button class="btn btn-g case-open" data-a="caseOpen">Відкрити за '+box.price+' 🪙</button><div class="case-caption">Тільки ігрові монети · без реальних грошей</div></div>';
  out+='<div class="case-motion"><b>Анімація відкриття</b><div class="motion-choices">'+[['auto','Авто'],['full','Повна'],['off','Без руху']].map(([v,n])=>'<button data-a="caseMotion" data-v="'+v+'" class="'+(v===mode?'selected':'')+'" aria-pressed="'+(v===mode)+'">'+n+'</button>').join('')+'</div><small>«Авто» враховує налаштування руху пристрою. Обери «Повна», якщо хочеш бачити прокрутку.</small></div>';
  out+='<div class="case-section-head"><b>Що всередині</b><span>Шанс кожної нагороди</span></div><div class="case-prizes">'+box.items.map(prize).join('')+'</div>';
  out+='<div class="case-help">Кожне відкриття незалежне: рідкісна нагорода не гарантована. Повтор героя, теми чи рамки перетворюється на вказані монети. Знайдене оформлення — у профілі.</div>';
  if(last&&typeof last.name==='string')out+='<div class="case-last"><span>Остання знахідка</span><b>'+UI.esc(last.name)+'</b></div>';
  const hist=Array.isArray(S().caseHistory)?S().caseHistory.slice(0,5):[];if(hist.length)out+='<div class="case-section-head"><b>Історія знахідок</b></div><div class="case-history">'+hist.map(q=>'<div><span>'+UI.esc(q.boxName||'Кейс')+'</span><b>'+UI.esc(q.name||'')+'</b></div>').join('')+'</div>';
  out+='<button class="btn btn-s mt" data-go="home">← На головну</button>';el('casesW').innerHTML=out;
 };
 function open(){
  if(busy)return;const box=boxes.find(b=>b.id===selected);if(!box)return;
  if(S().coins<box.price){UI.hap('err');return UI.toast('Не вистачає ігрових монет 🪙');}
  let winner,sequence;try{winner=roll(box.items);sequence=Array.from({length:36},(_,i)=>i===29?winner:roll(box.items));}catch(_){return UI.toast('Не вдалося відкрити кейс на цьому пристрої');}
  busy=true;Prog.spend(box.price);const result=apply(winner);S().stats.cases=(S().stats.cases||0)+1;if(winner.w<=50000)S().stats.rareCases=(S().stats.rareCases||0)+1;
  const record={name:result.text,box:box.id,boxName:box.name,at:Date.now()};S().caseLast=record;S().caseHistory=[record,...(Array.isArray(S().caseHistory)?S().caseHistory:[])].slice(0,12);Store.save(true);Prog.emit();
  let closed=false,animation=null,timer=null;const mode=S().set.caseMotion||'auto';const reduced=mode==='off'||(mode==='auto'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const boxEl=UI.modal('<div class="case-reveal"><div class="case-eyebrow">МАЙСТЕРНЯ СКАРБІВ</div><h3>Відкриваємо «'+box.name+'»</h3><p>Нагороду вже збережено у твоєму прогресі</p><div class="reel-window"><div class="reel-pointer"></div><div class="reel-track">'+sequence.map((p,i)=>'<div class="reel-item"'+(i===29?' id="reelWinner"':'')+'><span>'+p.ic+'</span><small>'+p.name+'</small></div>').join('')+'</div></div><div class="case-result" id="caseResult" aria-live="polite">'+(reduced?'Налаштування пристрою: без прокрутки…':'Прокручуємо нагороди…')+'</div><button class="btn btn-s" data-close>Закрити</button></div>',{onClose:()=>{closed=true;busy=false;if(timer)clearTimeout(timer);if(animation)animation.cancel();if(result.ups&&result.ups.length)setTimeout(()=>UI.levelUp(result.ups),250);}});
  const track=boxEl.querySelector('.reel-track'),win=boxEl.querySelector('#reelWinner'),viewport=boxEl.querySelector('.reel-window');
  const target=win.offsetLeft+win.offsetWidth/2-viewport.clientWidth/2,finish=()=>{if(closed)return;el('caseResult').innerHTML='<span class="case-result-label">'+rarity(winner)+' · шанс '+chance(winner)+'</span><strong>'+UI.esc(result.text)+'</strong>';Soundscape.play('reward');UI.hap('ok');if(!reduced)UI.confetti(30);busy=false;};
  track.style.transition='none';
  if(reduced){track.style.transform='translateX(-'+target+'px)';timer=setTimeout(finish,1000);}
  else if(typeof track.animate==='function'){
   animation=track.animate([{transform:'translateX(0px)'},{transform:'translateX(-'+target+'px)'}],{duration:5200,easing:'cubic-bezier(.13,.72,.12,1)',fill:'forwards'});animation.finished.then(finish).catch(()=>{});Soundscape.play('place');
  }else{
   track.offsetWidth;requestAnimationFrame(()=>{if(closed)return;track.style.transition='transform 5.2s cubic-bezier(.13,.72,.12,1)';track.style.transform='translateX(-'+target+'px)';timer=setTimeout(finish,5300);});Soundscape.play('place');
  }
 }
 UI.A.caseSelect=id=>{if(boxes.some(b=>b.id===id)){selected=id;UI.hap('sel');UI.refresh();}};
 UI.A.caseMotion=id=>{if(['auto','full','off'].includes(id)){S().set.caseMotion=id;Store.save();UI.refresh();}};
 UI.A.caseOpen=open;
 return {boxes,open,get busy(){return busy;}};
})();
