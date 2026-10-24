import { randomBytes } from 'node:crypto';
import { put } from '@vercel/blob';
import { getSession } from '../../lib/auth.js';
import { hasStorage, IMAGE_NAME_RE } from '../../lib/store.js';
import { send } from '../../lib/http.js';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BYTES = 3 * 1024 * 1024;

// The browser resizes photos before upload, so 3 MB is generous and stays under Vercel's 4.5 MB body limit.
const TYPES = {
  'image/webp': { ext: 'webp', ok: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  'image/jpeg': { ext: 'jpg', ok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', ok: (b) => b.readUInt32BE(0) === 0x89504e47 },
};

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw Object.assign(new Error('Fotoğraf çok büyük (en fazla 3 MB).'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' }, NO_STORE);
  if (!getSession(req)) return send(res, 401, { error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' }, NO_STORE);
  if (!sameOrigin(req)) return send(res, 403, { error: 'Geçersiz istek.' }, NO_STORE);
  if (!hasStorage()) return send(res, 503, { error: 'Depolama ayarlanmamış.' }, NO_STORE);

  const type = TYPES[String(req.headers['content-type'] || '').split(';')[0].trim()];
  if (!type) return send(res, 415, { error: 'Sadece JPG, PNG veya WEBP fotoğraf yüklenebilir.' }, NO_STORE);

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return send(res, err.status || 400, { error: err.message }, NO_STORE);
  }
  if (body.length < 12 || body.length > MAX_BYTES || !type.ok(body)) {
    return send(res, 400, { error: 'Dosya geçerli bir fotoğraf değil.' }, NO_STORE);
  }

  const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${type.ext}`;
  if (!IMAGE_NAME_RE.test(name)) return send(res, 500, { error: 'Fotoğraf adı oluşturulamadı.' }, NO_STORE);
  try {
    await put(`images/${name}`, body, { access: 'private', contentType: req.headers['content-type'], addRandomSuffix: false });
    return send(res, 200, { image: name }, NO_STORE);
  } catch (err) {
    console.error('image upload failed', err);
    return send(res, 500, { error: 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.' }, NO_STORE);
  }
}
