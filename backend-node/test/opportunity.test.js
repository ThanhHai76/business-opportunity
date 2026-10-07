'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const M = require('../src/opportunity/model');
const { MockAnswerer } = require('../src/opportunity/ai');

const OP = '/api/opportunity';

describe('Business Opportunity Map model', () => {
  it('covers Hanoi wards from OSM, each with an outline; only wards with a population are scored', () => {
    assert.ok(M.DATA.wards.length >= 60);
    assert.ok(M.DATA.wards.every((w) => w.geometry.type === 'MultiPolygon' && /^(Phường|Xã) /.test(w.name)));
    const scored = M.DATA.wards.filter((w) => M.isScored(w.slug));
    assert.ok(scored.length >= 50);
    assert.ok(scored.every((w) => w.population > 0));
    assert.equal(M.scoresFor(M.DATA.wards.find((w) => !w.population)?.slug ?? 'none', 'now'), null);
  });

  it('scores 0-100 as demand − 0.4 × competition, relative between wards', () => {
    for (const type of M.TYPE_KEYS) {
      const ranking = M.rankingFor(type, 'now');
      assert.ok(ranking.every((r) => r.opportunity >= 0 && r.opportunity <= 100));
      assert.ok(Math.abs(Math.max(...ranking.map((r) => r.demand)) - 100) < 25, type);
      for (const r of ranking) assert.ok(Math.abs(r.opportunity - Math.max(0, r.demand - 0.4 * r.competition)) < 0.2, `${type} ${r.slug}`);
      assert.deepEqual([...ranking].sort((a, b) => b.opportunity - a.opportunity).map((r) => r.slug), ranking.map((r) => r.slug));
    }
  });

  it('the 2030 horizon only adds growth (construction, metro being built) to demand', () => {
    const now = new Map(M.rankingFor('cafe', 'now').map((r) => [r.slug, r]));
    for (const r of M.rankingFor('cafe', '2030')) {
      assert.ok(r.demand >= now.get(r.slug).demand - 0.05, r.slug);
      assert.equal(r.competition, now.get(r.slug).competition);
    }
  });

  it('never makes a sparsely mapped type the top suggestion of a ward', () => {
    for (const w of M.DATA.wards.filter((x) => M.isScored(x.slug))) {
      assert.equal(M.scoresFor(w.slug, 'now')[0].sparseType, false, w.slug);
    }
  });
});

