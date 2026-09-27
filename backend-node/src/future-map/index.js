'use strict';
/**
 * Hanoi Future Map API — mounted by server.js at /api/future-map.
 *
 *   GET  /timeline                     the timeline years with headline stats, map centre
 *   GET  /scenario?year=2050           every map layer for one year (GeoJSON) + stats
 *   GET  /hubs/:slug?year=2050         one growth hub: scores, facts and scores across the years
 *   GET  /compare?years=2030,2050,2100 stats side by side + delta between the first and last year
 *   GET  /questions                    the preset questions
 *   POST /ask { question, year }       answers a preset question from the scenario data
 *
 * All data is illustrative SCENARIO DATA (see data.js), not an official plan.
 */
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { HttpError, asyncHandler, badRequest, errorBody, singleString } = require('../living-score/common/http');
const { parseSlug } = require('../living-score/common/query-parsers');
const { createLogger } = require('../living-score/common/logger');
const scenarios = require('./scenario');

const logger = createLogger('FutureMap');
const DEFAULT_YEAR = 2050;

const AskSchema = z.strictObject({
  question: z.enum(scenarios.QUESTION_IDS),
  year: z.number().int().optional(),
});

function createFutureMap(options = {}) {
  const limits = { global: 240, ...options.rateLimits };
  const router = express.Router();
  router.use(helmet());
  router.use(
    rateLimit({
      windowMs: 60_000,
      limit: limits.global,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res, next) => next(new HttpError(429, 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.')),
    }),
  );
  router.use(express.json({ limit: '4kb' }));

  const yearOf = (raw) => singleString(raw, 'year') ?? DEFAULT_YEAR;

  router.get('/timeline', (req, res) => {
    res.json(scenarios.getTimeline());
  });

  router.get('/scenario', (req, res) => {
    res.json(scenarios.getScenario(yearOf(req.query.year)));
  });

  router.get('/hubs/:slug', (req, res) => {
    res.json(scenarios.getHub(parseSlug(req.params.slug, 'Mã cực phát triển'), yearOf(req.query.year)));
  });

  router.get('/compare', (req, res) => {
    const raw = singleString(req.query.years, 'years');
    if (!raw) throw badRequest('Thiếu tham số years, ví dụ years=2030,2050,2100.');
    res.json(scenarios.compareYears(raw.split(',').map((s) => s.trim())));
  });

  router.get('/questions', (req, res) => {
    res.json({ questions: scenarios.QUESTIONS });
  });

  router.post(
    '/ask',
    asyncHandler(async (req, res) => {
      const parsed = AskSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
        throw badRequest(`Dữ liệu gửi lên không hợp lệ — ${details}`);
      }
      res.json(scenarios.answerQuestion(parsed.data.question, parsed.data.year ?? DEFAULT_YEAR));
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

  return { router };
}

module.exports = { createFutureMap };
