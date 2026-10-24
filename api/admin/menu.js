import { getSession } from '../../lib/auth.js';
import { readMenu, writeMenu, sanitizeMenu, hasStorage, MenuError } from '../../lib/store.js';
import { send, readJson, isSameOriginJson } from '../../lib/http.js';

const NO_STORE = { 'Cache-Control': 'no-store' };

export default async function handler(req, res) {
  const session = getSession(req);
  if (!session) return send(res, 401, { error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' }, NO_STORE);

  if (req.method === 'GET') {
    try {
      const menu = await readMenu();
      return send(res, 200, { user: session.u, storage: hasStorage(), menu }, NO_STORE);
    } catch (err) {
      console.error('admin read failed', err);
      return send(res, 500, { error: 'Menü okunamadı.' }, NO_STORE);
    }
  }

  if (req.method === 'PUT') {
    if (!isSameOriginJson(req)) return send(res, 403, { error: 'Geçersiz istek.' }, NO_STORE);
    if (!hasStorage()) return send(res, 503, { error: 'Depolama ayarlanmamış (BLOB_READ_WRITE_TOKEN eksik).' }, NO_STORE);
    try {
      const body = await readJson(req);
      const current = await readMenu();
      if (current.updatedAt && body.baseUpdatedAt !== current.updatedAt) {
        return send(res, 409, {
          error: 'Menü başka bir yerden değiştirilmiş. Sayfayı yenileyip değişikliklerinizi tekrar yapın.',
        }, NO_STORE);
      }
      const saved = await writeMenu(sanitizeMenu(body.menu));
      return send(res, 200, { ok: true, menu: saved }, NO_STORE);
    } catch (err) {
      if (err.status === 413) return send(res, 413, { error: err.message }, NO_STORE);
      if (err instanceof SyntaxError) return send(res, 400, { error: 'Geçersiz JSON.' }, NO_STORE);
      if (err instanceof MenuError) return send(res, 400, { error: err.message }, NO_STORE);
      console.error('admin save failed', err);
      return send(res, 500, { error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }, NO_STORE);
    }
  }

  return send(res, 405, { error: 'Method not allowed' }, NO_STORE);
}
