// خادم تطوير بسيط بدون Netlify CLI: يخدم public/ ويوجّه /api/* إلى الدوال (مخزن ذاكرة مؤقت)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const PORT = process.env.PORT || 8888, ROOT = new URL('../public/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    const api = url.pathname.match(/^\/api\/([\w-]+)$/), m = url.pathname.match(/^\/(join|verify)\/([\w-]+)$/);
    if (m) { res.writeHead(302, { location: `/?${m[1]}=${m[2]}` }); return res.end(); }
    if (api) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const fn = (await import(`../netlify/functions/${api[1]}.js`)).default;
      const r = await fn(new Request(url, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    const file = join(ROOT, normalize(url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(ROOT)) throw 0;
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file));
  } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
