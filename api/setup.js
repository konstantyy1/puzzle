/* One-time setup: authenticated POST using SETUP_KEY. */
import crypto from 'node:crypto';
import { tg } from './_lib/tg.js';
import { hookSecret, appUrl, TOKEN } from './_lib/util.js';
import { hasKV } from './_lib/kv.js';

export default async function handler(req, res) {
  const key = process.env.SETUP_KEY || '';
  const supplied = String(req.headers['x-setup-key'] || '');
  const a = Buffer.from(key), b = Buffer.from(supplied);
  if (req.method !== 'POST' || !key || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).send('Forbidden');
  }
  const app = appUrl(req), out = [];
  if (!TOKEN) out.push(['❌', 'Не задано BOT_TOKEN: Vercel → Settings → Environment Variables → BOT_TOKEN, потім Redeploy']);
  else {
    const me = await tg('getMe');
    out.push([me.ok ? '✅' : '❌', me.ok ? 'Бот: @' + me.result.username : 'Токен не підходить: ' + me.description]);
    if (me.ok && String(me.result.username || '').toLowerCase() !== 'fotopuzzle_bot') {
      out.push(['❌', 'Токен належить іншому боту; налаштування не змінено']);
    } else if (me.ok) {
      const wh = await tg('setWebhook', { url: app + '/api/bot', secret_token: hookSecret(), allowed_updates: ['message'], drop_pending_updates: true });
      out.push([wh.ok ? '✅' : '❌', 'Webhook → ' + app + '/api/bot' + (wh.ok ? '' : ': ' + wh.description)]);
      const mb = await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Грати', web_app: { url: app + '/' } } });
      out.push([mb.ok ? '✅' : '❌', 'Кнопка меню «Грати» → ' + app + '/' + (mb.ok ? '' : ': ' + mb.description)]);
      const cm = await tg('setMyCommands', { commands: [{ command: 'start', description: 'Почати гру' }, { command: 'play', description: 'Відкрити пазли' }, { command: 'help', description: 'Як зробити пазл зі стікера чи GIF' }] });
      out.push([cm.ok ? '✅' : '❌', 'Команди /start, /play, /help']);
      await tg('setMyShortDescription', { short_description: 'Пазли з фото, стікерів і GIF · рівні · онлайн-бої' });
    }
  }
  out.push([hasKV ? '✅' : '⚠️', hasKV ? 'База Upstash Redis підключена — онлайн-бої й таблиця лідерів працюють' : 'База не підключена — Арена працюватиме лише з ботами. Додай Upstash Redis: Vercel → Storage → Upstash for Redis → Connect, потім Redeploy']);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  res.status(200).send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Фото Пазл — налаштування</title>' +
    '<body style="font-family:system-ui,sans-serif;background:#0a0a14;color:#fff;padding:24px;max-width:640px;margin:auto;line-height:1.5"><h2>🧩 Фото Пазл — налаштування</h2>' +
    out.map(([i, t]) => '<p style="background:#1c1c3a;border-radius:12px;padding:12px">' + i + ' ' + esc(t) + '</p>').join('') + '<p style="opacity:.7">Можна повторно відкривати цю сторінку після кожного переїзду на нову адресу.</p></body>');
}
