'use strict';
/**
 * What can be bought. Prices in VND — change them here (orders keep the price and what they grant as created).
 *
 *   report   credits for paid feasibility reports (src/reports): one credit = one report
 *   ai       in-depth AI questions (answers written by Claude), used after the free daily allowance (src/billing/ai-meter.js)
 *   premium  days of Premium: a larger daily AI allowance, plus report credits included in the price
 *
 * A product grants { reportCredits, aiCredits, premiumDays }; an order stores that grant when it is created.
 */
const PRODUCTS = Object.freeze({
  report_1: { kind: 'report', credits: 1, amountVnd: 199_000, name: { vi: '1 báo cáo khả thi', en: '1 feasibility report' } },
  report_3: { kind: 'report', credits: 3, amountVnd: 449_000, name: { vi: 'Gói 3 báo cáo', en: '3-report pack' } },
  ai_30: { kind: 'ai', aiCredits: 30, amountVnd: 49_000, name: { vi: '30 lượt hỏi AI chuyên sâu', en: '30 in-depth AI questions' } },
  ai_150: { kind: 'ai', aiCredits: 150, amountVnd: 199_000, name: { vi: '150 lượt hỏi AI chuyên sâu', en: '150 in-depth AI questions' } },
  premium_30d: { kind: 'premium', premiumDays: 30, credits: 1, amountVnd: 249_000, name: { vi: 'Premium 1 tháng', en: 'Premium, 1 month' } },
  premium_365d: { kind: 'premium', premiumDays: 365, credits: 12, amountVnd: 2_490_000, name: { vi: 'Premium 1 năm', en: 'Premium, 1 year' } },
});

/**
 * In-depth AI questions per day (Vietnam time): every signed-in account gets `freePerDay`; Premium adds `premiumPerDay`.
 * Past both, each question uses one bought AI credit. Override with AI_FREE_PER_DAY / AI_PREMIUM_PER_DAY.
 * The Time Machine storyteller has a free allowance of its own (`storyFreePerDay`, AI_STORY_FREE_PER_DAY): it is a
 * more casual tool, so it gets more free answers, which do not use up the other tools' free ones. Premium
 * (`premiumPerDay`) and bought AI credits are shared by every tool, the Time Machine included.
 */
const AI_LIMITS = Object.freeze({ freePerDay: 3, storyFreePerDay: 5, premiumPerDay: 50 });
/** The tools that draw on the storyteller's free allowance instead of the common one. */
const STORY_TOOLS = Object.freeze(['time-machine']);

function aiLimitsFromEnv(env = process.env) {
  const int = (raw, fallback) => {
    const n = Number(raw);
    return raw !== undefined && raw !== '' && Number.isInteger(n) && n >= 0 ? n : fallback;
  };
  return {
    freePerDay: int(env.AI_FREE_PER_DAY, AI_LIMITS.freePerDay),
    storyFreePerDay: int(env.AI_STORY_FREE_PER_DAY, AI_LIMITS.storyFreePerDay),
    premiumPerDay: int(env.AI_PREMIUM_PER_DAY, AI_LIMITS.premiumPerDay),
  };
}

/** What paying for a product adds to the buyer's account. */
const grantsOf = (p) => ({ reportCredits: p.credits ?? 0, aiCredits: p.aiCredits ?? 0, premiumDays: p.premiumDays ?? 0 });

const productList = () =>
  Object.entries(PRODUCTS).map(([id, p]) => ({
    id,
    kind: p.kind,
    credits: p.credits ?? 0,
    aiCredits: p.aiCredits ?? 0,
    premiumDays: p.premiumDays ?? 0,
    amountVnd: p.amountVnd,
    name: p.name,
  }));

module.exports = { PRODUCTS, AI_LIMITS, STORY_TOOLS, aiLimitsFromEnv, grantsOf, productList };
