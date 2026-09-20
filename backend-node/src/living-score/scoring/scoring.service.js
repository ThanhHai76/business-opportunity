'use strict';
const { badRequest } = require('../common/http');
const { round1 } = require('../common/text');
const { CRITERIA, CRITERION_KEYS, SCORE_BANDS } = require('./criteria');

/**
 * The Scoring Engine. It is the only place where a Living Score is computed —
 * the UI and the AI layer only display / explain what it returns.
 *
 * compute() -> { score (0-100, 1 decimal), band, breakdown: [{ criterion, score, weightPct, points }] }
 */
class ScoringService {
  getDefaultWeights() {
    return Object.fromEntries(CRITERIA.map((c) => [c.key, c.defaultWeight]));
  }

  /** Defaults overridden by whatever the caller supplied. Throws 400 if the total weight is not positive. */
  resolveWeights(overrides) {
    const weights = { ...this.getDefaultWeights(), ...overrides };
    this.assertUsable(weights);
    return weights;
  }

  isPersonalized(overrides) {
    if (!overrides) return false;
    const defaults = this.getDefaultWeights();
    return CRITERION_KEYS.some((key) => overrides[key] !== undefined && overrides[key] !== defaults[key]);
  }

  /** Stable cache key: identical effective weights always map to the same key. */
  cacheKey(overrides) {
    if (!this.isPersonalized(overrides)) return 'default';
    const weights = this.resolveWeights(overrides);
    return CRITERION_KEYS.map((key) => weights[key]).join('-');
  }

  /** Scales weights so they sum to 100. */
  normalizeWeights(weights) {
    this.assertUsable(weights);
    const total = CRITERION_KEYS.reduce((sum, key) => sum + weights[key], 0);
    return Object.fromEntries(CRITERION_KEYS.map((key) => [key, (weights[key] / total) * 100]));
  }

  compute(scores, weights) {
    const normalized = this.normalizeWeights(weights);
    const breakdown = CRITERION_KEYS.map((key) => ({
      criterion: key,
      score: scores[key],
      weightPct: round1(normalized[key]),
      points: round1((scores[key] * normalized[key]) / 100),
    }));
    const raw = CRITERION_KEYS.reduce((sum, key) => sum + (scores[key] * normalized[key]) / 100, 0);
    const score = round1(raw);
    return { score, band: this.bandFor(score), breakdown };
  }

  bandFor(score) {
    const band = SCORE_BANDS.find((b) => score >= b.min);
    return band ? band.key : 'low';
  }

  assertUsable(weights) {
    let total = 0;
    for (const key of CRITERION_KEYS) {
      const value = weights[key];
      if (!Number.isFinite(value) || value < 0) {
        throw badRequest(`Trọng số "${key}" phải là số không âm.`);
      }
      total += value;
    }
    if (total <= 0) {
      throw badRequest('Tổng trọng số phải lớn hơn 0 — hãy ưu tiên ít nhất một tiêu chí.');
    }
  }
}

module.exports = { ScoringService };
