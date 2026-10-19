'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const M = require('../src/property-intel/model');
const analyst = require('../src/property-intel/analyst');

const PI = '/api/property-intel';

describe('AI Property Intelligence API', () => {
  let server;
  let living;
  let base;

  before(async () => {
    const created = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      propertyIntel: { config: { aiProvider: 'mock' } },
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

  it('labels every source with its kind, date and confidence, and never shows an unlabelled one as firm', () => {
    for (const id of M.SOURCE_IDS) {
      assert.ok(Object.hasOwn(M.QUALITY, id), `${id} has no quality label`);
      const q = M.qualityOf(id);
      assert.ok(['official', 'published', 'crowdsourced', 'computed', 'asking'].includes(q.kind), id);
      assert.ok(['high', 'medium', 'low'].includes(q.confidence), id);
      assert.ok(q.asOf === null || /^\d{4}-\d{2}(-\d{2})?$/.test(q.asOf), `${id}: ${q.asOf}`);
    }
    // asking prices are estimates, never "high"
    for (const id of M.SOURCE_IDS) if (M.qualityOf(id).kind === 'asking') assert.notEqual(M.qualityOf(id).confidence, 'high', id);
    assert.deepEqual(M.qualityOf('not-a-source'), { kind: 'published', confidence: 'low', asOf: null });
  });

  it('returns the label with every source of a ward, a project and an AI answer', async () => {
    const ward = (await get('/wards/phuong-bo-de')).body;
    const land = ward.sources.find((s) => s.id === 'landPrice');
    assert.deepEqual(land.quality, { kind: 'official', confidence: 'high', asOf: '2026-01-01' });
    assert.ok(ward.sources.every((s) => s.quality && s.quality.kind && s.quality.confidence));
    assert.equal(ward.sources.find((s) => s.id === 'osrm').quality.kind, 'computed');
    const project = (await get('/projects/vinhomes-metropolis')).body;
    const price = project.sources.find((s) => s.id === project.sourceId) ?? project.sources[0];
    assert.equal(price.quality.kind, 'asking');
    assert.equal(price.quality.confidence, 'low');
    const answer = (await ask({ question: 'Phường Bồ Đề có tiềm năng không?', ward: 'phuong-bo-de' })).body;
    assert.ok(answer.sources.length > 0 && answer.sources.every((s) => s.quality?.confidence));
  });

  it('serves an overview of the 79 wards with the latest market figure', async () => {
    const { status, body } = await get('/overview');
    assert.equal(status, 200);
    assert.match(body.note, /bảng giá Nhà nước/);
    assert.deepEqual(body.market, { quarter: 'Q2/2026', primary: 95 });
    assert.equal(body.stats.projects, 24);
    assert.deepEqual(body.horizons, [2026, 2030, 2045]);
    assert.equal(body.stats.wards, 79);
    assert.equal(body.stats.poles, 9);
    assert.equal(body.featured.slug, 'phuong-bo-de');
    assert.equal(body.featured.criteria.length, 3);
    const en = (await get('/overview?lang=en')).body;
    assert.match(en.note, /official table/);
    assert.match(en.defaultQuestion, /^Is Phường Bồ Đề/);
  });

  it('ranks the wards by potential score', async () => {
    const { status, body } = await get('/wards');
    assert.equal(status, 200);
    assert.equal(body.wards.length, 79);
    const scores = body.wards.map((w) => w.score);
    assert.deepEqual([...scores].sort((a, b) => b - a), scores);
    assert.deepEqual(body.wards.map((w) => w.rank), body.wards.map((_, i) => i + 1));
    // Each ward carries its criterion values (for re-weighting on the page), land median and driving times.
    const first = body.wards[0];
    assert.deepEqual(Object.keys(first.values), ['connectivity', 'infrastructure', 'planning', 'amenities', 'population', 'development']);
    assert.ok(first.landMedian > 0 && first.drive.centre >= 0);
    // Communes without a population figure are scored on the other criteria and flagged.
    const partial = body.wards.filter((w) => w.partial);
    assert.ok(partial.length > 0 && partial.every((w) => w.population === null));
  });

  it('explains a ward with real criteria, infrastructure and sources', async () => {
    const { status, body } = await get('/wards/phuong-bo-de');
    assert.equal(status, 200);
    assert.equal(body.name, 'Phường Bồ Đề');
    assert.deepEqual(body.criteria.map((c) => c.key), ['connectivity', 'infrastructure', 'planning', 'amenities', 'population', 'development']);
    assert.equal(body.criteria.reduce((s, c) => s + c.weight, 0).toFixed(2), '1.00');
    assert.ok(body.criteria.every((c) => c.value >= 0 && c.value <= 100 && c.detail));
    // The Trần Hưng Đạo bridge (OSM, due 2027) is within 4 km and cites its source.
    const bridge = body.infra.find((i) => i.id === 'bridge-tran-hung-dao');
    assert.ok(bridge && bridge.openYear === 2027 && bridge.distanceKm < 4);
    assert.ok(bridge.sources.some((s) => s.url?.includes('nhandan.vn')));
    assert.ok(body.poles.some((p) => p.inside));
    assert.equal(body.links.opportunity, 'phuong-bo-de');
    // Official land price of the ward (2026 table), placed with its own streets.
    assert.equal(body.landPrice.zone, 6);
    assert.equal(body.landPrice.zoneOnly, false);
    assert.ok(body.landPrice.streets >= 10 && body.landPrice.medianVT1 > 50 && body.landPrice.medianVT1 < 150);
    assert.ok(body.landPrice.top.every((s, i, a) => i === 0 || a[i - 1].vt1 >= s.vt1));
    // City market from CBRE, each quarter with its source.
    assert.deepEqual(body.market.quarters.map((q) => q.primary), [78, 84, 95]);
    assert.ok(body.market.quarters.every((q) => q.source.url.startsWith('https://')));
    assert.ok(body.sources.some((s) => s.id === 'landPrice'));
    assert.ok(body.sources.some((s) => s.id === 'population'));
    assert.ok(!body.sources.some((s) => s.id === 'sample'));
  });

  it('gives driving times (OSRM, free-flow) from the ward and from each project', async () => {
    const { body } = await get('/wards/phuong-bo-de');
    assert.deepEqual(body.travel.items.map((t) => t.id), ['centre', 'offices', 'airport']);
    assert.ok(body.travel.items.every((t) => t.minutes > 0 && t.minutes < 90));
    assert.ok(body.travel.metro.minutes > 0 && body.travel.metro.station);
    assert.match(body.travel.note, /chưa tính kẹt xe/);
    assert.ok(body.sources.some((s) => s.id === 'osrm'));
    const project = (await get('/projects/vinhomes-skylake')).body;
    assert.ok(project.travel.items[1].minutes <= 10); // next to the Cầu Giấy – Duy Tân office cluster
  });

  it('keeps social housing apart from the commercial market average', async () => {
    const { body } = await get('/projects/noxh-kim-hoa-ct2');
    assert.equal(body.price.kind, 'social');
    assert.equal(body.vsMarket, null);
    assert.ok(body.sources.some((s) => s.url?.includes('cafef.vn')));
    const located = (await get('/projects/lumiere-essence-peak')).body;
    assert.ok(located.sources.some((s) => s.id === 'savillsProjects2026'));
  });

  it('serves ward text in English', async () => {
    const { body } = await get('/wards/phuong-ha-dong?lang=en');
    assert.equal(body.criteria[0].label, 'Metro & bus access');
    assert.match(body.criteria[0].detail, /^Nearest station in service: Hà Đông \(line 2A\)/);
  });

  it('returns 404 for an unknown ward and 400 for a bad language', async () => {
    assert.equal((await get('/wards/khong-co')).status, 404);
    assert.equal((await get('/wards/phuong-bo-de?lang=fr')).status, 400);
  });

  it('shows a real project with its published price, ward and surroundings', async () => {
    const { status, body } = await get('/projects/vinhomes-skylake');
    assert.equal(status, 200);
    assert.equal(body.ward.slug, 'phuong-cau-giay');
    assert.deepEqual([body.price.min, body.price.max, body.price.kind], [140, 178, 'listing']);
    assert.deepEqual(body.unit, { m2: 70, min: 9.8, max: 12.46 });
    assert.deepEqual(body.vsMarket, { pct: 67, market: 95, quarter: 'Q2/2026' });
    assert.equal(body.landPrice.zone, 3);
    assert.equal(body.station.line, '3');
    assert.ok(body.sources.some((s) => s.url?.includes('vietnamnet.vn')));
    assert.deepEqual(body.proximity.map((r) => r.key).slice(0, 2), ['metro', 'tod']);
    // Points of interest come from OpenStreetMap: real names, real coordinates.
    const osmNames = new Set(M.POIS.map((p) => p.name).concat(M.PARKS.map((p) => p.name)));
    assert.ok(body.pois.length >= 3 && body.pois.every((p) => osmNames.has(p.name) || /Trường|Cơ sở|Công viên|Siêu thị/.test(p.name)));
    // A project the article places only by its ward sits at the ward's centre, flagged.
    const approx = (await get('/projects/ct14-mandala')).body;
    assert.equal(approx.approx, true);
    assert.equal(approx.ward.slug, 'phuong-yen-so');
  });

  it('builds map layers per horizon: today the bridges are being built, by 2030 they are open', async () => {
    const now = (await get('/map?horizon=2026')).body;
    const later = (await get('/map?horizon=2030&lang=en')).body;
    assert.equal(now.layers.wards.features.length, 79);
    const bridge = (l) => l.layers.infrastructure.features.find((f) => f.properties.id === 'bridge-tu-lien');
    assert.equal(bridge(now).properties.status, 'building');
    assert.equal(bridge(later).properties.status, 'open');
    assert.equal(bridge(later).properties.name, 'Tứ Liên Bridge');
    const underground = (l) => l.layers.metro.features.find((f) => f.properties.name.includes('Ga Hà Nội') || f.properties.name.includes('Hanoi Station'));
    assert.equal(underground(now).properties.status, 'building');
    assert.equal(underground(later).properties.status, 'operating');
    assert.ok(now.layers.planning.features.some((f) => f.properties.kind === 'development'));
    assert.equal((await get('/map?horizon=2040')).status, 400);
  });

  it('serves schools and health facilities apart from the main layers', async () => {
    const main = (await get('/map?horizon=2026')).body;
    assert.equal(main.layers.social, undefined);
    const social = (await get('/map/social?lang=en')).body;
    assert.ok(social.features.length > 1000);
    assert.ok(social.features.every((f) => ['school', 'hospital'].includes(f.properties.kind)));
  });

  it('searches wards (whole words first) and projects', async () => {
    const { body } = await get('/search?q=gia');
    assert.equal(body.results[0].name, 'Xã Gia Lâm');
    const project = (await get('/search?q=skylake')).body.results[0];
    assert.equal(project.type, 'project');
    assert.match(project.detail, /140–178 tr\/m²/);
    assert.equal((await get('/search?q=')).body.results.length, 0);
  });

  it('answers about a ward from the real data (template analyst)', async () => {
    const { status, body } = await ask({ question: 'Phường Bồ Đề có đáng mua không?' });
    assert.equal(status, 200);
    assert.equal(body.provider, 'template');
    assert.equal(body.intent, 'analyze');
    assert.equal(body.ward.slug, 'phuong-bo-de');
    assert.match(body.summary, /điểm tiềm năng \d+\/100/);
    assert.ok(body.sources.length > 0);
  });

  it('compares the wards named in the question', async () => {
    const { body } = await ask({ question: 'So sánh Cầu Giấy và Long Biên' });
    assert.equal(body.intent, 'compare');
    assert.deepEqual(body.table.rows.map((r) => r[0]), ['Cầu Giấy', 'Long Biên']);
    assert.equal(body.table.highlight, 0);
  });

  it('answers price questions with the land price table and the published market, in Vietnamese decimals', async () => {
    const { body } = await ask({ question: 'Giá nhà ở Cầu Giấy thế nào?' });
    assert.equal(body.intent, 'price');
    assert.match(body.summary, /bảng giá Nhà nước 2026 có trung vị \d+,\d triệu\/m²/);
    assert.ok(body.rows.some((r) => /CBRE: giá sơ cấp trung bình khoảng 95 triệu/.test(r.text)));
    assert.ok(body.rows.some((r) => /Vinhomes Skylake 140–178/.test(r.text)));
    assert.deepEqual(body.sources.map((s) => s.id).slice(0, 2), ['landPrice', 'cbreQ2_2026']);
    assert.equal((await ask({ question: 'How much is land in Hoàn Kiếm?', lang: 'en' })).body.intent, 'price');
  });

  it('answers about a project in English', async () => {
    const { body } = await ask({ question: 'Tell me about this project', intent: 'project', project: 'handico-complex', lang: 'en' });
    assert.equal(body.intent, 'project');
    assert.equal(body.project.slug, 'handico-complex');
    assert.match(body.summary, /110–120 million VND\/m² \(primary asking price\)/);
    assert.ok(body.sources.some((s) => s.id === 'launches2026'));
  });

  it('validates the ask payload', async () => {
    assert.equal((await ask({ question: '?' })).status, 400);
    assert.equal((await ask({ question: 'Hello there', ward: 'Bad Slug' })).status, 400);
    assert.equal((await ask({ question: 'Hello there', ward: 'khong-co' })).status, 404);
    assert.equal((await ask('{bad json')).status, 400);
  });
});

describe('Property AI grounding', () => {
  it('keeps only real ward and project ids from the model and attaches tables itself', async () => {
    const fake = {
      name: 'anthropic',
      model: 'test-model',
      answer: async () => ({
        outlook: { label: 'Tốt', tone: 'good' },
        summary: 'Cầu Giấy mạnh về metro (điểm 3.5).',
        rows: [{ label: 'Metro', tone: 'mobility', text: 'Gần ga Chùa Hà' }],
        callout: { title: 'Gợi ý', text: 'Xem thêm' },
        wardSlugs: ['phuong-cau-giay', 'phuong-khong-co'],
        projectSlugs: ['fake-project'],
        sourceIds: ['osmAmenities', 'made-up'],
        outOfScope: false,
      }),
    };
    const res = await analyst.ask({ primary: fake, fallback: new analyst.TemplateAnalyst() }, { question: 'So sánh Cầu Giấy và Láng', lang: 'vi' });
    assert.equal(res.provider, 'anthropic');
    assert.deepEqual(res.wards.map((w) => w.slug), ['phuong-cau-giay']);
    assert.deepEqual(res.projects, []);
    assert.deepEqual(res.sources.map((s) => s.id), ['osmAmenities']);
    assert.equal(res.summary, 'Cầu Giấy mạnh về metro (điểm 3,5).');
    assert.deepEqual(res.table.rows.map((r) => r[0]), ['Cầu Giấy', 'Láng']);
  });

  it('falls back to the template analyst when the model fails', async () => {
    const broken = { name: 'anthropic', model: 'x', answer: async () => null };
    const res = await analyst.ask({ primary: broken, fallback: new analyst.TemplateAnalyst() }, { question: 'Hà Đông thế nào?', lang: 'vi' });
    assert.equal(res.provider, 'template');
    assert.equal(res.ward.slug, 'phuong-ha-dong');
  });
});
