'use strict';
/**
 * Premium-only data (src/billing/premium-gate.js): locked while Premium is for sale, open to Premium accounts, and
 * open to everyone when nothing is for sale. Runs on the in-memory store with the mock payment provider.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const { MemoryStore } = require('../src/accounts/memory-store');
const { createMockProvider } = require('../src/billing/mock-provider');
const { MockAnswerer, knowledge } = require('../src/opportunity/ai');
const { defaultsFor } = require('../src/reports/feasibility');

const ORIGIN = 'http://localhost:4200';
const WARD = 'phuong-tay-ho';

/** The app with accounts and the mock payment provider; `billing` overrides (e.g. provider: null = nothing for sale). */
async function start(billing = {}) {
  const asked = [];
  const fake = { name: 'fake', model: 'fake-model', answer: async (request) => (asked.push(request), null) };
  const { app } = createApp({
    log: false,
    living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
    accounts: { store: new MemoryStore(), rateLimits: { login: 1000, register: 1000 } },
    billing: { provider: createMockProvider({ secret: 'test-secret' }), rateLimits: { checkout: 1000 }, ...billing },
    aiMeter: { mode: 'off' },
    opportunity: { answerers: { primary: fake, fallback: new MockAnswerer() }, rateLimits: { global: 10_000, ai: 10_000 } },
    propertyIntel: { config: { aiProvider: 'mock' } },
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return { server, root: `http://127.0.0.1:${server.address().port}`, asked };
}

/** A browser: keeps the session cookie, sends our own Origin. */
const browserFor = (root) => () => {
  let cookie = '';
  return async (method, url, body, { form = false } = {}) => {
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
      /* not JSON */
    }
    return { status: res.status, body: json, text, headers: res.headers };
  };
};

describe('Premium-only data while Premium is for sale', () => {
  let ctx;
  let browser;
  let n = 0;
  before(async () => {
    ctx = await start();
    browser = browserFor(ctx.root);
  });
  after(() => new Promise((resolve) => ctx.server.close(resolve)));

  const signedUp = async () => {
    const b = browser();
    assert.equal((await b('POST', '/api/account/register', { email: `premium${++n}@example.com`, password: 'mat-khau-dai' })).status, 201);
    return b;
  };
  const buyPremium = async (b) => {
    const checkout = await b('POST', '/api/billing/checkout', { product: 'premium_30d', returnUrl: `${ORIGIN}/premium` });
    assert.equal(checkout.status, 201);
    const page = new URL(checkout.body.checkoutUrl);
    const paid = await b('POST', `${page.pathname}/pay`, { returnUrl: page.searchParams.get('returnUrl'), cancelUrl: page.searchParams.get('cancelUrl') }, { form: true });
    assert.equal(paid.status, 303);
    assert.equal((await b('GET', '/api/billing/me')).body.ai.premium, true);
  };

  it('tells the page that Premium features are locked', async () => {
    assert.equal((await browser()('GET', '/api/billing/products')).body.premiumGating, true);
  });

  it('keeps today open to everyone, and one ward of 2030 as a free preview', async () => {
    const anon = browser();
    assert.equal((await anon('GET', '/api/opportunity/wards?type=cafe&horizon=now&lang=vi')).status, 200);
    const preview = await anon('GET', `/api/opportunity/wards/${WARD}?horizon=2030&lang=vi`);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.horizon, '2030');
    assert.equal((await anon('GET', '/api/property-intel/map?horizon=2026&lang=vi')).status, 200);
  });

  it('locks the 2030 map, 2030 comparisons and the 2030/2045 planning layers for visitors and free accounts', async () => {
    for (const who of [browser(), await signedUp()]) {
      const map = await who('GET', '/api/opportunity/wards?type=cafe&horizon=2030&lang=vi');
      assert.equal(map.status, 402);
      assert.equal(map.body.code, 'premium_required');
      assert.equal((await who('GET', `/api/opportunity/compare?slugs=${WARD},phuong-cau-giay&horizon=2030&lang=vi`)).body.code, 'premium_required');
      assert.equal((await who('GET', '/api/property-intel/map?horizon=2030&lang=vi')).body.code, 'premium_required');
      assert.equal((await who('GET', '/api/property-intel/map?horizon=2045&lang=vi')).status, 402);
    }
  });

  it('gives a page that asks for no horizon today, instead of an error', async () => {
    const anon = browser();
    const none = await anon('GET', '/api/property-intel/map?lang=vi');
    assert.equal(none.status, 200);
    assert.deepEqual(none.body, (await anon('GET', '/api/property-intel/map?horizon=2026&lang=vi')).body);
  });

  it('answers AI questions about today only, and without the 2030 data, for a free account', async () => {
    const free = await signedUp();
    ctx.asked.length = 0;
    assert.equal((await free('POST', '/api/opportunity/ask', { question: 'Mở quán cà phê ở đâu năm 2030?', type: 'cafe', horizon: '2030', lang: 'vi' })).status, 200);
    assert.equal(ctx.asked[0].horizon, 'now');
    assert.equal(ctx.asked[0].with2030, false);
    // The data the AI gets leaves 2030 out, and keeps it when allowed.
    assert.equal(JSON.stringify(knowledge('vi', false)).includes('scores2030'), false);
    assert.equal(JSON.stringify(knowledge('vi', true)).includes('scores2030'), true);
  });

  it('opens everything to a Premium account, and keeps its layers out of shared caches', async () => {
    const pro = await signedUp();
    await buyPremium(pro);
    assert.equal((await pro('GET', '/api/opportunity/wards?type=cafe&horizon=2030&lang=vi')).status, 200);
    assert.equal((await pro('GET', `/api/opportunity/compare?slugs=${WARD},phuong-cau-giay&horizon=2030&lang=vi`)).status, 200);
    const layers = await pro('GET', '/api/property-intel/map?horizon=2045&lang=vi');
    assert.equal(layers.status, 200);
    assert.match(layers.headers.get('cache-control'), /^private/);
    assert.match((await pro('GET', '/api/property-intel/map?horizon=2026&lang=vi')).headers.get('cache-control'), /^public/);
    ctx.asked.length = 0;
    await pro('POST', '/api/opportunity/ask', { question: 'Mở quán cà phê ở đâu năm 2030?', type: 'cafe', horizon: '2030', lang: 'vi' });
    assert.equal(ctx.asked[0].horizon, '2030');
    assert.equal(ctx.asked[0].with2030, true);
  });

  const saved = (ward, extra = {}) => ({
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
    assumptions: { basis: 'day', customers: 120 },
    result: { revenue: 1.6e8, costs: 1.1e8, profit: 4.25e7, marginPct: 26, investment: 3.1e8, paybackMonths: 14, budgetGap: 1.9e8 },
    risk: 'low',
    ...extra,
  });

  it('saves only a few reports without Premium, never deletes older ones, and keeps notes for Premium', async () => {
    const b = await signedUp();
    for (let i = 0; i < 5; i++) assert.equal((await b('PUT', '/api/account/reports', saved(`w-${i}`))).status, 200);
    const sixth = await b('PUT', '/api/account/reports', saved('w-5'));
    assert.equal(sixth.status, 402);
    assert.equal(sixth.body.code, 'premium_required');
    // The same type + ward + horizon again is an update, not a new report.
    assert.equal((await b('PUT', '/api/account/reports', saved('w-0', { score: 60 }))).status, 200);
    // Over the limit, the browser's reports are not imported (they stay in the browser).
    const imported = await b('POST', '/api/account/reports/import', { items: [saved('w-9')] });
    assert.equal(imported.body.items.length, 5);
    // A note and tags are Premium.
    const id = (await b('GET', '/api/account/reports')).body.items[0].id;
    assert.equal((await b('PATCH', `/api/account/reports/${id}`, { note: 'Khách A' })).body.code, 'premium_required');

    await buyPremium(b);
    assert.equal((await b('PUT', '/api/account/reports', saved('w-5'))).status, 200);
    const noted = await b('PATCH', `/api/account/reports/${id}`, { note: 'Khách A thích mặt tiền', tags: ['Khách A', 'Khách A', 'Cầu Giấy'] });
    assert.equal(noted.status, 200);
    assert.equal(noted.body.item.note, 'Khách A thích mặt tiền');
    assert.deepEqual(noted.body.item.tags, ['Khách A', 'Cầu Giấy']);
    assert.equal((await b('PATCH', `/api/account/reports/${id}`, { tags: ['a', 'b', 'c', 'd'] })).status, 400);
    // Saving the same report again keeps its note and tags.
    const again = (await b('GET', '/api/account/reports')).body.items.find((r) => r.id === id);
    await b('PUT', '/api/account/reports', saved(again.ward, { score: 61 }));
    assert.equal((await b('GET', '/api/account/reports')).body.items.find((r) => r.ward === again.ward).note, 'Khách A thích mặt tiền');
  });

  it('keeps the career compass answers and 30-day plans in the account for Premium only, up to five plans', async () => {
    const b = await signedUp();
    const profile = { situation: 'graduate', backgrounds: ['tech'], education: 2, time: 2, work: 'employee', ward: 'phuong-tay-ho' };
    const plan = { startedAt: '2026-10-21T08:00:00.000Z', done: ['cv', 'accounts'] };
    assert.equal((await browser()('GET', '/api/account/career')).status, 401);
    assert.deepEqual((await b('GET', '/api/account/career')).body, { profile: null, plans: [] });
    assert.equal((await b('PUT', '/api/account/career/profile', profile)).body.code, 'premium_required');
    assert.equal((await b('PUT', '/api/account/career/plans/retail', plan)).body.code, 'premium_required');

    await buyPremium(b);
    assert.deepEqual((await b('PUT', '/api/account/career/profile', profile)).body.profile, profile);
    const saved = await b('PUT', '/api/account/career/plans/retail', { ...plan, done: ['cv', 'cv', 'accounts'] });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.plan.done, ['cv', 'accounts']);
    assert.equal(saved.body.plan.directionId, 'retail');
    const read = (await b('GET', '/api/account/career')).body;
    assert.deepEqual(read.profile, profile);
    assert.equal(read.plans.length, 1);
    assert.match(read.plans[0].updatedAt, /^\d{4}-\d\d-\d\dT/);

    // What is not a plan or an answer is refused.
    assert.equal((await b('PUT', '/api/account/career/plans/retail', { ...plan, done: ['Not A Step'] })).status, 400);
    assert.equal((await b('PUT', '/api/account/career/plans/retail', { ...plan, extra: 1 })).status, 400);
    assert.equal((await b('PUT', '/api/account/career/plans/Bad_Id', plan)).status, 400);
    assert.equal((await b('PUT', '/api/account/career/profile', { ...profile, education: 7 })).status, 400);

    // Five plans at most: a sixth direction is refused, but an existing one can still be updated.
    for (const id of ['logistics', 'tourism', 'finance', 'engineering']) assert.equal((await b('PUT', `/api/account/career/plans/${id}`, plan)).status, 200);
    const sixth = await b('PUT', '/api/account/career/plans/semiconductor', plan);
    assert.equal(sixth.status, 409);
    assert.equal(sixth.body.code, 'plan_limit');
    assert.equal((await b('PUT', '/api/account/career/plans/retail', { ...plan, done: ['cv'] })).status, 200);

    assert.equal((await b('DELETE', '/api/account/career/plans/retail')).status, 204);
    assert.equal((await b('DELETE', '/api/account/career/plans/retail')).status, 404);
    assert.equal((await b('GET', '/api/account/career')).body.plans.length, 4);
    // Another account never sees them.
    assert.deepEqual((await (await signedUp())('GET', '/api/account/career')).body, { profile: null, plans: [] });
  });

  it('prints a report with the broker details for a Premium account only, and offers the standard page', async () => {
    const b = await signedUp();
    assert.equal((await b('PUT', '/api/reports/brand', { company: 'Nhà Đẹp', name: 'Lan', phone: '0900', email: '', note: '' })).body.code, 'premium_required');
    await buyPremium(b); // includes one report credit
    const brand = { company: 'Nhà Đẹp Land', name: 'Lan Anh', phone: '0900 000 111', email: 'lan@nhadep.vn', note: 'Cảm ơn anh chị <đã tin tưởng>' };
    assert.equal((await b('PUT', '/api/reports/brand', { ...brand, company: '', name: '' })).status, 400);
    assert.equal((await b('PUT', '/api/reports/brand', { ...brand, extra: 1 })).status, 400);
    assert.deepEqual((await b('PUT', '/api/reports/brand', brand)).body.brand, brand);
    assert.deepEqual((await b('GET', '/api/reports/brand')).body, { brand, premium: true });

    const created = await b('POST', '/api/reports', { type: 'cafe', ward: WARD, horizon: 'now', assumptions: defaultsFor('cafe') });
    assert.equal(created.status, 201);
    const html = (await b('GET', `/api/reports/${created.body.report.id}/print`)).text;
    assert.match(html, /Nhà Đẹp Land · Báo cáo khả thi kinh doanh/);
    assert.match(html, /Chuẩn bị bởi: Lan Anh · 0900 000 111 · lan@nhadep.vn/);
    assert.match(html, /Cảm ơn anh chị &lt;đã tin tưởng&gt;/); // escaped
    assert.doesNotMatch(html, /Hanoi Century Vista · Báo cáo khả thi kinh doanh/);
    assert.match(html, /href="\?brand=0"/);
    const standard = (await b('GET', `/api/reports/${created.body.report.id}/print?brand=0`)).text;
    assert.match(standard, /Hanoi Century Vista · Báo cáo khả thi kinh doanh/);
    assert.doesNotMatch(standard, /Nhà Đẹp Land/);
    assert.equal((await b('DELETE', '/api/reports/brand')).status, 204);
    assert.equal((await b('GET', '/api/reports/brand')).body.brand, null);
  });
});

describe('Premium-only data when nothing is for sale', () => {
  let ctx;
  before(async () => {
    ctx = await start({ provider: null });
  });
  after(() => new Promise((resolve) => ctx.server.close(resolve)));

  it('opens everything to everyone: nobody is locked out of a feature there is no way to buy', async () => {
    const anon = browserFor(ctx.root)();
    assert.equal((await anon('GET', '/api/billing/products')).body.premiumGating, false);
    assert.equal((await anon('GET', '/api/opportunity/wards?type=cafe&horizon=2030&lang=vi')).status, 200);
    assert.equal((await anon('GET', '/api/property-intel/map?horizon=2045&lang=vi')).status, 200);
  });
});
