'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { CRITERIA, CRITERION_KEYS } = require('../../src/living-score/scoring/criteria');
const { ScoringService } = require('../../src/living-score/scoring/scoring.service');

const scores = {
  transportation: 88,
  education: 90,
  healthcare: 72,
  greenSpace: 55,
  amenities: 92,
};

describe('ScoringService', () => {
  const service = new ScoringService();

  it('uses default weights that sum to 100', () => {
    const total = CRITERION_KEYS.reduce((sum, key) => sum + service.getDefaultWeights()[key], 0);
    assert.equal(total, 100);
    assert.equal(CRITERIA.length, 5);
  });

  it('computes the weighted Living Score with default weights', () => {
    // 88*.25 + 90*.20 + 72*.15 + 55*.15 + 92*.25 = 82.05
    const result = service.compute(scores, service.getDefaultWeights());
    assert.equal(result.score, 82.1);
    assert.equal(result.band, 'excellent');
    const total = result.breakdown.reduce((sum, b) => sum + b.weightPct, 0);
    assert.ok(Math.abs(total - 100) < 0.5);
  });

  it('normalises arbitrary weights so only ratios matter', () => {
    const doubled = Object.fromEntries(CRITERION_KEYS.map((k) => [k, service.getDefaultWeights()[k] * 2]));
    assert.equal(service.compute(scores, service.resolveWeights(doubled)).score, 82.1);
    const heavyTransport = service.compute(scores, service.resolveWeights({ transportation: 100 }));
    assert.ok(heavyTransport.score > 82.1);
  });

  it('personalised weights change the score in the expected direction', () => {
    const greenFirst = service.compute(scores, service.resolveWeights({ greenSpace: 100, transportation: 0, amenities: 0 }));
    assert.ok(greenFirst.score < 82.1);
  });

  it('rejects unusable weights with a 400', () => {
    const zero = Object.fromEntries(CRITERION_KEYS.map((k) => [k, 0]));
    const is400 = (e) => e.status === 400;
    assert.throws(() => service.resolveWeights(zero), is400);
    assert.throws(() => service.resolveWeights({ healthcare: -1 }), is400);
    assert.throws(() => service.resolveWeights({ healthcare: Number.NaN }), is400);
  });

  it('assigns score bands at their boundaries', () => {
    assert.equal(service.bandFor(75), 'excellent');
    assert.equal(service.bandFor(74.9), 'good');
    assert.equal(service.bandFor(65), 'good');
    assert.equal(service.bandFor(50), 'fair');
    assert.equal(service.bandFor(49.9), 'low');
  });

  it('gives identical cache keys for default and explicitly-default weights', () => {
    assert.equal(service.cacheKey(undefined), 'default');
    assert.equal(service.cacheKey(service.getDefaultWeights()), 'default');
    assert.notEqual(service.cacheKey({ healthcare: 50 }), 'default');
  });
});
