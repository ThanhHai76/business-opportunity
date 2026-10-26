'use strict';
/**
 * PayOS (src/billing/payos-provider.js) without the network: a fake PayOS API answers the payment requests, and the
 * webhooks are signed here with the rule of the PayOS docs, so a mistake in the provider's own signing shows up.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const { MemoryStore } = require('../src/accounts/memory-store');
const { createPayosProvider } = require('../src/billing/payos-provider');

const KEYS = { clientId: 'client-1', apiKey: 'api-1', checksumKey: 'checksum-secret' };
const ORIGIN = 'http://localhost:4200';

/** The PayOS docs' rule, written again independently: data keys sorted, key=value joined by &, HMAC-SHA256 hex. */
const signData = (data, key = KEYS.checksumKey) =>
  crypto
    .createHmac('sha256', key)
    .update(
      Object.keys(data)
        .sort()
        .map((k) => `${k}=${data[k] === null || data[k] === undefined ? '' : data[k]}`)
        .join('&'),
    )
    .digest('hex');

/** A fake PayOS API: remembers the requests, answers like the real one. */
function fakePayos({ reply } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    if (reply) return reply(url, body);
    return new Response(JSON.stringify({ code: '00', desc: 'success', data: { checkoutUrl: `https://pay.payos.vn/web/${body.orderCode}`, paymentLinkId: `link-${body.orderCode}`, orderCode: body.orderCode, amount: body.amount, status: 'PENDING' } }), { status: 200 });
  };
  return { fetch, calls };
}

/** The webhook PayOS sends when the money has arrived. */
const webhook = (orderCode, amount, extra = {}) => {
  const data = {
    orderCode,
    amount,
    description: `HCV${orderCode}`,
    accountNumber: '12345678',
    reference: `FT${orderCode}`,
    transactionDateTime: '2026-10-23 21:00:00',
    currency: 'VND',
    paymentLinkId: `link-${orderCode}`,
    code: '00',
    desc: 'success',
    counterAccountBankId: '',
    counterAccountBankName: '',
    counterAccountName: null,
    counterAccountNumber: null,
    virtualAccountName: '',
    virtualAccountNumber: '',
    ...extra,
  };
  return { code: '00', desc: 'success', success: true, data, signature: signData(data) };
};

describe('PayOS provider', () => {
  it('needs its three keys', () => {
    assert.throws(() => createPayosProvider({}, {}), /PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY/);
    assert.doesNotThrow(() => createPayosProvider({}, { PAYOS_CLIENT_ID: 'a', PAYOS_API_KEY: 'b', PAYOS_CHECKSUM_KEY: 'c' }));
  });

  it('asks PayOS for a payment link with the keys, a signed request and a short memo', async () => {
    const api = fakePayos();
    const p = createPayosProvider({ ...KEYS, fetch: api.fetch }, {});
    const expiresAt = new Date('2026-10-23T14:30:00Z');
    const r = await p.createPayment({ order: { orderCode: 100042, amountVnd: 249_000, expiresAt }, returnUrl: 'https://site.vn/premium?o=1', cancelUrl: 'https://site.vn/premium' });
    assert.deepEqual(r, { checkoutUrl: 'https://pay.payos.vn/web/100042', providerRef: 'link-100042' });
    const [call] = api.calls;
    assert.equal(call.url, 'https://api-merchant.payos.vn/v2/payment-requests');
    assert.equal(call.headers['x-client-id'], 'client-1');
    assert.equal(call.headers['x-api-key'], 'api-1');
    assert.equal(call.body.description, 'HCV100042');
    assert.ok(call.body.description.length <= 9);
    assert.equal(call.body.expiredAt, Math.floor(expiresAt.getTime() / 1000));
    const expected = crypto.createHmac('sha256', KEYS.checksumKey).update('amount=249000&cancelUrl=https://site.vn/premium&description=HCV100042&orderCode=100042&returnUrl=https://site.vn/premium?o=1').digest('hex');
    assert.equal(call.body.signature, expected);
  });

  it('adds the order offset going out and takes it off coming back', async () => {
    const api = fakePayos();
    const p = createPayosProvider({ ...KEYS, fetch: api.fetch, orderOffset: 900_000_000 }, {});
    await p.createPayment({ order: { orderCode: 100001, amountVnd: 49_000 }, returnUrl: 'https://a.vn/', cancelUrl: 'https://a.vn/' });
    assert.equal(api.calls[0].body.orderCode, 900_100_001);
    assert.equal(p.verifyWebhook(webhook(900_100_001, 49_000)).orderCode, 100001);
    // PayOS's test payment (order 123) when the address is registered: signed, nothing to credit.
    assert.equal(p.verifyWebhook(webhook(123, 3000)), null);
  });

  it('turns a refusal or a network failure into an error the buyer can read', async () => {
    const refused = createPayosProvider({ ...KEYS, fetch: fakePayos({ reply: () => new Response(JSON.stringify({ code: '231', desc: 'Đơn thanh toán đã tồn tại', data: null })) }).fetch }, {});
    await assert.rejects(refused.createPayment({ order: { orderCode: 1, amountVnd: 1000 }, returnUrl: 'https://a.vn/', cancelUrl: 'https://a.vn/' }), (e) => e.status === 502 && e.code === 'payment_provider_error');
    const down = createPayosProvider({ ...KEYS, fetch: async () => { throw new Error('ECONNRESET'); } }, {});
    await assert.rejects(down.createPayment({ order: { orderCode: 1, amountVnd: 1000 }, returnUrl: 'https://a.vn/', cancelUrl: 'https://a.vn/' }), (e) => e.status === 502 && e.code === 'payment_provider_unavailable');
  });

  it('accepts only webhooks signed with the checksum key, and credits only successful payments', () => {
    const p = createPayosProvider(KEYS, {});
    const good = webhook(100050, 199_000);
    assert.deepEqual(p.verifyWebhook(good), { orderCode: 100050, amountVnd: 199_000, reference: 'FT100050' });
    assert.throws(() => p.verifyWebhook({ ...good, data: { ...good.data, amount: 1000 } }), /bad signature/);
    const forged = webhook(100050, 199_000);
    forged.signature = signData(forged.data, 'another-key');
    assert.throws(() => p.verifyWebhook(forged), /bad signature/);
    assert.throws(() => p.verifyWebhook({ data: good.data }), /malformed/);
    assert.equal(p.verifyWebhook(webhook(100050, 199_000, { code: '01', desc: 'failed' })), null);
  });
});

