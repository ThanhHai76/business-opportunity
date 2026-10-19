'use strict';
/**
 * Metering of in-depth AI answers (written by Claude) across the tools: Opportunity Map /ask, Future Map /ask-ai,
 * Property Intelligence /ask, Living Score /recommendations and the Time Machine storyteller /ask.
 * The Time Machine has its own, larger free daily allowance (`storyFreePerDay`); Premium and bought AI credits are
 * shared by every tool.
 *
 * Who gets an AI answer:
 *   - not signed in            → the basic answer (templates / rules), with `quota.reason = 'signin'`
 *   - signed in                → Premium daily allowance (while Premium is active), then the free daily allowance,
 *                                (the tool's own: the Time Machine's or the common one), then one bought AI credit;
 *                                with none left → the basic answer, `reason = 'no_quota'`
 * An answer is paid for only when the AI actually wrote it: when the model fails and the template answers, the
 * allowance or credit is given back. Days are counted in Vietnam time (UTC+7).
 *
 * AI_METERING: auto (default) — on when accounts are on and an Anthropic key is set (AI_PROVIDER is not `mock`);
 *              on — whenever accounts are on (answers are then recorded only if the AI writes them);
 *              off — every answer is free, as before metering existed.
 */
const { loadConfig } = require('../ai-config');
const { aiLimitsFromEnv, STORY_TOOLS } = require('./products');

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight of `now`'s day in Vietnam (UTC+7), as an instant. */
const dayStartVn = (now) => new Date(Math.floor((now.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS);

/** A meter that never meters: the tools' default when they are created on their own (tests, scripts). */
const NO_METER = Object.freeze({
  enabled: false,
  limits: aiLimitsFromEnv(),
  async run(req, res, tool, work) {
    return (await work(true)).body;
  },
  async status() {
    return null;
  },
});

/** Account-facing view of an AI status (also used by GET /api/billing/me). */
function statusView(raw, limits, now) {
  if (!raw) return null;
  const premiumActive = Boolean(raw.premiumUntil && new Date(raw.premiumUntil) > now);
  return {
    premium: premiumActive,
    premiumUntil: raw.premiumUntil ? new Date(raw.premiumUntil).toISOString() : null,
    freePerDay: limits.freePerDay,
    freeLeft: Math.max(0, limits.freePerDay - raw.used.free),
    storyFreePerDay: limits.storyFreePerDay,
    storyFreeLeft: Math.max(0, limits.storyFreePerDay - raw.used.freeStory),
    premiumPerDay: premiumActive ? limits.premiumPerDay : 0,
    premiumLeft: premiumActive ? Math.max(0, limits.premiumPerDay - raw.used.premium) : 0,
    aiCredits: raw.aiCredits,
  };
}

/**
 * @param options {
 *   accounts: the accounts module;
 *   isAllowedOrigin?: (origin) => boolean   (a cross-site page never spends the visitor's allowance);
 *   mode?: 'auto'|'on'|'off'               (default AI_METERING, else auto);
 *   aiConfigured?: boolean                  (default: an Anthropic key is set and AI_PROVIDER is not mock);
 *   limits?: { freePerDay, storyFreePerDay, premiumPerDay }  (default AI_FREE_PER_DAY / AI_STORY_FREE_PER_DAY / AI_PREMIUM_PER_DAY, else products.js);
 *   clock?: () => Date                      (tests)
 * }
 */
function createAiMeter(options = {}) {
  const { accounts } = options;
  const isAllowedOrigin = options.isAllowedOrigin ?? (() => false);
  const mode = options.mode ?? process.env.AI_METERING ?? 'auto';
  const aiConfigured =
    options.aiConfigured ??
    (() => {
      const c = loadConfig();
      return Boolean(c.anthropicApiKey) && c.aiProvider !== 'mock';
    })();
  const limits = { ...aiLimitsFromEnv(), ...options.limits };
  const clock = options.clock ?? (() => new Date());
  const enabled = () => Boolean(accounts?.enabled) && (mode === 'on' || (mode === 'auto' && aiConfigured));

  const fromOwnPage = (req) => {
    const origin = req.get('origin');
    if (!origin) return true;
    try {
      if (new URL(origin).host === req.get('host')) return true;
    } catch {
      return false;
    }
    return isAllowedOrigin(origin);
  };

  async function status(userId, now = clock()) {
    return statusView(await accounts.store.aiStatus(userId, { now, dayStart: dayStartVn(now), storyTools: STORY_TOOLS }), limits, now);
  }

  /** Who asks, and whether an AI answer is paid for (recorded before the AI runs, given back if it does not). */
  async function begin(req, res, tool) {
    const ctx = { tool, user: null, spend: null, reason: null };
    if (!fromOwnPage(req)) {
      ctx.reason = 'signin';
      return ctx;
    }
    ctx.user = await accounts.userOf(req, res);
    if (!ctx.user) {
      ctx.reason = 'signin';
      return ctx;
    }
    const now = clock();
    const spend = await accounts.store.spendAi(ctx.user.id, { tool, now, dayStart: dayStartVn(now), storyTools: STORY_TOOLS, ...limits });
    if (spend.ok) ctx.spend = spend;
    else ctx.reason = 'no_quota';
    return ctx;
  }

  async function finish(ctx, usedAi) {
    let charged = null;
    let reason = ctx.reason;
    if (ctx.spend) {
      if (usedAi) charged = ctx.spend.source;
      else {
        await accounts.store.refundAi(ctx.user.id, ctx.spend.usageId);
        reason = 'unavailable';
      }
    }
    // `toolFree…` is the free allowance of the tool that was asked (the storyteller's, or the common one).
    const story = STORY_TOOLS.includes(ctx.tool);
    const view = ctx.user ? await status(ctx.user.id) : null;
    return {
      charged,
      reason,
      signedIn: Boolean(ctx.user),
      toolFreePerDay: story ? limits.storyFreePerDay : limits.freePerDay,
      ...(view ? { ...view, toolFreeLeft: story ? view.storyFreeLeft : view.freeLeft } : {}),
    };
  }

  return {
    get enabled() {
      return enabled();
    },
    limits,
    status,
    /**
     * Runs one metered question. `work(allowAi)` answers it — with the AI only when `allowAi` — and returns
     * `{ body, usedAi }`. Resolves to the response body, with `quota` added when metering is on:
     *   { charged: 'free'|'premium'|'credit'|null, reason: 'signin'|'no_quota'|'unavailable'|null, signedIn,
     *     toolFreePerDay, toolFreeLeft, premium, premiumUntil, freePerDay, freeLeft, storyFreePerDay, storyFreeLeft,
     *     premiumPerDay, premiumLeft, aiCredits }
     */
    async run(req, res, tool, work) {
      if (!enabled()) return (await work(true)).body;
      const ctx = await begin(req, res, tool);
      let out;
      try {
        out = await work(Boolean(ctx.spend));
      } catch (error) {
        if (ctx.spend) await accounts.store.refundAi(ctx.user.id, ctx.spend.usageId).catch(() => {});
        throw error;
      }
      return { ...out.body, quota: await finish(ctx, Boolean(out.usedAi)) };
    },
  };
}

/** The answerers to use for one question: the AI's, or only the template ones (`{ primary: fallback, fallback }`). */
const answerersFor = (answerers, allowAi) => (allowAi ? answerers : { primary: answerers.fallback, fallback: answerers.fallback });

/** Whether an answer from `ask(answerers, …)` was written by the AI (the primary answerer, when it is not the template). */
const answeredByAi = (answerers, provider) => answerers.primary !== answerers.fallback && provider === answerers.primary.name;

module.exports = { createAiMeter, NO_METER, statusView, dayStartVn, answerersFor, answeredByAi };
