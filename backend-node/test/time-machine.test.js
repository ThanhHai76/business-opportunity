'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const { MockStoryteller, findLandmarks, findEra } = require('../src/time-machine/storyteller');

const TM = '/api/time-machine';

describe('Hanoi Time Machine storyteller', () => {
  it('matches landmarks by name or alias, with or without diacritics', () => {
    assert.deepEqual(findLandmarks('Hỏa Lò được gọi là gì?'), ['hoa-lo']);
    assert.deepEqual(findLandmarks('Why was it called the Hanoi Hilton?'), ['hoa-lo']);
    assert.deepEqual(findLandmarks('cau long bien xay khi nao'), ['long-bien']);
    assert.deepEqual(findLandmarks('Thời tiết hôm nay'), []);
  });

  it('maps a year in the question to the nearest era', () => {
    assert.equal(findEra('năm 1972'), '1975');
    assert.equal(findEra('năm 1902'), '1926');
    assert.equal(findEra('Hà Nội năm 2060'), '2050');
    assert.equal(findEra('không có năm'), null);
  });

  it('keeps landmarks.json in sync with the Time Machine page', { skip: !fs.existsSync(path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'typescript')) }, () => {
    const { buildKnowledge, serialize, OUT_FILE } = require('../scripts/sync-time-machine');
    assert.equal(fs.readFileSync(OUT_FILE, 'utf8'), serialize(buildKnowledge()), 'Run `npm run sync:time-machine` after editing the Time Machine data.');
  });

  describe('API', () => {
    let server;
    let living;
    let base;
    let fakeAnswer;

    before(async () => {
      // A stand-in for Claude: returns whatever the test sets, or null to force the fallback.
      const fakePrimary = { name: 'fake', model: 'fake-model', tell: async () => fakeAnswer };
      const created = createApp({
        log: false,
        living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
        timeMachine: { storytellers: { primary: fakePrimary, fallback: new MockStoryteller() }, rateLimits: { global: 10_000, ask: 10_000 } },
      });
      living = created.living;
      server = await new Promise((resolve) => {
        const s = created.app.listen(0, '127.0.0.1', () => resolve(s));
      });
      base = `http://127.0.0.1:${server.address().port}${TM}`;
    });

    after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await living.close();
    });

    const ask = (body) => fetch(`${base}/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

    it('falls back to the template storyteller, grounded in the landmark story and its sources', async () => {
      fakeAnswer = null;
      const res = await ask({ question: 'Cầu Long Biên năm 1972 thế nào?' });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.provider, 'mock');
      assert.deepEqual(body.landmarks, [{ key: 'long-bien', name: 'Cầu Long Biên' }]);
      assert.deepEqual(body.eras, ['1975']);
      assert.match(body.answer, /1967/);
      assert.ok(body.sources.every((s) => s.url.startsWith('https://vi.wikipedia.org/wiki/')));
      assert.equal(body.future, false);
    });

    it('uses the page context when the question names no landmark', async () => {
      fakeAnswer = null;
      const body = await (await ask({ question: 'Nơi này năm 2100 ra sao?', landmark: 'hoa-lo' })).json();
      assert.equal(body.landmarks[0].key, 'hoa-lo');
      assert.equal(body.future, true);
    });

    it('says so when a question is out of scope', async () => {
      fakeAnswer = null;
      const body = await (await ask({ question: 'Giá vàng hôm nay bao nhiêu?', landmark: 'hoan-kiem', era: '2026' })).json();
      assert.equal(body.outOfScope, true);
      assert.deepEqual(body.sources, []);
    });

    it("attaches sources from the model's landmark keys and drops unknown keys", async () => {
      fakeAnswer = { answer: 'Câu trả lời thử.', landmarkKeys: ['van-mieu', 'not-a-landmark'], eraIds: ['2026', '1800'], outOfScope: false };
      const body = await (await ask({ question: 'Văn Miếu có gì đặc biệt?' })).json();
      assert.equal(body.provider, 'fake');
      assert.equal(body.answer, 'Câu trả lời thử.');
      assert.deepEqual(body.landmarks.map((l) => l.key), ['van-mieu']);
      assert.deepEqual(body.eras, ['2026']);
      assert.deepEqual(body.sources.map((s) => s.site), ['Wikipedia tiếng Việt', 'Trang chính thức của di tích']);
    });

    it('answers in English, with English names and English Wikipedia first', async () => {
      fakeAnswer = null;
      const body = await (await ask({ question: 'What was Long Bien Bridge like in 1972?', lang: 'en' })).json();
      assert.deepEqual(body.landmarks, [{ key: 'long-bien', name: 'Long Bien Bridge' }]);
      assert.match(body.answer, /bombed many times/);
      assert.equal(body.sources[0].site, 'English Wikipedia');
      assert.equal(body.sources[1].site, 'Vietnamese Wikipedia');
      const out = await (await ask({ question: 'What is the weather today?', lang: 'en' })).json();
      assert.equal(out.outOfScope, true);
      assert.match(out.answer, /^I can only tell/);
    });

    it('rejects invalid input', async () => {
      assert.equal((await ask({ question: '' })).status, 400);
      assert.equal((await ask({ question: 'Hồ Gươm', landmark: 'nowhere' })).status, 400);
      assert.equal((await ask({ question: 'x'.repeat(501) })).status, 400);
      assert.equal((await ask({ question: 'Hồ Gươm', extra: 1 })).status, 400);
      assert.equal((await ask({ question: 'Hồ Gươm', lang: 'fr' })).status, 400);
    });
  });
});
