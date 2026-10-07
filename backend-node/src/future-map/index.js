'use strict';
/**
 * Hanoi Future Map API — mounted by server.js at /api/future-map. Every GET takes `lang=vi|en` (default vi).
 *
 *   GET  /timeline                      the plan milestones (2026 today, 2035, 2045, 2065) with headline figures
 *   GET  /scenario?year=2035            every map layer for one milestone (GeoJSON), figures and their sources
 *   GET  /hubs/:slug?year=2035          one development pole: role, area, related lines and axes, sources
 *   GET  /compare?years=2026,2035,2065  figures side by side + change between the first and last milestone
 *   GET  /questions                     the preset questions
 *   POST /ask { question, year, lang }  answers a preset question from the data
 *   POST /ask-ai { question, year, lang }  free-text question, answered only from the data (Claude when configured)
 *
 * Data comes from the approved plans with a source per object (see data.js); geometry is schematic.
 */
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { HttpError, asyncHandler, badRequest, errorBody, singleString } = require('../living-score/common/http');
const { parseSlug } = require('../living-score/common/query-parsers');
const { createLogger } = require('../living-score/common/logger');
const { loadConfig } = require('../business-copilot');
const scenarios = require('./scenario');
const { createAnswerers, ask } = require('./ai');

const logger = createLogger('FutureMap');
const DEFAULT_YEAR = 2035;
const LANG = z.enum(['vi', 'en']).default('vi');

const AskSchema = z.strictObject({
  question: z.enum(scenarios.QUESTION_IDS),
  year: z.number().int().optional(),
  lang: LANG,
});
const AskAiSchema = z.strictObject({
  question: z.string().trim().min(2).max(500),
  year: z.number().int().optional(),
  lang: LANG,
});

function parse(schema, body) {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw badRequest(`Dữ liệu gửi lên không hợp lệ — ${details}`);
  }
  return parsed.data;
}

/** Small TTL cache so a repeated AI question does not call the model again. */
function createAnswerCache(ttlMs = 30 * 60_000, max = 300) {
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
 * @param options.answerers   { primary, fallback } — replaces the AI answerers (tests)
 * @param options.config      AI config (defaults from env: AI_PROVIDER, ANTHROPIC_API_KEY, LLM_MODEL)
 * @param options.rateLimits  { global, ai } requests per minute per client (defaults 240 / 20)
 */
function createFutureMap(options = {}) {
  const limits = { global: 240, ai: 20, ...options.rateLimits };
  const answerers = options.answerers ?? createAnswerers(options.config ?? loadConfig());
  const cached = createAnswerCache();
  const tooMany = (req, res, next) => next(new HttpError(429, 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'));
  const router = express.Router();
  router.use(helmet());
  router.use(
    rateLimit({
      windowMs: 60_000,
      limit: limits.global,
      standardHeaders: true,
      legacyHeaders: false,
      handler: tooMany,
    }),
  );
  router.use(express.json({ limit: '4kb' }));

  const yearOf = (raw) => singleString(raw, 'year') ?? DEFAULT_YEAR;
  const langOf = (raw) => singleString(raw, 'lang') ?? 'vi';

  router.get('/timeline', (req, res) => {
    res.json(scenarios.getTimeline(langOf(req.query.lang)));
  });

  router.get('/scenario', (req, res) => {
    res.json(scenarios.getScenario(yearOf(req.query.year), langOf(req.query.lang)));
  });

  router.get('/hubs/:slug', (req, res) => {
    res.json(scenarios.getHub(parseSlug(req.params.slug, 'Mã cực phát triển'), yearOf(req.query.year), langOf(req.query.lang)));
  });

  // The Capital Region view: corridors from Hanoi to the neighbouring provinces, and regional infrastructure.
  router.get('/region', (req, res) => {
    res.json(scenarios.getRegion(yearOf(req.query.year), langOf(req.query.lang)));
  });

  router.get('/region/corridors/:slug', (req, res) => {
    res.json(scenarios.getCorridor(parseSlug(req.params.slug, 'Mã hướng kết nối'), yearOf(req.query.year), langOf(req.query.lang)));
  });

  router.get('/compare', (req, res) => {
    const raw = singleString(req.query.years, 'years');
    if (!raw) throw badRequest('Thiếu tham số years, ví dụ years=2026,2035,2065.');
    res.json(scenarios.compareYears(raw.split(',').map((s) => s.trim()), langOf(req.query.lang)));
  });

  router.get('/questions', (req, res) => {
    res.json({ questions: scenarios.questions(langOf(req.query.lang)) });
  });

  router.post(
    '/ask',
    asyncHandler(async (req, res) => {
      const body = parse(AskSchema, req.body);
      res.json(scenarios.answerQuestion(body.question, body.year ?? DEFAULT_YEAR, body.lang));
    }),
  );

  router.post(
    '/ask-ai',
    rateLimit({ windowMs: 60_000, limit: limits.ai, standardHeaders: true, legacyHeaders: false, handler: tooMany }),
    asyncHandler(async (req, res) => {
      const body = parse(AskAiSchema, req.body);
      const year = scenarios.requireYear(body.year ?? DEFAULT_YEAR);
      const key = `${body.lang}|${year}|${body.question.toLowerCase()}`;
      res.json(await cached(key, () => ask(answerers, { question: body.question, year, lang: body.lang })));
    }),
  );

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

  return { router, answerers };
}

module.exports = { createFutureMap };
