/* Four-player, invite-only, unranked team rooms. */
'use strict';
const Team = (() => {
  let room=null, busy=false;
  const prof=()=>({hero:Store.S.hero.id,lvl:Prog.level(),hp:Prog.B.hp()});
  const signed=()=>!!(TG && TG.initData);
  const messages={telegram:'Відкрий гру через Telegram',expired:'Час запрошення минув або кімнату закрито',full:'У цій команді вже немає місць',started:'Бій уже розпочався',member:'Ти більше не в кімнаті',nokv:'Командний режим тимчасово недоступний',busy:'Спробуй ще раз за мить',room:'Некоректне запрошення'};
  async function api(op,body,ms){
    const ac=window.AbortController?new AbortController():null, t=setTimeout(()=>ac&&ac.abort(),ms||8000);
    try{const r=await fetch('/api/team',{method:'POST',headers:{'content-type':'application/json'},signal:ac?ac.signal:undefined,body:JSON.stringify(Object.assign({op,init:(TG&&TG.initData)||''},body||{}))}); if(!r.ok)throw Error('http'); const j=await r.json();if(j.err)throw Error(j.err);return j;}finally{clearTimeout(t);}
  }
  function fail(e){UI.toast(messages[e.message]||'Не вдалося з’єднатися з кімнатою');}
  function share(code){
    const url='https://t.me/'+UI.BOT+'?start=t_'+code, to='https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent('Приєднуйся до командного бою 2×2 у Фото Пазлі! 🧩');
    try{if(TG&&TG.openTelegramLink)TG.openTelegramLink(to);else window.open(to,'_blank','noopener');}catch(e){UI.toast('Не вдалося відкрити Telegram');}
  }
  function lobby(code){
    const q=room={code,closed:false,matched:false};
    const box=UI.modal('<div class="mic">🤝</div><h3>Командний бій 2×2</h3><p>Запроси трьох гравців за цим посиланням. Кожен обирає команду. Бій розпочнеться, коли приєднаються всі четверо.</p><div id="teamRoster" class="card">Завантаження…</div><button class="btn btn-g" id="teamShare">Поділитися запрошенням</button><div class="mut small tc mt">Без рейтингу · кімната діє до 15 хвилин</div><button class="btn btn-s mt" data-close>Покинути кімнату</button>',{sticky:true,onClose:()=>{q.closed=true;if(!q.matched)api('leave',{code}).catch(()=>{});if(room===q)room=null;}});
    box.querySelector('#teamShare').onclick=()=>share(code);
    async function poll(){
      if(q.closed)return;
      try{const r=await api('lobby',{code});if(q.closed)return;
        if(r.match){q.matched=true;UI.closeModal();Arena.start(r.match);return;}
        const p=r.players||[], row=(i)=>p[i]?UI.esc(p[i].a)+(r.slot===['a0','a1','b0','b1'][i]?' · ти':''):'Очікуємо гравця…';
        const el=box.querySelector('#teamRoster');if(el)el.innerHTML='<div class="h2">🔵 Команда 1</div><div class="rd">'+row(0)+'<br>'+row(1)+'</div><div class="h2 mt">🟠 Команда 2</div><div class="rd">'+row(2)+'<br>'+row(3)+'</div>';
      }catch(e){if(q.closed)return;if(['expired','member','room'].includes(e.message)){UI.closeModal();return fail(e);}}
      if(!q.closed)setTimeout(poll,1500);
    }poll();
  }
  async function create(){
    if(!signed())return UI.toast('Відкрий гру через Telegram');if(busy||room||Arena.M)return;busy=true;
    try{const r=await api('create',prof());lobby(r.code);}catch(e){fail(e);}finally{busy=false;}
  }
  function accept(code){
    if(!signed())return UI.toast('Відкрий посилання через Telegram');
    if(!/^[A-Za-z0-9]{24}$/.test(code||''))return UI.toast('Некоректне запрошення');
    const box=UI.modal('<div class="mic">🤝</div><h3>Бій 2×2</h3><p>Обери команду. У кожній команді по два гравці; бій без зміни рейтингу.</p><button class="btn btn-g" id="teamA">🔵 Команда 1</button><button class="btn btn-s" id="teamB">🟠 Команда 2</button><button class="btn btn-s" data-close>Скасувати</button>');
    async function join(side){if(busy)return;busy=true;try{await api('join',Object.assign({code,side},prof()));UI.closeModal();lobby(code);}catch(e){fail(e);}finally{busy=false;}}
    box.querySelector('#teamA').onclick=()=>join('a');box.querySelector('#teamB').onclick=()=>join('b');
  }
  UI.A.teamCreate=create;
  return {api,accept};
})();
