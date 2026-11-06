import crypto from 'node:crypto';
import { TOKEN } from './util.js';

const API = process.env.TG_API || 'https://api.telegram.org';
export async function tg(method, params) {
  if (!TOKEN) return { ok: false, description: 'BOT_TOKEN не задано' };
  try {
    const r = await fetch(API + '/bot' + TOKEN + '/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params || {}) });
    return await r.json();
  } catch (e) { return { ok: false, description: String(e && e.message || e) }; }
}
export const fileUrl = p => API + '/file/bot' + TOKEN + '/' + p;
/* Telegram Mini App initData validation -> user object or null */
export function checkInit(init) {
  if (!init || !TOKEN || typeof init !== 'string' || init.length > 4096) return null;
  const p = new URLSearchParams(init), hash = p.get('hash'); if (!hash) return null;
  const key = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const calc = skip => [...p.entries()].filter(([k]) => !skip.includes(k)).map(([k, v]) => k + '=' + v).sort().join('\n');
  const ok = [['hash'], ['hash', 'signature']].some(skip => {
    const h = crypto.createHmac('sha256', key).update(calc(skip)).digest('hex');
    return h.length === hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
  });
  if (!ok) return null;
  const ad = +p.get('auth_date'); if (ad && Date.now() / 1000 - ad > 86400 * 30) return null;
  try { return JSON.parse(p.get('user') || 'null'); } catch { return null; }
}
