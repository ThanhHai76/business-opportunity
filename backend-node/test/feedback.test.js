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
});
