/* Private player avatars. Only the owner and mutual friends may read them. */
import {cmd,pipe} from './kv.js';
export function validAvatar(s){
 if(typeof s!=='string'||s.length<20||s.length>40000||s.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))return false;
 const b=Buffer.from(s,'base64');return b.length<=30000&&b.length>=10&&b[0]===255&&b[1]===216&&b[b.length-2]===255&&b[b.length-1]===217&&b.toString('base64')===s;
}
export async function avatarMap(viewer,ids){
 const unique=[...new Set((Array.isArray(ids)?ids:[]).filter(x=>typeof x==='string'&&/^t[0-9]+$/.test(x)))].slice(0,20);
 const others=unique.filter(x=>x!==viewer), checks=others.length?await pipe(others.flatMap(id=>[['SISMEMBER','friends:'+viewer,id],['SISMEMBER','friends:'+id,viewer]])):[];
 const allowed=unique.filter(id=>id===viewer||(()=>{const i=others.indexOf(id);return checks[i*2]&&checks[i*2+1];})());
 if(!allowed.length)return {};
 const values=await cmd('MGET',...allowed.map(id=>'avatar:'+id)), out={};
 allowed.forEach((id,i)=>{if(validAvatar(values[i]))out[id]=values[i];});return out;
}
