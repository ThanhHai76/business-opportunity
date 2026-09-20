'use strict';
const { haversineKm } = require('../common/geo');
const { clamp, round1 } = require('../common/text');
const { CRITERIA, CRITERION_KEYS } = require('../scoring/criteria');
const { HOUSEHOLD_EFFECTS, HOUSEHOLD_LABELS, INTEREST_EFFECTS } = require('./recommendation.types');

const LABELS = Object.fromEntries(CRITERIA.map((c) => [c.key, c.label]));
const NEUTRAL_PRIORITY = 3;
const MAX_REASONS = 5;

const formatVnd = (vnd) => `${new Intl.NumberFormat('vi-VN').format(Math.round(vnd))}đ`;
const unique = (items) => [...new Set(items)];

/**
 * Deterministic part of the recommendation: turns the user's answers into weights, ranks areas
 * (using the Scoring Engine for the score itself) and writes rule-based explanations.
 * The LLM never touches numbers — it only rewrites the wording of what is computed here.
 */
class RecommendationEngine {
  constructor(scoring) {
    this.scoring = scoring;
  }

  /**
   * weight(criterion) = defaultWeight x (priority / 3) x household multiplier x interest multipliers.
   * A priority of 3 (or none) keeps the default weight; 0 removes the criterion; 5 boosts it ~1.7x.
   */
  buildWeights(input) {
    const defaults = this.scoring.getDefaultWeights();
    const weights = { ...defaults };
    for (const key of CRITERION_KEYS) {
      const priority = input.priorities[key] ?? NEUTRAL_PRIORITY;
      weights[key] = defaults[key] * (priority / NEUTRAL_PRIORITY) * (HOUSEHOLD_EFFECTS[input.household][key] ?? 1);
    }
    for (const interest of input.interests) {
      const effect = INTEREST_EFFECTS[interest];
      weights[effect.criterion] *= effect.multiplier;
    }
    // Throws a 400 when the user zeroed out every criterion.
    return this.scoring.normalizeWeights(weights);
  }

  /** Ranked list: { area, personalizedScore, budgetFactor, commuteFactor, commuteKm, matchScore, withinBudget, budgetDeltaPct, breakdown } */
  rank(areas, input, weights, workplace) {
    return areas
      .map((area) => {
        const result = this.scoring.compute(area.scores, weights);
        const budgetFactor = area.avgRentVnd <= input.budgetVnd ? 1 : Math.max(0.5, input.budgetVnd / area.avgRentVnd);
        const commuteKm = workplace ? haversineKm(area.centroid, workplace.centroid) : null;
        const commuteFactor = commuteKm === null || commuteKm <= 3 ? 1 : Math.max(0.8, 1 - (commuteKm - 3) * 0.015);
        return {
          area,
          personalizedScore: result.score,
          budgetFactor,
          commuteFactor,
          commuteKm: commuteKm === null ? null : round1(commuteKm),
          matchScore: round1(clamp(result.score * budgetFactor * commuteFactor, 0, 100)),
          withinBudget: area.avgRentVnd <= input.budgetVnd,
          // (rent - budget) / budget in percent; negative = under budget.
          budgetDeltaPct: Math.round(((area.avgRentVnd - input.budgetVnd) / input.budgetVnd) * 100),
          breakdown: result.breakdown,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore || b.personalizedScore - a.personalizedScore || a.area.name.localeCompare(b.area.name, 'vi'));
  }

  /** Rule-based { summary, reasons, pros, cons }. */
  explain(ranked, input, workplace) {
    const { area, breakdown } = ranked;
    const reasons = [];
    const pros = [];
    const cons = [];

    reasons.push(`Điểm phù hợp ${ranked.matchScore}/100 dựa trên ưu tiên (${HOUSEHOLD_LABELS[input.household].toLowerCase()}) bạn đã chọn.`);

    const strengths = [...breakdown].filter((b) => b.score >= 65).sort((a, b) => b.points - a.points).slice(0, 2);
    for (const s of strengths) {
      reasons.push(`Điểm mạnh: ${LABELS[s.criterion]} đạt ${s.score}/100 (chiếm ${s.weightPct}% trọng số của bạn).`);
    }

    if (ranked.withinBudget) {
      reasons.push(`Giá thuê tham khảo khoảng ${formatVnd(area.avgRentVnd)}/tháng, nằm trong ngân sách ${formatVnd(input.budgetVnd)}.`);
    } else {
      cons.push(`Giá thuê tham khảo ~${formatVnd(area.avgRentVnd)}/tháng, vượt ngân sách khoảng ${ranked.budgetDeltaPct}%.`);
    }

    if (workplace && ranked.commuteKm !== null) {
      const text = `Cách ${workplace.name} khoảng ${ranked.commuteKm} km (đường chim bay).`;
      (ranked.commuteKm <= 6 ? reasons : cons).push(text);
    }

    for (const interest of input.interests) {
      const effect = INTEREST_EFFECTS[interest];
      const score = area.scores[effect.criterion];
      if (score >= 70) reasons.push(`Hợp sở thích "${effect.label}": ${LABELS[effect.criterion]} ${score}/100.`);
      else if (score < 55) cons.push(`Chưa mạnh về "${effect.label}": ${LABELS[effect.criterion]} chỉ ${score}/100.`);
    }

    pros.push(...area.pros.slice(0, 2));
    const weakest = [...breakdown].filter((b) => b.weightPct >= 8 && b.score < 50).sort((a, b) => a.score - b.score)[0];
    if (weakest) cons.push(`${LABELS[weakest.criterion]} còn thấp (${weakest.score}/100).`);
    cons.push(...area.cons.slice(0, 2));

    return {
      summary: area.description,
      reasons: unique(reasons).slice(0, MAX_REASONS),
      pros: unique(pros).slice(0, 3),
      cons: unique(cons).slice(0, 3),
    };
  }
}

module.exports = { RecommendationEngine };
