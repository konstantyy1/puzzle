/* Telegram webhook: stickers / GIFs / photos / videos -> puzzle buttons */
import { tg } from './_lib/tg.js';
import { hookSecret, sig, b64u, appUrl, readJson, rid } from './_lib/util.js';
import { cmd, jget, jset, hasKV } from './_lib/kv.js';

const MAX = 4.3 * 1024 * 1024; // Vercel response limit ~4.5 MB
const WELCOME = '👋 Привіт! Це <b>Фото Пазл</b> 🧩\n\n🗺️ 200 рівнів кампанії з зірками\n⚔️ Арена: онлайн-бої та рейтинг\n🦊 Герої з суперударами і прокачкою\n📋 Щоденні завдання й нагороди\n\n' +
  '🎞️ <b>Надішли мені стікер, GIF, фото або відео</b> — і я перетворю його на пазл! Анімовані стікери й GIF рухаються прямо в деталях.';
const HELP = '🧩 <b>Як зробити пазл</b>\n\n1. Надішли сюди будь-який стікер, GIF, фото або коротке відео.\n2. Обери розмір під повідомленням: 3×3 … 6×6.\n3. Збирай! Пазл також з’явиться в грі в розділі «Свій пазл».';

function pick(msg) {
  const th = o => o && o.thumbnail ? o.thumbnail.file_id : (o && o.thumb ? o.thumb.file_id : undefined);
  if (msg.sticker) { const s = msg.sticker; return { it: { k: s.is_video ? 'v' : s.is_animated ? 'l' : 's', f: s.file_id, th: th(s) }, name: s.is_video || s.is_animated ? 'Анімований стікер' : 'Стікер' }; }
  const vid = msg.animation || msg.video || msg.video_note;
  if (vid) {
    const name = msg.animation ? 'GIF' : msg.video_note ? 'Кружечок' : 'Відео';
    if ((vid.file_size || 0) <= MAX && (vid.duration || 0) <= 90) return { it: { k: 'g', f: vid.file_id, th: th(vid) }, name };
    if (th(vid)) return { it: { k: 'p', f: th(vid) }, name, note: 'Файл завеликий, тому пазл буде з кадру.' };
    return { err: 'Файл завеликий 😕 Спробуй коротший GIF або відео (до 4 МБ).' };
  }
  if (msg.photo && msg.photo.length) { const ok = msg.photo.filter(p => !p.file_size || p.file_size <= MAX), p = ok[ok.length - 1] || msg.photo[0]; return { it: { k: 'p', f: p.file_id }, name: 'Фото' }; }
  if (msg.document) {
    const d = msg.document, mt = d.mime_type || '';
    if ((d.file_size || 0) > MAX) return { err: 'Файл завеликий 😕 Надішли його як фото або менший файл.' };
    if (/^image\/(jpeg|png|webp|gif)$/.test(mt)) return { it: { k: 'p', f: d.file_id }, name: 'Картинка' };
    if (/^video\/(mp4|webm)$/.test(mt)) return { it: { k: 'g', f: d.file_id, th: th(d) }, name: 'Відео' };
  }
  return null;
}
async function onMsg(msg, app) {
  if (!msg.chat || msg.chat.type !== 'private') return;
  const reply = (text, kb) => tg('sendMessage', { chat_id: msg.chat.id, text, parse_mode: 'HTML', disable_web_page_preview: true,
    reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true }, reply_markup: kb ? { inline_keyboard: kb } : undefined });
  const play = [{ text: '🎮 Грати', web_app: { url: app + '/' } }];
  const p = pick(msg);
  if (p && p.err) return reply(p.err, [play]);
  if (p && p.it) {
    const it = p.it; if (!it.th) delete it.th;
    const d = b64u(JSON.stringify(it)), s = sig(d);
    if (!hasKV && process.env.VERCEL) return reply('Сховище тимчасово недоступне. Спробуй пізніше.', [play]);
    const code=rid(24), owner=msg.from && msg.from.id;
    if(!Number.isSafeInteger(owner) || owner!==msg.chat.id) return;
    await jset('pick:media:'+code,{owner,d,s},7*86400);
    const button=g=>({text:'🧩 '+g+'×'+g,callback_data:'pz_'+code+'_'+g});
    return reply('✨ <b>'+p.name+' → пазл!</b>\n'+(p.note?p.note+'\n':'')+'Обери розмір, потім повернись у відкриту гру. Якщо гра закрита — відкрий її через меню. Кнопки діють 7 днів.',[[button(3),button(4)],[button(5),button(6)]]);
  }
  const t = (msg.text || '').trim();
  const inv = t.match(/^\/start(?:@\w+)?\s+([fdt])_([A-Za-z0-9]{24})$/);
  if (inv) {
    const kind = inv[1] === 'f' ? 'friend' : inv[1] === 'd' ? 'duel' : 'team';
    const label = kind === 'friend' ? '🤝 Прийняти запрошення в друзі' : kind === 'duel' ? '⚔️ Прийняти виклик на дуель' : '🤝 Приєднатися до бою 2×2';
    return reply('🧩 ' + (kind === 'friend' ? 'Тебе запрошують у друзі!' : kind === 'duel' ? 'Тебе викликали на дуель!' : 'Тебе запрошують на командний бій!') + '\nВідкрий гру та підтверди:', [[{ text: label, web_app: { url: app + '/?' + kind + '=' + inv[2] } }]]);
  }
  if (/^\/help/.test(t)) return reply(HELP, [play]);
  if (/^\/(start|play)/.test(t)) return reply(WELCOME, [play]);
  if (t) return reply('Надішли мені <b>стікер</b>, <b>GIF</b>, <b>фото</b> або <b>відео</b> — і я зроблю з нього пазл 🧩', [play]);
}
async function onCallback(q) {
  const m=/^pz_([A-Za-z0-9]{24})_([3-6])$/.exec(String(q.data||'')); if(!m)return;
  const from=q.from && q.from.id, chat=q.message && q.message.chat;
  if(!Number.isSafeInteger(from)||!chat||chat.type!=='private'||chat.id!==from){await tg('answerCallbackQuery',{callback_query_id:q.id,text:'Ця кнопка доступна тільки в особистому чаті з ботом.'});return;}
  const v=await jget('pick:media:'+m[1]);
  if(!v||v.owner!==from){await tg('answerCallbackQuery',{callback_query_id:q.id,text:'Кнопка застаріла. Надішли фото або GIF боту ще раз.'});return;}
  await jset('pick:pending:t'+from,{id:rid(24),d:v.d,s:v.s,g:+m[2]},86400);
  await tg('answerCallbackQuery',{callback_query_id:q.id,text:'Готово! Повернись у відкриту гру або відкрий її з меню.'});
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('ok');
  if (req.headers['x-telegram-bot-api-secret-token'] !== hookSecret()) return res.status(401).send('unauthorized');
  const u = await readJson(req);
  try { if (u && u.message) await onMsg(u.message, appUrl(req)); else if (u && u.callback_query) await onCallback(u.callback_query); } catch (e) { console.error('bot', e); }
  res.status(200).json({ ok: true });
}
