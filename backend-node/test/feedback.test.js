'use strict';
/** "Báo sai số liệu": reports of wrong figures about a ward or a source (src/feedback). */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const { MemoryStore } = require('../src/accounts/memory-store');

const ORIGIN = 'http://localhost:4200';
const WARD = 'phuong-tay-ho';

describe('Reports of wrong figures', () => {
  let server;
  let root;
  let store;

  const start = async (rateLimits) => {
    store = new MemoryStore();
    const { app } = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      accounts: { store, rateLimits: { login: 1000, register: 1000 } },
      aiMeter: { mode: 'off' },
      feedback: { rateLimits },
    });
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    root = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = () => new Promise((resolve) => server.close(resolve));
  const send = async (body, headers = {}) => {
    const res = await fetch(`${root}/api/feedback/data-report`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };

  describe('sending', () => {
    before(() => start({ perHour: 1000, perDay: 1000 }));
    after(stop);

    it('keeps a report about a ward, with who sent it when they gave a contact', async () => {
      const r = await send({ kind: 'ward', target: WARD, targetName: 'Phường Tây Hồ', page: 'opportunity', message: 'Dân số ghi 60.000 nhưng danh sách chính thức là khác.', contact: 'a@example.com' });
      assert.equal(r.status, 201);
      assert.equal(r.body.ok, true);
      const [saved] = await store.listDataReports();
      assert.deepEqual([saved.kind, saved.target, saved.targetName, saved.page, saved.contact], ['ward', WARD, 'Phường Tây Hồ', 'opportunity', 'a@example.com']);
      assert.equal(saved.userId, null);
    });

    it('keeps a report about a source', async () => {
      const r = await send({ kind: 'source', target: 'nso-q2-2026', message: 'Số thất nghiệp thanh niên khác với thông cáo.' });
      assert.equal(r.status, 201);
      assert.equal((await store.listDataReports())[0].target, 'nso-q2-2026');
    });

    it('refuses an unknown ward, a message that is too short or too long, extra fields and a foreign origin', async () => {
      assert.equal((await send({ kind: 'ward', target: 'khong-co', message: 'Số liệu này sai hoàn toàn.' })).status, 400);
      assert.equal((await send({ kind: 'ward', target: WARD, message: 'sai' })).status, 400);
      assert.equal((await send({ kind: 'ward', target: WARD, message: 'x'.repeat(1001) })).status, 400);
      assert.equal((await send({ kind: 'ward', target: WARD, message: 'Số liệu này sai hoàn toàn.', admin: true })).status, 400);
      assert.equal((await send({ kind: 'other', target: WARD, message: 'Số liệu này sai hoàn toàn.' })).status, 400);
      assert.equal((await send({ kind: 'ward', target: WARD, message: 'Số liệu này sai hoàn toàn.' }, { origin: 'https://evil.example' })).status, 403);
    });

    it('answers a bot that fills the hidden field as if it worked, and keeps nothing', async () => {
      const before = (await store.listDataReports(500)).length;
      const r = await send({ kind: 'ward', target: WARD, message: 'Mua thuốc giá rẻ tại đây nhé.', website: 'http://spam.example' });
      assert.equal(r.status, 201);
      assert.equal((await store.listDataReports(500)).length, before);
    });
  });

  describe('limits', () => {
    before(() => start({ perHour: 2, perDay: 1000 }));
    after(stop);

    it('stops one address after a few reports an hour', async () => {
      const report = { kind: 'ward', target: WARD, message: 'Số liệu này sai hoàn toàn.' };
      assert.equal((await send(report)).status, 201);
      assert.equal((await send(report)).status, 201);
      const third = await send(report);
      assert.equal(third.status, 429);
      assert.equal(third.body.code, 'rate_limited');
    });
  });

  describe('the administrator reads and sorts the reports', () => {
    const ADMIN = 'chu@example.com';
    let admin;
    before(async () => {
      process.env.ADMIN_EMAILS = ` ${ADMIN.toUpperCase()} , khac@example.com `;
      await start({ perHour: 1000, perDay: 1000 });
      await send({ kind: 'ward', target: WARD, targetName: 'Phường Tây Hồ', message: 'Dân số ghi 60.000 nhưng danh sách chính thức là khác.' });
      await send({ kind: 'source', target: 'nso-q2-2026', message: 'Số thất nghiệp thanh niên khác với thông cáo.' });
      admin = await signUp(ADMIN, true);
    });
    after(async () => {
      delete process.env.ADMIN_EMAILS;
      await stop();
    });

    /** A browser with its own session cookie. */
    const browser = () => {
      let cookie = '';
      return async (method, path, body) => {
        const res = await fetch(root + path, { method, headers: { 'content-type': 'application/json', origin: ORIGIN, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
        const set = res.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null };
      };
    };
    const signUp = async (email, verified) => {
      const b = browser();
      const reg = await b('POST', '/api/account/register', { email, password: 'mat-khau-dai-123', acceptTerms: true });
      assert.equal(reg.status, 201, JSON.stringify(reg.body));
      if (verified) await store.updateUser(reg.body.user.id, { emailVerifiedAt: new Date() });
      return b;
    };

    it('asks to sign in first, and refuses anyone who is not on the list, and a listed address that was never confirmed', async () => {
      assert.equal((await browser()('GET', '/api/feedback/admin/reports')).status, 401);
      assert.equal((await (await signUp('thuong@example.com', true))('GET', '/api/feedback/admin/reports')).status, 403);
      // On the list, but the address was never confirmed: anyone could have typed it.
      assert.equal((await (await signUp('khac@example.com', false))('GET', '/api/feedback/admin/reports')).status, 403);
    });

    it('tells the account menu whether to show the link, without ever failing', async () => {
      assert.deepEqual((await browser()('GET', '/api/feedback/admin/me')).body, { admin: false });
      assert.deepEqual((await (await signUp('thuong2@example.com', true))('GET', '/api/feedback/admin/me')).body, { admin: false });
      assert.deepEqual((await admin('GET', '/api/feedback/admin/me')).body, { admin: true });
    });

    it('lists the reports, newest first, filters them by status and records a decision', async () => {
      const all = await admin('GET', '/api/feedback/admin/reports');
      assert.equal(all.status, 200);
      assert.deepEqual(all.body.reports.map((r) => r.target), ['nso-q2-2026', WARD]);
      assert.equal(all.body.reports[1].targetName, 'Phường Tây Hồ');
      assert.equal(all.body.reports[0].status, 'new');

      const id = all.body.reports[0].id;
      assert.equal((await admin('PATCH', `/api/feedback/admin/reports/${id}`, { status: 'fixed' })).status, 200);
      assert.deepEqual((await admin('GET', '/api/feedback/admin/reports?status=new')).body.reports.map((r) => r.target), [WARD]);
      assert.deepEqual((await admin('GET', '/api/feedback/admin/reports?status=fixed')).body.reports.map((r) => r.id), [id]);
    });

    it('refuses an unknown status, a malformed id and a report that does not exist', async () => {
      const id = (await admin('GET', '/api/feedback/admin/reports')).body.reports[0].id;
      assert.equal((await admin('GET', '/api/feedback/admin/reports?status=weird')).status, 400);
      assert.equal((await admin('PATCH', `/api/feedback/admin/reports/${id}`, { status: 'weird' })).status, 400);
      assert.equal((await admin('PATCH', '/api/feedback/admin/reports/not-an-id', { status: 'fixed' })).status, 400);
      assert.equal((await admin('PATCH', '/api/feedback/admin/reports/00000000-0000-4000-8000-000000000000', { status: 'fixed' })).status, 404);
    });

    it('is closed to everyone while ADMIN_EMAILS is empty', async () => {
      delete process.env.ADMIN_EMAILS;
      await stop();
      await start({ perHour: 1000, perDay: 1000 });
      const b = await signUp(ADMIN, true);
      assert.equal((await b('GET', '/api/feedback/admin/reports')).status, 403);
    });
  });
});
