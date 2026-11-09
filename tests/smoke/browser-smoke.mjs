/* Browser smoke test for «Фото Пазл»: the automated part of tests/smoke/critical-paths.md.
   Opens the game in a headless phone-sized Chromium with a stubbed Telegram WebApp and a mocked /api, then
   opens every screen at 320, 360 and 414 px, presses every button once, plays the Daily Puzzle and campaign
   level 1 to the win screen, reloads to check that progress is kept, and starts an arena fight against the
   offline bot. Prints a JSON report; exit code 1 means errors were found.
   Needs Playwright (not a game dependency): npm i --no-save playwright && npx playwright install chromium
   Run from the repo root: python3 -m http.server 8765 & node tests/smoke/browser-smoke.mjs http://127.0.0.1:8765/
   Env: CHROMIUM_PATH = browser binary to use; SMOKE_SHOTS = folder for screenshots. */
import { chromium } from 'playwright';
import { mockApi, perfInit, curScreen, layoutCheck, pressNth, pressDialog, backTo, backgroundAndBack, measureFps } from './smoke-lib.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const SHOTS = process.env.SMOKE_SHOTS || '';
const SIZES = [[320, 568], [360, 740], [414, 896]];
const wait = ms => new Promise(r => setTimeout(r, ms));
const oneLine = s => String(s || '').split('\n').join(' ').trim();

async function openGame(browser, w, h, V, st) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'uk-UA' });
  const page = await ctx.newPage();
  page.on('pageerror', e => V.errors.push(st.where + ' -> ' + String(e && e.message).slice(0, 240)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('Failed to load resource')) V.net++;
    else V.errors.push(st.where + ' -> console: ' + t.slice(0, 240));
  });
  await page.addInitScript(perfInit);
  await mockApi(page, st, new URL(BASE).hostname);
  await page.goto(BASE, { waitUntil: 'load' });
  await wait(2500);
  await page.evaluate(backTo, 'home');
  return { ctx, page };
}

/* page.evaluate that survives a page reload caused by a button; problems go to warnings. */
function safeEval(page, V, st) {
  return async (f, a) => {
    try { return await page.evaluate(f, a); } catch (e) {
      V.warnings.push(st.where + ' -> ' + String(e && e.message).slice(0, 140));
      await wait(2500);
      return null;
    }
  };
}

/* Presses every visible control of every screen once, plus the first new button of any dialog it opens. */
async function pressEverything(page, st, V, screens) {
  const ev = safeEval(page, V, st), done = new Set();
  V.pressed = 0;
  V.skipped = [];
  for (const s of screens) {
    for (let i = 0; i < 45; i++) {
      st.where = V.size + ' ' + s + ' control ' + i;
      const r = await ev(pressNth, { s, i, done: [...done] });
      if (!r || r.end) break;
      if (r.skip) { if ((r.risky || r.flow) && !done.has(r.skip)) V.skipped.push(r.skip); done.add(r.skip); continue; }
      done.add(r.sig);
      V.pressed++;
      st.where = V.size + ' ' + s + ' -> ' + r.sig;
      await wait(350);
      const d = await ev(pressDialog, [...done]);
      if (d && d.sig) { done.add(d.sig); V.pressed++; st.where += ' -> ' + d.sig; await wait(350); }
      if (d && d.skip) done.add(d.skip);
      await ev(backTo, s);
      await wait(150);
    }
  }
}

async function hintToWin(page, max) {
  for (let n = 0; n < max && (await page.evaluate(curScreen)) !== 'ws'; n++) {
    await page.evaluate(() => { try { Game.hint(); } catch (e) { /* finished */ } });
    await wait(220);
  }
  return (await page.evaluate(curScreen)) === 'ws';
}

