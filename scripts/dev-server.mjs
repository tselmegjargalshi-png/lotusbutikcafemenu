// Minimal local server that mimics Vercel: static files from public/, functions from api/.
// Without BLOB_READ_WRITE_TOKEN the menu is read from lib/seed.js and saving is disabled.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.pdf': 'application/pdf' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/img/')) {
      req.url = `/api/img?name=${encodeURIComponent(url.pathname.slice(5))}`;
      return await (await import(join(root, 'api/img.js'))).default(req, res);
    }
    if (url.pathname.startsWith('/api/')) {
      const mod = await import(join(root, `${url.pathname}.js`));
      return await mod.default(req, res);
    }
    let file = normalize(join(root, 'public', url.pathname));
    if (!file.startsWith(join(root, 'public'))) throw new Error('bad path');
    if (url.pathname === '/') file = join(root, 'public/index.html');
    else if (!extname(file)) file += '.html';
    await stat(file);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}`));
