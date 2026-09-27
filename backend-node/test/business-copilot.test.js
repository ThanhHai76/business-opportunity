'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const { parsePrompt } = require('../src/business-copilot/nlp');
const { MockAIProvider } = require('../src/business-copilot/ai-provider');

const BC = '/api/business-copilot';

describe('Hanoi Business Copilot', () => {
  describe('prompt parser', () => {
    it('extracts budget, category and districts in English and Vietnamese', () => {
      assert.deepEqual(parsePrompt('I have 500M VND and want to open a coffee shop in Hanoi.'), { category: 'coffee-shop', budgetVnd: 500_000_000, districts: [], missing: [] });
      const vi = parsePrompt('Tôi có 1,2 tỷ, muốn mở nhà hàng ở Cầu Giấy');
      assert.equal(vi.category, 'restaurant');
      assert.equal(vi.budgetVnd, 1_200_000_000);
      assert.deepEqual(vi.districts, ['cau-giay']);
      assert.equal(parsePrompt('Mở cửa hàng tiện lợi với 800 triệu').category, 'convenience-store');
      assert.equal(parsePrompt('800,000,000 VND pharmacy').budgetVnd, 800_000_000);
      assert.deepEqual(parsePrompt('hello').missing, ['category', 'budget']);
    });
  });

  describe('API', () => {
    let server;
    let living;
    let base;
    let fakePrimary;

    before(async () => {
      fakePrimary = { name: 'fake', model: 'fake-model', explain: async () => null };
      const created = createApp({
        log: false,
        living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
        businessCopilot: { providers: { primary: fakePrimary, fallback: new MockAIProvider() }, rateLimits: { global: 10_000, ai: 10_000 } },
      });
      living = created.living;
      server = await new Promise((resolve) => {
        const s = created.app.listen(0, '127.0.0.1', () => resolve(s));
      });
      base = `http://127.0.0.1:${server.address().port}${BC}`;
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

    it('lists categories and ranks all 10 demo locations', async () => {
      const cats = await get('/categories');
      assert.equal(cats.body.categories.length, 6);
      assert.equal(cats.body.demo, true);
      const { body } = await get('/locations?category=coffee-shop&budget=500000000');
      assert.equal(body.locations.length, 10);
      const scores = body.locations.map((l) => l.businessScore);
      assert.deepEqual([...scores].sort((a, b) => b - a), scores);
      assert.equal(body.locations[0].slug, 'cau-giay');
      for (const l of body.locations) for (const v of Object.values(l.scores)) assert.ok(v >= 0 && v <= 100);
    });

    it('analyzes a free-text business idea into the top 10 with an AI summary', async () => {
      const { status, body } = await post('/analyze', { message: 'I have 500M VND. I want to open a coffee shop in Hanoi.' });
      assert.equal(status, 200);
      assert.equal(body.parsed.category, 'coffee-shop');
      assert.equal(body.parsed.budgetVnd, 500_000_000);
      assert.equal(body.recommendations.length, 10);
      assert.equal(body.recommendations[0].rank, 1);
      assert.match(body.insight.summary, /Cầu Giấy/);
      assert.equal(body.provider, 'mock'); // the fake primary returned null -> mock fallback
      assert.equal(body.heatmap.markers.length, 3);
      assert.equal((await post('/analyze', { message: 'hello there' })).status, 400);
      assert.equal((await post('/analyze', {})).status, 400);
      assert.equal((await post('/analyze', { category: 'casino' })).status, 400);
    });

    it('budget changes the result and over-budget areas are flagged', async () => {
      const low = (await get('/locations?category=gym&budget=300000000')).body.locations;
      const high = (await get('/locations?category=gym&budget=3000000000')).body.locations;
      assert.ok(low.every((l) => !l.withinBudget));
      assert.ok(high.some((l) => l.withinBudget));
      assert.ok(high[0].businessScore > low[0].businessScore);
      assert.equal((await get('/locations?budget=10')).status, 400);
    });

    it('returns location intelligence with a coherent money model', async () => {
      const { status, body } = await get('/locations/cau-giay?category=coffee-shop&budget=500000000');
      assert.equal(status, 200);
      const sum = body.monthlyCosts.items.reduce((a, i) => a + i.millions, 0);
      assert.ok(Math.abs(sum - body.monthlyCosts.totalMillions) < 1);
      assert.equal(body.revenueSeries.length, 18);
      assert.equal(body.targetCustomers.reduce((a, t) => a + t.pct, 0), 100);
      assert.equal(body.footTraffic.grid.length, 7);
      assert.ok(body.evidence.length >= 2);
      assert.ok(body.breakEvenMonth >= 1 && body.breakEvenMonth <= 18);
      assert.equal((await get('/locations/khong-co')).status, 404);
      assert.equal((await get('/locations/Bad_Slug!')).status, 400);
      const comp = await get('/locations/cau-giay/competitors?category=coffee-shop');
      assert.equal(comp.body.subtypes.reduce((a, s) => a + s.count, 0), comp.body.total);
      const score = await get('/locations/ha-dong/business-score');
      assert.ok(score.body.totalScore > 0);
    });

    it('compares 2-3 locations and validates input', async () => {
      const { status, body } = await post('/compare', { locations: ['cau-giay', 'ha-dong', 'tay-ho'] });
      assert.equal(status, 200);
      assert.equal(body.locations.length, 3);
      const rent = body.metrics.find((m) => m.key === 'rent');
      assert.deepEqual(rent.best, ['ha-dong']); // cheapest rent wins
      assert.equal((await post('/compare', { locations: ['cau-giay'] })).status, 400);
      assert.equal((await post('/compare', { locations: ['cau-giay', 'cau-giay'] })).status, 400);
      assert.equal((await post('/compare', { locations: ['cau-giay', 'nowhere'] })).status, 404);
    });

    it('simulates a business and respects the max-rent filter', async () => {
      const { status, body } = await post('/simulate', { category: 'coffee-shop', budgetVnd: 500_000_000, maxRentVnd: 40_000_000 });
      assert.equal(status, 200);
      assert.equal(body.simulated, true);
      assert.ok(body.results.every((r) => r.rentMillions <= 40));
      assert.ok(body.excluded.some((e) => e.slug === 'tay-ho'));
      assert.ok(['Low', 'Medium', 'High'].includes(body.summary.riskLevel));
      const only = await post('/simulate', { category: 'gym', budgetVnd: 2_000_000_000, districts: ['ha-dong'] });
      assert.deepEqual(only.body.results.map((r) => r.slug), ['ha-dong']);
      assert.equal((await post('/simulate', { category: 'gym' })).status, 400);
      assert.equal((await post('/simulate', { category: 'gym', budgetVnd: 1_000_000_000, districts: ['nowhere'] })).status, 404);
    });

    it('answers the copilot example questions with the structured format', async () => {
      const cases = [
        ['Where should I open a coffee shop with 500M?', 'recommend'],
        ['Which district has the lowest competition?', 'low-competition'],
        ['Compare Cầu Giấy vs Hà Đông', 'compare'],
        ['Find areas suitable for a premium restaurant', 'premium'],
        ['Ở Tây Hồ nên kinh doanh gì?', 'category-fit'],
        ['xin chào', 'help'],
      ];
      for (const [question, intent] of cases) {
        const { status, body } = await post('/ai/analyze', { question });
        assert.equal(status, 200, question);
        assert.equal(body.intent, intent, question);
        for (const k of ['summary', 'recommendation', 'evidence', 'risks', 'nextActions']) assert.ok(k in body.answer, `${question} -> ${k}`);
        assert.equal(body.demo, true);
      }
      assert.equal((await post('/ai/analyze', { question: '' })).status, 400);
      assert.equal((await post('/ai/analyze', { question: 'x'.repeat(700) })).status, 400);
    });

    it('uses the primary AI provider when it answers', async () => {
      const original = fakePrimary.explain;
      fakePrimary.explain = async () => ({ summary: 'AI viết', recommendation: 'r', evidence: [], risks: [], nextActions: [] });
      try {
        const { body } = await post('/ai/analyze', { question: 'Compare Tây Hồ vs Long Biên' });
        assert.equal(body.provider, 'fake');
        assert.equal(body.answer.summary, 'AI viết');
        assert.ok(body.scores.length === 2);
      } finally {
        fakePrimary.explain = original;
      }
    });

    it('builds a full business report', async () => {
      const { status, body } = await post('/report', { category: 'coffee-shop', budgetVnd: 500_000_000 });
      assert.equal(status, 200);
      assert.equal(body.recommendedLocation.slug, 'cau-giay');
      for (const k of ['executiveSummary', 'marketDemand', 'competition', 'estimatedCosts', 'customerProfile', 'locationAnalysis', 'growthPotential', 'risks', 'aiRecommendation']) {
        assert.ok(k in body.sections, k);
      }
      assert.equal((await post('/report', { location: 'Bad_Slug' })).status, 400);
    });

    it('serves map layers as GeoJSON inside Hanoi', async () => {
      const { body } = await get('/map/layers?category=pharmacy');
      const check = (c) => assert.ok(c[0] > 105.3 && c[0] < 106.3 && c[1] > 20.6 && c[1] < 21.5, `outside Hanoi: ${c}`);
      const walk = (c) => (typeof c[0] === 'number' ? check(c) : c.forEach(walk));
      for (const [name, layer] of Object.entries(body.layers)) {
        assert.equal(layer.type, 'FeatureCollection', name);
        assert.ok(layer.features.length > 0, name);
        layer.features.forEach((f) => walk(f.geometry.coordinates));
      }
    });

    it('uses the shared JSON error format', async () => {
      const res = await fetch(`${base}/nowhere`);
      assert.equal(res.status, 404);
      assert.equal((await res.json()).statusCode, 404);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal((await post('/compare', '{bad')).status, 400);
    });
  });
});
