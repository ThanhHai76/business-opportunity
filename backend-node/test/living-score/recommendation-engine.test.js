'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MemoryDataSource } = require('../../src/living-score/data/memory-data-source');
const { RecommendationEngine } = require('../../src/living-score/recommendation/recommendation-engine');
const { CRITERION_KEYS } = require('../../src/living-score/scoring/criteria');
const { ScoringService } = require('../../src/living-score/scoring/scoring.service');

describe('RecommendationEngine', () => {
  const scoring = new ScoringService();
  const engine = new RecommendationEngine(scoring);
  const data = new MemoryDataSource();
  const base = { household: 'single', interests: [], priorities: {}, useAi: false };

  it('normalises weights to 100 and honours priorities', () => {
    const neutral = engine.buildWeights(base);
    const total = CRITERION_KEYS.reduce((s, k) => s + neutral[k], 0);
    assert.ok(Math.abs(total - 100) < 1e-5);
    const healthFirst = engine.buildWeights({ ...base, priorities: { healthcare: 5 } });
    assert.ok(healthFirst.healthcare > neutral.healthcare);
    const noGreen = engine.buildWeights({ ...base, priorities: { greenSpace: 0 } });
    assert.equal(noGreen.greenSpace, 0);
  });

  it('boosts education and healthcare for families', () => {
    const single = engine.buildWeights(base);
    const family = engine.buildWeights({ ...base, household: 'family_with_kids' });
    assert.ok(family.education > single.education);
    assert.ok(family.healthcare > single.healthcare);
  });

  it('refuses a request that zeroes every priority', () => {
    const allZero = Object.fromEntries(CRITERION_KEYS.map((k) => [k, 0]));
    assert.throws(() => engine.buildWeights({ ...base, priorities: allZero }), (e) => e.status === 400);
  });

  it('ranks by the personalised score when there is no workplace', async () => {
    const areas = await data.listAreas();
    const input = { ...base, priorities: { greenSpace: 5, transportation: 0, education: 0, healthcare: 0, amenities: 0 } };
    const ranked = engine.rank(areas, input, engine.buildWeights(input), null);
    assert.equal(ranked[0].area.slug, 'tay-ho');
    for (const r of ranked) assert.equal(r.matchScore, r.personalizedScore);
  });

  it('computes commute distance and never returns scores outside 0-100', async () => {
    const areas = await data.listAreas();
    const workplace = areas.find((a) => a.slug === 'cau-giay');
    const ranked = engine.rank(areas, { ...base, workplaceAreaSlug: 'cau-giay' }, engine.buildWeights(base), workplace);
    const self = ranked.find((r) => r.area.slug === 'cau-giay');
    const far = ranked.find((r) => r.area.slug === 'dong-anh');
    assert.equal(self.commuteKm, 0);
    assert.ok(far.commuteKm > 8);
    assert.ok(far.commuteFactor < 1);
    for (const r of ranked) assert.ok(r.matchScore >= 0 && r.matchScore <= 100);
  });

  it('writes rule-based explanations grounded in the data', async () => {
    const areas = await data.listAreas();
    const input = { ...base, interests: ['metro_access'] };
    const [best] = engine.rank(areas, input, engine.buildWeights(input), null);
    const explanation = engine.explain(best, input, null);
    assert.ok(explanation.reasons.length >= 2);
    assert.ok(explanation.pros.length > 0);
    assert.ok(explanation.cons.length > 0);
    assert.match(explanation.reasons.join(' '), /\d+\/100/);
    // Interests are explained with the OpenStreetMap facts behind them.
    assert.match([...explanation.reasons, ...explanation.cons].join(' '), /ga metro/);
  });
});
