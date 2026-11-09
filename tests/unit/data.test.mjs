/* Campaign and fight data the client ships, and the rules the server shares with it. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

/* The data file index.html actually loads (v<N>/data.js), so the test follows new versions. */
function dataFile() {
  const html = read('index.html'), k = html.indexOf('/data.js');
  assert.ok(k > 0, 'index.html loads no data.js');
  return html.slice(html.lastIndexOf('"', k) + 1, k + '/data.js'.length);
}
function clientData() {
  const ctx = { console };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read(dataFile()) + '\n;this.__D = DATA;', ctx);
  return ctx.__D;
}
const D = clientData();
const arena = read('api/arena.js');

/* A constant from api/arena.js, e.g. const HEROES = [['fox', 1], ...]; or const FTIME = 180, ... */
function serverConst(name) {
  const head = 'const ' + name + ' = ', i = arena.indexOf(head);
  assert.ok(i >= 0, name + ' not found in api/arena.js');
  const rest = arena.slice(i + head.length);
  if (rest[0] !== '[') return Number.parseInt(rest, 10);
  return JSON.parse(rest.slice(0, rest.indexOf('];') + 1).replaceAll("'", '"'));
}

test('the campaign has 20 chapters of 10 levels - 200 levels', () => {
  assert.equal(D.CH.length, 20);
  for (const c of D.CH) assert.equal(c.ids.length, 10, c.n);
  assert.equal(D.LEVELS.length, 200);
});

test('levels are numbered 1-200 in order and use their chapter pictures', () => {
  D.LEVELS.forEach((L, k) => {
    const at = 'level ' + (k + 1);
    assert.equal(L.id, k + 1, at);
    assert.equal(L.ch, Math.floor(k / 10), at);
    assert.equal(L.i, k % 10, at);
    assert.equal(L.pid, D.CH[L.ch].ids[L.i], at);
    assert.ok(L.g >= 3 && L.g <= 8, at + ' grid ' + L.g);
    assert.ok(L.par > 0, at + ' par');
    assert.ok(L.timed ? L.limit > 0 : L.limit === 0, at + ' time limit');
  });
});

test('every chapter can be unlocked with the stars of the chapters before it', () => {
  assert.equal(D.CH[0].need, 0);
  D.CH.forEach((c, i) => {
    if (i) assert.ok(c.need >= D.CH[i - 1].need, c.n);
    assert.ok(c.need <= i * 10 * 3, c.n + ' needs ' + c.need + ' stars');
  });
});

test('heroes and their unlock levels match the server (bots and profiles)', () => {
  /* Array.from: the client data lives in its own VM realm, and strict deepEqual also compares array prototypes. */
  assert.deepEqual(Array.from(D.HEROES, h => [h.id, h.lvl]), serverConst('HEROES'));
});

test('every hero super-strike is one the server accepts', () => {
  const sks = serverConst('SKS');
  for (const h of D.HEROES) assert.ok(sks.includes(h.sp.id), h.id + ': ' + h.sp.id);
});

test('online fights use the same pictures as the gallery', () => {
  const sort = a => [...a].sort((x, y) => x - y);
  assert.deepEqual(sort(serverConst('PIDS')), sort(D.GALLERY));
});

test('fight length and starting HP match the server', () => {
  assert.equal(D.FIGHT.time, serverConst('FTIME'));
  assert.equal(D.FIGHT.hp, 100);
});

test('leagues, streak rewards and ids are well-formed', () => {
  assert.equal(D.LEAGUES[0].min, 0);
  for (let i = 1; i < D.LEAGUES.length; i++) assert.ok(D.LEAGUES[i].min > D.LEAGUES[i - 1].min, D.LEAGUES[i].n);
  assert.equal(D.STREAK.length, 7);
  assert.ok(D.STREAK.every(x => x > 0));
  for (const k of ['HEROES', 'SKILLS', 'ACH', 'FRAMES', 'THEMES', 'DAILY', 'PROF']) {
    const ids = D[k].map(x => x.id);
    assert.equal(new Set(ids).size, ids.length, k);
  }
});
