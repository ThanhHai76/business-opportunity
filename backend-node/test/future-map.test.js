'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const D = require('../src/future-map/data');
const { MockAnswerer } = require('../src/future-map/ai');
const R = require('../src/future-map/region');

const FM = '/api/future-map';
const YEARS = [2026, 2035, 2045, 2065];

describe('Hanoi Future Map data', () => {
  it('cites a known source for every map object and every figure', () => {
    const ids = new Set(Object.keys(D.SOURCES));
    const cited = [
      ...D.HUBS, ...D.METRO_LINES, ...D.EXPRESSWAYS, ...D.RING_ROADS, ...D.GREEN_AREAS, ...D.AIRPORTS, ...D.AXES,
    ];
    for (const item of cited) {
      assert.ok(item.sources?.length, `no sources: ${JSON.stringify(item.name)}`);
      for (const id of item.sources) assert.ok(ids.has(id), `unknown source ${id}`);
      assert.ok(['operating', 'construction', 'plan'].includes(item.status), `status of ${JSON.stringify(item.name)}`);
    }
    for (const y of D.YEARS) {
      for (const id of [...y.population.sources, ...y.railKm.sources]) assert.ok(ids.has(id), `${y.year}: unknown source ${id}`);
    }
    for (const s of Object.values(D.SOURCES)) assert.match(s.url, /^https:\/\//);
  });

  it('has the 9 poles and 9 axes of the 100-year plan, all bilingual', () => {
    assert.equal(D.HUBS.length, 9);
    assert.equal(D.AXES.length, 9);
    for (const item of [...D.HUBS, ...D.AXES, ...D.METRO_LINES, ...D.YEARS.map((y) => ({ name: y.headline }))]) {
      assert.ok(item.name.vi && item.name.en, JSON.stringify(item.name));
    }
  });
});

describe('Capital Region data', () => {
  it('cites a known source for every corridor, fact and piece of regional infrastructure', () => {
    const ids = new Set([...Object.keys(D.SOURCES), ...Object.keys(R.REGION_SOURCES)]);
    for (const c of R.CORRIDORS) {
      for (const id of c.sources) assert.ok(ids.has(id), `${c.slug}: unknown source ${id}`);
      for (const f of c.facts) assert.ok(f.sources.length && f.sources.every((id) => ids.has(id)), c.slug);
      assert.ok(c.label.vi && c.label.en && c.direction.vi && c.formerly.en, c.slug);
      for (const slug of c.poles) assert.ok(D.HUBS.some((h) => h.slug === slug), `${c.slug}: unknown pole ${slug}`);
      for (const id of c.via) assert.ok(R.INFRA.some((i) => i.id === id) || R.EXTERNAL_INFRA[id], `${c.slug}: unknown infrastructure ${id}`);
    }
    for (const i of R.INFRA) {
      assert.ok(i.sources.every((id) => ids.has(id)), i.id);
      assert.ok(['operating', 'construction', 'plan'].includes(i.status), i.id);
    }
    // Sources have a URL, except the TV report (no stable link), which is named instead.
    for (const [id, s] of Object.entries(R.REGION_SOURCES)) assert.ok(s.url === null ? id === 'vtv24Region' : /^https:\/\//.test(s.url), id);
  });

  it('covers the six neighbouring provinces named by the 100-year plan (after the 2025 merger)', () => {
    assert.deepEqual(R.CORRIDORS.map((c) => c.slug).sort(), ['bac-ninh', 'hai-phong', 'hung-yen', 'ninh-binh', 'phu-tho', 'thai-nguyen']);
  });
});

describe('Hanoi Future Map API', () => {
  let server;
  let living;
  let base;
  let fakeAnswer;

  before(async () => {
    const fake = { name: 'fake', model: 'fake-model', answer: async () => fakeAnswer };
    const created = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      futureMap: { answerers: { primary: fake, fallback: new MockAnswerer() }, rateLimits: { global: 10_000, ai: 10_000 } },
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

  it('lists the plan milestones with quoted figures', async () => {
    const { status, body } = await get('/timeline');
    assert.equal(status, 200);
    assert.deepEqual(body.years.map((y) => y.year), YEARS);
    assert.equal(body.years[0].kind, 'present');
    assert.deepEqual(body.years[1].stats.population, { min: 14, max: 15 });
    assert.equal(body.years[1].stats.railKm, 500);
    assert.equal(body.years[2].stats.railKm, 979);
    assert.match(body.note, /không thay thế bản vẽ quy hoạch chính thức/);
    assert.ok(body.sources.qd2512.url.startsWith('https://'));
  });

  it('returns every layer as valid GeoJSON inside the Hanoi area, in both languages', async () => {
    for (const lang of ['vi', 'en']) {
      const { status, body } = await get(`/scenario?year=2035&lang=${lang}`);
      assert.equal(status, 200);
      const expected = ['metroLines', 'metroStations', 'roads', 'green', 'water', 'airports', 'hubs', 'zones', 'tod', 'axes'];
      assert.deepEqual(Object.keys(body.layers).sort(), expected.sort());
      const check = (c) => assert.ok(c[0] > 105.0 && c[0] < 106.4 && c[1] > 20.5 && c[1] < 21.5, `outside Hanoi: ${c}`);
      const walk = (coords) => (typeof coords[0] === 'number' ? check(coords) : coords.forEach(walk));
      for (const [name, layer] of Object.entries(body.layers)) {
        assert.equal(layer.type, 'FeatureCollection', name);
        assert.ok(layer.features.length > 0, `${name} is empty`);
        layer.features.forEach((f) => walk(f.geometry.coordinates));
      }
      const hoaLac = body.layers.hubs.features.find((f) => f.properties.slug === 'hoa-lac').properties;
      assert.equal(hoaLac.name, lang === 'en' ? 'West pole: Hòa Lạc' : 'Cực phía Tây: Hòa Lạc');
    }
  });

  it('shows what exists today, what is being built and what is planned', async () => {
    const today = (await get('/scenario?year=2026')).body;
    const later = (await get('/scenario?year=2035')).body;
    const status = (layer, name) => layer.features.find((f) => f.properties.name.startsWith(name))?.properties.status;
    assert.equal(status(today.layers.metroLines, 'Tuyến 2A Cát Linh'), 'operating');
    assert.equal(status(today.layers.metroLines, 'Tuyến 3 Cầu Giấy'), 'construction');
    assert.equal(status(later.layers.metroLines, 'Tuyến 3 Cầu Giấy'), 'operating');
    assert.equal(status(today.layers.roads, 'Vành đai 4'), 'construction');
    assert.equal(status(later.layers.roads, 'Vành đai 4'), 'operating');
    assert.equal(status(later.layers.metroLines, 'Tuyến 5'), 'plan');
    assert.equal(today.layers.hubs.features.length, 1);
    assert.equal(later.layers.hubs.features.length, 9);
    assert.ok(!today.layers.airports.features.some((f) => f.properties.status === 'plan'));
  });

  it('rejects an unknown year or language', async () => {
    for (const bad of ['2030', '2050', 'abc', '']) assert.equal((await get(`/scenario?year=${bad}`)).status, 400, bad);
    assert.equal((await get('/scenario?year=2035&lang=fr')).status, 400);
  });

  it('returns a pole with its role, related lines and axes, and citations', async () => {
    const { status, body } = await get('/hubs/hoa-lac?year=2035&lang=vi');
    assert.equal(status, 200);
    assert.match(body.role, /khoa học công nghệ/);
    assert.ok(body.lines.some((l) => l.name.startsWith('Tuyến 5')));
    assert.ok(body.axes.some((a) => a.name.includes('Hồ Tây – Ba Vì')));
    assert.ok(body.sourceList.some((s) => s.id === 'qd2512Poles'));
    assert.equal((await get('/hubs/nowhere?year=2035')).status, 404);
  });

  it('compares milestones', async () => {
    const { status, body } = await get('/compare?years=2026,2035,2065');
    assert.equal(status, 200);
    assert.equal(body.delta.railKm, 979 - 21.6);
    assert.equal(body.delta.poles, 8);
    assert.equal((await get('/compare?years=2035')).status, 400);
  });

  it('answers the preset questions from the data, with sources', async () => {
    const poles = await post('/ask', { question: 'poles', year: 2035 });
    assert.equal(poles.status, 200);
    assert.equal(poles.body.highlights.length, 9);
    assert.ok(poles.body.sources.some((s) => s.id === 'qd2512Poles'));
    const rail = await post('/ask', { question: 'rail', year: 2045, lang: 'en' });
    assert.match(rail.body.answer, /979 km/);
    assert.equal((await post('/ask', { question: 'nope' })).status, 400);
  });

  it('answers free-text questions: mock fallback, topic and pole detection, out of scope', async () => {
    fakeAnswer = null;
    const pop = await post('/ask-ai', { question: 'Dân số Hà Nội năm 2045 là bao nhiêu?', year: 2045 });
    assert.equal(pop.body.provider, 'mock');
    assert.match(pop.body.answer, /15–16 triệu/);
    assert.ok(pop.body.sources.length > 0);
    const pole = await post('/ask-ai', { question: 'Hòa Lạc sẽ phát triển thế nào?', year: 2035 });
    assert.deepEqual(pole.body.highlights, ['hoa-lac']);
    const out = await post('/ask-ai', { question: 'Giá vàng hôm nay?', year: 2035, lang: 'en' });
    assert.equal(out.body.outOfScope, true);
  });

  it('draws the Capital Region: corridors, arrows, nodes and regional infrastructure, in both languages', async () => {
    const vi = await get('/region?year=2026');
    assert.equal(vi.status, 200);
    assert.equal(vi.body.corridors.length, 6);
    assert.equal(vi.body.layers.arrows.features.length, 6);
    assert.equal(vi.body.layers.arrowheads.features[0].geometry.type, 'Polygon');
    // Province areas (OSM outlines): Hanoi as the core plus the six provinces, tinted by their direction's theme.
    const provinces = vi.body.layers.provinces.features;
    assert.equal(provinces.length, 7);
    assert.equal(provinces.find((f) => f.properties.slug === 'ha-noi').properties.theme, 'core');
    assert.equal(provinces.find((f) => f.properties.slug === 'ninh-binh').properties.theme, 'health');
    assert.ok(provinces.every((f) => f.geometry.type === 'MultiPolygon'));
    const hp = vi.body.corridors.find((c) => c.slug === 'hai-phong');
    assert.match(hp.formerly, /Hải Dương/);
    assert.equal(hp.labelSource, 'vtv24Region');
    assert.ok(hp.travel.minutes > 30 && hp.travel.km > 80);
    // Gia Bình is being built today and counted as open by 2035; Ring Road 5 only appears as a plan.
    const giaBinh = (y) => y.layers.infraPoints.features.find((f) => f.properties.id === 'airport-gia-binh').properties.status;
    assert.equal(giaBinh(vi.body), 'construction');
    assert.equal(giaBinh((await get('/region?year=2035')).body), 'operating');
    assert.ok(!vi.body.layers.infraLines.features.some((f) => f.properties.id === 'ring5'));
    const en = await get('/region?year=2035&lang=en');
    assert.equal(en.body.corridors.find((c) => c.slug === 'ninh-binh').direction, 'South');
    assert.equal((await get('/region?year=2030')).status, 400);
  });

  it('returns a corridor with its facts, infrastructure status, linked poles and citations', async () => {
    const { status, body } = await get('/region/corridors/ninh-binh?year=2026');
    assert.equal(status, 200);
    assert.match(body.facts[0].text, /Bạch Mai/);
    assert.ok(body.infrastructure.some((i) => i.id === 'hsr' && i.status === 'plan'));
    assert.deepEqual(body.poles.map((p) => p.slug), ['thuong-tin-phu-xuyen', 'van-dinh-dai-nghia']);
    assert.ok(['bachMai2', 'vtv24Region', 'nq202', 'osrm'].every((id) => body.sourceList.some((s) => s.id === id)));
    assert.equal((await get('/region/corridors/nowhere')).status, 404);
  });

  it('links each pole to the regional corridors it faces', async () => {
    const { body } = await get('/hubs/dong?year=2035');
    assert.deepEqual(body.corridors.map((c) => c.slug), ['bac-ninh', 'hung-yen', 'hai-phong']);
  });

  it('answers regional questions from the data (presets and free text)', async () => {
    const commute = await post('/ask', { question: 'region-commute', year: 2026 });
    assert.match(commute.body.answer, /Bắc Ninh ~\d+ phút/);
    assert.ok(commute.body.sources.some((s) => s.id === 'osrm'));
    const logistics = await post('/ask', { question: 'region-logistics', year: 2035, lang: 'en' });
    assert.match(logistics.body.answer, /per VTV24/);
    assert.ok(!/Phú Thọ/.test(logistics.body.answer));
    fakeAnswer = null;
    const free = await post('/ask-ai', { question: 'Bắc Ninh sẽ phát triển thế nào?', year: 2035 });
    assert.match(free.body.answer, /Gia Bình/);
  });

  it('keeps only real source ids and pole slugs from the model', async () => {
    fakeAnswer = { answer: 'Theo quy hoạch…', sourceIds: ['qd2512', 'made-up'], poleSlugs: ['bac', 'nowhere'], outOfScope: false };
    const { body } = await post('/ask-ai', { question: 'Phía Bắc sẽ ra sao?', year: 2035 });
    assert.equal(body.provider, 'fake');
    assert.deepEqual(body.sources.map((s) => s.id), ['qd2512']);
    assert.deepEqual(body.highlights, ['bac']);
    assert.equal((await post('/ask-ai', { question: 'x' })).status, 400);
  });
});
