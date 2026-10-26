'use strict';
/**
 * `node deploy/share-local.js` — serves the built site (frontend/dist/opportunity-map/browser) and forwards /api to the
 * backend on one address, so a tunnel (cloudflared, ngrok) can show the whole site from this machine, for a short trial
 * without a domain. Build first: `npm run build` in frontend; run the backend: `npm start` in backend-node.
 * PORT (default 8090) is where this listens; BACKEND (default http://127.0.0.1:8000) is the API.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'frontend', 'dist', 'opportunity-map', 'browser');
const PORT = Number(process.env.PORT || 8090);
const BACKEND = new URL(process.env.BACKEND || 'http://127.0.0.1:8000');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`No build found at ${ROOT}. Run "npm run build" in frontend first.`);
  process.exit(1);
}

function proxy(req, res) {
  const upstream = http.request(
    { host: BACKEND.hostname, port: BACKEND.port, path: req.url, method: req.method, headers: { ...req.headers, host: BACKEND.host, 'x-forwarded-proto': 'https' } },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end('{"error":"backend_unreachable"}');
  });
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    if (req.url.startsWith('/api/')) return proxy(req, res);
    const clean = decodeURIComponent(req.url.split('?')[0]);
    let file = path.normalize(path.join(ROOT, clean));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    // /career is served from career.html (the same page with its own title and share tags), else the app's own routes.
    if ((!fs.existsSync(file) || fs.statSync(file).isDirectory()) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
    const ext = path.extname(file);
    const asset = /^[^.]+-[A-Z0-9]{8}\.(js|css)$/.test(path.basename(file));
    res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': asset ? 'public, max-age=31536000, immutable' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Site and API on http://127.0.0.1:${PORT} (API from ${BACKEND.origin})`));
