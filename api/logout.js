import { clearSessionCookie } from '../lib/auth.js';
import { send } from '../lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  return send(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(), 'Cache-Control': 'no-store' });
}
