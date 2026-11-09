/* Pieces of the browser smoke test (browser-smoke.mjs): a test picture, a Telegram WebApp stub, the /api mock,
   and checks that run inside the page. Functions marked "in the page" are passed to page.evaluate(),
   so they must not use anything else from this file. */

/* A player name with HTML in it: if a screen renders names as HTML, window.__xss counts it. */
export const XSS = 'Хакер<img src=x onerror=__xssHit()>';

/* A colourful 512x512 BMP, so the test needs no picture files and no network. */
export function testPicture(w = 512, h = 512) {
  const row = (w * 3 + 3) & ~3, size = 54 + row * h, b = Buffer.alloc(size);
  b.write('BM', 0);
  b.writeUInt32LE(size, 2);
  b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18);
  b.writeInt32LE(h, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);
  b.writeUInt32LE(row * h, 34);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = 54 + y * row + x * 3, cell = ((x >> 6) + (y >> 6)) % 2;
    b[o] = (x * 255 / w) | 0;
    b[o + 1] = (y * 255 / h) | 0;
    b[o + 2] = cell ? 230 : 40;
  }
  return b;
}
const PIC = testPicture();

/* In the page: stands in for telegram-web-app.js. */
export function telegramStub() {
  const noop = () => {};
  const btn = () => ({ show: noop, hide: noop, onClick: noop, offClick: noop, setText: noop, setParams: noop, enable: noop, disable: noop, showProgress: noop, hideProgress: noop, isVisible: false });
  const cloud = {};
  window.__xssHit = () => { window.__xss = (window.__xss || 0) + 1; };
  window.Telegram = { WebApp: {
    initData: 'query_id=AAQ42&user=%7B%22id%22%3A42%7D&auth_date=1700000000&hash=abc',
    initDataUnsafe: { query_id: 'AAQ42', user: { id: 42, first_name: 'Тест', language_code: 'uk' }, auth_date: 1700000000, start_param: '' },
    version: '7.10', platform: 'android', colorScheme: 'dark', themeParams: {},
    viewportHeight: innerHeight, viewportStableHeight: innerHeight, isExpanded: true,
    safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 }, contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    isVersionAtLeast: v => parseFloat(v) <= 7.1,
    ready: noop, expand: noop, close: noop, onEvent: noop, offEvent: noop, sendData: noop, openLink: noop, openTelegramLink: noop,
    switchInlineQuery: noop, shareToStory: noop, setHeaderColor: noop, setBackgroundColor: noop, setBottomBarColor: noop,
    enableClosingConfirmation: noop, disableClosingConfirmation: noop, disableVerticalSwipes: noop, enableVerticalSwipes: noop,
    requestFullscreen: noop, exitFullscreen: noop, lockOrientation: noop, unlockOrientation: noop,
    showAlert: (m, cb) => { if (cb) cb(); },
    showConfirm: (m, cb) => { if (cb) cb(true); },
    showPopup: (p, cb) => { if (cb) cb(p && p.buttons && p.buttons[0] ? p.buttons[0].id : ''); },
    requestWriteAccess: cb => { window.__wa = (window.__wa || 0) + 1; if (cb) cb(true); },
    readTextFromClipboard: cb => { if (cb) cb(''); },
    BackButton: btn(), MainButton: btn(), SecondaryButton: btn(), SettingsButton: btn(),
    HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
    CloudStorage: {
      setItem: (k, v, cb) => { cloud[k] = String(v); if (cb) cb(null, true); },
      getItem: (k, cb) => { if (cb) cb(null, cloud[k] || ''); },
      getItems: (ks, cb) => { const o = {}; for (const k of ks) o[k] = cloud[k] || ''; if (cb) cb(null, o); },
      removeItem: (k, cb) => { delete cloud[k]; if (cb) cb(null, true); },
      removeItems: (ks, cb) => { for (const k of ks) delete cloud[k]; if (cb) cb(null, true); },
      getKeys: cb => { if (cb) cb(null, Object.keys(cloud)); },
    },
  } };
}

