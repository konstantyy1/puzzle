/* Jigsaw engine: canvas pieces, one coordinate system (#stage), board + tray */
'use strict';
const Game = (() => {
  const $ = id => document.getElementById(id);
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  const f = v => Math.round(v * 100) / 100;
  let st = null, raf = 0, rafAnim = 0, relT = 0;
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const KN = [[0.2, 0], [0.5, 0], [0.4, 0.1], [0.3, 0.3], [0.7, 0.3], [0.6, 0.1], [0.5, 0], [0.8, 0], [1, 0]];
  function edge(x0, y0, x1, y1, s, k, K) {
    if (!s) return 'L' + f(x1) + ' ' + f(y1);
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
    const pts = KN.map(([u, v], i) => { const a = i === 8 ? L : L / 2 + (u - 0.5) * K * k, b = i === 8 ? 0 : v * K * k * s; return f(x0 + ux * a + nx * b) + ' ' + f(y0 + uy * a + ny * b); });
    return 'C' + pts.slice(0, 3).join(' ') + 'C' + pts.slice(3, 6).join(' ') + 'C' + pts.slice(6, 9).join(' ');
  }
  function mkEdges(g, R) {
    const H = [], V = [];
    for (let r = 0; r < g - 1; r++) { H.push([]); for (let c = 0; c < g; c++) H[r].push({ s: R() < 0.5 ? 1 : -1, k: 0.9 + R() * 0.2 }); }
    for (let r = 0; r < g; r++) { V.push([]); for (let c = 0; c < g - 1; c++) V[r].push({ s: R() < 0.5 ? 1 : -1, k: 0.9 + R() * 0.2 }); }
    return { H, V };
  }
  function piecePath(r, c) {
    const { g, sw, sh, p, E } = st, K = Math.min(sw, sh);
    const T = r ? E.H[r - 1][c] : null, Rt = c < g - 1 ? E.V[r][c] : null, Bm = r < g - 1 ? E.H[r][c] : null, Lf = c ? E.V[r][c - 1] : null;
    const x0 = p, y0 = p, x1 = p + sw, y1 = p + sh;
    return 'M' + f(x0) + ' ' + f(y0) + edge(x0, y0, x1, y0, T ? -T.s : 0, T ? T.k : 1, K) + edge(x1, y0, x1, y1, Rt ? Rt.s : 0, Rt ? Rt.k : 1, K)
      + edge(x1, y1, x0, y1, Bm ? Bm.s : 0, Bm ? Bm.k : 1, K) + edge(x0, y1, x0, y0, Lf ? -Lf.s : 0, Lf ? Lf.k : 1, K) + 'Z';
  }
  function blit(ctx, el, sx, sy, sw, sh, dx, dy, dw, dh, iw, ih) {
    const kx = dw / sw, ky = dh / sh;
    if (sx < 0) { dx -= sx * kx; dw += sx * kx; sw += sx; sx = 0; }
    if (sy < 0) { dy -= sy * ky; dh += sy * ky; sh += sy; sy = 0; }
    if (sx + sw > iw) { const o = sx + sw - iw; sw -= o; dw -= o * kx; }
    if (sy + sh > ih) { const o = sy + sh - ih; sh -= o; dh -= o * ky; }
    if (sw <= 0.5 || sh <= 0.5) return;
    try { ctx.drawImage(el, sx, sy, sw, sh, dx, dy, dw, dh); } catch (e) {}
  }
  const srcW = () => st.src.el.videoWidth || st.src.el.naturalWidth || st.src.el.width || st.src.w;
  const srcH = () => st.src.el.videoHeight || st.src.el.naturalHeight || st.src.el.height || st.src.h;
  function drawPiece(P) {
    const ctx = P.ctx, d = DPR(), W = st.sw + 2 * st.p, H = st.sh + 2 * st.p, m = st.map;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.clip(P.p2d);
    const bx0 = P.c * st.sw - st.p, by0 = P.r * st.sh - st.p, iw = srcW(), ih = srcH(), kk = m.k * (st.src.w / iw);
    blit(ctx, st.src.el, (bx0 - m.ox) / kk, (by0 - m.oy) / kk, W / kk, H / kk, 0, 0, W, H, iw, ih);
    ctx.restore();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke(P.p2d);
  }
  function drawFull(cv, w, h, alpha) {
    const d = DPR(); cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = alpha || 1;
    const k = Math.max(w / st.src.w, h / st.src.h), iw = srcW(), ih = srcH(), kk = k * (st.src.w / iw);
    blit(ctx, st.src.el, ((st.src.w * k - w) / 2) / kk, ((st.src.h * k - h) / 2) / kk, w / kk, h / kk, 0, 0, w, h, iw, ih);
  }
  function redrawAll() {
    if (!st) return;
    st.src.tick();
    st.P.forEach(drawPiece);
    if ($('ghost').classList.contains('on')) drawFull($('ghost'), st.bw, st.bh);
    if (st.won) drawFull($('fullImg'), st.bw, st.bh);
    const pc = $('prevC'); if (pc) drawFull(pc, 40, 40);
    const pb = $('prevBigC'); if (pb && $('prevBig').classList.contains('on')) drawFull(pb, st.pvw, st.pvh);
  }
  function animLoop() {
    let last = 0;
    const fr = t => { if (!st || !st.src.anim) return; rafAnim = requestAnimationFrame(fr); if (t - last < 33) return; last = t; redrawAll(); };
    rafAnim = requestAnimationFrame(fr);
  }
  const place = P => { P.el.style.transform = 'translate3d(' + f(P.x) + 'px,' + f(P.y) + 'px,0) scale(' + f(P.s) + ')'; };
  function animTo(P, x, y, s) { P.el.classList.add('anim'); P.x = x; P.y = y; P.s = s; place(P); clearTimeout(P.at); P.at = setTimeout(() => P.el.classList.remove('anim'), 330); }
  function layout() {
    const S = $('stage'), W = S.clientWidth, H = S.clientHeight; if (!W || !H) return false;
    const ar = st.ar, m = Math.max(8, Math.min(14, W * 0.025)), land = W > H * 1.08;
    let bx, by, bw, bh, T;
    if (!land) {
      bw = Math.min(W - 2 * m, 760); bh = bw / ar;
      const maxH = H * (st.g >= 6 ? 0.6 : 0.62); if (bh > maxH) { bh = maxH; bw = bh * ar; }
      bx = (W - bw) / 2; by = m;
      T = { x: m, y: by + bh + m * 1.2, w: W - 2 * m, h: H - (by + bh + m * 1.2) - m };
    } else {
      bh = H - 2 * m; bw = bh * ar; const maxW = W * 0.58; if (bw > maxW) { bw = maxW; bh = bw / ar; }
      bx = m + Math.max(0, (W * 0.6 - bw - m) / 2); by = (H - bh) / 2;
      T = { x: bx + bw + m * 1.4, y: m, w: W - (bx + bw + m * 1.4) - m, h: H - 2 * m };
    }
    const g = st.g, sw = bw / g, sh = bh / g, p = Math.ceil(Math.min(sw, sh) * 0.3) + 2;
    Object.assign(st, { W, H, bx, by, bw, bh, sw, sh, p, tray: T });
    const k = Math.max(bw / st.src.w, bh / st.src.h);
    st.map = { k, ox: (bw - st.src.w * k) / 2, oy: (bh - st.src.h * k) / 2 };
    const bg = $('boardBg'); Object.assign(bg.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
    for (const id of ['ghost', 'fullImg']) { const e = $(id); e.style.left = bx + 'px'; e.style.top = by + 'px'; }
    const gs = $('gridSvg'); Object.assign(gs.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
    gs.setAttribute('viewBox', '0 0 ' + f(bw) + ' ' + f(bh));
    let gl = ''; for (let i = 1; i < g; i++) gl += 'M' + f(i * sw) + ' 0V' + f(bh) + 'M0 ' + f(i * sh) + 'H' + f(bw);
    gs.innerHTML = '<path d="' + gl + '" stroke="rgba(255,255,255,.07)" stroke-width="1" fill="none"/>';
    const tb = $('trayBg'); Object.assign(tb.style, { left: T.x + 'px', top: T.y + 'px', width: Math.max(0, T.w) + 'px', height: Math.max(0, T.h) + 'px', display: st.order.length && T.h > 20 ? 'block' : 'none' });
    const pv = Math.min(W, H) * 0.86; st.pvw = ar >= 1 ? pv : pv * ar; st.pvh = ar >= 1 ? pv / ar : pv;
    return true;
  }
  function buildPieces() {
    const L = $('layer'); L.innerHTML = '';
    const W = st.sw + 2 * st.p, H = st.sh + 2 * st.p, d = DPR();
    st.P.forEach(P => {
      const dstr = piecePath(P.r, P.c); P.p2d = new Path2D(dstr);
      if (!P.el) { P.el = document.createElement('div'); P.el.className = 'pc'; P.el.dataset.i = P.i; }
      P.el.innerHTML = '';
      const cv = document.createElement('canvas'); cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      P.ctx = cv.getContext('2d'); P.el.appendChild(cv);
      P.el.insertAdjacentHTML('beforeend', '<svg width="' + f(W) + '" height="' + f(H) + '" viewBox="0 0 ' + f(W) + ' ' + f(H) + '"><path class="edge" d="' + dstr + '"/></svg>');
      P.el.style.width = W + 'px'; P.el.style.height = H + 'px';
      L.appendChild(P.el); drawPiece(P);
    });
  }
  const lockXY = P => [st.bx + P.c * st.sw - st.p, st.by + P.r * st.sh - st.p];
  function trayLayout(anim) {
    const n = st.order.length, T = st.tray; if (!n) { $('trayBg').style.display = 'none'; return; }
    const PW = st.sw + 2 * st.p, PH = st.sh + 2 * st.p, cw = st.sw + st.p * 1.6, ch = st.sh + st.p * 1.6;
    let best = { s: 0, cols: 1 };
    for (let cols = 1; cols <= n; cols++) { const rows = Math.ceil(n / cols), s = Math.min(T.w / (cols * cw), T.h / (rows * ch), 0.92); if (s > best.s) best = { s, cols }; }
    const s = best.s, cols = best.cols, rows = Math.ceil(n / cols), gw = cols * cw * s, gh = rows * ch * s, x0 = T.x + (T.w - gw) / 2, y0 = T.y + (T.h - gh) / 2;
    st.ts = s;
    st.order.forEach((i, j) => {
      const P = st.P[i]; if (st.drag && st.drag.P === P) return;
      const cx = x0 + ((j % cols) + 0.5) * cw * s, cy = y0 + (Math.floor(j / cols) + 0.5) * ch * s, x = cx - PW * s / 2, y = cy - PH * s / 2;
      if (anim) animTo(P, x, y, s); else { P.x = x; P.y = y; P.s = s; place(P); }
    });
  }
  function relayout() {
    if (!st) return; if (!layout()) return;
    buildPieces();
    st.P.forEach(P => { if (P.ok) { const [x, y] = lockXY(P); P.x = x; P.y = y; P.s = 1; place(P); P.el.classList.add('ok'); P.el.style.zIndex = 1; } });
    trayLayout(false); redrawAll();
  }
  function scheduleRelayout() { clearTimeout(relT); relT = setTimeout(relayout, 90); }
  /* input */
  const toStage = e => { const r = $('stage').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function onDown(e) {
    if (!st || st.won || st.frozen || st.drag || st.paused) return;
    const el = e.target.closest && e.target.closest('.pc'); if (!el || el.classList.contains('ok')) return;
    e.preventDefault();
    const P = st.P[+el.dataset.i], pt = toStage(e), lx = (pt.x - P.x) / P.s, ly = (pt.y - P.y) / P.s;
    const lift = e.pointerType === 'touch' ? Math.min(34, (st.sh + 2 * st.p) * 0.3) : 0;
    st.drag = { P, id: e.pointerId, lx, ly, lift, t0: Date.now() };
    el.classList.remove('anim'); el.classList.add('drag'); el.style.zIndex = ++st.z;
    P.s = 1; P.x = pt.x - lx; P.y = pt.y - ly - lift; place(P);
    try { $('stage').setPointerCapture(e.pointerId); } catch (er) {}
    st.cb.haptic && st.cb.haptic('light');
  }
  function onMove(e) {
    const D = st && st.drag; if (!D || e.pointerId !== D.id) return;
    e.preventDefault(); const pt = toStage(e); D.P.x = pt.x - D.lx; D.P.y = pt.y - D.ly - D.lift;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (!st || !st.drag) return; const P = st.drag.P; place(P); const [lx, ly] = lockXY(P); P.el.classList.toggle('near', Math.hypot(P.x - lx, P.y - ly) < st.snapR()); });
  }
  function onUp(e) {
    const D = st && st.drag; if (!D || e.pointerId !== D.id) return;
    st.drag = null; const P = D.P; P.el.classList.remove('drag', 'near');
    const [lx, ly] = lockXY(P), dist = Math.hypot(P.x - lx, P.y - ly);
    if (dist < st.snapR()) { lock(P, false); return; }
    const cx = P.x + st.p + st.sw / 2, cy = P.y + st.p + st.sh / 2;
    const onBoard = cx > st.bx && cx < st.bx + st.bw && cy > st.by && cy < st.by + st.bh;
    if (onBoard && Date.now() - D.t0 > 120) { st.miss++; P.el.classList.add('shake'); setTimeout(() => P.el.classList.remove('shake'), 340); st.cb.onMiss && st.cb.onMiss(P); }
    trayLayout(true);
  }
  function lock(P, byHint) {
    if (P.ok) return;
    P.ok = true; st.order = st.order.filter(i => i !== P.i); st.placed.push(P.i);
    const [x, y] = lockXY(P); P.el.style.zIndex = 1; animTo(P, x, y, 1); P.el.classList.add('ok');
    trayLayout(true);
    st.cb.onPlace && st.cb.onPlace({ i: P.i, hint: byHint, n: st.placed.length, total: st.P.length });
    if (st.placed.length === st.P.length) win();
  }
  function win() {
    st.won = true; const fi = $('fullImg');
    setTimeout(() => { if (!st) return; drawFull(fi, st.bw, st.bh); fi.classList.add('on'); }, 350);
    st.cb.onWin && setTimeout(() => st && st.cb.onWin(), 900);
  }
  function bind() {
    const S = $('stage');
    S.addEventListener('pointerdown', onDown, { passive: false });
    S.addEventListener('pointermove', onMove, { passive: false });
    S.addEventListener('pointerup', onUp); S.addEventListener('pointercancel', onUp);
    S.addEventListener('lostpointercapture', onUp);
    window.addEventListener('resize', scheduleRelayout);
    if (window.ResizeObserver) new ResizeObserver(scheduleRelayout).observe(S);
    if (TG && TG.onEvent) TG.onEvent('viewportChanged', e => { if (!e || e.isStateStable) scheduleRelayout(); });
  }
  let bound = false;
  function start(o) {
    stop(); if (!bound) { bind(); bound = true; }
    const R = rng(o.seed || (Date.now() & 0xffffffff)), g = o.g;
    st = { g, src: o.src, seed: o.seed, cb: o, ar: Math.max(0.75, Math.min(1.333, o.src.w / o.src.h)), E: mkEdges(g, R), P: [], order: [], placed: [], miss: 0, z: 10, won: false, drag: null,
      snapR: () => Math.max(20, Math.min(st.sw, st.sh) * 0.38) * (o.magnet || 1) };
    for (let r = 0; r < g; r++) for (let c = 0; c < g; c++) st.P.push({ i: r * g + c, r, c, x: 0, y: 0, s: 1, ok: false });
    const ord = st.P.map(P => P.i); for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
    st.order = ord;
    $('fullImg').classList.remove('on'); $('ghost').classList.toggle('on', !!o.ghost); $('prevBig').classList.remove('on');
    if (!layout()) { setTimeout(() => st && relayout(), 60); }
    buildPieces();
    const pre = new Set(o.restore ? o.restore : []);
    if (!o.restore && o.corners) { const cs = [0, g - 1, g * (g - 1), g * g - 1].slice(0, Math.min(4, o.corners)); cs.forEach(i => pre.add(i)); if (o.corners >= 5) { pre.add(1); pre.add(g); } }
    pre.forEach(i => { const P = st.P[i]; if (!P) return; P.ok = true; st.placed.push(i); st.order = st.order.filter(x => x !== i); const [x, y] = lockXY(P); P.x = x; P.y = y; P.s = 1; place(P); P.el.classList.add('ok'); P.el.style.zIndex = 1; });
    trayLayout(false); redrawAll();
    if (st.src.anim) { st.src.play(); animLoop(); }
    return st;
  }
  function stop() {
    if (!st) return; cancelAnimationFrame(rafAnim); rafAnim = 0;
    try { st.src.pause(); } catch (e) {}
    $('layer').innerHTML = ''; st = null; $('fullImg').classList.remove('on');
  }
  function hint() {
    if (!st || st.won || !st.order.length) return false;
    const i = st.order[Math.floor(Math.random() * st.order.length)], P = st.P[i];
    P.el.classList.add('hintfx'); setTimeout(() => P.el && P.el.classList.remove('hintfx'), 1800);
    P.el.style.zIndex = ++st.z; lock(P, true); return true;
  }
  function shuffleTray() { if (!st) return; const o = st.order; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } trayLayout(true); }
  function toggleGhost(v) { const g = $('ghost'), on = typeof v === 'boolean' ? v : !g.classList.contains('on'); g.classList.toggle('on', on); if (on && st) drawFull(g, st.bw, st.bh); return on; }
  function togglePreview() { const b = $('prevBig'), on = !b.classList.contains('on'); b.classList.toggle('on', on); if (on && st) drawFull($('prevBigC'), st.pvw, st.pvh); return on; }
  function freeze(ms) { if (!st) return; st.frozen = true; if (st.drag) { const P = st.drag.P; st.drag = null; P.el.classList.remove('drag', 'near'); trayLayout(true); } clearTimeout(st.ft); st.ft = setTimeout(() => { if (st) st.frozen = false; }, ms); }
  function pause(v) { if (st) { st.paused = v; if (st.src.anim) v ? st.src.pause() : st.src.play(); } }
  const state = () => st && { g: st.g, seed: st.seed, placed: st.placed.slice(), miss: st.miss };
  return { start, stop, hint, shuffleTray, toggleGhost, togglePreview, freeze, pause, state, relayout, get st() { return st; },
    _place(i) { if (st && st.P[i] && !st.P[i].ok) lock(st.P[i], false); }, _miss() { if (st) { st.miss++; st.cb.onMiss && st.cb.onMiss(); } } };
})();
