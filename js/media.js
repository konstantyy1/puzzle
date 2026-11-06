/* Image / sticker / GIF sources for the puzzle engine */
'use strict';
const Media = (() => {
  let hid = null;
  const hidden = () => {
    if (hid) return hid;
    hid = document.createElement('div');
    hid.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1';
    document.body.appendChild(hid); return hid;
  };
  const b64d = s => { try { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch (e) { return null; } };
  const url = (m, w) => '/api/media?d=' + encodeURIComponent(m.d) + '&s=' + encodeURIComponent(m.s) + (w ? '&w=' + w : '');
  function loadImg(src, cors = true) {
    return new Promise((res, rej) => {
      const i = new Image(); if (cors) i.crossOrigin = 'anonymous';
      i.onload = () => res(i); i.onerror = () => cors && /^https?:/.test(src) && src.indexOf(location.origin) !== 0 ? loadImg(src, false).then(res, rej) : rej(new Error('img'));
      i.src = src;
    });
  }
  async function loadVideo(src) {
    let url = src;
    if (window.fetch && window.URL && URL.createObjectURL) {
      const r = await fetch(src); if (!r.ok) throw new Error('http ' + r.status);
      url = URL.createObjectURL(await r.blob());
    }
    return new Promise((res, rej) => {
      const v = document.createElement('video'); let done = false;
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v._blob = url !== src ? url : '';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
      v.style.cssText = 'width:2px;height:2px'; hidden().appendChild(v);
      const fin = (ok, e) => { if (done) return; done = true; if (ok) res(v); else { v.remove(); if (v._blob) URL.revokeObjectURL(v._blob); rej(e || new Error('video')); } };
      v.addEventListener('loadeddata', () => fin(true), { once: true });
      v.addEventListener('error', () => fin(false), { once: true });
      setTimeout(() => fin(false, new Error('timeout')), 12000);
      v.src = url; const p = v.play(); if (p && p.catch) p.catch(() => {});
    });
  }
  const scripts = {};
  const loadScript = src => scripts[src] || (scripts[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }));
  function bgPaint(ctx, W, H) {
    const cs = getComputedStyle(document.body), a1 = cs.getPropertyValue('--a1').trim() || '#7c3aed', a2 = cs.getPropertyValue('--a2').trim() || '#2563eb';
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, a1); g.addColorStop(1, a2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    const st = W / 10;
    for (let y = st / 2, r = 0; y < H; y += st, r++) for (let x = (r % 2 ? st : st / 2); x < W; x += st) { ctx.beginPath(); ctx.arc(x, y, st * 0.09, 0, 6.283); ctx.fill(); }
    const rg = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.7); rg.addColorStop(0, 'rgba(255,255,255,.18)'); rg.addColorStop(1, 'rgba(0,0,0,.25)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  /* wraps a drawable; if sticker -> composes on a background canvas */
  function make(el, w, h, o) {
    o = o || {};
    const src = { el, w, h, anim: !!o.anim, kind: o.kind || 'img', destroy: o.destroy || (() => {}), tick: () => {}, play: () => {}, pause: () => {} };
    if (o.sticker) {
      const S = 640, c = document.createElement('canvas'); c.width = S; c.height = S; const ctx = c.getContext('2d');
      const bg = document.createElement('canvas'); bg.width = S; bg.height = S; bgPaint(bg.getContext('2d'), S, S);
      const draw = () => {
        ctx.drawImage(bg, 0, 0);
        const k = Math.min(S * 0.84 / w, S * 0.84 / h), dw = w * k, dh = h * k;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
        try { ctx.drawImage(el, (S - dw) / 2, (S - dh) / 2, dw, dh); } catch (e) {}
        ctx.restore();
      };
      draw(); src.el = c; src.w = S; src.h = S; if (o.anim) src.tick = draw;
    }
    if (el instanceof HTMLVideoElement) { src.play = () => { const p = el.play(); if (p && p.catch) p.catch(() => {}); }; src.pause = () => el.pause(); src.destroy = () => { el.pause(); el.removeAttribute('src'); el.load(); el.remove(); if (el._blob) URL.revokeObjectURL(el._blob); }; }
    if (o.lottie) { src.play = () => o.lottie.play(); src.pause = () => o.lottie.pause(); src.destroy = () => { o.lottie.destroy(); o.box.remove(); }; }
    return src;
  }
  async function fromUrl(u) { const i = await loadImg(u); return make(i, i.naturalWidth, i.naturalHeight); }
  async function fromFile(file) {
    const u = URL.createObjectURL(file);
    try {
      const i = await loadImg(u, false), M = 1400, k = Math.min(1, M / Math.max(i.naturalWidth, i.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k);
      c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
      return make(c, c.width, c.height, { kind: 'own' });
    } finally { URL.revokeObjectURL(u); }
  }
  async function fromBot(m) {
    const info = b64d(m.d) || {}, k = info.k || 'p';
    if (k === 'p') { const i = await loadImg(url(m)); return make(i, i.naturalWidth, i.naturalHeight, { kind: 'photo' }); }
    if (k === 's') { const i = await loadImg(url(m)); return make(i, i.naturalWidth || 512, i.naturalHeight || 512, { sticker: 1, kind: 'sticker' }); }
    if (k === 'v' || k === 'g') {
      try {
        const v = await loadVideo(url(m)), w = v.videoWidth || 512, h = v.videoHeight || 512;
        return make(v, w, h, { anim: 1, sticker: k === 'v', kind: k === 'v' ? 'sticker' : 'gif' });
      } catch (e) {
        if (!info.th) throw e;
        const i = await loadImg(url(m, 'th')); return make(i, i.naturalWidth, i.naturalHeight, { sticker: k === 'v', kind: k === 'v' ? 'sticker' : 'gif' });
      }
    }
    if (k === 'l') {
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_canvas.min.js');
        const data = await (await fetch(url(m))).json();
        const box = document.createElement('div'); box.style.cssText = 'width:512px;height:512px'; hidden().appendChild(box);
        const an = window.lottie.loadAnimation({ container: box, renderer: 'canvas', loop: true, autoplay: true, animationData: data, rendererSettings: { clearCanvas: true } });
        await new Promise(r => { an.addEventListener('DOMLoaded', r); setTimeout(r, 1500); });
        const cv = box.querySelector('canvas'); if (!cv) throw new Error('lottie');
        return make(cv, cv.width || 512, cv.height || 512, { anim: 1, sticker: 1, lottie: an, box, kind: 'sticker' });
      } catch (e) {
        if (!info.th) throw e;
        const i = await loadImg(url(m, 'th')); return make(i, i.naturalWidth, i.naturalHeight, { sticker: 1, kind: 'sticker' });
      }
    }
    throw new Error('kind');
  }
  const kindOf = m => (b64d(m.d) || {}).k || 'p';
  const thumbUrl = m => { const i = b64d(m.d) || {}; return i.k === 'p' || i.k === 's' ? url(m) : (i.th ? url(m, 'th') : ''); };
  return { fromUrl, fromFile, fromBot, kindOf, thumbUrl, b64d, loadImg };
})();
