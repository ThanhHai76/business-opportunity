'use strict';
/** Visit statistics (src/analytics) and the free sample of the paid report (src/reports, GET /sample). */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const { MemoryStore } = require('../src/accounts/memory-store');
const { pathKey, dayOf } = require('../src/analytics');

const ORIGIN = 'http://localhost:4200';
const ADMIN = 'chu@example.com';

describe('Visit statistics', () => {
  let server;
  let root;
  let store;
  let admin;

  before(async () => {
    store = new MemoryStore();
    const { app } = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      accounts: { store, rateLimits: { login: 1000, register: 1000 } },
      aiMeter: { mode: 'off' },
      feedback: { adminEmails: ADMIN },
      analytics: { adminEmails: ADMIN, rateLimits: { perMinute: 1000 } },
    });
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    root = `http://127.0.0.1:${server.address().port}`;
    admin = await signUp(ADMIN, true);
  });
  after(() => new Promise((resolve) => server.close(resolve)));

  const browser = () => {
    let cookie = '';
    return async (method, path, body, headers = {}) => {
      const res = await fetch(root + path, { method, headers: { 'content-type': 'application/json', origin: ORIGIN, ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        /* html */
      }
      return { status: res.status, body: json, text };
    };
  };
  async function signUp(email, verified) {
    const b = browser();
    const reg = await b('POST', '/api/account/register', { email, password: 'mat-khau-dai-123', acceptTerms: true });
    assert.equal(reg.status, 201, reg.text);
    if (verified) await store.updateUser(reg.body.user.id, { emailVerifiedAt: new Date() });
    return b;
  }
  const send = (body, headers) => browser()('POST', '/api/analytics/event', body, headers);
  const summary = async (days) => (await admin('GET', `/api/analytics/admin/summary${days ? `?days=${days}` : ''}`)).body;
  const countOf = (rows, event, key) => rows.filter((r) => r.event === event && r.key === key).reduce((s, r) => s + r.n, 0);

  describe('folding a path into a page name', () => {
    it('keeps the pages of the site and folds the ids, so a made-up address cannot fill the table', () => {
      assert.equal(pathKey('/'), '/');
      assert.equal(pathKey('/career?lang=en'), '/career');
      assert.equal(pathKey('/phuong-xa/phuong-cau-giay'), '/phuong-xa/:slug');
      assert.equal(pathKey('/phuong-xa'), '/phuong-xa');
      assert.equal(pathKey('/living-score/area/phuong-x'), '/living-score/area/:slug');
      assert.equal(pathKey('/living-score/zzz/q'), '/living-score');
      assert.equal(pathKey('/property-intelligence/projects/abc'), '/property-intelligence/projects/:slug');
      assert.equal(pathKey('/property-intelligence/map?ward=x'), '/property-intelligence/map');
      assert.equal(pathKey('/khong-co-trang-nay/abc'), '/other');
      assert.equal(pathKey('/admin/reports'), '/other');
    });

    it('counts days in Vietnamese time', () => {
      assert.equal(dayOf(Date.UTC(2026, 9, 27, 18, 0)), '2026-10-28'); // 01:00 on the 28th in Hanoi
      assert.equal(dayOf(Date.UTC(2026, 9, 27, 16, 59)), '2026-10-27');
    });
  });

  describe('counting', () => {
    it('counts page views by page, a lookup, a help click and a sign-up, without keeping anything about the visitor', async () => {
      assert.equal((await send({ event: 'page_view', key: '/phuong-xa/phuong-cau-giay?x=1' })).status, 204);
      assert.equal((await send({ event: 'page_view', key: '/phuong-xa/phuong-tay-ho' })).status, 204);
      assert.equal((await send({ event: 'page_view', key: '/nonsense' })).status, 204);
      assert.equal((await send({ event: 'ward_lookup' })).status, 204);
      assert.equal((await send({ event: 'score_help', key: 'Living Score!' })).status, 204);
      assert.equal((await send({ event: 'signup' })).status, 204);

      const { rows } = await summary();
      assert.equal(countOf(rows, 'page_view', '/phuong-xa/:slug'), 2);
      assert.equal(countOf(rows, 'page_view', '/other'), 1);
      assert.equal(countOf(rows, 'ward_lookup', ''), 1);
      assert.equal(countOf(rows, 'score_help', 'living-score'), 1);
      assert.equal(countOf(rows, 'signup', ''), 1);
      assert.deepEqual(Object.keys(rows[0]).sort(), ['day', 'event', 'key', 'n']);
      assert.equal(rows[0].day, dayOf());
    });

    it('refuses an event a page may not send (the money ones are the server\'s own), extra fields and a foreign origin', async () => {
      const before = (await summary()).rows.length;
      assert.equal((await send({ event: 'order_paid', key: 'premium-month' })).status, 400);
      assert.equal((await send({ event: 'checkout_start' })).status, 400);
      assert.equal((await send({ event: 'page_view', key: '/', userId: 'x' })).status, 400);
      assert.notEqual((await send({ event: 'page_view', key: '/' }, { origin: 'https://evil.example' })).status, 204);
      assert.equal((await summary()).rows.length, before);
    });
  });

  describe('reading', () => {
    it('is for the administrator: 401 when nobody is signed in, 403 for anyone else', async () => {
      assert.equal((await browser()('GET', '/api/analytics/admin/summary')).status, 401);
      assert.equal((await (await signUp('thuong@example.com', true))('GET', '/api/analytics/admin/summary')).status, 403);
      assert.equal((await admin('GET', '/api/analytics/admin/summary')).status, 200);
    });

    it('gives the period asked for', async () => {
      const r = await summary(7);
      assert.equal(r.days, 7);
      assert.equal(r.since, dayOf(Date.now() - 6 * 86_400_000));
    });
  });

  describe('the free sample of the paid report', () => {
    it('is public, printable, marked as a sample, and counted', async () => {
      const before = countOf((await summary()).rows, 'sample_report', 'opened');
      const r = await browser()('GET', '/api/reports/sample');
      assert.equal(r.status, 200);
      assert.match(r.text, /Đây là báo cáo mẫu/);
      assert.match(r.text, /Phường Cầu Giấy/);
      assert.match(r.text, /class="page is-sample"/);
      assert.match(r.text, /Dòng tiền|dòng tiền/);
      assert.equal(countOf((await summary()).rows, 'sample_report', 'opened'), before + 1);
    });

    it('uses no credit and is not mistaken for a report id', async () => {
      assert.equal((await browser()('GET', '/api/reports/sample/print')).status, 401);
      assert.equal((await browser()('GET', '/api/reports')).status, 401);
    });
  });
});

