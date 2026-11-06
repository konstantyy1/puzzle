/* Telegram names are stored separately from public anonymous arena profiles. */
import {cmd,pipe,jget,jset,parse} from './kv.js';
const safeName = v => String(typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
export async function refreshFriendIdentity(uid,u){
 if(!u || !uid.startsWith('t'))return;
 const name=[safeName(u.first_name),safeName(u.last_name)].filter(Boolean).join(' ').slice(0,120);
 const username=/^[a-zA-Z0-9_]{1,32}$/.test(u.username||'')?u.username:'';
 if(!name&&!username)return;
 const next={name,username}, old=await jget('friendid:'+uid);
 if(!old||old.name!==name||old.username!==username)await jset('friendid:'+uid,next);
}
/* Identity is disclosed only to the owner and to mutually confirmed friends. */
export async function friendIdentities(viewer,ids){
 const unique=[...new Set(ids.filter(Boolean))], others=unique.filter(id=>id!==viewer);
 const checks=others.length?await pipe(others.flatMap(id=>[['SISMEMBER','friends:'+viewer,id],['SISMEMBER','friends:'+id,viewer]])):[];
 const allowed=unique.filter(id=>id===viewer||(()=>{const i=others.indexOf(id);return checks[i*2]&&checks[i*2+1];})());
 if(!allowed.length)return {};
 const rows=await cmd('MGET',...allowed.map(id=>'friendid:'+id));
 const out={};allowed.forEach((id,i)=>{const p=parse(rows[i]);if(p)out[id]={name:safeName(p.name),username:/^[a-zA-Z0-9_]{1,32}$/.test(p.username||'')?p.username:''};});return out;
}
export const friendLabel = (p,fallback) => p && (p.name||p.username) ? (p.name||('@'+p.username))+(p.name&&p.username?' (@'+p.username+')':'') : fallback;