async function dailyFlow(page, st, V, w, h) {
  const ev = (f, a) => page.evaluate(f, a), out = V.daily = {};
  st.where = V.size + ' daily';
  await ev(backTo, 'home');
  await wait(400);
  out.coinsBefore = await ev(() => Store.S.coins);
  const card = await page.$('.dz-cta');
  if (!card) { V.errors.push(st.where + ' -> no Daily Puzzle card on the home screen'); return; }
  await card.click();
  await wait(900);
  const play = await page.$('#dzPlay');
  if (!play) { V.errors.push(st.where + ' -> no play button in the Daily Puzzle dialog'); return; }
  await play.click();
  await wait(2500);
  out.started = await ev(curScreen);
  const fps = ev(measureFps, 3000);
  for (let k = 0; k < 6; k++) {
    await page.mouse.move(w * 0.3, h * 0.86);
    await page.mouse.down();
    await page.mouse.move(w * 0.55, h * 0.42, { steps: 14 });
    await page.mouse.up();
  }
  out.fps = await fps;
  out.won = await hintToWin(page, 150);
  out.coinsAfter = await ev(() => Store.S.coins);
  out.winScreen = oneLine(await ev(() => (document.getElementById('wsW') || {}).innerText)).slice(0, 200);
  if (!out.won) V.errors.push(st.where + ' -> the Daily Puzzle did not reach the win screen');
}

