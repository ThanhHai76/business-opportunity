'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');

const FM = '/api/future-map';
const YEARS = [2026, 2030, 2050, 2100];

describe('Hanoi Future Map API', () => {
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
    const res = await fetch(`${base}${FM}${path}`);
    return { status: res.status, body: await res.json() };
  };
  const post = async (path, payload) => {
    const res = await fetch(`${base}${FM}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json() };
  };

  it('lists the timeline with growing metro stats and flags everything as scenario data', async () => {
    const { status, body } = await get('/timeline');
    assert.equal(status, 200);
    assert.deepEqual(body.years.map((y) => y.year), YEARS);
    assert.equal(body.scenario, true);
    assert.match(body.note, /không phải bản đồ quy hoạch chính thức/);
    const km = body.years.map((y) => y.stats.metroKm);
    assert.deepEqual([...km].sort((a, b) => a - b), km);
    assert.ok(km[3] > km[0]);
    assert.equal(body.years[0].kind, 'present');
    assert.equal(body.years[2].kind, 'scenario');
  });

  it('returns every layer as valid GeoJSON inside the Hanoi area', async () => {
    const { status, body } = await get('/scenario?year=2050');
    assert.equal(status, 200);
    assert.equal(body.year, 2050);
    const expected = ['metroLines', 'metroStations', 'roads', 'green', 'water', 'airports', 'hubs', 'zones', 'tod', 'boundaries', 'axes'];
    assert.deepEqual(Object.keys(body.layers).sort(), expected.sort());
    const check = (c) => {
      assert.ok(Number.isFinite(c[0]) && Number.isFinite(c[1]));
      assert.ok(c[0] > 105.0 && c[0] < 106.4 && c[1] > 20.5 && c[1] < 21.5, `outside Hanoi: ${c}`);
    };
    const walk = (coords) => (typeof coords[0] === 'number' ? check(coords) : coords.forEach(walk));
    for (const [name, layer] of Object.entries(body.layers)) {
      assert.equal(layer.type, 'FeatureCollection', name);
      assert.ok(layer.features.length > 0, `${name} is empty`);
      layer.features.forEach((f) => walk(f.geometry.coordinates));
    }
  });

  it('only shows what exists in the chosen year, and grows over time', async () => {
    const byYear = {};
    for (const year of YEARS) byYear[year] = (await get(`/scenario?year=${year}`)).body;
    const hubs = (y) => byYear[y].layers.hubs.features.map((f) => f.properties.slug);
    assert.ok(!hubs(2026).includes('soc-son'));
    assert.ok(hubs(2050).includes('soc-son'));
    assert.ok(!hubs(2050).includes('van-giang'));
    assert.ok(hubs(2100).includes('van-giang'));
    for (let i = 1; i < YEARS.length; i++) {
      assert.ok(hubs(YEARS[i]).length >= hubs(YEARS[i - 1]).length);
      assert.ok(byYear[YEARS[i]].stats.metroLines >= byYear[YEARS[i - 1]].stats.metroLines);
      assert.ok(byYear[YEARS[i]].stats.greenPct >= byYear[YEARS[i - 1]].stats.greenPct);
    }
    const newIn2050 = byYear[2050].layers.metroLines.features.filter((f) => f.properties.isNew);
    assert.ok(newIn2050.length > 0);
    assert.ok(newIn2050.every((f) => f.properties.year > 2030 && f.properties.year <= 2050));
  });

  it('keeps hub scores within 0-100 and ties transit scores to the metro lines that reach the hub', async () => {
    const early = (await get('/scenario?year=2026')).body.layers.hubs.features.map((f) => f.properties);
    const late = (await get('/scenario?year=2050')).body.layers.hubs.features.map((f) => f.properties);
    for (const h of [...early, ...late]) {
      for (const v of Object.values(h.scores)) assert.ok(v >= 0 && v <= 100, `${h.slug} score ${v}`);
    }
    const before = early.find((h) => h.slug === 'dong-anh');
    const after = late.find((h) => h.slug === 'dong-anh');
    assert.ok(after.facts.metroLines > before.facts.metroLines);
    assert.ok(after.scores.tod > before.scores.tod);
    assert.ok(after.scores.development > before.scores.development);
    assert.deepEqual(after.scores, { development: 88, tod: 85, green: 70, connectivity: 82 });
  });

  it('rejects an unknown year', async () => {
    for (const bad of ['2027', 'abc', '']) {
      const { status, body } = await get(`/scenario?year=${bad}`);
      assert.equal(status, 400, bad);
      assert.equal(body.statusCode, 400);
    }
    assert.equal((await get('/scenario?year=2050&year=2100')).status, 400);
  });

  it('returns hub details with scores across the years and handles hubs that do not exist yet', async () => {
    const ok = await get('/hubs/dong-anh?year=2050');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.presentInYear, true);
    assert.equal(ok.body.facts.airportConnection, true);
    assert.deepEqual(ok.body.byYear.map((y) => y.year), YEARS);

    const future = await get('/hubs/soc-son?year=2026');
    assert.equal(future.status, 200);
    assert.equal(future.body.presentInYear, false);
    assert.equal(future.body.firstYear, 2050);
    assert.equal(future.body.scores, undefined);

    assert.equal((await get('/hubs/khong-co?year=2050')).status, 404);
    assert.equal((await get('/hubs/Bad_Slug!')).status, 400);
  });

  it('compares 2-3 years and validates the input', async () => {
    const { status, body } = await get('/compare?years=2030,2050,2100');
    assert.equal(status, 200);
    assert.deepEqual(body.years.map((y) => y.year), [2030, 2050, 2100]);
    assert.equal(body.from, 2030);
    assert.equal(body.to, 2100);
    assert.equal(body.delta.metroKm, body.years[2].stats.metroKm - body.years[0].stats.metroKm);
    assert.equal((await get('/compare?years=2050,2030')).body.from, 2030);
    assert.equal((await get('/compare?years=2050')).status, 400);
    assert.equal((await get('/compare?years=2050,2050')).status, 400);
    assert.equal((await get('/compare?years=2026,2030,2050,2100')).status, 400);
    assert.equal((await get('/compare?years=2026,1999')).status, 400);
    assert.equal((await get('/compare')).status, 400);
  });

  it('answers the preset questions from the data', async () => {
    const list = await get('/questions');
    assert.equal(list.status, 200);
    assert.ok(list.body.questions.length >= 5);
    for (const q of list.body.questions) {
      const { status, body } = await post('/ask', { question: q.id, year: 2050 });
      assert.equal(status, 200, q.id);
      assert.equal(body.source, 'rules');
      assert.equal(body.scenario, true);
      assert.ok(body.answer.length > 20, q.id);
    }
    const tod = (await post('/ask', { question: 'top-tod', year: 2050 })).body;
    assert.deepEqual(tod.highlights, ['dong-anh', 'ha-dong', 'hoa-lac']);
    const early = (await post('/ask', { question: 'fastest-growth', year: 2026 })).body;
    assert.match(early.answer, /mốc hiện tại/);
  });

  it('validates the ask payload', async () => {
    assert.equal((await post('/ask', { question: 'hack the planet' })).status, 400);
    assert.equal((await post('/ask', { question: 'top-tod', year: 2027 })).status, 400);
    assert.equal((await post('/ask', { question: 'top-tod', extra: 1 })).status, 400);
    assert.equal((await post('/ask', '{oops')).status, 400);
    assert.equal((await post('/ask', {})).status, 400);
  });

  it('returns the shared JSON error format for unknown paths and sets security headers', async () => {
    const res = await fetch(`${base}${FM}/nowhere`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.statusCode, 404);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });
});
