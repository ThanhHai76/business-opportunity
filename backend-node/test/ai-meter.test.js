'use strict';
/**
 * In-depth AI questions (src/billing/ai-meter.js) and what AI packs and Premium add (src/billing). The AI is a fake
 * answerer; payments go through the mock provider. Runs against the in-memory store, and against PostgreSQL too when
 * TEST_DATABASE_URL is set (its tables are emptied first — use a throw-away database).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../src/accounts/memory-store');
const { createMockProvider } = require('../src/billing/mock-provider');
const { dayStartVn } = require('../src/billing/ai-meter');
const { MockAnswerer: OpMock } = require('../src/opportunity/ai');
const { MockAnswerer: FmMock } = require('../src/future-map/ai');
const { MockStoryteller } = require('../src/time-machine/storyteller');
const { loadConfig } = require('../src/living-score/config');

const ORIGIN = 'http://localhost:4200';
const DAY = 86_400_000;

describe('day boundaries in Vietnam time', () => {
  it('starts the day at 00:00 UTC+7', () => {
    assert.equal(dayStartVn(new Date('2026-10-15T16:59:59Z')).toISOString(), '2026-10-14T17:00:00.000Z');
    assert.equal(dayStartVn(new Date('2026-10-15T17:00:00Z')).toISOString(), '2026-10-15T17:00:00.000Z');
  });
});

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
  describe(`in-depth AI questions, AI packs and Premium (${name} store)`, () => {
    let server;
    let root;
    let store;
    let living;
    let offset = 0; // the meter's clock runs `offset` ms ahead of the real one
    let aiDown = false; // the AI fails: the template answers
    const provider = createMockProvider({ secret: 'test-secret' });
    const fakeOp = { name: 'anthropic', model: 'fake', answer: async () => (aiDown ? null : { verdict: 'AI verdict', reasons: ['r1'], risks: [], wardSlugs: [], typeKeys: [], sourceIds: [], outOfScope: false }) };
    const fakeFm = { name: 'anthropic', model: 'fake', answer: async () => (aiDown ? null : { answer: 'AI answer', poleSlugs: [], sourceIds: [], outOfScope: false }) };
    const fakeTm = { name: 'anthropic', model: 'fake', tell: async () => (aiDown ? null : { answer: 'AI story', landmarkKeys: ['hoan-kiem'], eraIds: ['2026'], outOfScope: false }) };
    const fakeNarrative = {
      enabled: true,
      model: 'fake',
      generate: async (ctx, areas) => (aiDown ? null : areas.map((a) => ({ slug: a.slug, summary: 'AI summary', reasons: ['a', 'b'], pros: ['p'], cons: ['c'] }))),
    };

    before(async () => {
      store = await makeStore();
      const created = createApp({
        log: false,
        accounts: { store, rateLimits: { login: 1000, register: 1000 } },
        billing: { provider, rateLimits: { checkout: 1000 } },
        aiMeter: { mode: 'on', limits: { freePerDay: 2, storyFreePerDay: 4, premiumPerDay: 3 }, clock: () => new Date(Date.now() + offset) },
        opportunity: { answerers: { primary: fakeOp, fallback: new OpMock() }, rateLimits: { global: 10_000, ai: 10_000 } },
        futureMap: { answerers: { primary: fakeFm, fallback: new FmMock() }, rateLimits: { global: 10_000, ai: 10_000 } },
        timeMachine: { storytellers: { primary: fakeTm, fallback: new MockStoryteller() }, rateLimits: { global: 10_000, ask: 10_000 } },
        living: { config: loadConfig({ DATA_SOURCE: 'memory' }), narrative: fakeNarrative, rateLimits: { global: 10_000, recommendations: 10_000 } },
      });
      living = created.living;
      await new Promise((resolve) => {
        server = created.app.listen(0, resolve);
      });
      root = `http://127.0.0.1:${server.address().port}`;
    });
    after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await living.close();
      await store.close();
    });

    const browser = ({ origin = ORIGIN } = {}) => {
      let cookie = '';
      return async (method, url, body, { form = false } = {}) => {
        const res = await fetch(root + url, {
          method,
          redirect: 'manual',
          headers: {
            ...(body ? { 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}),
            ...(cookie ? { cookie } : {}),
            origin,
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
        return { status: res.status, body: json };
      };
    };
    let n = 0;
    const signedUp = async () => {
      const b = browser();
      assert.equal((await b('POST', '/api/account/register', { email: `ai${++n}-${name}@example.com`, password: 'mat-khau-dai' })).status, 201);
      return b;
    };
    const buy = async (b, product) => {
      const checkout = await b('POST', '/api/billing/checkout', { product, returnUrl: ORIGIN });
      assert.equal(checkout.status, 201);
      const page = new URL(checkout.body.checkoutUrl);
      assert.equal((await b('POST', `${page.pathname}/pay`, { returnUrl: ORIGIN, cancelUrl: ORIGIN }, { form: true })).status, 303);
      return checkout.body.order;
    };
    const askOp = (b) => b('POST', '/api/opportunity/ask', { question: 'Mở quán cà phê ở đâu?' });
    const askTm = (b, question = 'Hồ Gươm có gì đặc biệt?') => b('POST', '/api/time-machine/ask', { question, landmark: 'hoan-kiem', era: '2026' });

    it('gives a visitor the basic answer and asks them to sign in', async () => {
      const res = await askOp(browser());
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, 'mock');
      assert.deepEqual({ charged: res.body.quota.charged, reason: res.body.quota.reason, signedIn: res.body.quota.signedIn }, { charged: null, reason: 'signin', signedIn: false });
    });

    it('uses the free daily allowance, then answers without AI, and starts again the next day', async () => {
      const b = await signedUp();
      const first = await askOp(b);
      assert.equal(first.body.provider, 'anthropic');
      assert.equal(first.body.quota.charged, 'free');
      assert.equal(first.body.quota.freeLeft, 1);
      assert.equal((await askOp(b)).body.quota.freeLeft, 0);

      const third = await askOp(b);
      assert.equal(third.body.provider, 'mock');
      assert.equal(third.body.quota.charged, null);
      assert.equal(third.body.quota.reason, 'no_quota');

      offset = DAY;
      try {
        const tomorrow = await askOp(b);
        assert.equal(tomorrow.body.quota.charged, 'free');
        assert.equal(tomorrow.body.quota.freeLeft, 1);
      } finally {
        offset = 0;
      }
    });

    it('gives the allowance back when the AI fails and the template answers', async () => {
      const b = await signedUp();
      aiDown = true;
      try {
        const res = await askOp(b);
        assert.equal(res.body.provider, 'mock');
        assert.equal(res.body.quota.charged, null);
        assert.equal(res.body.quota.reason, 'unavailable');
        assert.equal(res.body.quota.freeLeft, 2);
      } finally {
        aiDown = false;
      }
    });

    it('charges nothing for a question it refuses', async () => {
      const b = await signedUp();
      assert.equal((await b('POST', '/api/opportunity/ask', { question: 'x' })).status, 400);
      assert.equal((await b('POST', '/api/opportunity/ask', { question: 'Ở đâu?', ward: 'khong-co' })).status, 404);
      assert.equal((await b('GET', '/api/billing/me')).body.ai.freeLeft, 2);
    });

    it('never lets a page on another site spend the allowance', async () => {
      const b = await signedUp();
      const evil = browser({ origin: 'https://evil.example' });
      const res = await evil('POST', '/api/opportunity/ask', { question: 'Mở quán cà phê ở đâu?' });
      assert.equal(res.body.quota.reason, 'signin');
      assert.equal((await b('GET', '/api/billing/me')).body.ai.freeLeft, 2);
    });

    it('sells AI packs: their credits are used after the free allowance', async () => {
      const b = await signedUp();
      const order = await buy(b, 'ai_30');
      assert.deepEqual(order.grants, { reportCredits: 0, aiCredits: 30, premiumDays: 0 });
      assert.equal(order.credits, 0);
      const me = (await b('GET', '/api/billing/me')).body;
      assert.equal(me.credits, 0);
      assert.equal(me.ai.aiCredits, 30);

      await askOp(b);
      await askOp(b);
      const third = await askOp(b);
      assert.equal(third.body.quota.charged, 'credit');
      assert.equal(third.body.quota.aiCredits, 29);
      // A repeated payment notification adds nothing.
      assert.equal((await b('POST', '/api/billing/webhook/mock', provider.paidWebhook(order))).body.credited, false);
      assert.equal((await b('GET', '/api/billing/me')).body.ai.aiCredits, 29);
    });

    it('sells Premium: a larger daily allowance and report credits, extended by a second purchase', async () => {
      const b = await signedUp();
      await buy(b, 'premium_30d');
      let me = (await b('GET', '/api/billing/me')).body;
      assert.equal(me.credits, 1);
      assert.equal(me.ai.premium, true);
      assert.equal(me.ai.premiumPerDay, 3);
      const until = Date.parse(me.ai.premiumUntil);
      assert.ok(Math.abs(until - (Date.now() + 30 * DAY)) < 60_000);

      await buy(b, 'premium_30d');
      me = (await b('GET', '/api/billing/me')).body;
      assert.equal(me.credits, 2);
      assert.ok(Math.abs(Date.parse(me.ai.premiumUntil) - (until + 30 * DAY)) < 60_000);

      const sources = [];
      for (let i = 0; i < 6; i++) sources.push((await askOp(b)).body.quota.charged);
      assert.deepEqual(sources, ['premium', 'premium', 'premium', 'free', 'free', null]);

      // After Premium ends: only the free allowance.
      offset = 61 * DAY;
      try {
        const later = await askOp(b);
        assert.equal(later.body.quota.premium, false);
        assert.equal(later.body.quota.charged, 'free');
      } finally {
        offset = 0;
      }
    });

    it('never spends one allowance on two questions asked at once', async () => {
      const b = await signedUp();
      const results = await Promise.all([1, 2, 3, 4].map(() => askOp(b)));
      assert.deepEqual(results.map((r) => r.body.quota.charged).sort(), ['free', 'free', null, null]);
    });

    it('meters the Future Map AI and keeps its AI and basic answers apart in the cache', async () => {
      const b = await signedUp();
      const q = { question: 'Vành đai 4 hoàn thành khi nào?', year: 2035, lang: 'vi' };
      const ai = await b('POST', '/api/future-map/ask-ai', q);
      assert.equal(ai.status, 200);
      assert.equal(ai.body.provider, 'anthropic');
      assert.equal(ai.body.quota.charged, 'free');
      const basic = await browser()('POST', '/api/future-map/ask-ai', q);
      assert.equal(basic.body.provider, 'mock');
      // The rule-based /ask stays free and unmetered.
      assert.equal((await b('POST', '/api/future-map/ask', q)).body.quota, undefined);
    });

    it('gives the Time Machine storyteller a free allowance of its own, apart from the other tools', async () => {
      const visitor = await askTm(browser());
      assert.equal(visitor.body.provider, 'mock');
      assert.deepEqual({ charged: visitor.body.quota.charged, reason: visitor.body.quota.reason, toolFreePerDay: visitor.body.quota.toolFreePerDay }, { charged: null, reason: 'signin', toolFreePerDay: 4 });

      const b = await signedUp();
      await askOp(b);
      const first = await askTm(b);
      assert.equal(first.body.provider, 'anthropic');
      assert.equal(first.body.quota.charged, 'free');
      assert.equal(first.body.quota.toolFreeLeft, 3);
      assert.equal(first.body.quota.freeLeft, 1); // the common allowance is only used by the other tools
      for (let i = 0; i < 3; i++) await askTm(b);

      const fifth = await askTm(b);
      assert.equal(fifth.body.provider, 'mock');
      assert.deepEqual({ charged: fifth.body.quota.charged, reason: fifth.body.quota.reason, toolFreeLeft: fifth.body.quota.toolFreeLeft }, { charged: null, reason: 'no_quota', toolFreeLeft: 0 });
      // The storyteller's answers did not use up the common allowance, and the reverse.
      assert.equal((await askOp(b)).body.quota.charged, 'free');
      const ai = (await b('GET', '/api/billing/me')).body.ai;
      assert.deepEqual({ freeLeft: ai.freeLeft, storyFreeLeft: ai.storyFreeLeft, storyFreePerDay: ai.storyFreePerDay }, { freeLeft: 0, storyFreeLeft: 0, storyFreePerDay: 4 });
    });

    it('lets Premium and bought AI credits pay for the Time Machine too', async () => {
      const b = await signedUp();
      await buy(b, 'premium_30d');
      await buy(b, 'ai_30');
      const sources = [];
      for (let i = 0; i < 9; i++) sources.push((await askTm(b)).body.quota.charged);
      assert.deepEqual(sources, ['premium', 'premium', 'premium', 'free', 'free', 'free', 'free', 'credit', 'credit']);
      assert.equal((await b('GET', '/api/billing/me')).body.ai.aiCredits, 28);
    });

    it('gives the storyteller allowance back when the AI fails, and charges nothing for an invalid question', async () => {
      const b = await signedUp();
      aiDown = true;
      try {
        const res = await askTm(b, 'Hồ Gươm xưa ra sao nhỉ?'); // not asked before, so not served from the answer cache
        assert.equal(res.body.provider, 'mock');
        assert.equal(res.body.quota.reason, 'unavailable');
        assert.equal(res.body.quota.toolFreeLeft, 4);
      } finally {
        aiDown = false;
      }
      assert.equal((await askTm(b, 'x')).status, 400);
      assert.equal((await b('GET', '/api/billing/me')).body.ai.storyFreeLeft, 4);
    });

    it('never spends one storyteller allowance on two questions asked at once', async () => {
      const b = await signedUp();
      const results = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => askTm(b, `Hồ Gươm năm ${2000 + i}?`)));
      assert.deepEqual(results.map((r) => r.body.quota.charged).sort(), ['free', 'free', 'free', 'free', null, null]);
    });

    it('meters the Living Score AI explanations, but not the rule-based ones', async () => {
      const b = await signedUp();
      const body = { household: 'single', lang: 'vi' };
      const ai = await b('POST', '/api/living-score/recommendations', body);
      assert.equal(ai.status, 200);
      assert.equal(ai.body.mode, 'ai');
      assert.equal(ai.body.quota.charged, 'free');
      const visitor = await browser()('POST', '/api/living-score/recommendations', body);
      assert.equal(visitor.body.mode, 'rules');
      assert.equal(visitor.body.quota.reason, 'signin');
      const rules = await b('POST', '/api/living-score/recommendations', { ...body, useAi: false });
      assert.equal(rules.body.quota, undefined);
      assert.equal((await b('GET', '/api/billing/me')).body.ai.freeLeft, 1);
    });
  });
}

describe('AI metering switched off', () => {
  let server;
  let root;
  before(async () => {
    const fake = { name: 'anthropic', model: 'fake', answer: async () => ({ verdict: 'AI', reasons: [], risks: [], wardSlugs: [], typeKeys: [], sourceIds: [] }) };
    // auto: no Anthropic key configured → nothing to meter, even with accounts on.
    const { app } = createApp({
      log: false,
      accounts: { store: new MemoryStore() },
      aiMeter: { mode: 'auto', aiConfigured: false },
      opportunity: { answerers: { primary: fake, fallback: new OpMock() } },
    });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    root = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise((resolve) => server.close(resolve)));

  it('answers with the AI for everyone, without a quota', async () => {
    const res = await fetch(`${root}/api/opportunity/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'Mở quán cà phê ở đâu?' }) });
    const body = await res.json();
    assert.equal(body.provider, 'anthropic');
    assert.equal(body.quota, undefined);
  });
});
