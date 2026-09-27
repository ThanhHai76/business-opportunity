'use strict';
/**
 * AI Property Intelligence API — mounted by server.js at /api/property-intel.
 *
 *   GET  /overview                 hero stats, featured district, data date, VND/USD rate
 *   GET  /districts                every district ranked by growth score
 *   GET  /districts/:slug          full district intelligence (scores, charts, timeline, projects)
 *   GET  /projects                 every tracked project
 *   GET  /projects/:slug           project deep dive (valuation, history, proximity, nearby)
 *   GET  /map?horizon=2030         GeoJSON layers for one planning horizon (2026 | 2030 | 2045)
 *   GET  /search?q=gia             districts and projects matching a query
 *   POST /ask { question, intent?, district?, project? }   rule-based "Ask Property AI" answer
 *
 * All data is SAMPLE DATA (see data.js), not official market or planning data.
 */
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { HttpError, asyncHandler, badRequest, errorBody, singleString } = require('../living-score/common/http');
const { parseSlug } = require('../living-score/common/query-parsers');
const { createLogger } = require('../living-score/common/logger');
const data = require('./data');
const engine = require('./engine');
const analyst = require('./analyst');
const { buildLayers } = require('./map-layers');

const logger = createLogger('PropertyIntel');
const slug = z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const AskSchema = z.strictObject({
  question: z.string().trim().min(2).max(500),
  intent: z.enum(analyst.INTENTS).optional(),
  district: slug.optional(),
  project: slug.optional(),
});

function createPropertyIntel(options = {}) {
  const limits = { global: 240, ask: 30, ...options.rateLimits };
  const tooMany = (req, res, next) => next(new HttpError(429, 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'));
  const router = express.Router();
  router.use(helmet());
  router.use(rateLimit({ windowMs: 60_000, limit: limits.global, standardHeaders: true, legacyHeaders: false, handler: tooMany }));
  router.use(express.json({ limit: '4kb' }));

  // Built once per horizon: the layers only depend on static sample data.
  const layerCache = new Map(data.PLANNING_HORIZONS.map((h) => [h, buildLayers(h)]));

  router.get('/overview', (req, res) => {
    res.json(engine.overview());
  });

  router.get('/districts', (req, res) => {
    res.json({ sampleData: true, districts: engine.listDistricts() });
  });

  router.get('/districts/:slug', (req, res) => {
    res.json(engine.getDistrict(parseSlug(req.params.slug, 'Mã khu vực')));
  });

  router.get('/projects', (req, res) => {
    res.json({ sampleData: true, projects: engine.listProjects() });
  });

  router.get('/projects/:slug', (req, res) => {
    res.json(engine.getProject(parseSlug(req.params.slug, 'Mã dự án')));
  });

  router.get('/map', (req, res) => {
    const raw = singleString(req.query.horizon, 'horizon') ?? '2030';
    const horizon = Number(raw);
    if (!layerCache.has(horizon)) throw badRequest(`horizon phải là một trong ${data.PLANNING_HORIZONS.join(', ')}.`);
    res.json(layerCache.get(horizon));
  });

  router.get('/search', (req, res) => {
    const q = singleString(req.query.q, 'q') ?? '';
    if (q.length > 80) throw badRequest('Từ khoá tìm kiếm tối đa 80 ký tự.');
    res.json(engine.search(q));
  });

  router.post(
    '/ask',
    rateLimit({ windowMs: 60_000, limit: limits.ask, standardHeaders: true, legacyHeaders: false, handler: tooMany }),
    asyncHandler(async (req, res) => {
      const parsed = AskSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
        throw badRequest(`Dữ liệu gửi lên không hợp lệ — ${details}`);
      }
      res.json(analyst.answer(parsed.data));
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

module.exports = { createPropertyIntel };
