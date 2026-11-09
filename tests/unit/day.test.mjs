/* The Daily Puzzle calendar: days follow Kyiv time, the grid rotates daily, only today and yesterday count. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kyivDay, kyivHour, dayNum, dayGrid, okDay } from '../../api/_lib/day.js';

test('a new Daily Puzzle day starts at midnight Kyiv time in winter (UTC+2)', () => {
  assert.equal(kyivDay(Date.UTC(2026, 10, 9, 21, 59)), '2026-11-09');
  assert.equal(kyivDay(Date.UTC(2026, 10, 9, 22, 0)), '2026-11-10');
});

test('a new Daily Puzzle day starts at midnight Kyiv time in summer (UTC+3)', () => {
  assert.equal(kyivDay(Date.UTC(2027, 6, 1, 20, 59)), '2027-07-01');
  assert.equal(kyivDay(Date.UTC(2027, 6, 1, 21, 0)), '2027-07-02');
});

test('the reminder cron (16:00 UTC) falls inside the 17-22 Kyiv evening window all year', () => {
  for (let month = 0; month < 12; month++) {
    const h = kyivHour(Date.UTC(2027, month, 15, 16, 0));
    assert.ok(h >= 17 && h <= 22, 'month ' + (month + 1) + ': ' + h + ':00');
  }
});

test('the grid goes 4x4 -> 5x5 -> 6x6 -> 4x4 on consecutive days, also across months and years', () => {
  for (const [a, b] of [['2026-11-09', '2026-11-10'], ['2026-11-30', '2026-12-01'], ['2026-12-31', '2027-01-01'], ['2028-02-28', '2028-02-29']]) {
    assert.equal(dayNum(b) - dayNum(a), 1, a + ' -> ' + b);
    const g = dayGrid(a), n = dayGrid(b);
    assert.ok([4, 5, 6].includes(g), a + ': ' + g);
    assert.equal(n, g === 6 ? 4 : g + 1, a + ' -> ' + b);
  }
});

test('results are accepted only for today and yesterday', () => {
  assert.equal(okDay(kyivDay()), true);
  assert.equal(okDay(kyivDay(Date.now() - 864e5)), true);
  for (const d of ['2020-01-01', kyivDay(Date.now() + 864e5), '2026-1-9', '', 20261109, null, undefined]) assert.equal(!!okDay(d), false, String(d));
});
