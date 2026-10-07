'use strict';
const { haversineKm } = require('../common/geo');
const { clamp, round1 } = require('../common/text');
const { CRITERIA, CRITERION_KEYS } = require('../scoring/criteria');
const { HOUSEHOLD_EFFECTS, HOUSEHOLD_LABELS, HOUSEHOLD_LABELS_EN, INTEREST_EFFECTS } = require('./recommendation.types');
const { roadCommute } = require('./commute');

const LABELS = {
  vi: Object.fromEntries(CRITERIA.map((c) => [c.key, c.label])),
  en: Object.fromEntries(CRITERIA.map((c) => [c.key, c.labelEn])),
};
const NEUTRAL_PRIORITY = 3;
const MAX_REASONS = 5;
/** Road minutes up to which the commute costs nothing; beyond, the match score is reduced (at most x0.8). */
const FREE_COMMUTE_MIN = 15;

const unique = (items) => [...new Set(items)];

/** The OSM fact behind an interest, in words, and whether it counts in the area's favour. */
function interestFact(interest, facts, lang) {
  const en = lang === 'en';
  const within = en ? 'within 1.5 km' : 'trong bán kính 1,5 km';
  switch (interest) {
    case 'cafes':
      return { good: facts.cafes >= 30, text: en ? `${facts.cafes} cafés ${within}` : `${facts.cafes} quán cà phê ${within}` };
    case 'metro_access':
      if (!facts.metroStations.length) {
        return { good: false, text: en ? `no metro station in service ${within}` : `chưa có ga metro đang khai thác ${within}` };
      }
      return {
        good: true,
        text: en
          ? `${facts.metroStations.length} metro station(s) ${within} (${facts.metroStations.join(', ')})`
          : `có ${facts.metroStations.length} ga metro ${within} (${facts.metroStations.join(', ')})`,
      };
    case 'international_schools':
      return facts.internationalSchools
        ? { good: true, text: en ? `${facts.internationalSchools} school(s) named "international" ${within}` : `${facts.internationalSchools} trường có tên "quốc tế" ${within}` }
        : { good: false, text: en ? `no school named "international" ${within}` : `không có trường mang tên "quốc tế" ${within}` };
    case 'green_space': {
      const share = facts.parkPct + facts.waterPct;
      return {
        good: share >= 5,
        text: en
          ? `parks cover about ${facts.parkPct}% and lakes about ${facts.waterPct}% of the area ${within}`
          : `công viên chiếm khoảng ${String(facts.parkPct).replace('.', ',')}%, hồ ao khoảng ${String(facts.waterPct).replace('.', ',')}% diện tích ${within}`,
      };
    }
    default:
      return { good: false, text: '' };
  }
}

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

  /**
   * Ranked list: { area, personalizedScore, commuteFactor, commuteKm, commuteMinutes, matchScore, breakdown }.
   * The commute is the road trip (OSRM table, free-flow driving) when known, else the straight-line distance.
   */
  rank(areas, input, weights, workplace) {
    return areas
      .map((area) => {
        const result = this.scoring.compute(area.scores, weights);
        const road = workplace ? roadCommute(area.slug, workplace.slug) : null;
        const commuteKm = workplace ? (road?.km ?? haversineKm(area.centroid, workplace.centroid)) : null;
        const commuteMinutes = road?.minutes ?? null;
        let commuteFactor = 1;
        if (commuteMinutes !== null) commuteFactor = Math.max(0.8, 1 - Math.max(0, commuteMinutes - FREE_COMMUTE_MIN) * 0.008);
        else if (commuteKm !== null && commuteKm > 3) commuteFactor = Math.max(0.8, 1 - (commuteKm - 3) * 0.015);
        return {
          area,
          personalizedScore: result.score,
          commuteFactor,
          commuteKm: commuteKm === null ? null : round1(commuteKm),
          commuteMinutes,
          matchScore: round1(clamp(result.score * commuteFactor, 0, 100)),
          breakdown: result.breakdown,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore || b.personalizedScore - a.personalizedScore || a.area.name.localeCompare(b.area.name, 'vi'));
  }

  /** Rule-based { summary, reasons, pros, cons } in the request's language. */
  explain(ranked, input, workplace) {
    const lang = input.lang === 'en' ? 'en' : 'vi';
    const en = lang === 'en';
    const label = LABELS[lang];
    const pick = (text) => (text && typeof text === 'object' ? text[lang] : text);
    // 74.9 -> "74,9" in Vietnamese.
    const n = (value) => Number(value).toLocaleString(en ? 'en-US' : 'vi-VN', { maximumFractionDigits: 1 });
    const { area, breakdown } = ranked;
    const reasons = [];
    const pros = [];
    const cons = [];

    const household = HOUSEHOLD_LABELS[input.household];
    reasons.push(
      en
        ? `Match ${n(ranked.matchScore)}/100 for your priorities (${HOUSEHOLD_LABELS_EN[input.household].toLowerCase()}).`
        : `Điểm phù hợp ${n(ranked.matchScore)}/100 dựa trên ưu tiên (${household.toLowerCase()}) bạn đã chọn.`,
    );

    const strengths = [...breakdown].filter((b) => b.score >= 65).sort((a, b) => b.points - a.points).slice(0, 2);
    for (const s of strengths) {
      reasons.push(
        en
          ? `Strength: ${label[s.criterion]} scores ${s.score}/100 (${n(s.weightPct)}% of your weighting).`
          : `Điểm mạnh: ${label[s.criterion]} đạt ${s.score}/100 (chiếm ${n(s.weightPct)}% trọng số của bạn).`,
      );
    }

    if (workplace && ranked.commuteKm !== null) {
      const text =
        ranked.commuteMinutes !== null
          ? en
            ? `About ${ranked.commuteMinutes} min by road to ${workplace.nameEn} (${n(ranked.commuteKm)} km, free-flow driving — longer at rush hour).`
            : `Khoảng ${ranked.commuteMinutes} phút đi đường tới ${workplace.name} (${n(ranked.commuteKm)} km, khi đường thông thoáng — giờ cao điểm lâu hơn).`
          : en
            ? `About ${n(ranked.commuteKm)} km from ${workplace.nameEn} (straight line).`
            : `Cách ${workplace.name} khoảng ${n(ranked.commuteKm)} km (đường chim bay).`;
      const close = ranked.commuteMinutes !== null ? ranked.commuteMinutes <= 20 : ranked.commuteKm <= 6;
      (close ? reasons : cons).push(text);
    }

    for (const interest of input.interests) {
      const fact = interestFact(interest, area.facts, lang);
      const name = en ? INTEREST_EFFECTS[interest].labelEn : INTEREST_EFFECTS[interest].label;
      if (fact.good) reasons.push(en ? `Fits "${name}": ${fact.text}.` : `Hợp sở thích "${name}": ${fact.text}.`);
      else cons.push(en ? `Weaker on "${name}": ${fact.text}.` : `Chưa mạnh về "${name}": ${fact.text}.`);
    }

    pros.push(...area.pros.slice(0, 2).map(pick));
    const weakest = [...breakdown].filter((b) => b.weightPct >= 8 && b.score < 50).sort((a, b) => a.score - b.score)[0];
    if (weakest) cons.push(en ? `${label[weakest.criterion]} is low (${weakest.score}/100).` : `${label[weakest.criterion]} còn thấp (${weakest.score}/100).`);
    cons.push(...area.cons.slice(0, 2).map(pick));

    return {
      summary: pick(area.description),
      reasons: unique(reasons).slice(0, MAX_REASONS),
      pros: unique(pros).slice(0, 3),
      cons: unique(cons).slice(0, 3),
    };
  }
}

module.exports = { RecommendationEngine };
