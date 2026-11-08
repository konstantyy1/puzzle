/* Daily puzzle calendar: a new day starts at midnight Kyiv time (the client uses the same rules) */
const TZ = 'Europe/Kiev';
function parts(t) {
  const d = new Date(t === undefined ? Date.now() : t);
  try {
    const p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(x => { p[x.type] = x.value; });
    if (p.year && p.month && p.day) return { day: p.year + '-' + p.month + '-' + p.day, h: (+p.hour || 0) % 24 };
  } catch (e) {}
  const u = new Date(d.getTime() + 2 * 3600e3);
  return { day: u.toISOString().slice(0, 10), h: u.getUTCHours() };
}
export const kyivDay = t => parts(t).day;
export const kyivHour = t => parts(t).h;
export const dayNum = day => Math.floor(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 864e5);
export const dayGrid = day => 4 + (dayNum(day) % 3);
export const okDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && (d === kyivDay() || d === kyivDay(Date.now() - 864e5));
