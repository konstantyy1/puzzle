/* Opt-in public puzzle showcase. Telegram identity and private avatars never leave the server. */
import {cmd,pipe,jget,jset,parse,hasKV} from './_lib/kv.js';
import {checkInit} from './_lib/tg.js';
import {alias,rid,sig,unb64u,readJson} from './_lib/util.js';
import media from './media.js';
const validId = s => /^[A-Za-z0-9]{24}$/.test(s||'');
const safeItem = (x, own=false) => ({id:x.id,profile:x.profile,kind:x.kind,alias:x.alias,hero:x.hero,pid:x.pid,created:x.created, ...(own?{hidden:!!x.hidden}: {})});
const hero = h => ['fox','owl','bear','cat','robot','dragon','uni'].includes(h)?h:'fox';
function validJpeg(s){if(typeof s!=='string'||s.length>134000||s.length<20||s.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))return false;const b=Buffer.from(s,'base64');return b.length<=100000&&b[0]===255&&b[1]===216&&b[b.length-2]===255&&b[b.length-1]===217&&b.toString('base64')===s;}
async function loadItems(key,limit,includeHidden=false){const ids=await cmd('ZREVRANGE',key,0,limit-1);if(!ids.length)return [];const [a,h]=await Promise.all([cmd('MGET',...ids.map(id=>'show:item:'+id)),cmd('MGET',...ids.map(id=>'show:hidden:'+id))]);return a.map((v,i)=>{const x=parse(v);if(x&&h[i])x.hidden=true;return x;}).filter(x=>x&&(includeHidden||!x.hidden));}
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  if(!hasKV&&process.env.VERCEL)return res.status(503).json({err:'nokv'});
  try {
    const q=req.query||{};
    if(req.method==='GET'){
      if(q.op==='feed')return res.json({list:(await loadItems('show:feed',100)).map(x=>safeItem(x))});
      if(q.op==='profile'&&validId(q.id)){const uid=await cmd('GET','show:profile:'+q.id);if(!uid)return res.json({list:[]});return res.json({list:(await loadItems('show:user:'+uid,12)).map(x=>safeItem(x))});}
      if(q.op==='media'&&validId(q.id)){
        const [x,hidden]=await Promise.all([jget('show:item:'+q.id),cmd('GET','show:hidden:'+q.id)]);if(!x||hidden)return res.status(404).send('not found');
        if(x.kind==='file'){const raw=await cmd('GET','show:data:'+x.id);if(!validJpeg(raw))return res.status(404).send('not found');res.setHeader('Content-Type','image/jpeg');return res.status(200).send(Buffer.from(raw,'base64'));}
        if(x.kind==='botPhoto'||x.kind==='botGif'){
          const set=res.setHeader.bind(res);res.setHeader=(k,v)=>set(k,String(k).toLowerCase()==='cache-control'?'private, no-store':v);
          req.query={d:x.d,s:x.s};return await media(req,res);
        }
      }
      return res.status(400).json({err:'bad'});
    }
    if(req.method!=='POST')return res.status(405).json({err:'method'});
    const b=await readJson(req), u=checkInit(b.init);if(!u||!Number.isSafeInteger(u.id)||u.id<=0)return res.status(401).json({err:'telegram'});
    const uid='t'+u.id;
    if(b.op==='mine')return res.json({list:(await loadItems('show:user:'+uid,12,true)).map(x=>safeItem(x,true))});
    if(b.op==='publish'){
      let kind=String(b.kind||''),data='';
      if(kind==='file'){data=b.image;if(!validJpeg(data))return res.status(400).json({err:'image'});}
      else if(kind==='botPhoto'||kind==='botGif'){if(typeof b.d!=='string'||b.d.length>1500||sig(b.d)!==b.s)return res.status(400).json({err:'image'});let info;try{info=JSON.parse(unb64u(b.d));}catch{}if(!info||!info.f||info.k!==(kind==='botGif'?'g':'p'))return res.status(400).json({err:'image'});}
      else if(kind==='pic'){if(!Number.isInteger(b.pid)||b.pid<0||b.pid>99999)return res.status(400).json({err:'image'});}
      else return res.status(400).json({err:'image'});
      if(!await cmd('SET','show:lock:'+uid,'1','NX','EX',4))return res.status(429).json({err:'busy'});
      if(await cmd('ZCARD','show:user:'+uid)>=12)return res.status(400).json({err:'limit'});
      let profile=await cmd('GET','show:pub:'+uid);if(!profile){profile=rid(24);await pipe([['SET','show:pub:'+uid,profile],['SET','show:profile:'+profile,uid]]);}
      const id=rid(24), created=Date.now(), x={id,owner:uid,profile,kind,alias:alias(uid),hero:hero(b.hero),created};
      if(kind==='pic')x.pid=b.pid;if(kind==='file')await cmd('SET','show:data:'+id,data);if(kind.startsWith('bot')){x.d=b.d;x.s=b.s;}
      await jset('show:item:'+id,x);await pipe([['ZADD','show:user:'+uid,created,id],['ZADD','show:feed',created,id]]);
      return res.json({ok:1,item:safeItem(x,true)});
    }
    if(b.op==='remove'&&validId(b.id)){const x=await jget('show:item:'+b.id);if(!x||x.owner!==uid)return res.status(403).json({err:'owner'});await pipe([['DEL','show:item:'+x.id,'show:data:'+x.id,'show:hidden:'+x.id],['ZREM','show:user:'+uid,x.id],['ZREM','show:feed',x.id]]);return res.json({ok:1});}
    if(b.op==='report'&&validId(b.id)){const x=await jget('show:item:'+b.id);if(!x||x.owner===uid)return res.status(400).json({err:'bad'});if(!await cmd('SET','show:report:'+x.id+':'+uid,'1','NX','EX',31536000))return res.json({ok:1});const count=await cmd('SADD','show:reports:'+x.id,uid);const n=(await cmd('SMEMBERS','show:reports:'+x.id)).length;if(n>=3)await cmd('SET','show:hidden:'+x.id,'1');return res.json({ok:1});}
    return res.status(400).json({err:'bad'});
  } catch(e){console.error('showcase error',e.message);return res.status(500).json({err:'server'});}
}
