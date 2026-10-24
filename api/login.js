import { checkCredentials, createSessionCookie, isRateLimited, recordFailure, clearFailures } from '../lib/auth.js';
import { send, readJson, isSameOriginJson } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!isSameOriginJson(req)) return send(res, 403, { error: 'Geçersiz istek.' });
  if (isRateLimited(req)) {
    return send(res, 429, { error: 'Çok fazla hatalı deneme. Lütfen 15 dakika sonra tekrar deneyin.' });
  }
  let body;
  try {
    body = await readJson(req, 4096);
  } catch {
    return send(res, 400, { error: 'Geçersiz istek.' });
  }
  if (!checkCredentials(body.username, body.password)) {
    recordFailure(req);
    await new Promise((r) => setTimeout(r, 400));
    return send(res, 401, { error: 'Kullanıcı adı veya şifre hatalı.' });
  }
  clearFailures(req);
  return send(res, 200, { ok: true }, { 'Set-Cookie': createSessionCookie(String(body.username).trim().toLowerCase()), 'Cache-Control': 'no-store' });
}