async function campaignFlow(page, st, V) {
  const ev = (f, a) => page.evaluate(f, a), out = V.campaign = {};
  st.where = V.size + ' campaign';
  await ev(backTo, 'levels');
  await wait(600);
  const before = await ev(() => JSON.parse(JSON.stringify(Store.S)));
  out.levelControls = await ev(() => [...new Set([...document.querySelectorAll('[data-a]')].filter(e => e.offsetParent).map(e => e.dataset.a))]);
  out.card = await ev(() => {
    const els = [...document.querySelectorAll('[data-a][data-v]')].filter(e => e.offsetParent && e.dataset.v === '1');
    const el = els.find(e => /lv|lvl|level|play/i.test(e.dataset.a)) || els[0];
    if (!el) return null;
    el.click();
    return el.dataset.a + ':' + el.dataset.v;
  });
  await wait(1300);
  if ((await ev(curScreen)) !== 'gs') {
    out.dialog = await ev(() => {
      const b = [...document.querySelectorAll('#mbox button, #mbox [data-a]')].find(e => e.offsetParent && /грати|почати|старт|▶/i.test(e.innerText));
      if (!b) return null;
      b.click();
      return String(b.innerText).trim().slice(0, 30);
    });
    await wait(1500);
  }
  out.started = await ev(curScreen);
  if (out.started !== 'gs') { V.errors.push(st.where + ' -> level 1 did not start (pressed ' + out.card + ')'); return; }
  await ev(backgroundAndBack);
  await wait(500);
  out.afterBackground = await ev(() => { const b = document.getElementById('mbox'); return { screen: typeof UI.cur === 'function' ? UI.cur() : UI.cur, dialog: b && b.offsetParent ? String(b.innerText).slice(0, 100) : '' }; });
  if (out.afterBackground.dialog) {
    await ev(() => { const b = [...document.querySelectorAll('#mbox button, #mbox [data-a]')].find(e => e.offsetParent && /продовж|далі|▶/i.test(e.innerText)); if (b) b.click(); else UI.closeModal(); });
    await wait(600);
  }
  out.won = await hintToWin(page, 100);
  if (!out.won) { V.errors.push(st.where + ' -> level 1 did not reach the win screen'); return; }
  out.winScreen = oneLine(await ev(() => (document.getElementById('wsW') || {}).innerText)).slice(0, 200);
  await wait(1500);
  const after = await ev(() => JSON.parse(JSON.stringify(Store.S)));
  out.changed = Object.keys(after).filter(k => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
  out.coins = [before.coins, after.coins];
  st.where = V.size + ' campaign reopen';
  await page.reload({ waitUntil: 'load' });
  await wait(2500);
  const back = await ev(() => JSON.parse(JSON.stringify(Store.S)));
  out.lostAfterReopen = out.changed.filter(k => JSON.stringify(back[k]) !== JSON.stringify(after[k]));
  out.coinsAfterReopen = back.coins;
  if (back.coins !== after.coins) V.errors.push(st.where + ' -> coins changed after reopening: ' + after.coins + ' -> ' + back.coins);
}

async function arenaFlow(page, st, V) {
  const ev = (f, a) => page.evaluate(f, a), out = V.arena = {};
  st.where = V.size + ' arena';
  await ev(backTo, 'arena');
  await wait(800);
  out.controls = await ev(() => [...document.querySelectorAll('[data-a], button')].filter(e => e.offsetParent).map(e => (e.dataset.a || e.id || 'button') + ':' + String(e.innerText).trim().slice(0, 24)).slice(0, 14));
  out.pressed = await ev(() => {
    const els = [...document.querySelectorAll('[data-a], button')].filter(e => e.offsetParent);
    const el = els.find(e => /find|fight|battle|ranked|casual|play/i.test(e.dataset.a || '')) || els.find(e => /бій|битв|знайти/i.test(e.innerText));
    if (!el) return null;
    el.click();
    return (el.dataset.a || el.id) + ':' + String(el.innerText).trim().slice(0, 24);
  });
  if (!out.pressed) { V.errors.push(st.where + ' -> no fight button on the arena screen'); return; }
  const seen = [];
  for (let k = 0; k < 25 && seen.filter(x => x === 'gs').length < 5; k++) { await wait(1000); seen.push(await ev(curScreen)); }
  out.screens = seen.join(',');
  out.opponent = await ev(() => String((document.getElementById('fOpN') || {}).textContent || ''));
  if (!seen.includes('gs')) { V.errors.push(st.where + ' -> the fight did not start'); return; }
  st.where = V.size + ' arena surrender';
  await ev(() => { try { Arena.surrender(); } catch (e) { window.__surrenderError = String(e); } });
  await wait(1200);
  out.confirm = await ev(() => { const b = [...document.querySelectorAll('#mbox button, #mbox [data-a]')].find(e => e.offsetParent && /так|здат|вийти|ok/i.test(e.innerText)); if (!b) return null; b.click(); return String(b.innerText).trim().slice(0, 24); });
  await wait(2500);
  out.end = await ev(() => ({ screen: typeof UI.cur === 'function' ? UI.cur() : UI.cur, text: String((document.getElementById('wsW') || document.body).innerText || '').slice(0, 160), error: window.__surrenderError || '' }));
  out.end.text = oneLine(out.end.text);
  await ev(backTo, 'home');
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const report = { base: BASE, sizes: [] };
try {
  for (const [w, h] of SIZES) {
    const V = { size: w + 'x' + h, errors: [], warnings: [], net: 0, overflow: {}, smallTaps: {} };
    const st = { where: V.size + ' load', api: [], blocked: [] };
    const { ctx, page } = await openGame(browser, w, h, V, st);
    const ev = (f, a) => page.evaluate(f, a);
    if (w === 360) V.load = await ev(() => { const r = performance.getEntriesByType('resource'), n = performance.getEntriesByType('navigation')[0]; return { files: r.length, kb: Math.round(r.reduce((s, e) => s + (e.transferSize || e.encodedBodySize || 0), 0) / 1024), loadMs: n ? Math.round(n.loadEventEnd) : null }; });
    const screens = await ev(() => Object.keys(UI.R).filter(s => s !== 'gs' && s !== 'ws'));
    V.screens = screens;
    for (const s of screens) {
      st.where = V.size + ' ' + s;
      const o = await ev(layoutCheck, s);
      if (o.err) V.errors.push(st.where + ' -> cannot open: ' + o.err);
      if (o.ow > 0 || o.bad.length) V.overflow[s] = { extraPx: o.ow, items: o.bad };
      if (o.small.length) V.smallTaps[s] = o.small;
      if (SHOTS) await page.screenshot({ path: SHOTS + '/' + V.size + '-' + s + '.png' });
    }
    if (w === 360) {
      await pressEverything(page, st, V, screens);
      await dailyFlow(page, st, V, w, h);
      await campaignFlow(page, st, V);
      await arenaFlow(page, st, V);
    }
    V.xss = await ev(() => window.__xss || 0);
    V.heapMB = await ev(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
    V.longTasks = await ev(() => ({ count: window.__lt.length, maxMs: window.__lt.length ? Math.max(...window.__lt) : 0 }));
    V.apiCalls = [...new Set(st.api)].slice(0, 30);
    V.blocked = [...new Set(st.blocked)].slice(0, 10);
    report.sizes.push(V);
    await ctx.close();
  }
} catch (e) {
  report.crash = String((e && e.stack) || e).slice(0, 700);
} finally {
  await browser.close();
}
report.errors = report.sizes.flatMap(v => v.errors.map(e => v.size + ': ' + e).concat(v.xss ? [v.size + ': HTML inside a player name was executed (' + v.xss + ' times)'] : []));
if (report.crash) report.errors.push('the smoke test itself crashed: ' + report.crash);
console.log(JSON.stringify(report, null, 1));
process.exit(report.errors.length ? 1 : 0);
