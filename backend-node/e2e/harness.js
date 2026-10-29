'use strict';
/**
 * End-to-end harness: the real backend (in memory, mock payments, a mailbox the tests can read) and the built frontend
 * (frontend/dist) served from one address, driven by a real Chrome through the DevTools protocol. No packages are added:
 * Chrome is the one on the machine (CHROME_PATH, or the usual places) and WebSocket is Node's own.
 *
 *   npm run build   (in frontend)    then    npm run test:e2e   (in backend-node)
 *
 * The page is opened at 127.0.0.2, not localhost: the frontend sends API calls to localhost:8000 when it is served from
 * localhost with a port (the dev set-up), and to its own address on any other host, which is how it runs once deployed.
 */
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const { MemoryStore } = require('../src/accounts/memory-store');

const DIST = path.join(__dirname, '..', '..', 'frontend', 'dist', 'opportunity-map', 'browser');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/** Why the end-to-end tests cannot run here, or null. */
function unavailable() {
  if (!findChrome()) return 'Chrome not found (set CHROME_PATH)';
  if (!fs.existsSync(path.join(DIST, 'index.html'))) return 'frontend/dist not built (run `npm run build` in frontend)';
  return null;
}

/** The address that may read the reports at /admin/reports in the test site. */
const ADMIN_EMAIL = 'quan-tri-e2e@example.com';

/** The site: backend and built frontend on one port. */
async function startSite() {
  const mailbox = [];
  const store = new MemoryStore();
  const mailer = { kind: 'capture', enabled: true, real: false, async send(message) { mailbox.push(message); } };
  let app;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) return app(req, res);
    const clean = decodeURIComponent(req.url.split('?')[0]);
    let file = path.normalize(path.join(DIST, clean));
    if (!file.startsWith(DIST)) {
      res.writeHead(403);
      return res.end();
    }
    if ((!fs.existsSync(file) || fs.statSync(file).isDirectory()) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
  // The address is known only now, and the links in the emails must point at it.
  const origin = `http://127.0.0.2:${server.address().port}`;
  ({ app } = createApp({
    log: false,
    living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
    mailer,
    accounts: { store, appUrl: origin, rateLimits: { login: 1000, register: 1000, mail: 1000, export: 1000 } },
    aiMeter: { mode: 'off' },
    billing: { rateLimits: { checkout: 1000 } },
    feedback: { rateLimits: { perHour: 1000, perDay: 1000 }, adminEmails: ADMIN_EMAIL },
    analytics: { adminEmails: ADMIN_EMAIL, rateLimits: { perMinute: 1000 } },
  }));
  return { origin, mailbox, store, adminEmail: ADMIN_EMAIL, close: () => new Promise((resolve) => server.close(resolve)) };
}

/** A Chrome window with a few verbs: goto, click, type, text, waitFor. */
async function startBrowser({ width = 1280, height = 900 } = {}) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hcv-e2e-'));
  const chrome = spawn(findChrome(), [...(process.env.CI ? ['--no-sandbox'] : []), '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    } catch {
      /* not up yet */
    }
  }
  if (!target) {
    chrome.kill();
    throw new Error('Chrome did not start');
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
    if (msg.method === 'Runtime.exceptionThrown') errors.push((msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).split('\n')[0]);
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression) => {
    const r = (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result;
    if (r.exceptionDetails) throw new Error(`in the page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const q = JSON.stringify;
  const api = {
    errors,
    evaluate,
    /** `app: false` for a page the server draws itself (a printable report): it is loaded when the document is complete. */
    async goto(url, { app = true } = {}) {
      await send('Page.navigate', { url });
      // The first paint of the app: its root has content.
      await api.waitFor(app ? `document.readyState === 'complete' && (document.querySelector('app-root')?.children.length ?? 0) > 0` : `document.readyState === 'complete' && location.href !== 'about:blank'`, 'the page to load');
    },
    /** Polls an expression until it is truthy (the page is drawn by Angular, so there is always a moment of waiting). */
    async waitFor(expression, what = expression, timeout = 15_000) {
      const end = Date.now() + timeout;
      let last;
      while (Date.now() < end) {
        try {
          last = await evaluate(expression);
          if (last) return last;
        } catch (error) {
          last = error.message;
        }
        await sleep(100);
      }
      throw new Error(`Timed out waiting for ${what} (last: ${String(last).slice(0, 160)})`);
    },
    exists: (selector) => evaluate(`!!document.querySelector(${q(selector)})`),
    text: (selector) => evaluate(`document.querySelector(${q(selector)})?.textContent.replace(/\\s+/g, ' ').trim() ?? null`),
    async click(selector) {
      await api.waitFor(`!!document.querySelector(${q(selector)})`, `${selector} to exist`);
      await evaluate(`document.querySelector(${q(selector)}).click()`);
    },
    /** Clicks the first element of `selector` whose text matches `pattern` (a RegExp source). */
    async clickText(selector, pattern) {
      await api.waitFor(`[...document.querySelectorAll(${q(selector)})].some((e) => new RegExp(${q(pattern)}).test(e.textContent))`, `${selector} with text /${pattern}/`);
      await evaluate(`[...document.querySelectorAll(${q(selector)})].find((e) => new RegExp(${q(pattern)}).test(e.textContent)).click()`);
    },
    async type(selector, value) {
      await api.waitFor(`!!document.querySelector(${q(selector)})`, `${selector} to exist`);
      await evaluate(`(() => { const e = document.querySelector(${q(selector)}); e.focus(); e.value = ${q(value)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    },
    async screenshot(file) {
      fs.writeFileSync(file, Buffer.from((await send('Page.captureScreenshot')).result.data, 'base64'));
    },
    async close() {
      try {
        ws.close();
      } catch {
        /* closed */
      }
      chrome.kill();
      await sleep(300);
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    },
  };
  return api;
}

module.exports = { startSite, startBrowser, unavailable, sleep };
