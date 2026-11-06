/* Four-player invite rooms. Identity is verified with Telegram, never guest identifiers. */
import { cmd, pipe, jget, jset, parse, hasKV } from './_lib/kv.js';
import { checkInit } from './_lib/tg.js';
import { alias, rid, rnd, readJson } from './_lib/util.js';
import { refreshFriendIdentity, friendIdentities, friendLabel } from './_lib/friend-identity.js';
import {avatarMap} from './_lib/avatars.js';
const SLOT = ['a0','a1','b0','b1'], TTL = 900, NOW = () => Date.now();
const HERO = ['fox','owl','bear','cat','robot','dragon','uni'];
const SKILLS = ['shuffle','fog','shield','claws','freeze','fire','rainbow'];
const PICS = [1069,896,525,287,1015,701,28,976,360,429,503,639,859,376,857,164,133,437,979,799,951,165,881,580,585,34,955,402,464,21,855];
const num = (x,a,b) => Math.max(a,Math.min(b,Number(x)||0));
const roomkey = c => 'team:'+c, key = (c,slot) => roomkey(c)+':slot:'+slot;
const valid = code => /^[a-zA-Z0-9]{24}$/.test(code || '');
const profile = async (uid,b) => {
 const u = await jget('u:'+uid) || {};
 return { uid, a:u.a || alias(uid), h:HERO.includes(b.hero)?b.hero:(u.h||'fox'), l:num(b.lvl||u.lv||1,1,200), hp:num(b.hp||u.hp||100,50,400), rt:num(u.rt||1000,100,5000) };
};
const participants = async c => (await cmd('MGET',...SLOT.map(s=>key(c,s)))).map(parse);
function mySlot(ps,uid){return SLOT.find((s,i)=>ps[i] && ps[i].uid===uid);}
const clampState = (s,old) => {
 s=s&&typeof s==='object'?s:{}; old=old||{};
 const k=Array.isArray(s.k)?s.k.filter(x=>SKILLS.includes(x)).slice(0,30):[];
 const out={ p:num(s.p,old.p||0,16),d:num(s.d,old.d||0,1500),h:num(s.h,old.h||0,400),e:num(s.e,0,100),k:k.length>=(old.k||[]).length?k:(old.k||[]),x:old.x||(s.x?1:0),fT:old.fT||0,seen:NOW() };
 if(s.f&&out.p>=16&&!out.fT)out.fT=NOW(); return out;
};
const publicState = s => s ? {p:s.p||0,d:s.d||0,h:s.h||0,e:s.e||0,k:s.k||[],f:s.fT?1:0,x:s.x||0} : {p:0,d:0,h:0,e:0,k:[],f:0,x:0};
const cleanProf = p => ({a:p.a,h:p.h,l:p.l,hp:p.hp,rt:p.rt,avatar:p.avatar||null});
function match(c,room,ps,slot,t0) {
 const me=SLOT.indexOf(slot), side=slot[0], mate=me ^ 1, foes=side==='a'?[2,3]:[0,1];
 return {team:true,mid:c,side:slot,seed:room.seed,g:4,pid:room.pid,ranked:0,bot:0,t0:+t0,now:NOW(),ally:cleanProf(ps[mate]),opponents:foes.map(i=>cleanProf(ps[i])),opp:{a:ps[foes[0]].a+' + '+ps[foes[1]].a,h:ps[foes[0]].h,avatar:ps[foes[0]].avatar||null,l:Math.max(ps[foes[0]].l,ps[foes[1]].l),hp:ps[foes[0]].hp+ps[foes[1]].hp}};
}
async function decide(c,room,ps,states,t0) {
 const [A,B,C,D]=states.map(s=>s||{}), t=NOW();
 const ah=ps[0].hp+ps[1].hp-(C.d||0)-(D.d||0)+(A.h||0)+(B.h||0);
 const bh=ps[2].hp+ps[3].hp-(A.d||0)-(B.d||0)+(C.h||0)+(D.h||0);
 const gone=s=>s.x||(t>+t0+15000&&(!s.seen||t-s.seen>15000));
 const ag=gone(A)||gone(B), bg=gone(C)||gone(D); let w='',why='';
 if(ag||bg){w=ag&&bg?'d':ag?'b':'a';why='left';}
 else if(ah<=0||bh<=0){w=ah<=0&&bh<=0?'d':bh<=0?'a':'b';why='ko';}
 else if((A.fT&&B.fT)||(C.fT&&D.fT)){const at=A.fT&&B.fT?Math.max(A.fT,B.fT):Infinity,bt=C.fT&&D.fT?Math.max(C.fT,D.fT):Infinity;w=at===bt?'d':at<bt?'a':'b';why='done';}
 else if(t>+t0+186000){w=ah===bh?'d':ah>bh?'a':'b';why='time';}
 if(!w)return null;
 const r={w,why};const k=roomkey(c)+':result';
 if(!(await cmd('SET',k,JSON.stringify(r),'NX','EX',TTL)))return parse(await cmd('GET',k));
 return r;
}
const ops={
 async create(uid,b){
  const c=rid(24), p=await profile(uid,b), r={owner:uid,seed:rnd(2147483647),pid:PICS[rnd(PICS.length)]};
  await pipe([['SET',roomkey(c),JSON.stringify(r),'EX',TTL],['SET',key(c,'a0'),JSON.stringify(p),'EX',TTL],['SET',roomkey(c)+':user:'+uid,'a0','EX',TTL]]);
  return {code:c};
 },
 async join(uid,b){
  const c=String(b.code||''),side=b.side==='a'?'a':b.side==='b'?'b':'';if(!valid(c)||!side)return {err:'room'};
  const r=await jget(roomkey(c));if(!r)return {err:'expired'};if(await cmd('GET',roomkey(c)+':start'))return {err:'started'};
  const lk=roomkey(c)+':user:'+uid, existing=await cmd('GET',lk); if(existing)return {slot:existing};
  if(!(await cmd('SET',lk,'joining','NX','EX',TTL)))return {err:'busy'};
  const p=await profile(uid,b);let slot='';
  for(const s of SLOT.filter(s=>s[0]===side)){if(await cmd('SET',key(c,s),JSON.stringify(p),'NX','EX',TTL)){slot=s;break;}}
  if(!slot){await cmd('DEL',lk);return {err:'full'};}
  await cmd('SET',lk,slot,'EX',TTL);return {slot};
 },
 async lobby(uid,b){
  const c=String(b.code||'');if(!valid(c))return {err:'room'};
  const r=await jget(roomkey(c));if(!r)return {err:'expired'};const ps=await participants(c),slot=mySlot(ps,uid);if(!slot)return {err:'member'};
  const names=await friendIdentities(uid,ps.filter(Boolean).map(p=>p.uid));
  const shown=ps.map(p=>p?{...p,a:friendLabel(names[p.uid],p.a)}:null);
  if(ps.every(Boolean)){
   const sk=roomkey(c)+':start';await cmd('SET',sk,String(NOW()+12000),'NX','EX',TTL);const t=await cmd('GET',sk);const av=await avatarMap(uid,ps.map(p=>p.uid));shown.forEach(p=>p.avatar=av[p.uid]||null);return {match:match(c,r,shown,slot,t)};
  }
  return {wait:true,slot,players:shown.map(p=>p?{a:p.a,h:p.h,l:p.l}:null)};
 },
 async act(uid,b){
  const c=String(b.mid||'');if(!valid(c))return {err:'match'};const r=await jget(roomkey(c));if(!r)return {err:'expired'};
  const ps=await participants(c),slot=mySlot(ps,uid),t0=await cmd('GET',roomkey(c)+':start');if(!slot||!t0||!ps.every(Boolean))return {err:'match'};
  if(NOW()<+t0-2000)return {err:'not_started'};
  const k=roomkey(c)+':state:'+slot,old=await jget(k);await jset(k,clampState(b.s,old),TTL);
  const states=(await cmd('MGET',...SLOT.map(s=>roomkey(c)+':state:'+s))).map(parse),idx=SLOT.indexOf(slot),mate=idx^1,foes=slot[0]==='a'?[2,3]:[0,1];
  const saved=await jget(roomkey(c)+':result');
  return {ally:publicState(states[mate]),enemies:foes.map(i=>publicState(states[i])),r:saved||await decide(c,r,ps,states,t0)};
 },
 async leave(uid,b){
  const c=String(b.code||'');if(!valid(c))return {err:'room'};const r=await jget(roomkey(c));if(!r)return {ok:1};
  const ps=await participants(c),slot=mySlot(ps,uid);if(!slot)return {ok:1};
  if(await cmd('GET',roomkey(c)+':start')){const k=roomkey(c)+':state:'+slot,s=await jget(k)||{};s.x=1;s.seen=NOW();await jset(k,s,TTL);}
  else if(r.owner===uid) await cmd('DEL',roomkey(c));
  else await pipe([['DEL',key(c,slot)],['DEL',roomkey(c)+':user:'+uid]]);
  return {ok:1};
 },
};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({err:'method'});
 if(!hasKV&&process.env.VERCEL)return res.status(200).json({err:'nokv'});
 const b=await readJson(req),u=checkInit(b.init),uid=u&&Number.isSafeInteger(u.id)&&u.id>0?'t'+u.id:null;
 if(!uid)return res.status(200).json({err:'telegram'});
 if(!Object.hasOwn(ops,b.op))return res.status(200).json({err:'op'});
 try{if(['create','join'].includes(b.op))await refreshFriendIdentity(uid,u);return res.status(200).json(await ops[b.op](uid,b));}catch(e){console.error('team',b.op,e);return res.status(200).json({err:'server'});}
}