describe('Buying with PayOS', () => {
  let server;
  let root;
  let api;
  before(async () => {
    api = fakePayos();
    const { app } = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      accounts: { store: new MemoryStore(), rateLimits: { login: 1000, register: 1000 } },
      billing: { provider: createPayosProvider({ ...KEYS, fetch: api.fetch }, {}), rateLimits: { checkout: 1000 } },
      aiMeter: { mode: 'off' },
    });
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    root = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise((resolve) => server.close(resolve)));

  it('creates the order, sends the buyer to PayOS, and credits Premium only when the signed webhook arrives', async () => {
    let cookie = '';
    const req = async (method, url, body, headers = { origin: ORIGIN }) => {
      const res = await fetch(root + url, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      return { status: res.status, body: await res.json() };
    };
    assert.equal((await req('POST', '/api/account/register', { email: 'payos@example.com', password: 'mat-khau-dai', acceptTerms: true })).status, 201);
    assert.equal((await req('GET', '/api/billing/products')).body.provider, 'payos');

    const checkout = await req('POST', '/api/billing/checkout', { product: 'premium_30d', returnUrl: `${ORIGIN}/premium` });
    assert.equal(checkout.status, 201);
    const { order, checkoutUrl } = checkout.body;
    assert.equal(checkoutUrl, `https://pay.payos.vn/web/${order.orderCode}`);
    assert.equal(api.calls.at(-1).body.amount, 249_000);

    // The browser coming back is not proof of payment: the order is still pending.
    assert.equal((await req('GET', `/api/billing/orders/${order.id}`)).body.order.status, 'pending');

    // A forged notification is refused; PayOS's own is accepted (no Origin, no cookie: server to server).
    const forged = webhook(order.orderCode, 249_000);
    forged.signature = signData(forged.data, 'wrong');
    assert.equal((await req('POST', '/api/billing/webhook/payos', forged, {})).status, 400);
    const paid = await req('POST', '/api/billing/webhook/payos', webhook(order.orderCode, 249_000), {});
    assert.equal(paid.status, 200);
    assert.equal(paid.body.credited, true);
    assert.equal((await req('GET', `/api/billing/orders/${order.id}`)).body.order.status, 'paid');
    assert.equal((await req('GET', '/api/billing/me')).body.ai.premium, true);

    // The same notification again changes nothing; PayOS's test payment answers 200 without crediting anything.
    assert.equal((await req('POST', '/api/billing/webhook/payos', webhook(order.orderCode, 249_000), {})).body.credited, false);
    const test = await req('POST', '/api/billing/webhook/payos', webhook(123, 3000), {});
    assert.equal(test.status, 200);
    assert.equal(test.body.credited, false);
    // Notifications for another provider's address are not ours.
    assert.equal((await req('POST', '/api/billing/webhook/mock', webhook(order.orderCode, 249_000), {})).status, 404);
  });
});
