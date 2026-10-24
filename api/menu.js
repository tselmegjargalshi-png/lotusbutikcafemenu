import { readMenu, publicMenu } from '../lib/store.js';
import { send } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  try {
    const menu = await readMenu();
    // Short edge cache: busy hours stay fast, admin edits show within ~15 s.
    return send(res, 200, publicMenu(menu), {
      'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60',
    });
  } catch (err) {
    console.error('menu read failed', err);
    return send(res, 500, { error: 'Menü şu anda yüklenemedi.' });
  }
}
