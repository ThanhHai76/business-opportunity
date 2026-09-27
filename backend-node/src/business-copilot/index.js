'use strict';
/**
 * Hanoi Business Copilot API — mounted by server.js at /api/business-copilot.
 *
 *   GET  /categories                         business types
 *   GET  /locations?category=&budget=        all 10 areas ranked by Business Score
 *   GET  /locations/:id?category=&budget=    full location intelligence
 *   GET  /locations/:id/business-score       score + breakdown only
 *   GET  /locations/:id/competitors          competitor analysis
 *   GET  /recommendations?category=&budget=&limit=10   top N + AI summary + opportunity heatmap
 *   GET  /map/layers?category=&budget=       GeoJSON layers for the Map Explorer
 *   POST /analyze   { message } or { category, budgetVnd }  free-text business idea -> top 10
 *   POST /compare   { locations[2-3], category?, budgetVnd? }
 *   POST /simulate  { category, budgetVnd, sizeM2?, expectedRevenueVnd?, maxRentVnd?, targetCustomers?, districts? }
 *   POST /ai/analyze { question, context? }  AI Business Copilot
 *   POST /report    { category?, budgetVnd?, location? }
 *
 * All data is DEMO / ESTIMATED (see data.js).
 */
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { HttpError, asyncHandler, badRequest, errorBody, singleString } = require('../living-score/common/http');
const { parseSlug } = require('../living-score/common/query-parsers');
const { createLogger } = require('../living-score/common/logger');
const { CATEGORIES, LOCATIONS, DEMO_NOTE } = require('./data');
const scoring = require('./scoring');
const { parsePrompt } = require('./nlp');
const { simulate } = require('./simulate');
const copilot = require('./copilot');
const { buildReport } = require('./report');
const { mapLayers } = require('./map-layers');
const { createAIProvider, explainWithFallback } = require('./ai-provider');

const logger = createLogger('BusinessCopilot');

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const SLUG = z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const BUDGET = z.number().int().min(50_000_000).max(50_000_000_000);
const CUSTOMER_KEYS = ['office', 'students', 'residents', 'visitors'];

const Schemas = {
  analyze: z
    .strictObject({
      message: z.string().trim().min(3).max(500).optional(),
      category: z.enum(CATEGORY_KEYS).optional(),
      budgetVnd: BUDGET.optional(),
      districts: z.array(SLUG).max(10).optional(),
    })
    .refine((v) => v.message || v.category, 'Cần message hoặc category'),
  compare: z.strictObject({
    locations: z.array(SLUG).min(2).max(3).refine((a) => new Set(a).size === a.length, 'locations không được trùng'),
    category: z.enum(CATEGORY_KEYS).optional(),
    budgetVnd: BUDGET.optional(),
  }),
  simulate: z.strictObject({
    category: z.enum(CATEGORY_KEYS),
    budgetVnd: BUDGET,
    sizeM2: z.number().int().min(15).max(2000).optional(),
    expectedRevenueVnd: z.number().int().min(1_000_000).max(20_000_000_000).optional(),
    maxRentVnd: z.number().int().min(1_000_000).max(2_000_000_000).optional(),
    targetCustomers: z.array(z.enum(CUSTOMER_KEYS)).max(4).optional(),
    districts: z.array(SLUG).max(10).optional(),
  }),
  ask: z.strictObject({
    question: z.string().trim().min(1).max(600),
    context: z
      .strictObject({ category: z.enum(CATEGORY_KEYS).optional(), budgetVnd: BUDGET.optional(), location: SLUG.optional() })
      .optional(),
  }),
  report: z.strictObject({ category: z.enum(CATEGORY_KEYS).optional(), budgetVnd: BUDGET.optional(), location: SLUG.optional() }),
};

function parseBody(schema, body) {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw badRequest(`Dữ liệu gửi lên không hợp lệ — ${details}`);
  }
  return parsed.data;
}

function loadConfig(env = process.env) {
  return {
    aiProvider: env.AI_PROVIDER || 'auto',
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    llmModel: env.LLM_MODEL || 'claude-opus-5',
    llmTimeoutMs: Number(env.LLM_TIMEOUT_MS) || 45_000,
  };
}

