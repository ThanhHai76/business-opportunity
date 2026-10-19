'use strict';
/**
 * Purchases (/api/billing) and paid reports (/api/reports) with the mock payment provider. Runs against the in-memory
 * store, and against a real PostgreSQL too when TEST_DATABASE_URL is set (its tables are emptied first — use a
 * throw-away database).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createApp } = require('../server');
const { MemoryStore } = require('../src/accounts/memory-store');
const { createMockProvider } = require('../src/billing/mock-provider');
const { DEFAULT_ASSUMPTIONS, computeFeasibility, defaultsFor } = require('../src/reports/feasibility');

const ORIGIN = 'http://localhost:4200';
const WARD = 'phuong-phuc-loi';
const reportInput = (extra = {}) => ({ type: 'cafe', ward: WARD, horizon: 'now', assumptions: defaultsFor('cafe'), ...extra });

const stores = [['memory', () => new MemoryStore()]];
if (process.env.TEST_DATABASE_URL) {
  stores.push([
    'postgres',
    async () => {
      const { Pool } = require('pg');
      const { PostgresStore } = require('../src/accounts/postgres-store');
      const store = new PostgresStore(new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 5 }));
      await store.init();
      await store.pool.query('TRUNCATE app_email_tokens, ai_credit_ledger, ai_usage, paid_reports, credit_ledger, billing_orders, saved_items, app_sessions, app_users');
      return store;
    },
  ]);
}

for (const [name, makeStore] of stores) {
  describe(`billing and paid reports (${name} store)`, () => {
    let server;
    let root;
    let store;
    const provider = createMockProvider({ secret: 'test-secret' });

    before(async () => {
      store = await makeStore();
      const { app } = createApp({
        log: false,
        accounts: { store, rateLimits: { login: 1000, register: 1000 } },
        billing: { provider, rateLimits: { checkout: 1000 } },
      });
      await new Promise((resolve) => {
        server = app.listen(0, resolve);
      });
      root = `http://127.0.0.1:${server.address().port}`;
    });
    after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await store.close();
    });

    /** A browser: keeps the session cookie, sends our own Origin, does not follow redirects. */
    const browser = () => {
      let cookie = '';
      const call = async (method, url, body, { form = false } = {}) => {
        const res = await fetch(root + url, {
          method,
          redirect: 'manual',
          headers: {
            ...(body ? { 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}),
            ...(cookie ? { cookie } : {}),
            origin: ORIGIN,
          },
          body: body ? (form ? new URLSearchParams(body).toString() : JSON.stringify(body)) : undefined,
        });
        const set = res.headers.get('set-cookie');
        if (set) cookie = /Max-Age=0/.test(set) ? '' : set.split(';')[0];
        const text = await res.text();
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          /* HTML */
        }
        return { status: res.status, body: json, text, location: res.headers.get('location') };
      };
      return call;
    };
    let n = 0;
    const signedUp = async () => {
      const b = browser();
      const res = await b('POST', '/api/account/register', { email: `buyer${++n}-${name}@example.com`, password: 'mat-khau-dai' });
      assert.equal(res.status, 201);
      return b;
    };
    /** Buys a product through the mock checkout page, as the buyer would. */
    const buy = async (b, product = 'report_1') => {
      const checkout = await b('POST', '/api/billing/checkout', { product, returnUrl: `${ORIGIN}/opportunity-map?type=cafe` });
      assert.equal(checkout.status, 201);
      const page = new URL(checkout.body.checkoutUrl);
      const paid = await b('POST', `${page.pathname}/pay`, { returnUrl: page.searchParams.get('returnUrl'), cancelUrl: page.searchParams.get('cancelUrl') }, { form: true });
      assert.equal(paid.status, 303);
      return checkout.body.order;
    };

    it('lists the products publicly; everything else needs a session', async () => {
      const anon = browser();
      const products = await anon('GET', '/api/billing/products');
      assert.equal(products.status, 200);
      assert.equal(products.body.enabled, true);
      assert.equal(products.body.provider, 'mock');
      assert.deepEqual(products.body.products.map((p) => p.id).sort(), ['ai_150', 'ai_30', 'premium_30d', 'premium_365d', 'report_1', 'report_3']);
      assert.deepEqual([...new Set(products.body.products.map((p) => p.kind))].sort(), ['ai', 'premium', 'report']);
      assert.equal((await anon('GET', '/api/billing/me')).status, 401);
      assert.equal((await anon('POST', '/api/billing/checkout', { product: 'report_1', returnUrl: ORIGIN })).status, 401);
      assert.equal((await anon('POST', '/api/reports', reportInput())).status, 401);
    });

    it('refuses a report without credits and uses none', async () => {
      const b = await signedUp();
      const res = await b('POST', '/api/reports', reportInput());
      assert.equal(res.status, 402);
      assert.equal(res.body.code, 'no_credits');
      assert.equal((await b('GET', '/api/billing/me')).body.credits, 0);
    });

    it('creates an order only for a known product and a return URL on our own site', async () => {
      const b = await signedUp();
      assert.equal((await b('POST', '/api/billing/checkout', { product: 'free_stuff', returnUrl: ORIGIN })).status, 400);
      const evil = await b('POST', '/api/billing/checkout', { product: 'report_1', returnUrl: 'https://evil.example/steal' });
      assert.equal(evil.status, 400);
      assert.equal(evil.body.code, 'bad_return_url');
      const ok = await b('POST', '/api/billing/checkout', { product: 'report_3', returnUrl: `${ORIGIN}/opportunity-map` });
      assert.equal(ok.status, 201);
      assert.equal(ok.body.order.status, 'pending');
      assert.equal(ok.body.order.amountVnd, 449_000);
      assert.equal(ok.body.order.credits, 3);
      assert.match(ok.body.checkoutUrl, /\/api\/billing\/mock\/checkout\/\d+\?/);
      const page = await b('GET', new URL(ok.body.checkoutUrl).pathname + new URL(ok.body.checkoutUrl).search);
      assert.equal(page.status, 200);
      assert.match(page.text, /449\.000 đ/);
      assert.match(page.text, /GIẢ/);
    });

    it('credits a paid order once, from the signed webhook only', async () => {
      const b = await signedUp();
      const order = await buy(b, 'report_3');
      const status = await b('GET', `/api/billing/orders/${order.id}`);
      assert.equal(status.body.order.status, 'paid');
      assert.equal((await b('GET', '/api/billing/me')).body.credits, 3);

      // The provider repeats its notification: nothing more is added.
      const again = await b('POST', '/api/billing/webhook/mock', provider.paidWebhook(order));
      assert.equal(again.status, 200);
      assert.equal(again.body.credited, false);
      assert.equal((await b('GET', '/api/billing/me')).body.credits, 3);

      // A forged notification is refused.
      const forged = { ...provider.paidWebhook(order), signature: 'f'.repeat(64) };
      assert.equal((await b('POST', '/api/billing/webhook/mock', forged)).body.code, 'bad_webhook');
      assert.equal((await b('POST', '/api/billing/webhook/mock', { data: { orderCode: 'x' } })).status, 400);
      assert.equal((await b('POST', '/api/billing/webhook/payos', provider.paidWebhook(order))).status, 404);
    });

    it('does not credit a payment of the wrong amount', async () => {
      const b = await signedUp();
      const checkout = await b('POST', '/api/billing/checkout', { product: 'report_1', returnUrl: ORIGIN });
      const order = checkout.body.order;
      const short = await b('POST', '/api/billing/webhook/mock', provider.paidWebhook({ ...order, amountVnd: 1_000 }));
      assert.equal(short.body.ok, false);
      assert.equal(short.body.credited, false);
      assert.equal((await b('GET', `/api/billing/orders/${order.id}`)).body.order.status, 'pending');
      assert.equal((await b('GET', '/api/billing/me')).body.credits, 0);
    });

    it('cancels a pending order, and still credits it if the money arrives anyway', async () => {
      const b = await signedUp();
      const order = (await b('POST', '/api/billing/checkout', { product: 'report_1', returnUrl: ORIGIN })).body.order;
      assert.equal((await b('POST', `/api/billing/orders/${order.id}/cancel`)).body.order.status, 'cancelled');
      await b('POST', '/api/billing/webhook/mock', provider.paidWebhook(order));
      assert.equal((await b('GET', '/api/billing/me')).body.credits, 1);
    });

    it("keeps each buyer's orders and reports private", async () => {
      const owner = await signedUp();
      const other = await signedUp();
      const order = await buy(owner);
      const report = await owner('POST', '/api/reports', reportInput());
      assert.equal(report.status, 201);
      assert.equal((await other('GET', `/api/billing/orders/${order.id}`)).status, 404);
      assert.equal((await other('POST', `/api/billing/orders/${order.id}/cancel`)).status, 404);
      assert.equal((await other('GET', `/api/reports/${report.body.report.id}`)).status, 404);
      assert.equal((await other('GET', `/api/reports/${report.body.report.id}/print`)).status, 404);
      assert.deepEqual((await other('GET', '/api/reports')).body.items, []);
    });

    it('builds the report on the server, uses one credit, and keeps it to download again', async () => {
      const b = await signedUp();
      await buy(b, 'report_3');

      // Refused input costs nothing.
      assert.equal((await b('POST', '/api/reports', reportInput({ ward: 'khong-co-phuong-nay' }))).status, 400);
      assert.equal((await b('POST', '/api/reports', reportInput({ assumptions: { ...defaultsFor('cafe'), cogsPct: 400 } }))).status, 400);
      assert.equal((await b('POST', '/api/reports', reportInput({ extra: 1 }))).status, 400);
      assert.equal((await b('GET', '/api/billing/me')).body.credits, 3);

      const created = await b('POST', '/api/reports', reportInput());
      assert.equal(created.status, 201);
      assert.equal(created.body.credits, 2);
      assert.match(created.body.report.title, /Quán cà phê · Phường Phúc Lợi/);

      const list = await b('GET', '/api/reports');
      assert.equal(list.body.items.length, 1);
      assert.equal(list.body.items[0].content, undefined);

      const full = (await b('GET', `/api/reports/${created.body.report.id}`)).body.report.content;
      assert.equal(full.monthly.length, 36);
      assert.equal(full.sensitivity.length, 4);
      assert.equal(full.plan.alternatives.length, 5);
      assert.equal(full.assumptionsAreDefault, true);
      assert.equal(full.feasibility.revenue, computeFeasibility(defaultsFor('cafe')).revenue);

      const print = await b('GET', `/api/reports/${created.body.report.id}/print`);
      assert.equal(print.status, 200);
      assert.match(print.text, /<h1>☕ Quán cà phê tại Phường Phúc Lợi<\/h1>/);
      assert.match(print.text, /Dòng tiền 36 tháng/);
      assert.equal((await b('GET', '/api/reports/not-a-uuid')).status, 404);
    });

    it('never spends one credit on two reports created at once', async () => {
      const b = await signedUp();
      await buy(b);
      const results = await Promise.all([1, 2, 3].map(() => b('POST', '/api/reports', reportInput())));
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 402, 402]);
      assert.equal((await b('GET', '/api/billing/me')).body.credits, 0);
    });
  });
}

