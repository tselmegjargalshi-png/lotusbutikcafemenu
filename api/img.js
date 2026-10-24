import { get } from '@vercel/blob';
import { IMAGE_NAME_RE } from '../lib/store.js';

const TYPES = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };

// Serves product photos from the private Blob store. Names are unique per upload,
// so responses are cached as immutable at the edge and in browsers.
export default async function handler(req, res) {
  const name = String(new URL(req.url, 'http://x').searchParams.get('name') || '');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
  if (!IMAGE_NAME_RE.test(name)) { res.statusCode = 404; return res.end('Not found'); }
  try {
    const blob = await get(`images/${name}`, { access: 'private' });
    if (!blob || blob.statusCode !== 200) { res.statusCode = 404; return res.end('Not found'); }
    const buf = Buffer.from(await new Response(blob.stream).arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', TYPES[name.split('.').pop()]);
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(req.method === 'HEAD' ? undefined : buf);
  } catch (err) {
    console.error('image read failed', err);
    res.statusCode = 502;
    return res.end('Image unavailable');
  }
}
