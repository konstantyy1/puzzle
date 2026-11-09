/* Shared helpers for the server tests: Telegram initData signed the way Telegram signs it,
   a fake Vercel request/response, and clock helpers. */
import crypto from 'node:crypto';

export const BOT_TOKEN = '123456:TEST_TOKEN';

/* initData for user `id`, signed with the bot token (the algorithm api/_lib/tg.js checks). */
export function initData(id, { authDate, token } = {}) {
  const key = token || process.env.BOT_TOKEN || BOT_TOKEN;
  const p = { auth_date: String(authDate || Math.floor(Date.now() / 1000)), query_id: 'AAQ' + id, user: JSON.stringify({ id, first_name: 'U' + id }) };
  const dcs = Object.keys(p).sort().map(k => k + '=' + p[k]).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(key).digest();
  return new URLSearchParams({ ...p, hash: crypto.createHmac('sha256', secret).update(dcs).digest('hex') }).toString();
}

/* Calls a Vercel function handler with a fake request; resolves to { code, body }. */
export async function call(handler, { method = 'POST', body, headers = {} } = {}) {
  const out = { code: 200, body: undefined };
  const res = {
    setHeader() { return res; },
    status(c) { out.code = c; return res; },
    json(j) { out.body = j; return res; },
    send(s) { out.body = s; return res; },
    end(s) { out.body = s; return res; },
  };
  await handler({ method, url: '/', body, headers: { host: 'game.example', ...headers }, query: {} }, res);
  return out;
}

/* Runs fn with the clock moved forward by `ms` (time keeps flowing), then puts the clock back. */
export async function later(ms, fn) {
  const real = Date.now;
  Date.now = () => real() + ms;
  try { return await fn(); } finally { Date.now = real; }
}

/* Runs fn with the clock stopped at time `t`, then puts the clock back. */
export async function frozenAt(t, fn) {
  const real = Date.now;
  Date.now = () => t;
  try { return await fn(); } finally { Date.now = real; }
}

/* Points the API at its in-memory store and a test bot token, so tests never touch real Redis or Telegram.
   Call it before importing anything from api/ - those modules read the environment when they load. */
export function offline() {
  for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'VERCEL', 'CRON_SECRET']) delete process.env[k];
  process.env.BOT_TOKEN = BOT_TOKEN;
}
