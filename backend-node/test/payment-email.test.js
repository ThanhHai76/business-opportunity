'use strict';
/** The email a buyer gets when a payment has been received (src/accounts/mails.js, sent from src/billing). */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../src/accounts/memory-store');
const { createMockProvider } = require('../src/billing/mock-provider');

const ORIGIN = 'http://localhost:4200';
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('payment received email', () => {
  let server;
  let root;
  const sent = [];
  let failMail = false;
  const provider = createMockProvider({ secret: 'test-secret' });
  const mailer = {
    kind: 'fake',
    enabled: true,
    real: false,
    send: async (m) => {
      if (failMail) throw new Error('smtp down');
      sent.push(m);
    },
  };

  before(async () => {
    const { app } = createApp({
      log: false,
      mailer,
      accounts: { store: new MemoryStore(), appUrl: 'https://site.test', rateLimits: { login: 1000, register: 1000, mail: 1000 } },
      billing: { provider, rateLimits: { checkout: 1000 } },
    });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    root = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise((resolve) => server.close(resolve)));

  const browser = () => {
    let cookie = '';
    return async (method, url, body) => {
      const res = await fetch(root + url, {
        method,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), origin: ORIGIN },
        body: body ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    };
  };
  let n = 0;
  const signedUp = async () => {
    const b = browser();
    const email = `payer${++n}@example.com`;
    assert.equal((await b('POST', '/api/account/register', { email, password: 'mat-khau-dai', displayName: 'Lan' })).status, 201);
    return { b, email };
  };
  const order = async (b, product) => (await b('POST', '/api/billing/checkout', { product, returnUrl: ORIGIN })).body.order;

  it('tells the buyer once: product, amount, order code, what was added, links', async () => {
    sent.length = 0;
    const { b, email } = await signedUp();
    const o = await order(b, 'premium_30d');
    await b('POST', '/api/billing/webhook/mock', provider.paidWebhook(o));
    await tick();
    const mail = sent.find((m) => m.to === email && /thanh toán/.test(m.subject));
    assert.ok(mail, 'a payment email was sent');
    assert.match(mail.subject, /249\.000đ/);
    assert.match(mail.text, /Premium 1 tháng/);
    assert.match(mail.text, new RegExp(String(o.orderCode)));
    assert.match(mail.text, /30 ngày Premium/);
    assert.match(mail.text, /https:\/\/site\.test\/tai-khoan/);
    assert.match(mail.text, /https:\/\/site\.test\/refund/);
    assert.match(mail.text, /Chào Lan/);

    // The provider repeats its notification: no second email.
    const before = sent.length;
    await b('POST', '/api/billing/webhook/mock', provider.paidWebhook(o));
    await tick();
    assert.equal(sent.length, before);
  });

  it('sends nothing for a payment of the wrong amount', async () => {
    sent.length = 0;
    const { b } = await signedUp();
    const o = await order(b, 'report_1');
    await b('POST', '/api/billing/webhook/mock', provider.paidWebhook({ ...o, amountVnd: 1_000 }));
    await tick();
    assert.equal(sent.filter((m) => /thanh toán/.test(m.subject)).length, 0);
  });

  it('still credits the order when the email cannot be sent', async () => {
    const { b } = await signedUp();
    const o = await order(b, 'report_3');
    failMail = true;
    try {
      const res = await b('POST', '/api/billing/webhook/mock', provider.paidWebhook(o));
      assert.equal(res.status, 200);
      assert.equal(res.body.credited, true);
    } finally {
      failMail = false;
    }
    assert.equal((await b('GET', '/api/billing/me')).body.credits, 3);
  });
});
