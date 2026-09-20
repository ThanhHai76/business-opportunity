'use strict';
const { createHash } = require('node:crypto');
const { badRequest } = require('../common/http');
const { CRITERIA, CRITERION_KEYS } = require('../scoring/criteria');
const { HOUSEHOLD_LABELS, INTEREST_EFFECTS } = require('./recommendation.types');
const { parseRecommendationRequest } = require('./request-schema');

const RESULT_COUNT = 3;
const CACHE_TTL_SECONDS = 600;
const LABELS = Object.fromEntries(CRITERIA.map((c) => [c.key, c.label]));
const AMENITY_LABELS = { school: 'Trường học', hospital: 'Cơ sở y tế', park: 'Công viên', shopping: 'Trung tâm mua sắm' };

/**
 * AI Recommendation: deterministic ranking -> retrieval (RAG) -> LLM wording, with a rule-based
 * fallback. The Top 3 and every number always come from the Scoring Engine, never from the LLM.
 */
class RecommendationService {
  /**
   * @param narrative a narrative client (`enabled`, `model`, `generate()`); may be a test double
   */
  constructor(areas, engine, knowledge, narrative, data, cache) {
    this.areas = areas;
    this.engine = engine;
    this.knowledge = knowledge;
    this.narrative = narrative;
    this.data = data;
    this.cache = cache;
  }

  /** @param body raw request body (validated here) */
  async recommend(body) {
    const input = this.toInput(parseRecommendationRequest(body));
    const key = `reco:${createHash('sha1').update(JSON.stringify(input)).digest('hex')}`;
    return this.cache.wrap(key, () => this.compute(input), CACHE_TTL_SECONDS);
  }

  toInput(dto) {
    const priorities = {};
    for (const key of CRITERION_KEYS) {
      const value = dto.priorities?.[key];
      if (value !== undefined) priorities[key] = value;
    }
    return {
      budgetVnd: dto.budgetVnd,
      workplaceAreaSlug: dto.workplaceAreaSlug,
      household: dto.household,
      interests: [...(dto.interests ?? [])].sort(),
      priorities,
      useAi: dto.useAi ?? true,
    };
  }

  async compute(input) {
    const records = await this.areas.getAllRecords();
    const workplace = input.workplaceAreaSlug ? (records.find((a) => a.slug === input.workplaceAreaSlug) ?? null) : null;
    if (input.workplaceAreaSlug && !workplace) {
      throw badRequest(`Không tìm thấy khu vực làm việc/học tập "${input.workplaceAreaSlug}".`);
    }

    const weights = this.engine.buildWeights(input);
    const top = this.engine.rank(records, input, weights, workplace).slice(0, RESULT_COUNT);
    const items = top.map((ranked, index) => this.toItem(ranked, index + 1, input, workplace));

    let mode = 'rules';
    let notice;
    if (input.useAi) {
      if (!this.narrative.enabled) {
        notice = 'Chưa cấu hình ANTHROPIC_API_KEY — đang dùng giải thích theo quy tắc.';
      } else {
        const narratives = await this.generateNarratives(top, items, input, weights, workplace);
        if (narratives && this.applyNarratives(items, narratives)) {
          mode = 'ai';
        } else {
          notice = 'AI tạm thời không khả dụng — đang hiển thị giải thích theo quy tắc.';
        }
      }
    }

    return {
      mode,
      model: mode === 'ai' ? (this.narrative.model ?? undefined) : undefined,
      notice,
      sampleData: true,
      weights,
      results: items,
    };
  }

  toItem(ranked, rank, input, workplace) {
    const explanation = this.engine.explain(ranked, input, workplace);
    return {
      rank,
      // Area summary with the DEFAULT Living Score, so the number matches the rest of the app.
      area: this.areas.toSummary(ranked.area),
      // Final ranking score: personalised Living Score x budget fit x commute fit.
      matchScore: ranked.matchScore,
      personalizedScore: ranked.personalizedScore,
      budget: {
        rentVnd: ranked.area.avgRentVnd,
        budgetVnd: input.budgetVnd,
        withinBudget: ranked.withinBudget,
        deltaPct: ranked.budgetDeltaPct,
      },
      commute: workplace && ranked.commuteKm !== null ? { workplaceName: workplace.name, km: ranked.commuteKm } : null,
      breakdown: ranked.breakdown,
      ...explanation,
    };
  }

  /** RAG: retrieve facts about the shortlisted areas, then let the model phrase the explanation. */
  async generateNarratives(top, items, input, weights, workplace) {
    const retrieved = await this.knowledge.retrieve(
      top.map((r) => r.area.id),
      { weights, household: input.household, interests: input.interests },
    );

    const areaInputs = await Promise.all(
      top.map(async (ranked, index) => {
        const amenities = await this.data.listAmenities({ areaSlug: ranked.area.slug });
        const amenityCounts = {};
        for (const m of amenities) amenityCounts[AMENITY_LABELS[m.type]] = (amenityCounts[AMENITY_LABELS[m.type]] ?? 0) + 1;
        return {
          slug: ranked.area.slug,
          name: ranked.area.name,
          matchScore: ranked.matchScore,
          criteriaScores: Object.fromEntries(CRITERION_KEYS.map((k) => [LABELS[k], ranked.area.scores[k]])),
          monthlyRentVnd: ranked.area.avgRentVnd,
          budgetVnd: input.budgetVnd,
          withinBudget: ranked.withinBudget,
          commuteKm: ranked.commuteKm,
          workplaceName: workplace?.name ?? null,
          knownPros: items[index].pros,
          knownCons: items[index].cons,
          knowledgeSnippets: (retrieved.get(ranked.area.id) ?? []).map((k) => k.content),
          amenityCounts,
        };
      }),
    );

    return this.narrative.generate(
      {
        household: HOUSEHOLD_LABELS[input.household],
        interests: input.interests.map((i) => INTEREST_EFFECTS[i].label),
        weightsPct: Object.fromEntries(CRITERION_KEYS.map((k) => [LABELS[k], Math.round(weights[k])])),
      },
      areaInputs,
    );
  }

  /** Copies validated LLM text onto the items. Returns true if at least one area was updated. */
  applyNarratives(items, narratives) {
    const clean = (lines, max) =>
      lines
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && l.length <= 300)
        .slice(0, max);

    let applied = 0;
    for (const item of items) {
      const narrative = narratives.find((n) => n.slug === item.area.slug);
      if (!narrative) continue;
      const reasons = clean(narrative.reasons, 4);
      const pros = clean(narrative.pros, 3);
      const cons = clean(narrative.cons, 3);
      const summary = narrative.summary.trim().slice(0, 500);
      if (reasons.length < 2 || pros.length < 1 || cons.length < 1 || !summary) continue;
      item.summary = summary;
      item.reasons = reasons;
      item.pros = pros;
      item.cons = cons;
      applied++;
    }
    return applied > 0;
  }
}

module.exports = { RecommendationService };
