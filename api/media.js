/* Proxy Telegram files (stickers, GIFs, photos) for the mini app without exposing the bot token */
import zlib from 'node:zlib';
import { tg, fileUrl } from './_lib/tg.js';
import { sig, unb64u } from './_lib/util.js';

const TYPES = { webp: 'image/webp', webm: 'video/webm', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', tgs: 'application/json' };
export default async function handler(req, res) {
  const q = req.query || {}, d = String(q.d || ''), s = String(q.s || ''), w = String(q.w || '');
  if (!d || d.length > 1500 || sig(d) !== s) return res.status(403).send('forbidden');
  let info; try { info = JSON.parse(unb64u(d)); } catch { return res.status(400).send('bad'); }
  const fid = w === 'th' ? info.th : info.f; if (!fid) return res.status(404).send('no file');
  const gf = await tg('getFile', { file_id: fid });
  if (!gf.ok || !gf.result || !gf.result.file_path) return res.status(404).send('not found');
  const fp = gf.result.file_path, ext = (fp.split('.').pop() || '').toLowerCase();
  const r = await fetch(fileUrl(fp)); if (!r.ok) return res.status(502).send('telegram error');
  let buf = Buffer.from(await r.arrayBuffer()), type = TYPES[ext] || 'application/octet-stream';
  if (ext === 'tgs') { try { buf = zlib.gunzipSync(buf); } catch {} type = 'application/json'; }
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, immutable');
  res.setHeader('Accept-Ranges', 'bytes');
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m && (m[1] || m[2])) {
    const L = buf.length; let a = m[1] ? +m[1] : Math.max(0, L - +m[2]), z = m[1] && m[2] ? Math.min(+m[2], L - 1) : L - 1;
    if (a >= L || a > z) { res.setHeader('Content-Range', 'bytes */' + L); return res.status(416).end(); }
    res.setHeader('Content-Range', 'bytes ' + a + '-' + z + '/' + L); res.setHeader('Content-Length', z - a + 1);
    return res.status(206).send(buf.subarray(a, z + 1));
  }
  res.setHeader('Content-Length', buf.length);
  res.status(200).send(buf);
}
