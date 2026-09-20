'use strict';
/**
 * Hanoi Living Score API — mounted by server.js at /api/living-score.
 *
 *   const living = createLivingScore();
 *   app.use('/api/living-score', living.router);
 *   await living.init();   // seeds PostgreSQL when DATA_SOURCE=postgres
 *   ...
 *   await living.close();  // on shutdown
 *
 * All data is SAMPLE DATA (see seed/seed-data.js).
 */
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { loadConfig } = require('./config');
const { HttpError, asyncHandler, badRequest, errorBody, singleString } = require('./common/http');
const { createLogger } = require('./common/logger');
const {
  parseAmenityTypes,
  parseBbox,
  parseCriterion,
  parseSearchText,
  parseSlug,
  parseSlugList,
  parseSort,
  parseWeights,
} = require('./common/query-parsers');

const { CacheService } = require('./cache/cache.service');
const { MemoryDataSource } = require('./data/memory-data-source');
const { PostgresDataSource } = require('./data/postgres-data-source');
const { seedPostgres } = require('./seed/postgres-seeder');
const { CRITERIA, SCORE_BANDS } = require('./scoring/criteria');
const { ScoringService } = require('./scoring/scoring.service');
const { AreasService } = require('./areas/areas.service');
const { AmenitiesService } = require('./amenities/amenities.service');
const { InfrastructureService } = require('./infrastructure/infrastructure.service');
const { CompareService } = require('./compare/compare.service');
const { SearchService } = require('./search/search.service');
const { RecommendationEngine } = require('./recommendation/recommendation-engine');
const { KnowledgeService } = require('./recommendation/knowledge.service');
const { RecommendationService } = require('./recommendation/recommendation.service');
const { AnthropicNarrativeClient } = require('./recommendation/anthropic-narrative.client');

const logger = createLogger('LivingScore');

function createDataSource(config) {
  if (config.dataSource !== 'postgres') return { source: new MemoryDataSource(), pool: null };
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
  pool.on('error', (error) => logger.error(`Postgres idle client error: ${error.message}`));
  return { source: new PostgresDataSource(pool), pool };
}

const tooManyRequests = (req, res, next) => next(new HttpError(429, 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'));

/**
 * @param options.config     already-parsed settings (defaults to loadConfig() from process.env)
 * @param options.narrative  replaces the Anthropic client (tests)
 * @param options.rateLimits { global, recommendations } requests per minute per client (defaults 240 / 10)
 */
function createLivingScore(options = {}) {
  const config = options.config ?? loadConfig();
  const limits = { global: 240, recommendations: 10, ...options.rateLimits };
  const { source: data, pool } = createDataSource(config);
  const cache = new CacheService(config);
  const scoring = new ScoringService();
  const areas = new AreasService(data, scoring, cache);
  const amenities = new AmenitiesService(data, cache);
  const infrastructure = new InfrastructureService(data, cache);
  const compare = new CompareService(areas, scoring);
  const search = new SearchService(areas, data);
  const narrative = options.narrative ?? new AnthropicNarrativeClient(config);
  const recommendations = new RecommendationService(
    areas,
    new RecommendationEngine(scoring),
    new KnowledgeService(data),
    narrative,
    data,
    cache,
  );

  const router = express.Router();
  router.use(helmet());
  router.use(rateLimit({ windowMs: 60_000, limit: limits.global, standardHeaders: true, legacyHeaders: false, handler: tooManyRequests }));
  router.use(express.json({ limit: '16kb' }));

  router.get(
    '/health',
    asyncHandler(async (req, res) => {
      const reachable = await data.ping();
      res.json({
        status: reachable ? 'ok' : 'degraded',
        dataSource: { kind: data.kind, reachable },
        cache: cache.backend,
        ai: { enabled: narrative.enabled, model: narrative.enabled ? narrative.model : undefined },
        sampleData: true,
      });
    }),
  );

  // Criteria metadata + default weights + score bands, so clients never hard-code them.
  router.get('/scoring/criteria', (req, res) => {
    res.json({ criteria: CRITERIA, bands: SCORE_BANDS });
  });

  // GET /areas?q=cau&sort=score|name|rent&weights=transportation:30,cost:5
  router.get(
    '/areas',
    asyncHandler(async (req, res) => {
      const q = parseSearchText(req.query.q, { max: 60 });
      const sort = parseSort(req.query.sort);
      const weights = parseWeights(req.query.weights);
      res.json(await areas.list({ q, sort, weights }));
    }),
  );

  // GET /areas/geojson?criterion=transportation&weights=... — polygons coloured by score, ready for the map.
  router.get(
    '/areas/geojson',
    asyncHandler(async (req, res) => {
      const visual = parseCriterion(req.query.criterion);
      const weights = parseWeights(req.query.weights);
      res.json(await areas.geojson({ visual, weights }));
    }),
  );

  router.get(
    '/areas/:slug',
    asyncHandler(async (req, res) => {
      const slug = parseSlug(req.params.slug);
      const weights = parseWeights(req.query.weights);
      res.json(await areas.detail(slug, weights));
    }),
  );

  // GET /compare?slugs=cau-giay,tay-ho[,ba-dinh]&weights=... — 2 to 3 areas side by side.
  router.get(
    '/compare',
    asyncHandler(async (req, res) => {
      const slugs = parseSlugList(req.query.slugs, { min: 2, max: 3 });
      const weights = parseWeights(req.query.weights);
      res.json(await compare.compare(slugs, weights));
    }),
  );

  // GET /amenities?types=school,hospital&bbox=minLng,minLat,maxLng,maxLat&area=cau-giay
  router.get(
    '/amenities',
    asyncHandler(async (req, res) => {
      const types = parseAmenityTypes(req.query.types);
      const bbox = parseBbox(req.query.bbox);
      const area = singleString(req.query.area, 'area');
      const areaSlug = area === undefined ? undefined : parseSlug(area, 'Tham số area');
      res.json(await amenities.findAsGeoJson({ types, bbox, areaSlug }));
    }),
  );

  router.get(
    '/infrastructure',
    asyncHandler(async (req, res) => {
      res.json(await infrastructure.getGeoJson());
    }),
  );

  // GET /search?q=cau giay
  router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const q = parseSearchText(req.query.q, { max: 60, required: true });
      res.json(await search.search(q ?? ''));
    }),
  );

  // POST /recommendations — Top 3 areas for a person's budget, household, interests and priorities.
  router.post(
    '/recommendations',
    rateLimit({ windowMs: 60_000, limit: limits.recommendations, standardHeaders: true, legacyHeaders: false, handler: tooManyRequests }),
    asyncHandler(async (req, res) => {
      res.status(200).json(await recommendations.recommend(req.body));
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

  return {
    router,
    config,
    services: { scoring, areas, amenities, infrastructure, compare, search, recommendations, cache, data },

    /** Loads the SAMPLE DATA into PostgreSQL on first start (no-op for the in-memory source). */
    async init() {
      if (!pool || !config.autoSeed) return;
      try {
        const seeded = await seedPostgres(pool);
        if (!seeded) logger.log('Areas table already populated — skipping seed.');
      } catch (error) {
        logger.error(
          `Could not seed the database. Did you apply database/living-score/01-schema.sql first? (${error instanceof Error ? error.message : String(error)})`,
        );
        throw error;
      }
    },

    async close() {
      cache.close();
      await data.close();
    },
  };
}

module.exports = { createLivingScore };