/** Small TTL cache for AI-worded answers, so repeating a question does not call the LLM again. */
function createAnswerCache(ttlMs = 10 * 60_000, max = 200) {
  const store = new Map();
  return async (key, compute) => {
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await compute();
    store.set(key, { value, expires: Date.now() + ttlMs });
    if (store.size > max) store.delete(store.keys().next().value);
    return value;
  };
}

/**
 * @param options.config      { aiProvider, anthropicApiKey, llmModel, llmTimeoutMs } (defaults from env)
 * @param options.providers   { primary, fallback } — replaces the AI providers (tests)
 * @param options.rateLimits  { global, ai } requests per minute per client (defaults 240 / 30)
 */
function createBusinessCopilot(options = {}) {
  const config = options.config ?? loadConfig();
  const providers = options.providers ?? createAIProvider(config);
  const limits = { global: 240, ai: 30, ...options.rateLimits };
  const cached = createAnswerCache();
  const tooMany = (req, res, next) => next(new HttpError(429, 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'));
  const aiLimit = rateLimit({ windowMs: 60_000, limit: limits.ai, standardHeaders: true, legacyHeaders: false, handler: tooMany });

  const router = express.Router();
  router.use(helmet());
  router.use(rateLimit({ windowMs: 60_000, limit: limits.global, standardHeaders: true, legacyHeaders: false, handler: tooMany }));
  router.use(express.json({ limit: '16kb' }));

  const query = (req) => ({
    category: scoring.requireCategory(singleString(req.query.category, 'category')),
    budgetVnd: scoring.requireBudget(singleString(req.query.budget, 'budget')),
  });
  const meta = { demo: true, note: DEMO_NOTE, ai: { provider: providers.primary.name, model: providers.primary.model } };

  router.get('/health', (req, res) => res.json({ status: 'ok', ...meta }));

  router.get('/categories', (req, res) => {
    res.json({ categories: CATEGORIES.map(({ key, name, nameVi, icon, avgSizeM2 }) => ({ key, name, nameVi, icon, avgSizeM2 })), ...meta });
  });

  router.get('/locations', (req, res) => {
    const { category, budgetVnd } = query(req);
    res.json({ locations: scoring.rank(category, budgetVnd), ...meta });
  });

  router.get('/locations/:id', (req, res) => {
    const { category, budgetVnd } = query(req);
    const location = scoring.requireLocation(parseSlug(req.params.id, 'Mã khu vực'));
    res.json({ ...scoring.locationDetail(location, category, budgetVnd), ...meta });
  });

  router.get('/locations/:id/business-score', (req, res) => {
    const { category, budgetVnd } = query(req);
    const location = scoring.requireLocation(parseSlug(req.params.id, 'Mã khu vực'));
    const s = scoring.computeScore(location, category, budgetVnd);
    res.json({ slug: location.slug, name: location.name, totalScore: s.totalScore, scores: s.scores, weights: scoring.SCORE_WEIGHTS, competitionLabel: s.competitionLabel, confidence: s.confidence, ...meta });
  });

  router.get('/locations/:id/competitors', (req, res) => {
    const { category, budgetVnd } = query(req);
    const location = scoring.requireLocation(parseSlug(req.params.id, 'Mã khu vực'));
    const d = scoring.locationDetail(location, category, budgetVnd);
    res.json({ slug: d.slug, name: d.name, competitionLabel: d.competitionLabel, score: d.scores.competition, ...d.competitors, gap: d.competitorGap, ...meta });
  });

  async function recommendationsPayload(category, budgetVnd, limit, districts, message) {
    let ranking = scoring.rank(category, budgetVnd);
    if (districts?.length) ranking = ranking.filter((r) => districts.includes(r.slug));
    const top = ranking.slice(0, limit);
    const key = `rec|${category.key}|${budgetVnd}|${top.map((t) => t.slug).join(',')}`;
    const ai = await cached(key, () =>
      explainWithFallback(providers, {
        task: 'recommendations',
        question: message,
        facts: { categoryVi: category.nameVi, budgetMillions: budgetVnd / 1e6, top: top.slice(0, 3), overBudget: top.filter((t) => !t.withinBudget).map((t) => t.name) },
      }),
    );
    return {
      category: { key: category.key, name: category.name, nameVi: category.nameVi },
      budgetMillions: budgetVnd / 1e6,
      recommendations: top,
      heatmap: scoring.opportunityHeatmap(category, budgetVnd, top.slice(0, 3).map((t) => t.slug)),
      insight: ai.narrative,
      provider: ai.provider,
      ...meta,
    };
  }

  router.get(
    '/recommendations',
    asyncHandler(async (req, res) => {
      const { category, budgetVnd } = query(req);
      const limitRaw = singleString(req.query.limit, 'limit');
      const limit = limitRaw === undefined ? 10 : Number(limitRaw);
      if (!Number.isInteger(limit) || limit < 1 || limit > LOCATIONS.length) throw badRequest(`limit phải từ 1 đến ${LOCATIONS.length}.`);
      res.json(await recommendationsPayload(category, budgetVnd, limit));
    }),
  );

  router.post(
    '/analyze',
    aiLimit,
    asyncHandler(async (req, res) => {
      const body = parseBody(Schemas.analyze, req.body);
      const parsed = body.message ? parsePrompt(body.message) : { category: null, budgetVnd: null, districts: [], missing: [] };
      const categoryKey = body.category ?? parsed.category;
      const budget = body.budgetVnd ?? parsed.budgetVnd;
      if (!categoryKey) {
        throw badRequest('Chưa nhận ra loại hình kinh doanh. Thử: quán cà phê, nhà hàng, cửa hàng bán lẻ, phòng gym, nhà thuốc, cửa hàng tiện lợi.');
      }
      const category = scoring.requireCategory(categoryKey);
      const budgetVnd = scoring.requireBudget(budget ?? undefined);
      const districts = body.districts ?? parsed.districts;
      const payload = await recommendationsPayload(category, budgetVnd, 10, districts.length ? districts : undefined, body.message);
      res.json({ ...payload, parsed: { category: category.key, budgetVnd, districts, assumedBudget: !budget } });
    }),
  );

  router.post(
    '/compare',
    asyncHandler(async (req, res) => {
      const body = parseBody(Schemas.compare, req.body);
      const category = scoring.requireCategory(body.category);
      const budgetVnd = scoring.requireBudget(body.budgetVnd);
      const result = scoring.compareLocations(body.locations, category, budgetVnd);
      res.json({ ...result, ...meta });
    }),
  );

  router.post(
    '/simulate',
    asyncHandler(async (req, res) => {
      const body = parseBody(Schemas.simulate, req.body);
      for (const slug of body.districts ?? []) scoring.requireLocation(slug);
      const category = scoring.requireCategory(body.category);
      const result = simulate({ ...body, category });
      res.json({ ...result, simulated: true, ...meta });
    }),
  );

  router.post(
    '/ai/analyze',
    aiLimit,
    asyncHandler(async (req, res) => {
      const body = parseBody(Schemas.ask, req.body);
      const key = `ask|${body.question.toLowerCase()}|${JSON.stringify(body.context ?? {})}`;
      res.json({ ...(await cached(key, () => copilot.answer(providers, body))), note: DEMO_NOTE });
    }),
  );

  router.get('/ai/examples', (req, res) => res.json({ questions: copilot.EXAMPLE_QUESTIONS }));

  router.post(
    '/report',
    aiLimit,
    asyncHandler(async (req, res) => {
      const body = parseBody(Schemas.report, req.body);
      if (body.location) scoring.requireLocation(body.location);
      const category = scoring.requireCategory(body.category);
      const budgetVnd = scoring.requireBudget(body.budgetVnd);
      res.json({ ...(await buildReport(providers, { category, budgetVnd, location: body.location })), note: DEMO_NOTE });
    }),
  );

  router.get('/map/layers', (req, res) => {
    const { category, budgetVnd } = query(req);
    res.json({ ...mapLayers(category, budgetVnd), note: DEMO_NOTE });
  });

  router.use((req, res, next) => next(new HttpError(404, `Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}.`)));

  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    let error = err;
    if (err?.type === 'entity.parse.failed') error = badRequest('Body JSON không hợp lệ.');
    else if (err?.type === 'entity.too.large') error = new HttpError(413, 'Body quá lớn.');
    const { status, body } = errorBody(error, req);
    if (status >= 500) logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
    res.status(status).json(body);
  });

  return { router, config, providers };
}

module.exports = { createBusinessCopilot, loadConfig };