describe('Visit statistics in PostgreSQL (a fake pool: the SQL it sends)', () => {
  const { PostgresStore } = require('../src/accounts/postgres-store');
  const fs = require('node:fs');
  const path = require('node:path');

  it('adds one to the counter of the day, event and key, and reads the rows since a day', async () => {
    const calls = [];
    const store = new PostgresStore({ query: async (sql, params) => (calls.push({ sql, params }), { rows: [{ day: '2026-10-28', event: 'page_view', key: '/', n: 3 }] }) });
    await store.bumpAnalytics('2026-10-28', 'page_view', '/');
    assert.match(calls[0].sql, /INSERT INTO analytics_daily[\s\S]*ON CONFLICT \(day, event, key\) DO UPDATE SET n = analytics_daily\.n \+ 1/);
    assert.deepEqual(calls[0].params, ['2026-10-28', 'page_view', '/']);
    assert.deepEqual(await store.analyticsRows('2026-10-01'), [{ day: '2026-10-28', event: 'page_view', key: '/', n: 3 }]);
    assert.deepEqual(calls[1].params, ['2026-10-01']);
  });

  it('has its table in a schema file the store applies at start, with nothing about a person in it', () => {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'accounts', '08-analytics.sql'), 'utf8');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS analytics_daily/);
    assert.doesNotMatch(sql.replace(/--.*/g, ''), /user_id|\bip\b|email/i); // the comments say what is not kept
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'src', 'accounts', 'postgres-store.js'), 'utf8'), /08-analytics\.sql/);
  });
});
