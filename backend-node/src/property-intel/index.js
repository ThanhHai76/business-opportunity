'use strict';
/**
 * AI Property Intelligence API — mounted by server.js at /api/property-intel. Every GET takes `lang=vi|en` (vi).
 *
 *   GET  /overview                 hero stats, featured ward, data date, VND/USD rate, method
 *   GET  /wards                    the 79 wards/communes (2025) ranked by potential score
 *   GET  /wards/:slug              one ward: criteria with details, infrastructure nearby, poles, official land price,
 *                                  the city apartment market, projects nearby, links, sources
 *   GET  /projects                 apartment projects with a published price
 *   GET  /projects/:slug           project deep dive: published price, the ward's land price, surroundings (metro,
 *                                  schools, health, parks, infrastructure)
 *   GET  /map?horizon=2030         GeoJSON layers for one planning horizon (2026 | 2030 | 2045)
 *   GET  /search?q=gia             wards and projects matching a query
 *   POST /ask { question, intent?, ward?, project?, lang? }   answer from the data (Claude when configured)
 *
 * Every figure is cited: OpenStreetMap, gis.vn population, approved plans, the 2026 land price table, CBRE / Savills
 * market briefings and the press (model.js, market.js).
 */
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { HttpError, asyncHandler, badRequest, errorBody, singleString } = require('../living-score/common/http');
const { parseSlug } = require('../living-score/common/query-parsers');
const { createLogger } = require('../living-score/common/logger');
const M = require('./model');
const engine = require('./engine');
const analyst = require('./analyst');
const { buildLayers } = require('./map-layers');

const logger = createLogger('PropertyIntel');
const LANGS = ['vi', 'en'];
const slug = z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const AskSchema = z.strictObject({
  question: z.string().trim().min(2).max(500),
  intent: z.enum(analyst.INTENTS).optional(),
  ward: slug.optional(),
  project: slug.optional(),
  lang: z.enum(LANGS).optional(),
});

function langOf(req) {
  const lang = singleString(req.query.lang, 'lang') ?? 'vi';
  if (!LANGS.includes(lang)) throw badRequest('lang phải là vi hoặc en.');
  return lang;
}

function createPropertyIntel(options = {}) {
  const limits = { global: 240, ask: 30, ...options.rateLimits };
  const analysts = options.analysts ?? analyst.createAnalysts(options.config);
  const tooMany = (req, res, next) => next(new HttpError(429, 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'));
  const router = express.Router();
  router.use(helmet());
  router.use(rateLimit({ windowMs: 60_000, limit: limits.global, standardHeaders: true, legacyHeaders: false, handler: tooMany }));
  router.use(express.json({ limit: '4kb' }));

  // The layers only depend on static data: built once per horizon and language, on first use.
  const layerCache = new Map();
  const layersFor = (horizon, lang) => {
    const key = `${horizon}:${lang}`;
    if (!layerCache.has(key)) layerCache.set(key, buildLayers(horizon, lang));
    return layerCache.get(key);
  };

  router.get('/overview', (req, res) => {
    res.json(engine.overview(langOf(req)));
  });

  router.get('/wards', (req, res) => {
    langOf(req);
    res.json({ wards: engine.listWards() });
  });

  router.get('/wards/:slug', (req, res) => {
    res.json(engine.getWard(parseSlug(req.params.slug, 'Mã phường/xã'), langOf(req)));
  });

  router.get('/projects', (req, res) => {
    res.json({ projects: engine.listProjects(langOf(req)) });
  });

  router.get('/projects/:slug', (req, res) => {
    res.json(engine.getProject(parseSlug(req.params.slug, 'Mã dự án'), langOf(req)));
  });

  router.get('/map', (req, res) => {
    const lang = langOf(req);
    const raw = singleString(req.query.horizon, 'horizon') ?? '2030';
    const horizon = Number(raw);
    if (!M.HORIZONS.includes(horizon)) throw badRequest(`horizon phải là một trong ${M.HORIZONS.join(', ')}.`);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(layersFor(horizon, lang));
  });

  router.get('/search', (req, res) => {
    const q = singleString(req.query.q, 'q') ?? '';
    if (q.length > 80) throw badRequest('Từ khoá tìm kiếm tối đa 80 ký tự.');
    res.json(engine.search(q, langOf(req)));
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
      res.json(await analyst.ask(analysts, { ...parsed.data, lang: parsed.data.lang ?? 'vi' }));
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
