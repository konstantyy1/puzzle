import crypto from 'node:crypto';

export const TOKEN = process.env.BOT_TOKEN || '';
export const SECRET = crypto.createHash('sha256').update('pz:' + TOKEN).digest('hex');
export const hookSecret = () => SECRET.slice(0, 48);
export const b64u = s => Buffer.from(String(s)).toString('base64url');
export const unb64u = s => Buffer.from(String(s), 'base64url').toString();
export const sig = d => crypto.createHmac('sha256', SECRET).update(String(d)).digest('base64url').slice(0, 16);
export const rid = (n = 10) => crypto.randomBytes(n * 2).toString('base64url').replace(/[-_]/g, '').slice(0, n);
export const rnd = n => crypto.randomInt(n);

const ADJ = ['Швидкий', 'Хоробрий', 'Мудрий', 'Веселий', 'Хитрий', 'Спритний', 'Сміливий', 'Тихий', 'Яскравий', 'Зоряний', 'Сонячний', 'Місячний', 'Крижаний', 'Вогняний', 'Золотий',
  'Срібний', 'Чарівний', 'Грайливий', 'Дивовижний', 'Могутній', 'Щасливий', 'Кмітливий', 'Невловимий', 'Бадьорий', 'Легендарний', 'Таємничий', 'Райдужний', 'Космічний', 'Лісовий', 'Морський'];
const ANI = ['Лис', 'Їжак', 'Ведмідь', 'Вовк', 'Борсук', 'Єнот', 'Тигр', 'Лев', 'Дельфін', 'Пінгвін', 'Кит', 'Орел', 'Сокіл', 'Кролик', 'Бобер', 'Хом’як', 'Жираф', 'Носоріг', 'Слон',
  'Крокодил', 'Пелікан', 'Леопард', 'Гепард', 'Ягуар', 'Яструб', 'Бегемот', 'Дракон', 'Єдиноріг', 'Кіт', 'Мамонт'];
export function alias(uid) {
  const h = crypto.createHmac('sha256', SECRET).update('alias:' + uid).digest();
  return ADJ[h[0] % ADJ.length] + ' ' + ANI[h[1] % ANI.length] + ' ' + (10 + (h.readUInt16BE(2) % 90));
}
export function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const h = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const p = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return (/^(localhost|127\.)/.test(h) ? p : 'https') + '://' + h;
}
export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) { try { return JSON.parse(String(req.body)); } catch { return {}; } }
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > 200000) break; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}
