/* Private, signed Telegram handoff from chat buttons to the existing Mini App. */
import {cmd,jget,hasKV} from './_lib/kv.js';
import {checkInit} from './_lib/tg.js';
import {readJson} from './_lib/util.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');if(req.method!=='POST')return res.status(405).json({err:'method'});
 if(!hasKV&&process.env.VERCEL)return res.status(503).json({err:'nokv'});
 try{const b=await readJson(req),u=checkInit(b.init);if(!u||!Number.isSafeInteger(u.id)||u.id<=0)return res.status(401).json({err:'telegram'});const uid='t'+u.id;
  if(b.op==='poll'){const x=await jget('pick:pending:'+uid);if(!x||await cmd('GET','pick:done:'+uid+':'+x.id))return res.json({pending:null});return res.json({pending:x});}
  if(b.op==='ack'&&/^[A-Za-z0-9]{24}$/.test(String(b.id||''))){const x=await jget('pick:pending:'+uid);if(!x||x.id!==b.id)return res.json({ok:1});await cmd('SET','pick:done:'+uid+':'+b.id,'1','EX',86400);return res.json({ok:1});}
  return res.status(400).json({err:'bad'});
 }catch(e){console.error('queue error',e.message);return res.status(500).json({err:'server'});}
}
