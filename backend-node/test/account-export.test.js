'use strict';
/** "Tải về dữ liệu của tôi": POST /api/account/me/export gives a person everything the account holds, as one JSON file. */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../src/accounts/memory-store');
const { loadConfig } = require('../src/living-score/config');

const ORIGIN = 'http://localhost:4200';
const PASSWORD = 'mat-khau-dai-123';

const report = (ward) => ({
  type: 'cafe',
  typeName: 'Quán cà phê',
  icon: '☕',
  ward,
  wardName: `Phường ${ward}`,
  horizon: 'now',
  score: 58.4,
  demand: 76.8,
  competition: 45.8,
  count: 51,
  assumptions: { basis: 'day', customers: 120, ticket: 45000, budget: 500000000 },
  result: { revenue: 1.6e8, costs: 1.1e8, profit: 4.25e7, marginPct: 26, investment: 3.1e8, paybackMonths: 14, budgetGap: 1.9e8 },
  risk: 'low',
});

describe('Account data export', () => {
  let server;
  let root;
  let store;

  before(async () => {
    store = new MemoryStore();
    const { app } = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      premium: { mode: 'off' },
      aiMeter: { mode: 'off' },
      accounts: { store, rateLimits: { login: 1000, register: 1000, export: 1000 } },
    });
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    root = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(() => new Promise((resolve) => server.close(resolve)));

  /** A browser with its own cookie. */
  const browser = () => {
    let cookie = '';
    return async (method, url, body, headers = {}) => {
      const res = await fetch(root + url, {
        method,
        headers: { origin: ORIGIN, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = /Max-Age=0/.test(set) ? '' : set.split(';')[0];
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* not JSON */
      }
      return { status: res.status, body: json, text, headers: res.headers };
    };
  };

  let n = 0;
  const signedUp = async () => {
    const b = browser();
    const email = `export${++n}@example.com`;
    assert.equal((await b('POST', '/account/register', { email, password: PASSWORD, displayName: 'An', acceptTerms: true })).status, 201);
    return { b, email };
  };

  it('needs a signed-in account and the password', async () => {
    assert.equal((await browser()('POST', '/account/me/export', { password: PASSWORD })).status, 401);
    const { b } = await signedUp();
    assert.equal((await b('POST', '/account/me/export', { password: 'sai-mat-khau' })).status, 403);
    assert.equal((await b('POST', '/account/me/export', {})).status, 400);
    assert.equal((await b('POST', '/account/me/export', { password: PASSWORD }, { origin: 'https://evil.example' })).status, 403);
  });

  it('gives the account, what it saved and what it did, as a file to keep', async () => {
    const { b, email } = await signedUp();
    assert.equal((await b('PUT', '/account/reports', report('tay-ho'))).status, 200);
    assert.equal((await b('PUT', '/account/career/plans/semiconductor', { startedAt: '2026-10-01T00:00:00.000Z', done: ['cv'] })).status, 200);
    await store.addDataReport({ kind: 'ward', target: 'phuong-tay-ho', targetName: 'Phường Tây Hồ', page: 'opportunity', message: 'Dân số ghi sai so với danh sách.', contact: null, userId: (await b('GET', '/account/me')).body.user.id });

    const res = await b('POST', '/account/me/export', { password: PASSWORD });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /^attachment; filename="hanoi-century-vista-du-lieu-\d{4}-\d{2}-\d{2}\.json"$/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const data = res.body;
    assert.equal(data.format, 'hanoi-century-vista-export/1');
    assert.equal(data.account.email, email);
    assert.equal(data.account.displayName, 'An');
    assert.equal(data.savedReports.length, 1);
    assert.equal(data.savedReports[0].content.ward, 'tay-ho');
    assert.equal(data.careerPlans.length, 1);
    assert.deepEqual(data.careerPlans[0].content.done, ['cv']);
    assert.equal(data.reportsSent.length, 1);
    assert.equal(data.reportsSent[0].target, 'phuong-tay-ho');
    for (const key of ['orders', 'paidReports', 'aiQuestions', 'careerAnswers', 'brandDetails']) assert.ok(Array.isArray(data[key]), key);
  });

  it('never includes the password, its hash, the sessions or other people\'s data', async () => {
    const mine = await signedUp();
    const other = await signedUp();
    assert.equal((await other.b('PUT', '/account/reports', report('hoan-kiem'))).status, 200);
    const res = await mine.b('POST', '/account/me/export', { password: PASSWORD });
    assert.equal(res.body.savedReports.length, 0);
    assert.doesNotMatch(res.text, /passwordHash|password_hash|scrypt\$|tokenHash|h100_sid/);
    assert.equal(res.text.includes(PASSWORD), false);
    assert.equal(res.text.includes(other.email), false);
    assert.equal(res.text.includes('hoan-kiem'), false);
  });

});

describe('Account data export limits', () => {
  it('allows only a few downloads an hour from one address', async () => {
    const { app } = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      premium: { mode: 'off' },
      aiMeter: { mode: 'off' },
      accounts: { store: new MemoryStore(), rateLimits: { login: 1000, register: 1000, export: 3 } },
    });
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    try {
      const url = `http://127.0.0.1:${server.address().port}/api/account`;
      const json = { 'content-type': 'application/json', origin: ORIGIN };
      const reg = await fetch(`${url}/register`, { method: 'POST', headers: json, body: JSON.stringify({ email: 'limit@example.com', password: PASSWORD, acceptTerms: true }) });
      const cookie = reg.headers.get('set-cookie').split(';')[0];
      const statuses = [];
      for (let i = 0; i < 5; i++) statuses.push((await fetch(`${url}/me/export`, { method: 'POST', headers: { ...json, cookie }, body: JSON.stringify({ password: PASSWORD }) })).status);
      assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
