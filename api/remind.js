/* Daily cron (vercel.json -> crons): evening reminder about the daily puzzle for players who opted in */
import { cmd, pipe, hasKV } from './_lib/kv.js';
import { tg } from './_lib/tg.js';
import { appUrl, TOKEN } from './_lib/util.js';
import { kyivDay, kyivHour, dayGrid } from './_lib/day.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const sec = process.env.CRON_SECRET || '';
  if (sec && String(req.headers.authorization || '') !== 'Bearer ' + sec) return res.status(401).json({ err: 'auth' });
  if (!TOKEN || (!hasKV && process.env.VERCEL)) return res.status(200).json({ skip: 'config' });
  const day = kyivDay(), h = kyivHour();
  if (h < 17 || h > 22) return res.status(200).json({ skip: 'hour', h });
  // One run per day, even if the endpoint is called again.
  if (!(await cmd('SET', 'rem:run:' + day, String(Date.now()), 'NX', 'EX', 86400 * 2))) return res.status(200).json({ skip: 'done', day });
  const ids = ((await cmd('SMEMBERS', 'rem:on')) || []).filter(x => /^t\d+$/.test(x));
  const app = appUrl(req), g = dayGrid(day), t0 = Date.now();
  const text = '🧩 <b>Пазл дня</b> вже чекає!\nСьогодні ' + g + '×' + g + ' — однаковий для всіх. Збери його швидше за інших і потрап у рейтинг дня 🏆';
  const markup = { inline_keyboard: [[{ text: '🧩 Грати', web_app: { url: app + '/?dz=1' } }], [{ text: '🔕 Вимкнути нагадування', callback_data: 'rem_off' }]] };
  const out = { day, total: ids.length, sent: 0, played: 0, gone: 0, failed: 0, left: 0 };
  async function send(uid) {
    const p = { chat_id: Number(uid.slice(1)), text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: markup };
    let r = await tg('sendMessage', p);
    if (!r.ok && r.error_code === 429) { await sleep(Math.min(5, (r.parameters && r.parameters.retry_after) || 1) * 1000 + 250); r = await tg('sendMessage', p); }
    if (r.ok) out.sent++;
    else if (r.error_code === 403 || (r.error_code === 400 && /chat not found|deactivated/i.test(r.description || ''))) { out.gone++; await cmd('SREM', 'rem:on', uid); }
    else out.failed++;
  }
  for (let i = 0; i < ids.length; i += 20) {
    if (Date.now() - t0 > 45000) { out.left = ids.length - i; break; }
    const part = ids.slice(i, i + 20), done = await pipe(part.map(uid => ['ZSCORE', 'dz:' + day, uid]));
    const todo = part.filter((uid, k) => done[k] === null || done[k] === undefined);
    out.played += part.length - todo.length;
    await Promise.all(todo.map(send));
    if (todo.length) await sleep(1000);
  }
  console.log('remind', JSON.stringify(out));
  res.status(200).json(out);
}
