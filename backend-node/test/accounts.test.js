'use strict';
/**
 * Accounts API: sign-up, sign-in, sessions, CSRF, saved reports. Runs against the in-memory store, and against a real
 * PostgreSQL too when TEST_DATABASE_URL is set (its tables are emptied first — use a throw-away database).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { MemoryStore } = require('../src/accounts/memory-store');

const report = (ward, extra = {}) => ({
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
  ...extra,
});

const stores = [['memory', () => new MemoryStore()]];
if (process.env.TEST_DATABASE_URL) {
  stores.push([
    'postgres',
    async () => {
      const { Pool } = require('pg');
      const { PostgresStore } = require('../src/accounts/postgres-store');
      const store = new PostgresStore(new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 }));
      await store.init();
      await store.pool.query('TRUNCATE app_email_tokens, ai_credit_ledger, ai_usage, paid_reports, credit_ledger, billing_orders, saved_items, app_sessions, app_users');
      return store;
    },
  ]);
}

for (const [name, makeStore] of stores) {
  describe(`accounts API (${name} store)`, () => {
    let server;
    let base;
    let store;

    before(async () => {
      store = await makeStore();
      const { app } = createApp({ log: false, premium: { mode: 'off' }, accounts: { store, rateLimits: { login: 1000, register: 1000 } } });
      await new Promise((resolve) => {
        server = app.listen(0, resolve);
      });
      base = `http://127.0.0.1:${server.address().port}/api/account`;
    });
    after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await store.close();
    });

    /** A browser: keeps the session cookie between requests, sends our own Origin. */
    const browser = (origin = 'http://localhost:4200') => {
      let cookie = '';
      return async (method, path, body, headers = {}) => {
        const res = await fetch(base + path, {
          method,
          headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), origin, ...headers },
          body: body ? JSON.stringify(body) : undefined,
        });
        const set = res.headers.get('set-cookie');
        if (set) cookie = /Max-Age=0/.test(set) ? '' : set.split(';')[0];
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: set, cookie: () => cookie };
      };
    };

    it('signs up, keeps the session in an HttpOnly cookie and never returns the password hash', async () => {
      const b = browser();
      assert.deepEqual((await b('GET', '/me')).body, { enabled: true, mail: true, user: null });
      const reg = await b('POST', '/register', { email: ' An@Example.com ', password: 'mat-khau-dai', displayName: 'An' });
      assert.equal(reg.status, 201);
      assert.equal(reg.body.user.email, 'an@example.com');
      assert.equal(reg.body.user.passwordHash, undefined);
      assert.match(reg.setCookie, /^h100_sid=[\w-]{43}; Path=\/api; HttpOnly; SameSite=Lax; Max-Age=2592000$/);
      const me = await b('GET', '/me');
      assert.equal(me.body.user.displayName, 'An');
      assert.equal(JSON.stringify(me.body).includes('scrypt'), false);
    });

    it('refuses a second account for the same email, whatever its case, and weak or malformed input', async () => {
      const b = browser();
      assert.equal((await b('POST', '/register', { email: 'binh@example.com', password: '12345678' })).status, 201);
      const dup = await browser()('POST', '/register', { email: 'BINH@example.com', password: '12345678' });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'email_taken');
      assert.equal((await browser()('POST', '/register', { email: 'x@example.com', password: 'short' })).status, 400);
      assert.equal((await browser()('POST', '/register', { email: 'not-an-email', password: '12345678' })).status, 400);
      assert.equal((await browser()('POST', '/register', { email: 'y@example.com', password: '12345678', admin: true })).status, 400);
    });

    it('signs in and out; a wrong email and a wrong password get the same answer', async () => {
      await browser()('POST', '/register', { email: 'chi@example.com', password: 'mat-khau-chi' });
      const b = browser();
      const wrongPass = await b('POST', '/login', { email: 'chi@example.com', password: 'sai' });
      const wrongMail = await b('POST', '/login', { email: 'khong-co@example.com', password: 'sai' });
      assert.equal(wrongPass.status, 401);
      assert.deepEqual(wrongPass.body, wrongMail.body);
      assert.equal((await b('POST', '/login', { email: 'CHI@example.com', password: 'mat-khau-chi' })).status, 200);
      assert.equal((await b('GET', '/me')).body.user.email, 'chi@example.com');
      assert.equal((await b('POST', '/logout')).status, 204);
      assert.equal((await b('GET', '/me')).body.user, null);
      assert.equal((await b('GET', '/reports')).status, 401);
    });

    it('rejects state-changing requests from another site (CSRF) but not from our own pages', async () => {
      const evil = await browser('https://evil.example')('POST', '/register', { email: 'evil@example.com', password: '12345678' });
      assert.equal(evil.status, 403);
      assert.equal(evil.body.code, 'bad_origin');
      // No Origin: not a browser, so there is no ambient cookie to abuse.
      const curl = await fetch(`${base}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'cli@example.com', password: '12345678' }) });
      assert.equal(curl.status, 201);
    });

    it('saves reports per user: the same type + ward + horizon replaces the older one, newest first', async () => {
      const b = browser();
      await b('POST', '/register', { email: 'dung@example.com', password: '12345678' });
      const first = await b('PUT', '/reports', report('phuong-lang'));
      assert.equal(first.status, 200);
      assert.match(first.body.item.id, /^[0-9a-f-]{36}$/);
      await b('PUT', '/reports', report('phuong-cau-giay'));
      await b('PUT', '/reports', report('phuong-lang', { score: 61 }));
      const list = (await b('GET', '/reports')).body.items;
      assert.deepEqual(list.map((r) => [r.ward, r.score]), [['phuong-lang', 61], ['phuong-cau-giay', 58.4]]);
      assert.ok(list.every((r) => !Number.isNaN(Date.parse(r.savedAt))));

      // Another user sees none of them and cannot delete them.
      const other = browser();
      await other('POST', '/register', { email: 'em@example.com', password: '12345678' });
      assert.deepEqual((await other('GET', '/reports')).body.items, []);
      assert.equal((await other('DELETE', `/reports/${list[0].id}`)).status, 404);

      assert.equal((await b('DELETE', `/reports/${list[0].id}`)).status, 204);
      assert.equal((await b('GET', '/reports')).body.items.length, 1);
      assert.equal((await b('DELETE', '/reports')).status, 204);
      assert.deepEqual((await b('GET', '/reports')).body.items, []);
    });

    it('validates reports and keeps at most 100', async () => {
      const b = browser();
      await b('POST', '/register', { email: 'giang@example.com', password: '12345678' });
      assert.equal((await b('PUT', '/reports', report('Bad Slug'))).status, 400);
      assert.equal((await b('PUT', '/reports', { ...report('phuong-lang'), extra: 'x' })).status, 400);
      assert.equal((await b('PUT', '/reports', report('phuong-lang', { score: 500 }))).status, 400);
      for (let i = 0; i < 102; i++) await b('PUT', '/reports', report(`w-${i}`));
      const items = (await b('GET', '/reports')).body.items;
      assert.equal(items.length, 100);
      assert.equal(items[0].ward, 'w-101');
    });

    it('imports the reports kept in the browser, never overwriting a newer saved copy', async () => {
      const b = browser();
      await b('POST', '/register', { email: 'hoa@example.com', password: '12345678' });
      await b('PUT', '/reports', report('phuong-lang', { score: 70 })); // saved now
      const imported = await b('POST', '/reports/import', {
        items: [
          { ...report('phuong-lang', { score: 10 }), id: 'local-1', savedAt: '2026-01-01T00:00:00.000Z' }, // older: ignored
          { ...report('phuong-cau-giay'), id: 'local-2', savedAt: '2026-02-01T00:00:00.000Z' },
        ],
      });
      assert.equal(imported.status, 200);
      const byWard = Object.fromEntries(imported.body.items.map((r) => [r.ward, r]));
      assert.equal(byWard['phuong-lang'].score, 70);
      assert.equal(byWard['phuong-cau-giay'].savedAt, '2026-02-01T00:00:00.000Z');
      assert.notEqual(byWard['phuong-cau-giay'].id, 'local-2'); // the server id replaces the browser one
    });

    it('changes the password (signing out the other devices) and deletes the account with everything saved', async () => {
      const laptop = browser();
      await laptop('POST', '/register', { email: 'khanh@example.com', password: 'mat-khau-cu' });
      const phone = browser();
      await phone('POST', '/login', { email: 'khanh@example.com', password: 'mat-khau-cu' });
      await laptop('PUT', '/reports', report('phuong-lang'));

      assert.equal((await laptop('POST', '/me/password', { currentPassword: 'sai', newPassword: 'mat-khau-moi' })).status, 403);
      assert.equal((await laptop('POST', '/me/password', { currentPassword: 'mat-khau-cu', newPassword: 'mat-khau-moi' })).status, 204);
      assert.equal((await phone('GET', '/me')).body.user, null);
      assert.equal((await laptop('GET', '/me')).body.user.email, 'khanh@example.com');
      assert.equal((await browser()('POST', '/login', { email: 'khanh@example.com', password: 'mat-khau-moi' })).status, 200);

      assert.equal((await laptop('PATCH', '/me', { displayName: '  Khánh  ' })).body.user.displayName, 'Khánh');
      assert.equal((await laptop('DELETE', '/me', { password: 'sai' })).status, 403);
      assert.equal((await laptop('DELETE', '/me', { password: 'mat-khau-moi' })).status, 204);
      assert.equal((await laptop('GET', '/me')).body.user, null);
      assert.equal((await browser()('POST', '/login', { email: 'khanh@example.com', password: 'mat-khau-moi' })).status, 401);
      assert.equal((await store.findUserByEmail('khanh@example.com')), null);
    });

    it('answers a forged or expired cookie as signed out and clears it', async () => {
      const res = await fetch(`${base}/me`, { headers: { cookie: 'h100_sid=forged-token' } });
      assert.deepEqual(await res.json(), { enabled: true, mail: true, user: null });
      assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
    });

    describe('email links', () => {
      const sent = [];
      let mailBase;
      let mailServer;
      const tokenOf = (mail) => /token=([\w-]+)/.exec(mail.text)[1];
      const lastMail = (to) => [...sent].reverse().find((m) => m.to === to);

      before(async () => {
        const mailer = { kind: 'fake', enabled: true, real: true, send: async (m) => void sent.push(m) };
        const { app } = createApp({ log: false, mailer, accounts: { store, appUrl: 'https://site.test', rateLimits: { login: 1000, register: 1000, mail: 1000 } } });
        await new Promise((resolve) => {
          mailServer = app.listen(0, resolve);
        });
        mailBase = `http://127.0.0.1:${mailServer.address().port}/api/account`;
      });
      after(async () => {
        await new Promise((resolve) => mailServer.close(resolve));
      });

      const mailBrowser = () => {
        let cookie = '';
        return async (method, path, body) => {
          const res = await fetch(mailBase + path, {
            method,
            headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), origin: 'http://localhost:4200' },
            body: body ? JSON.stringify(body) : undefined,
          });
          const set = res.headers.get('set-cookie');
          if (set) cookie = /Max-Age=0/.test(set) ? '' : set.split(';')[0];
          const text = await res.text();
          return { status: res.status, body: text ? JSON.parse(text) : null };
        };
      };
      const flush = () => new Promise((r) => setTimeout(r, 20));

      it('reports mail on, records the terms and sends a verification link at sign-up that verifies once', async () => {
        const b = mailBrowser();
        assert.equal((await b('GET', '/me')).body.mail, true);
        const reg = await b('POST', '/register', { email: 'mail1@example.com', password: 'mat-khau-dai-123', acceptTerms: true });
        assert.equal(reg.status, 201);
        assert.equal(reg.body.user.emailVerified, false);
        assert.equal((await store.findUserByEmail('mail1@example.com')).termsAcceptedAt instanceof Date, true);
        await flush();
        const mail = lastMail('mail1@example.com');
        assert.match(mail.text, /^[\s\S]*https:\/\/site\.test\/verify-email\?token=/m);
        const token = tokenOf(mail);
        assert.equal((await b('POST', '/verify-email', { token })).body.verified, true);
        assert.equal((await b('GET', '/me')).body.user.emailVerified, true);
        assert.equal((await b('POST', '/verify-email', { token })).status, 400); // single use
        assert.equal((await b('POST', '/verify-email', { token: 'x'.repeat(30) })).body.code, 'invalid_token');
      });

      it('resends the verification link, but not within a minute and not when already verified', async () => {
        const b = mailBrowser();
        await b('POST', '/register', { email: 'mail2@example.com', password: 'mat-khau-dai-123' });
        assert.equal((await b('POST', '/verify-email/send')).status, 429);
        // age the first token so the gap has passed
        await store.createEmailToken({ tokenHash: 'old'.padEnd(64, '0'), userId: (await store.findUserByEmail('mail2@example.com')).id, purpose: 'verify', email: 'mail2@example.com', expiresAt: new Date(Date.now() + 1000) });
        const before = sent.length;
        await store.updateUser((await store.findUserByEmail('mail2@example.com')).id, { emailVerifiedAt: new Date() });
        const done = await b('POST', '/verify-email/send');
        assert.equal(done.body.alreadyVerified, true);
        assert.equal(sent.length, before);
      });

      it('answers forgot-password the same for unknown addresses, and sends nothing to them', async () => {
        const b = mailBrowser();
        const before = sent.length;
        const unknown = await b('POST', '/forgot-password', { email: 'nobody-here@example.com' });
        assert.equal(unknown.status, 202);
        await flush();
        assert.equal(sent.length, before);
        await b('POST', '/register', { email: 'mail3@example.com', password: 'mat-khau-dai-123' });
        const known = await b('POST', '/forgot-password', { email: 'mail3@example.com' });
        assert.equal(known.status, 202);
        assert.deepEqual(known.body, unknown.body);
      });

      it('resets the password with a one-time link, signs every session out and verifies the address', async () => {
        const a = mailBrowser();
        await a('POST', '/register', { email: 'mail4@example.com', password: 'mat-khau-cu-12345' });
        const user = await store.findUserByEmail('mail4@example.com');
        // the sign-up link was just sent: forgot-password waits a minute only for the same kind, so ask directly
        assert.equal((await mailBrowser()('POST', '/forgot-password', { email: 'MAIL4@example.com' })).status, 202);
        await flush();
        const token = tokenOf(lastMail('mail4@example.com'));
        assert.match(lastMail('mail4@example.com').text, /reset-password\?token=/);
        const c = mailBrowser();
        assert.equal((await c('POST', '/reset-password', { token, password: 'short' })).status, 400);
        assert.equal((await c('POST', '/reset-password', { token, password: 'mat-khau-moi-67890' })).status, 204);
        assert.equal((await c('POST', '/reset-password', { token, password: 'mat-khau-khac-1111' })).status, 400); // single use
        assert.equal((await a('GET', '/me')).body.user, null); // the old session is gone
        assert.equal((await mailBrowser()('POST', '/login', { email: 'mail4@example.com', password: 'mat-khau-cu-12345' })).status, 401);
        const login = mailBrowser();
        const ok = await login('POST', '/login', { email: 'mail4@example.com', password: 'mat-khau-moi-67890' });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.user.emailVerified, true);
        assert.equal(user.id, ok.body.user.id);
      });

      it('throttles reset links per account and rejects expired ones', async () => {
        const b = mailBrowser();
        await b('POST', '/register', { email: 'mail5@example.com', password: 'mat-khau-dai-123' });
        await b('POST', '/forgot-password', { email: 'mail5@example.com' });
        await b('POST', '/forgot-password', { email: 'mail5@example.com' });
        await flush();
        assert.equal(sent.filter((m) => m.to === 'mail5@example.com' && /reset-password/.test(m.text)).length, 1);
        const user = await store.findUserByEmail('mail5@example.com');
        await store.createEmailToken({ tokenHash: require('node:crypto').createHash('sha256').update('e'.repeat(43)).digest('hex'), userId: user.id, purpose: 'reset', email: user.email, expiresAt: new Date(Date.now() - 1000) });
        assert.equal((await b('POST', '/reset-password', { token: 'e'.repeat(43), password: 'mat-khau-moi-67890' })).body.code, 'invalid_token');
      });
    });
  });
}

describe('accounts API (limits and no database)', () => {
  it('limits sign-in attempts per IP', async () => {
    const { app } = createApp({ log: false, accounts: { store: new MemoryStore(), rateLimits: { login: 3 } } });
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    try {
      let last;
      for (let i = 0; i < 4; i++) {
        last = await fetch(`http://127.0.0.1:${server.address().port}/api/account/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'nobody@example.com', password: 'x' }),
        });
      }
      assert.equal(last.status, 429);
      assert.equal((await last.json()).code, 'rate_limited');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('says accounts are off, and refuses everything else with 503', async () => {
    const { app } = createApp({ log: false, accounts: { store: null } });
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/account`;
    try {
      assert.deepEqual(await (await fetch(`${base}/me`)).json(), { enabled: false, user: null });
      const res = await fetch(`${base}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).code, 'accounts_disabled');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