/* Mocks everything outside the game: Telegram's script, pictures and the game's /api. */
export async function mockApi(page, st, baseHost) {
  const json = (r, o) => r.fulfill({ status: 200, body: JSON.stringify(o), contentType: 'application/json' });
  const body = r => { try { return JSON.parse(r.request().postData() || '{}'); } catch (e) { return {}; } };
  const local = h => h === '127.0.0.1' || h === 'localhost' || h === baseHost;
  const me = { a: 'Тест Лис 11', h: 'fox', l: 3 };
  const dz = { rem: 0, done: null };
  const ends = Date.now() + 20 * 864e5;
  const api = {
    '/api/arena': b => {
      if (b.op === 'top') return { list: [{ a: XSS, h: 'fox', l: 9, s: 1032, me: 0 }, { ...me, s: 1000, me: 1 }], my: { pos: 2, ...me, s: 1000 }, season: { id: '2026-11', ends } };
      if (b.op === 'sync') return { rt: 1000, w: 0, l: 0, alias: me.a, kv: true };
      if (b.op === 'friends') return { list: [{ id: 't5', a: XSS, h: 'cat', l: 4 }], friends: [] };
      if (b.op === 'seasonPrev') return { id: '2026-10', pos: null, total: 0, fresh: false, cur: '2026-11', ends };
      if (b.op === 'find' || b.op === 'poll') return { err: 'nokv' };
      return {};
    },
    '/api/daily': b => {
      if (b.op === 'top') {
        const mine = dz.done ? [{ ...me, t: dz.done, me: 1 }] : [];
        const list = [{ a: XSS, h: 'fox', l: 7, t: 41.2, me: 0 }, { a: 'Дуже Довге Імʼя Гравця Що Не Влазить 99', h: 'cat', l: 4, t: 55.9, me: 0 }].concat(mine);
        return { day: b.day, g: 4, list, my: dz.done ? { pos: 3, t: dz.done, ...me, me: 1 } : null, total: list.length, rem: dz.rem };
      }
      if (b.op === 'done') { dz.done = dz.done || b.t; return { day: b.day, fresh: 1, pos: 3, t: dz.done, total: 3 }; }
      if (b.op === 'rem') { dz.rem = b.on ? 1 : 0; return { rem: dz.rem }; }
      return {};
    },
  };
  await page.route(u => !local(u.hostname) && !u.hostname.endsWith('telegram.org') && !u.hostname.endsWith('picsum.photos'), r => { st.blocked.push(r.request().url().slice(0, 90)); return r.abort(); });
  await page.route(u => u.hostname.endsWith('telegram.org'), r => r.fulfill({ body: '(' + telegramStub.toString() + ')();', contentType: 'text/javascript' }));
  await page.route(u => u.hostname.endsWith('picsum.photos'), r => r.fulfill({ body: PIC, contentType: 'image/bmp', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route(u => local(u.hostname) && u.pathname.startsWith('/api/'), r => {
    const path = new URL(r.request().url()).pathname, b = body(r);
    st.api.push(path.slice(5) + ':' + (b.op || r.request().method()));
    return json(r, api[path] ? api[path](b) : {});
  });
}

/* Added before the page loads: records long main-thread tasks. */
export function perfInit() {
  window.__lt = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* not supported */ }
}

/* In the page: the current screen. */
export function curScreen() {
  return typeof UI.cur === 'function' ? UI.cur() : UI.cur;
}

/* In the page: open screen s and list layout problems (wider than the phone, small tap targets). */
export async function layoutCheck(s) {
  try { UI.closeModal(); } catch (e) { /* no dialog */ }
  try { UI.show(s); } catch (e) { return { err: String(e).slice(0, 160), ow: 0, bad: [], small: [] }; }
  await new Promise(r => setTimeout(r, 450));
  const W = innerWidth, bad = [], small = [];
  const clipped = el => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') return true; return false; };
  const name = el => String(el.innerText || el.dataset.a || el.dataset.go || el.tagName).split('\n').join(' ').trim().slice(0, 24);
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if ((r.right > W + 1 || r.left < -1) && !clipped(el)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 30) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    if (el.matches('button, [data-a], [data-go]') && (r.width < 32 || r.height < 32)) small.push(name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return { ow: document.documentElement.scrollWidth - W, bad: bad.slice(0, 6), small: [...new Set(small)].slice(0, 8) };
}

/* In the page: press the i-th visible control of screen s; skips risky ones and ones pressed before. */
export function pressNth({ s, i, done }) {
  const cur = () => (typeof UI.cur === 'function' ? UI.cur() : UI.cur);
  try { UI.closeModal(); } catch (e) { /* no dialog */ }
  if (cur() !== s) UI.show(s);
  const label = el => String(el.innerText || el.getAttribute('aria-label') || el.title || '').split('\n').join(' ').trim().slice(0, 30);
  const list = [...document.querySelectorAll('button, [data-a], [data-go]')].filter(el => {
    if (el.closest('#mbox')) return false;
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (i >= list.length) return { end: true };
  const el = list[i], sig = (el.dataset.a || el.dataset.go || el.id || 'button') + ':' + (el.dataset.v || '') + ':' + label(el);
  if (done.includes(sig)) return { skip: sig };
  if (/скинути|видалити|reset|delete/i.test(sig)) return { skip: sig, risky: true };
  if (/бій|битв|суперник|дуель|2x2|2×2/i.test(label(el)) || /find|fight|duel|queue|team/i.test(el.dataset.a || '')) return { skip: sig, flow: true };
  el.click();
  return { sig };
}

/* In the page: in an open dialog, press the first button not pressed before (never the close button). */
export function pressDialog(done) {
  const box = document.getElementById('mbox');
  if (!box || !box.offsetParent) return null;
  const label = el => String(el.innerText || '').split('\n').join(' ').trim().slice(0, 30);
  for (const el of box.querySelectorAll('button, [data-a], [data-go]')) {
    if (!el.offsetParent || el.hasAttribute('data-close')) continue;
    const sig = 'dialog:' + (el.dataset.a || el.dataset.go || el.id || '') + ':' + label(el);
    if (done.includes(sig)) continue;
    if (/скинути|видалити|reset|delete/i.test(sig)) return { open: true, skip: sig };
    el.click();
    return { open: true, sig };
  }
  return { open: true };
}

/* In the page: close dialogs, stop a running puzzle and return to screen s. */
export function backTo(s) {
  const cur = () => (typeof UI.cur === 'function' ? UI.cur() : UI.cur);
  for (let k = 0; k < 3; k++) try { UI.closeModal(); } catch (e) { /* none */ }
  if (cur() === 'gs') { try { Game.stop(); } catch (e) { /* not running */ } }
  if (s && cur() !== s) { try { UI.show(s); } catch (e) { return String(e); } }
  return cur();
}

/* In the page: the app goes to the background for a second and comes back. */
export function backgroundAndBack() {
  const set = hidden => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event(hidden ? 'blur' : 'focus'));
  };
  set(true);
  return new Promise(r => setTimeout(() => { set(false); r(true); }, 1000));
}

/* In the page: frames per second over ms milliseconds. */
export function measureFps(ms) {
  return new Promise(res => {
    let n = 0;
    const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round(n * 1000 / (performance.now() - t0))); };
    requestAnimationFrame(f);
  });
}