describe('Business Opportunity Map API', () => {
  let server;
  let living;
  let base;
  let fakeAnswer;

  before(async () => {
    const fake = { name: 'fake', model: 'fake-model', answer: async () => fakeAnswer };
    const created = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      opportunity: { answerers: { primary: fake, fallback: new MockAnswerer() }, rateLimits: { global: 10_000, ai: 10_000 } },
    });
    living = created.living;
    server = await new Promise((resolve) => {
      const s = created.app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await living.close();
  });

  const get = async (path) => {
    const res = await fetch(`${base}${OP}${path}`);
    return { status: res.status, body: await res.json() };
  };
  const post = async (path, payload) => {
    const res = await fetch(`${base}${OP}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    return { status: res.status, body: await res.json() };
  };

  it('lists the 12 business types with their data quality, in both languages', async () => {
    const vi = await get('/types');
    assert.equal(vi.body.types.length, 12);
    assert.ok(vi.body.types.some((t) => t.sparse) && vi.body.types.some((t) => !t.sparse));
    const en = await get('/types?lang=en');
    assert.equal(en.body.types.find((t) => t.key === 'cafe').name, 'Café');
    assert.equal((await get('/types?lang=fr')).status, 400);
  });

  it('returns wards as GeoJSON, scored for one type (with rank) or by their top type, plus method and sources', async () => {
    const byType = await get('/wards?type=pharmacy&horizon=2030');
    assert.equal(byType.status, 200);
    const scored = byType.body.features.filter((f) => f.properties.scored);
    assert.ok(scored.every((f) => f.properties.rank >= 1 && f.properties.score !== null));
    assert.ok(byType.body.features.filter((f) => !f.properties.scored).every((f) => f.properties.score === null));
    assert.match(byType.body.meta.method, /0,4/);
    assert.deepEqual(byType.body.meta.sources.map((s) => s.id), ['osm', 'population', 'metro']);
    const top = await get('/wards');
    assert.ok(top.body.features.filter((f) => f.properties.scored).every((f) => M.TYPE_KEYS.includes(f.properties.topType)));
    assert.equal((await get('/wards?type=casino')).status, 400);
    assert.equal((await get('/wards?horizon=2040')).status, 400);
  });

  it('explains a ward: facts, every type with its breakdown, OSM coverage and a Business Copilot link', async () => {
    const { status, body } = await get('/wards/phuong-cau-giay?horizon=2030');
    assert.equal(status, 200);
    assert.equal(body.facts.population, M.WARD_BY_SLUG.get('phuong-cau-giay').population);
    assert.equal(body.opportunities.length, 12);
    const cafe = body.opportunities.find((o) => o.type === 'cafe');
    assert.ok(cafe.drivers.length >= 4 && cafe.drivers.every((d) => d.points <= 100));
    assert.ok(cafe.growth !== null);
    assert.equal(body.copilot.slug, 'cau-giay');
    assert.ok(body.coverage.ratio > 0);
    assert.equal((await get('/wards/khong-co')).status, 404);
  });

  it('lists the competitors of a type mapped in a ward', async () => {
    const { body } = await get('/wards/phuong-cau-giay/places?type=cafe');
    assert.equal(body.features.length, M.WARD_BY_SLUG.get('phuong-cau-giay').counts.cafe);
    assert.equal((await get('/wards/phuong-cau-giay/places')).status, 400);
  });

  it('compares 2-3 wards', async () => {
    const ok = await get('/compare?slugs=phuong-cau-giay,phuong-ha-dong,phuong-tay-ho&type=cafe');
    assert.equal(ok.body.wards.length, 3);
    assert.ok(ok.body.wards.every((w) => w.focus.type === 'cafe' && w.top3.length === 3));
    assert.equal((await get('/compare?slugs=phuong-cau-giay')).status, 400);
    assert.equal((await get('/compare?slugs=phuong-cau-giay,khong-co')).status, 404);
  });

  it('answers questions from the data (mock), and keeps only real wards, types and sources from the model', async () => {
    fakeAnswer = null;
    const where = await post('/ask', { question: 'Nên mở nhà thuốc ở đâu?' });
    assert.equal(where.body.provider, 'mock');
    assert.deepEqual(where.body.types, ['pharmacy']);
    assert.equal(where.body.wards.length, 5);
    // "Where…?" ranks every ward even when one is selected; Vietnamese decimals use a comma, thousands keep the dot.
    const whereWithWard = await post('/ask', { question: 'Nên mở nhà thuốc ở đâu?', ward: 'phuong-lang' });
    assert.equal(whereWithWard.body.wards.length, 5);
    assert.doesNotMatch(where.body.answer, /\d\.\d(?!\d{2})/);
    const one = await post('/ask', { question: 'Mở quán cà phê ở Phường Cầu Giấy thì sao?', lang: 'en' });
    assert.match(one.body.answer, /Phường Cầu Giấy: opportunity/);
    fakeAnswer = { answer: 'Theo dữ liệu…', sourceIds: ['osm', 'made-up'], wardSlugs: ['phuong-lang', 'nowhere'], typeKeys: ['cafe', 'casino'], outOfScope: false };
    const ai = await post('/ask', { question: 'Láng có hợp mở cà phê?' });
    assert.equal(ai.body.provider, 'fake');
    assert.deepEqual(ai.body.sources.map((s) => s.id), ['osm']);
    assert.deepEqual(ai.body.wards.map((w) => w.slug), ['phuong-lang']);
    assert.deepEqual(ai.body.types, ['cafe']);
    assert.equal((await post('/ask', { question: 'x' })).status, 400);
    assert.equal((await post('/ask', { question: 'abc', ward: 'khong-co' })).status, 404);
  });
});
