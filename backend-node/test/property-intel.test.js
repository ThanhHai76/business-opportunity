'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');

const PI = '/api/property-intel';

describe('AI Property Intelligence API', () => {
  let server;
  let living;
  let base;

  before(async () => {
    const created = createApp({ log: false, living: { config: loadConfig({ DATA_SOURCE: 'memory' }) } });
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
    const res = await fetch(`${base}${PI}${path}`);
    return { status: res.status, body: await res.json() };
  };
  const ask = async (payload) => {
    const res = await fetch(`${base}${PI}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json() };
  };

  it('serves an overview flagged as sample data', async () => {
    const { status, body } = await get('/overview');
    assert.equal(status, 200);
    assert.equal(body.sampleData, true);
    assert.match(body.note, /SAMPLE DATA/);
    assert.deepEqual(body.horizons, [2026, 2030, 2045]);
    assert.equal(body.stats.districts, 10);
    assert.equal(body.featured.slug, 'gia-lam');
    assert.equal(body.featured.growthScore, 89);
  });

  it('ranks districts by growth score', async () => {
    const { status, body } = await get('/districts');
    assert.equal(status, 200);
    const scores = body.districts.map((d) => d.growthScore);
    assert.deepEqual([...scores].sort((a, b) => b - a), scores);
    assert.deepEqual(body.districts.map((d) => d.rank), body.districts.map((_, i) => i + 1));
  });

  it('returns Gia Lâm intelligence matching the design numbers', async () => {
    const { status, body } = await get('/districts/gia-lam');
    assert.equal(status, 200);
    assert.equal(body.growthScore, 89);
    assert.equal(body.rank, 3);
    assert.equal(body.scoreDelta, 6);
    assert.equal(body.criteria.length, 8);
    assert.equal(body.priceTrend.change6y, 112);
    assert.equal(body.priceTrend.district.at(-1), 68.4);
    assert.equal(body.priceTrend.district.length, body.priceTrend.city.length);
    assert.equal(body.metrics.pipelineUnits, 24_600);
    assert.ok(body.projects.some((p) => p.slug === 'riverside-aurora'));
  });

  it('values a project and measures real distances to its station and landmarks', async () => {
    const { status, body } = await get('/projects/riverside-aurora');
    assert.equal(status, 200);
    assert.equal(body.estimate.value, 5.39);
    assert.equal(body.vsDistrict, 6.4);
    assert.equal(body.station.name, 'Yên Viên Stn');
    assert.ok(body.station.distanceM > 300 && body.station.distanceM < 500);
    assert.equal(body.proximity.find((r) => r.key === 'tod').distanceM, 0);
    assert.equal(body.history.points.length, 21);
    assert.equal(body.history.points.at(-1).value, 72.8);
    assert.equal(body.nearby.length, 3);
    assert.ok(body.nearby.every((p) => p.district === 'gia-lam'));
  });

  it('generates landmarks for projects that have none and keeps them stable', async () => {
    const first = await get('/projects/west-line-residences');
    const second = await get('/projects/west-line-residences');
    assert.equal(first.status, 200);
    assert.ok(first.body.pois.length >= 4);
    assert.deepEqual(first.body.pois, second.body.pois);
  });

  it('answers 404 for unknown districts and projects, 400 for bad slugs', async () => {
    assert.equal((await get('/districts/atlantis')).status, 404);
    assert.equal((await get('/projects/nope')).status, 404);
    assert.equal((await get('/districts/Bad%20Slug')).status, 400);
  });

  it('builds map layers per planning horizon', async () => {
    const early = await get('/map?horizon=2026');
    const late = await get('/map?horizon=2045');
    assert.equal(early.status, 200);
    const l1 = (layers) => layers.metro.features.find((f) => f.properties.id === 'L1').properties.status;
    assert.equal(l1(early.body.layers), 'planned');
    assert.equal(l1(late.body.layers), 'operating');
    assert.ok(late.body.layers.planning.features.length > early.body.layers.planning.features.length);
    assert.equal(early.body.layers.districts.features.length, 10);
    assert.equal((await get('/map?horizon=2099')).status, 400);
  });

  it('searches districts and projects by word prefix, accent-insensitively', async () => {
    const { body } = await get('/search?q=gia%20l');
    assert.deepEqual(body.results.map((r) => r.slug), ['gia-lam']);
    const mid = await get('/search?q=ia');
    assert.deepEqual(mid.body.results, []);
    const viet = await get(`/search?q=${encodeURIComponent('yên viên')}`);
    assert.ok(viet.body.results.some((r) => r.slug === 'riverside-aurora'));
  });

  it('answers the hero question with the Gia Lâm insight', async () => {
    const { status, body } = await ask({ question: 'Is Gia Lâm a good area to buy property for the next 5 years?' });
    assert.equal(status, 200);
    assert.equal(body.intent, 'analyze');
    assert.equal(body.engine, 'rule-based');
    assert.equal(body.district.slug, 'gia-lam');
    assert.equal(body.outlook.label, 'Positive');
    assert.deepEqual(body.scenarios.map((s) => s.change), [12, 38, 61]);
    assert.equal(body.scenarios.reduce((sum, s) => sum + s.probability, 0), 100);
    assert.ok(body.callout.text.length > 0);
  });

  it('detects compare, price, future, report and project questions', async () => {
    const compare = await ask({ question: 'So sánh Gia Lâm và Long Biên' });
    assert.equal(compare.body.intent, 'compare');
    assert.deepEqual(compare.body.table.rows.map((r) => r[0]), ['Gia Lâm', 'Long Biên']);

    const price = await ask({ question: 'Giá nhà Đông Anh thế nào?' });
    assert.equal(price.body.intent, 'price');
    assert.equal(price.body.district.slug, 'dong-anh');

    assert.equal((await ask({ question: 'Future scenario for Hoàng Mai' })).body.intent, 'future');
    assert.equal((await ask({ question: 'Write an investment report', district: 'tay-ho' })).body.district.slug, 'tay-ho');

    const project = await ask({ question: 'What about Riverside Aurora?' });
    assert.equal(project.body.intent, 'project');
    assert.equal(project.body.project.slug, 'riverside-aurora');
  });

  it('honours an explicit intent and pads a one-district comparison', async () => {
    const { body } = await ask({ question: 'Compare Areas', intent: 'compare', district: 'ha-dong' });
    assert.equal(body.table.rows.length, 3);
    assert.equal(body.table.rows[0][0], 'Hà Đông');
  });

  it('validates the ask body', async () => {
    assert.equal((await ask({})).status, 400);
    assert.equal((await ask({ question: 'hi', intent: 'hack' })).status, 400);
    assert.equal((await ask({ question: 'hello', district: 'atlantis' })).status, 404);
    assert.equal((await ask('{not json')).status, 400);
  });
});
