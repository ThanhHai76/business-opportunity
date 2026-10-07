'use strict';
/**
 * Boots the whole Express app (in-memory Living Score data, no Redis, no LLM) and exercises both the
 * Hanoi Living Score API over real HTTP (the Business Opportunity Map has its own test file).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');

const LS = '/api/living-score';

describe('Opportunity Map backend', () => {
  let server;
  let living;
  let base;
  let fakeNarrative;

  before(async () => {
    fakeNarrative = { enabled: false, model: null, generate: async () => null };
    const created = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }), narrative: fakeNarrative, rateLimits: { global: 10_000, recommendations: 10_000 } },
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
    const res = await fetch(`${base}${path}`);
    return { status: res.status, body: await res.json() };
  };
  const post = async (path, payload) => {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json() };
  };

  describe('Server', () => {
    it('answers unknown routes with JSON, and no longer serves the old city-based endpoints', async () => {
      assert.deepEqual((await get('/api/nowhere')).body, { detail: 'Not found' });
      assert.equal((await get('/api/cities')).status, 404);
      assert.equal((await get('/api/areas?city=hcm')).status, 404);
    });
  });

  describe('Hanoi Living Score', () => {
    it('reports health and where the data comes from', async () => {
      const { status, body } = await get(`${LS}/health`);
      assert.equal(status, 200);
      assert.equal(body.status, 'ok');
      assert.equal(body.data.source, 'OpenStreetMap contributors');
      assert.match(body.data.osmDate, /^\d{4}-\d{2}-\d{2}T/);
      assert.deepEqual(body.dataSource, { kind: 'memory', reachable: true });
    });

    it('sets security headers on Living Score responses', async () => {
      const res = await fetch(`${base}${LS}/health`);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    });

    it('serves criteria metadata from the scoring engine', async () => {
      const { body } = await get(`${LS}/scoring/criteria`);
      assert.equal(body.criteria.length, 5);
      assert.equal(body.criteria.reduce((s, c) => s + c.defaultWeight, 0), 100);
      assert.deepEqual(body.missing.map((c) => c.key), ['safety', 'environment', 'cost']);
      assert.equal(body.data.license, 'ODbL 1.0');
    });

    it('lists areas sorted by Living Score and searches without accents', async () => {
      const all = await get(`${LS}/areas`);
      assert.equal(all.body.data.length, 13);
      const scores = all.body.data.map((a) => a.livingScore);
      assert.deepEqual([...scores].sort((a, b) => b - a), scores);
      assert.equal(all.body.meta.data.walkKm, 1.5);
      assert.equal(all.body.data[0].avgRentVnd, undefined);
      assert.equal((await get(`${LS}/areas?sort=rent`)).status, 400);

      const found = await get(`${LS}/areas?q=cau%20giay`);
      assert.deepEqual(found.body.data.map((a) => a.slug), ['cau-giay']);
      // New (2025) ward names find the areas they are in.
      const ward = await get(`${LS}/areas?q=phuong%20nghia%20do`);
      assert.ok(ward.body.data.some((a) => a.slug === 'cau-giay'));
      assert.ok(all.body.data[0].facts.wards.length > 0);
    });

    it('answers in English with ?lang=en and rejects unknown languages', async () => {
      const vi = await get(`${LS}/areas/cau-giay`);
      const en = await get(`${LS}/areas/cau-giay?lang=en`);
      assert.match(vi.body.description, /Khu vực quanh trung tâm quận Cầu Giấy cũ/);
      assert.match(en.body.description, /former Cau Giay district/);
      assert.match(en.body.metrics[0].text, /within 1\.5 km/);
      assert.match(en.body.dataInfo.method, /OpenStreetMap/);
      assert.equal(en.body.missingCriteria[0].reason, 'No open data on safety per area yet.');
      assert.equal(en.body.livingScore, vi.body.livingScore);
      assert.equal((await get(`${LS}/areas?lang=fr`)).status, 400);
    });

    it('lists the places of the same 1.5 km circle as the scores', async () => {
      const { body } = await get(`${LS}/areas/tay-ho`);
      const names = body.amenities.flatMap((g) => g.top.map((p) => p.name));
      assert.equal(new Set(names).size, names.length);
      assert.ok(body.amenities.every((g) => g.count >= g.top.length));
    });

    it('personalises scores through the weights parameter', async () => {
      const def = await get(`${LS}/areas/cau-giay`);
      const amenitiesFirst = await get(`${LS}/areas/cau-giay?weights=amenities:100,transportation:0,greenSpace:0,education:0`);
      assert.equal(def.body.isPersonalized, false);
      assert.equal(amenitiesFirst.body.isPersonalized, true);
      assert.ok(amenitiesFirst.body.livingScore < def.body.livingScore);
      assert.equal(amenitiesFirst.body.defaultLivingScore, def.body.livingScore);
    });

    it('rejects bad weights, unknown areas and bad slugs with consistent errors', async () => {
      const badKey = await get(`${LS}/areas?weights=nonsense:5`);
      assert.equal(badKey.status, 400);
      assert.equal(badKey.body.statusCode, 400);
      assert.equal(badKey.body.error, 'Bad Request');
      assert.equal(badKey.body.path, `${LS}/areas?weights=nonsense:5`);
      assert.equal((await get(`${LS}/areas?weights=education:500`)).status, 400);
      // Criteria without data are not accepted as weights.
      assert.equal((await get(`${LS}/areas?weights=safety:5`)).status, 400);
      assert.equal((await get(`${LS}/areas/khong-ton-tai`)).status, 404);
      assert.equal((await get(`${LS}/areas/Bad_Slug!`)).status, 400);
      const allZero = 'transportation:0,education:0,healthcare:0,greenSpace:0,amenities:0';
      assert.equal((await get(`${LS}/areas?weights=${allZero}`)).status, 400);
      assert.equal((await get(`${LS}/areas?q=a&q=b`)).status, 400);
      const unknown = await get(`${LS}/nowhere`);
      assert.equal(unknown.status, 404);
      assert.equal(unknown.body.statusCode, 404);
    });

    it('returns GeoJSON polygons for the map, optionally by criterion', async () => {
      const { body } = await get(`${LS}/areas/geojson?criterion=transportation`);
      assert.equal(body.type, 'FeatureCollection');
      assert.equal(body.features.length, 13);
      const feature = body.features.find((x) => x.properties.slug === 'hoan-kiem');
      assert.equal(feature.geometry.type, 'Polygon');
      assert.equal(feature.properties.value, 60);
      assert.equal(body.meta.visual, 'transportation');
      assert.equal((await get(`${LS}/areas/geojson?criterion=nope`)).status, 400);
    });

    it('compares two or three areas and validates the count', async () => {
      const ok = await get(`${LS}/compare?slugs=cau-giay,tay-ho,dong-anh`);
      assert.equal(ok.status, 200);
      assert.equal(ok.body.areas.length, 3);
      assert.equal(ok.body.criteria.length, 5);
      const green = ok.body.criteria.find((c) => c.criterion === 'greenSpace');
      assert.deepEqual(green.best, ['tay-ho']);
      assert.equal((await get(`${LS}/compare?slugs=cau-giay`)).status, 400);
      assert.equal((await get(`${LS}/compare?slugs=a,b,c,d`)).status, 400);
      assert.equal((await get(`${LS}/compare?slugs=cau-giay,nowhere`)).status, 404);
    });

    it('filters amenities by type, area and viewport', async () => {
      const schools = await get(`${LS}/amenities?types=school`);
      assert.ok(schools.body.features.length > 0);
      assert.ok(schools.body.features.every((f) => f.properties.type === 'school'));
      const inArea = await get(`${LS}/amenities?area=tay-ho`);
      assert.ok(inArea.body.features.every((f) => f.properties.areaSlug === 'tay-ho'));
      const box = await get(`${LS}/amenities?bbox=105.7,20.9,105.75,21.2`);
      assert.ok(box.body.features.every((f) => f.geometry.coordinates[0] <= 105.75));
      assert.equal((await get(`${LS}/amenities?types=casino`)).status, 400);
      assert.equal((await get(`${LS}/amenities?bbox=1,2,3`)).status, 400);
      assert.equal((await get(`${LS}/amenities?area=Bad_Slug`)).status, 400);
    });

    it('returns metro lines and stations with their status', async () => {
      const { body } = await get(`${LS}/infrastructure`);
      const statuses = new Set(body.features.map((f) => f.properties.status));
      assert.deepEqual(statuses, new Set(['operating', 'under_construction', 'planned']));
      // Lines in service come from OpenStreetMap; only planned lines are approximate.
      const operating = body.features.filter((f) => f.properties.status === 'operating' && f.properties.kind === 'metro_line');
      assert.ok(operating.length >= 2 && operating.every((f) => f.properties.source === 'osm'));
      assert.match(body.meta.source, /OpenStreetMap/);
    });

    it('searches areas and places', async () => {
      const { body } = await get(`${LS}/search?q=T%C3%A2y%20H%E1%BB%93`);
      assert.equal(body.areas[0].slug, 'tay-ho');
      const places = await get(`${LS}/search?q=cong%20vien`);
      assert.ok(places.body.places.length > 0);
      assert.equal((await get(`${LS}/search`)).status, 400);
    });

    const request = {
      household: 'single',
      workplaceAreaSlug: 'cau-giay',
      interests: ['cafes', 'metro_access'],
      priorities: { transportation: 5, amenities: 5, education: 1, greenSpace: 3 },
    };

    it('uses road travel times to the workplace when the OSRM table has them', async () => {
      const { body } = await post(`${LS}/recommendations`, { household: 'couple', workplaceAreaSlug: 'dong-anh', useAi: false });
      const commute = body.results[0].commute;
      assert.equal(commute.mode, 'road');
      assert.ok(commute.minutes > 0);
      assert.ok(body.sources.some((s) => /OSRM/.test(s.title)));
      const en = await post(`${LS}/recommendations`, { household: 'couple', workplaceAreaSlug: 'dong-anh', useAi: false, lang: 'en' });
      assert.match(en.body.results[0].reasons.join(' '), /min by road|Match/);
      assert.equal((await post(`${LS}/recommendations`, { household: 'couple', lang: 'fr' })).status, 400);
    });

    it('recommends three areas with rule-based explanations when no AI key is set', async () => {
      const { status, body } = await post(`${LS}/recommendations`, request);
      assert.equal(status, 200);
      assert.equal(body.mode, 'rules');
      assert.match(body.notice, /ANTHROPIC_API_KEY/);
      assert.equal(body.results.length, 3);
      assert.equal(body.results[0].rank, 1);
      assert.ok(body.results[0].matchScore >= body.results[1].matchScore);
      assert.ok(body.results[0].reasons.length > 1);
      assert.equal(body.results[0].budget, undefined);
      assert.equal(body.results[0].metrics.length, 5);
      assert.equal(body.sources[0].license, 'ODbL 1.0');
      assert.match(body.sources[0].title, /OpenStreetMap/);
    });

    it('validates recommendation input', async () => {
      const ok = { household: 'single' };
      assert.equal((await post(`${LS}/recommendations`, { ...ok, budgetVnd: 7_000_000 })).status, 400);
      assert.equal((await post(`${LS}/recommendations`, { ...ok, household: 'alien' })).status, 400);
      assert.equal((await post(`${LS}/recommendations`, { ...ok, extra: true })).status, 400);
      assert.equal((await post(`${LS}/recommendations`, { ...ok, workplaceAreaSlug: 'nowhere' })).status, 400);
      assert.equal((await post(`${LS}/recommendations`, { ...ok, priorities: { safety: 9 } })).status, 400);
      assert.equal((await post(`${LS}/recommendations`, { ...ok, interests: ['cafes', 'cafes'] })).status, 400);
      const broken = await post(`${LS}/recommendations`, '{not json');
      assert.equal(broken.status, 400);
      assert.equal(broken.body.statusCode, 400);
    });

    it('uses AI wording when the narrative client returns valid text, but never changes the ranking', async () => {
      const input = { ...request, household: 'couple' };
      const baseline = await post(`${LS}/recommendations`, { ...input, useAi: false });
      const original = { enabled: fakeNarrative.enabled, model: fakeNarrative.model, generate: fakeNarrative.generate };
      let seen = [];
      Object.assign(fakeNarrative, {
        enabled: true,
        model: 'fake-model',
        generate: async (context, areas) => {
          seen = areas;
          return areas.map((a) => ({
            slug: a.slug,
            summary: `Tóm tắt AI cho ${a.name}.`,
            reasons: ['Lý do một.', 'Lý do hai.', 'Lý do ba.'],
            pros: ['Ưu điểm.'],
            cons: ['Nhược điểm.'],
          }));
        },
      });
      try {
        // Results are cached per input, so this household is unique to keep the earlier rules-mode answers out.
        const ai = await post(`${LS}/recommendations`, { ...input, useAi: true });
        assert.equal(ai.status, 200);
        assert.equal(ai.body.mode, 'ai');
        assert.equal(ai.body.model, 'fake-model');
        assert.match(ai.body.results[0].summary, /^Tóm tắt AI/);
        assert.deepEqual(
          ai.body.results.map((r) => r.area.slug),
          baseline.body.results.map((r) => r.area.slug),
        );
        // The model is grounded in the OpenStreetMap measurements, and never sees (non-existent) rent data.
        assert.match(seen[0].measurements['Giao thông'], /bán kính 1,5 km/);
        assert.ok(Array.isArray(seen[0].facts.metroStations));
        assert.equal(seen[0].monthlyRentVnd, undefined);
        assert.equal(ai.body.sources[0].license, 'ODbL 1.0');
      } finally {
        Object.assign(fakeNarrative, original);
      }
    });

    it('falls back to rules with a notice when the AI returns nothing', async () => {
      const original = { enabled: fakeNarrative.enabled, model: fakeNarrative.model };
      Object.assign(fakeNarrative, { enabled: true, model: 'fake-model' });
      try {
        const { body } = await post(`${LS}/recommendations`, { ...request, household: 'family_with_kids' });
        assert.equal(body.mode, 'rules');
        assert.match(body.notice, /AI tạm thời/);
      } finally {
        Object.assign(fakeNarrative, original);
      }
    });
  });
});
