import { get, put } from '@vercel/blob';
import seed from './seed.js';

const KEY = 'menu.json';
const LIMITS = { categories: 60, items: 300, name: 80, desc: 200, note: 160, unit: 20 };
const PRICE_RE = /^\d{1,6}([.,]\d{1,2})?(\s*[/-]\s*\d{1,6}([.,]\d{1,2})?)?$/;

export class MenuError extends Error {}

export function hasStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

export async function readMenu() {
  if (!hasStorage()) return { ...clone(seed), source: 'seed' };
  const res = await get(KEY, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) return { ...clone(seed), source: 'seed' };
  const text = await new Response(res.stream).text();
  return { ...JSON.parse(text), source: 'blob' };
}

function str(v, max) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function id(v, prefix) {
  const s = String(v ?? '');
  return /^[a-z0-9_-]{1,40}$/i.test(s) ? s : `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Normalises an admin-submitted menu; throws with a Turkish message the UI can show.
export function sanitizeMenu(input) {
  if (!input || !Array.isArray(input.categories)) throw new MenuError('Geçersiz menü verisi.');
  if (input.categories.length > LIMITS.categories) throw new MenuError('Çok fazla kategori var.');
  const seen = new Set();
  const unique = (v, prefix) => {
    let out = id(v, prefix);
    while (seen.has(out)) out = id('', prefix);
    seen.add(out);
    return out;
  };
  const categories = input.categories.map((c, ci) => {
    const name = str(c.name, LIMITS.name);
    if (!name) throw new MenuError(`${ci + 1}. kategorinin adı boş olamaz.`);
    const items = Array.isArray(c.items) ? c.items : [];
    if (items.length > LIMITS.items) throw new MenuError(`"${name}" kategorisinde çok fazla ürün var.`);
    return {
      id: unique(c.id, 'c'),
      name,
      note: str(c.note, LIMITS.note),
      hidden: Boolean(c.hidden),
      items: items.map((it, ii) => {
        const iname = str(it.name, LIMITS.name);
        if (!iname) throw new MenuError(`"${name}" kategorisinde ${ii + 1}. ürünün adı boş.`);
        const price = str(it.price, 30);
        if (price && !PRICE_RE.test(price)) {
          throw new MenuError(`"${iname}" fiyatı geçersiz: "${price}". Örnek: 150 veya 500 / 750`);
        }
        return {
          id: unique(it.id, 'i'),
          name: iname,
          desc: str(it.desc, LIMITS.desc),
          price,
          unit: str(it.unit, LIMITS.unit),
          hidden: Boolean(it.hidden),
          check: Boolean(it.check),
        };
      }),
    };
  });
  return { categories };
}

export async function writeMenu(menu) {
  const data = { ...menu, updatedAt: new Date().toISOString() };
  const body = JSON.stringify(data);
  const opts = { access: 'private', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 };
  await put(KEY, body, { ...opts, allowOverwrite: true });
  // Keep a dated copy of every save so a bad edit can be rolled back.
  await put(`backups/menu-${data.updatedAt.replace(/[:.]/g, '-')}.json`, body, opts).catch(() => {});
  return data;
}

// Public view: drop hidden entries and admin-only fields.
export function publicMenu(menu) {
  return {
    updatedAt: menu.updatedAt || null,
    categories: menu.categories
      .filter((c) => !c.hidden)
      .map((c) => ({
        id: c.id,
        name: c.name,
        note: c.note || '',
        items: c.items.filter((i) => !i.hidden).map(({ id, name, desc, price, unit }) => ({ id, name, desc, price, unit })),
      }))
      .filter((c) => c.items.length > 0),
  };
}