describe('billing switched off', () => {
  let server;
  let root;
  before(async () => {
    const { app } = createApp({ log: false, accounts: { store: new MemoryStore() }, billing: { provider: null } });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    root = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise((resolve) => server.close(resolve)));

  it('still lists the products, and refuses to sell', async () => {
    const products = await (await fetch(`${root}/api/billing/products`)).json();
    assert.equal(products.enabled, false);
    const res = await fetch(`${root}/api/billing/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'billing_disabled');
    assert.equal((await fetch(`${root}/api/billing/mock/checkout/100001`)).status, 503);
  });
});

describe('server-side feasibility', () => {
  const plan = {
    basis: 'day', customers: 100, ticket: 50_000, daysOpen: 30, sizeM2: 50, rentPerM2: 400_000, cogsPct: 30, staff: 3,
    salary: 8_000_000, utilitiesPerM2: 100_000, otherPct: 5, setupPerM2: 5_000_000, depositMonths: 3, budget: 500_000_000,
    rampMonths: 0, rampStartPct: 100,
  };

  it('gives the figures of the frontend calculator (same cases as op-feasibility.spec.ts)', () => {
    const r = computeFeasibility(plan);
    assert.equal(r.revenue, 150_000_000);
    assert.equal(r.costs.total, 101_500_000);
    assert.equal(r.profit, 48_500_000);
    assert.equal(r.investment, 310_000_000);
    assert.equal(r.paybackMonths, Math.ceil(310_000_000 / 48_500_000));
    assert.equal(r.breakEvenCustomers, Math.ceil(49_000_000 / 32_500 / 30));
    assert.equal(r.budgetGap, 190_000_000);
  });

  it('has the same default assumptions as the frontend', () => {
    const file = path.join(__dirname, '..', '..', 'frontend', 'src', 'app', 'opportunity', 'op-feasibility.ts');
    if (!fs.existsSync(file)) return; // backend checked out alone
    const ts = fs.readFileSync(file, 'utf8');
    const block = ts.slice(ts.indexOf('const base ='), ts.indexOf('export const defaultsFor'));
    const js = block.replace(/export const/g, 'const').replace(/: Record<string, Assumptions>/g, '') + '\nDEFAULT_ASSUMPTIONS;';
    assert.deepEqual(JSON.parse(JSON.stringify(vm.runInNewContext(js))), DEFAULT_ASSUMPTIONS);
  });
});
