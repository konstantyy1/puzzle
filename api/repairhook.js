/* Temporary authenticated webhook diagnosis and repair, removed after use. */
import crypto from 'node:crypto';
import {tg} from './_lib/tg.js';
import {hookSecret,readJson} from './_lib/util.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');const a=Buffer.from(process.env.PZ_REPAIR_KEY||''),b=Buffer.from(String(req.headers['x-repair-key']||''));
 if(req.method!=='POST'||!a.length||a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(403).json({err:'forbidden'});
 const body=await readJson(req);const me=await tg('getMe');if(!me.ok||String(me.result.username||'').toLowerCase()!=='fotopuzzle_bot')return res.status(502).json({err:'bot'});
 const info=await tg('getWebhookInfo');if(!info.ok)return res.status(502).json({err:'webhook-info'});
 const w=info.result,target='https://puzzle-omega-peach.vercel.app/api/bot';
 if(w.url!==target||w.has_custom_certificate)return res.status(409).json({err:'unexpected-webhook'});
 const allowed=w.allowed_updates||null;
 if(body.op==='inspect')return res.json({allowed,callbackEnabled:!allowed||allowed.includes('callback_query'),pending:w.pending_update_count,lastError:!!w.last_error_date});
 if(body.op!=='fix')return res.status(400).json({err:'op'});
 if(!allowed||allowed.includes('callback_query'))return res.json({ok:true,changed:false,allowed});
 const updated=[...new Set([...allowed,'callback_query'])];
 const r=await tg('setWebhook',{url:w.url,secret_token:hookSecret(),allowed_updates:updated,drop_pending_updates:false,max_connections:w.max_connections||40});
 if(!r.ok)return res.status(502).json({err:'set-webhook'});
 const check=await tg('getWebhookInfo');if(!check.ok||check.result.url!==target||!check.result.allowed_updates?.includes('callback_query'))return res.status(502).json({err:'verify-webhook'});
 return res.json({ok:true,changed:true,allowed:check.result.allowed_updates,pending:check.result.pending_update_count});
}
