'use strict';
/**
 * Business Opportunity Map API — mounted at /api/opportunity. Hanoi only, by ward/commune (2025).
 *
 *   GET  /types?lang=                       business types, their demand weights and data quality
 *   GET  /wards?type=&horizon=now|2030&lang= GeoJSON: every ward, scored for one type (or its top type)
 *   GET  /wards/:slug?horizon=&lang=        one ward: every type with its breakdown, facts, sources, links
 *   GET  /wards/:slug/places?type=          the businesses of a type mapped in that ward (competition on the map)
 *   GET  /compare?slugs=a,b[,c]&type=&horizon=&lang=
 *   POST /ask      { question, type?, ward?, horizon?, lang? } → answer from the data (Claude when configured)
 */
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { HttpError, asyncHandler, badRequest, errorBody, notFound, singleString } = require('../living-score/common/http');
const { createLogger } = require('../living-score/common/logger');
const M = require('./model');
const { createAnswerers, ask } = require('./ai');
const { LOCATIONS: COPILOT_LOCATIONS } = require('../business-copilot/data');

const logger = createLogger('OpportunityMap');
const LANGS = ['vi', 'en'];
const L = (text, lang) => (text && typeof text === 'object' ? (text[lang] ?? text.vi) : text);
const round1 = (n) => Math.round(n * 10) / 10;

const SOURCES = {
  osm: {
    title: `Dữ liệu OpenStreetMap: cửa hàng, dịch vụ, văn phòng, chung cư, trường học, công trường (${M.DATA.osmBase?.slice(0, 10) ?? '—'})`,
    titleEn: `OpenStreetMap data: shops, services, offices, apartments, schools, construction sites (${M.DATA.osmBase?.slice(0, 10) ?? '—'})`,
    publisher: 'OpenStreetMap contributors (ODbL)',
    url: 'https://www.openstreetmap.org/copyright',
  },
  population: {
    title: 'Ranh giới và dân số phường/xã mới (1/7/2025) — thẻ population trên OpenStreetMap, nguồn gis.vn',
    titleEn: 'Boundaries and population of the new wards/communes (01/07/2025) — OpenStreetMap population tag, source gis.vn',
    publisher: 'OpenStreetMap contributors / gis.vn',
    url: 'https://www.openstreetmap.org/relation/1903516',
  },
  metro: {
    title: 'Ga metro đang khai thác và đoạn ngầm tuyến 3 đang xây (mục tiêu 2027) — OpenStreetMap; tiến độ theo VIUP',
    titleEn: 'Metro stations in service and line 3 underground section under construction (due 2027) — OpenStreetMap; schedule per VIUP',
    publisher: 'OpenStreetMap contributors / VIUP',
    url: 'https://www.viup.vn/vn/Quy-hoach-he-thong-giao-thong-cong-cong-trong-do-thi-n211-Quy-hoach-he-thong-duong-sat-do-thi-gan-voi-phat-trien-do-thi-theo-mo-hinh-tod-trong-quy-hoach-chung-thu-do-ha-noi-den-nam-2045-tam-nhin-den-nam-2065-d29279.html',
  },
};
const sourceList = (ids, lang) => ids.map((id) => ({ id, title: lang === 'en' ? SOURCES[id].titleEn : SOURCES[id].title, publisher: SOURCES[id].publisher, url: SOURCES[id].url }));

const METHOD = {
  vi:
    'Nhu cầu = dân số và các tín hiệu nhu cầu (văn phòng, chung cư, trường học, ga metro) theo trọng số của từng ngành, so tương đối giữa các phường (100 = cao nhất). ' +
    'Cạnh tranh = số cơ sở cùng ngành trên 10.000 dân, so tương đối. Cơ hội = nhu cầu − 0,4 × cạnh tranh. ' +
    'Mốc 2030 cộng thêm tín hiệu tăng trưởng: công trình đang xây trong phường và tuyến metro đang thi công gần đó.',
  en:
    "Demand = population and demand signals (offices, apartment buildings, schools, metro stations) weighted per business type, relative between wards (100 = the highest). " +
    'Competition = businesses of the same type per 10,000 residents, relative. Opportunity = demand − 0.4 × competition. ' +
    'Horizon 2030 adds a growth signal: construction sites in the ward and metro being built nearby.',
};
const CAVEAT = {
  vi: 'OpenStreetMap do cộng đồng đóng góp và chưa ghi nhận đủ cửa hàng nhỏ, nên mức cạnh tranh có thể thấp hơn thực tế; hãy khảo sát thực địa trước khi quyết định. Điểm để so sánh giữa các phường, không phải dự báo doanh thu.',
  en: 'OpenStreetMap is volunteer-built and misses many small shops, so competition may be under-counted; survey the street before deciding. Scores compare wards; they are not revenue forecasts.',
};

function requireLang(value) {
  const lang = value ?? 'vi';
  if (!LANGS.includes(lang)) throw badRequest('lang phải là vi hoặc en.');
  return lang;
}
function requireHorizon(value) {
  const h = value ?? 'now';
  if (!M.HORIZONS.includes(h)) throw badRequest('horizon phải là now hoặc 2030.');
  return h;
}
function requireType(value, { optional = false } = {}) {
  if (value === undefined || value === '') {
    if (optional) return null;
    throw badRequest('Thiếu tham số type.');
  }
  if (!M.TYPE_KEYS.includes(value)) throw badRequest(`type phải thuộc: ${M.TYPE_KEYS.join(', ')}.`);
  return value;
}
function requireWard(slug) {
  const ward = M.WARD_BY_SLUG.get(slug);
  if (!ward) throw notFound(`Không tìm thấy phường/xã "${slug}".`);
  return ward;
}

function typeView(key, lang) {
  const t = M.TYPES[key];
  return {
    key,
    icon: t.icon,
    name: L(t.name, lang),
    description: L(t.desc, lang),
    weights: t.weights,
    mappedTotal: M.totals[key],
    sparse: M.totals[key] < M.SPARSE_TOTAL,
  };
}

const distanceKm = ([x1, y1], [x2, y2]) => Math.hypot((x2 - x1) * 111.32 * Math.cos((((y1 + y2) / 2) * Math.PI) / 180), (y2 - y1) * 110.574);
/** The Business Copilot district nearest to the ward (within 4 km), for "analyse in depth". */
function copilotFor(ward) {
  const best = COPILOT_LOCATIONS.map((l) => ({ l, d: distanceKm(l.center, ward.centroid) })).sort((a, b) => a.d - b.d)[0];
  return best && best.d <= 4 ? { slug: best.l.slug, name: best.l.name } : null;
}

function scoreView(s, lang) {
  return {
    type: s.type,
    icon: M.TYPES[s.type].icon,
    name: L(M.TYPES[s.type].name, lang),
    opportunity: s.opportunity,
    demand: s.demand,
    competition: s.competition,
    count: s.count,
    per10k: s.per10k,
    confidence: s.confidence,
    sparseType: s.sparseType,
    growth: s.growth,
    drivers: s.parts
      .filter((p) => p.weight > 0)
      .sort((a, b) => b.weight * b.value - a.weight * a.value)
      .map((p) => ({ signal: p.signal, label: M.SIGNAL_LABELS[lang][p.signal], weight: p.weight, value: p.value, points: round1(p.weight * p.value) })),
  };
}

function wardFacts(w) {
  return {
    population: w.population,
    populationDate: w.populationDate,
    areaKm2: w.areaKm2,
    counts: w.counts,
    metroStations: w.metroStations,
    metroBuildingKm: w.metroBuildingKm,
    constructionHa: w.constructionHa,
  };
}

const cache = new Map();
const cached = (key, build) => {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
};

function wardsGeoJson(type, horizon, lang) {
  return cached(`wards|${type}|${horizon}|${lang}`, () => {
    const ranking = type ? new Map(M.rankingFor(type, horizon).map((r, i) => [r.slug, { ...r, rank: i + 1 }])) : null;
    const features = M.DATA.wards.map((w) => {
      let props = { slug: w.slug, name: w.name, population: w.population, scored: M.isScored(w.slug), score: null, topType: null, rank: null, confidence: null };
      if (props.scored) {
        if (ranking) {
          const r = ranking.get(w.slug);
          props = { ...props, score: r.opportunity, rank: r.rank, confidence: r.confidence, count: r.count };
        } else {
          const top = M.scoresFor(w.slug, horizon)[0];
          props = { ...props, score: top.opportunity, topType: top.type, topIcon: M.TYPES[top.type].icon, topName: L(M.TYPES[top.type].name, lang), confidence: top.confidence };
        }
      }
      return { type: 'Feature', geometry: w.geometry, properties: { ...props, lng: w.centroid[0], lat: w.centroid[1] } };
    });
    return {
      type: 'FeatureCollection',
      features,
      meta: {
        type: type ? typeView(type, lang) : null,
        horizon,
        scoredWards: features.filter((f) => f.properties.scored).length,
        method: L(METHOD, lang),
        caveat: L(CAVEAT, lang),
        osmDate: M.DATA.osmBase,
        sources: sourceList(['osm', 'population', 'metro'], lang),
      },
    };
  });
}

function wardDetail(slug, horizon, lang) {
  return cached(`ward|${slug}|${horizon}|${lang}`, () => {
    const w = requireWard(slug);
    const scores = M.scoresFor(slug, horizon);
    return {
      slug: w.slug,
      name: w.name,
      osm: w.osm,
      centroid: w.centroid,
      horizon,
      scored: Boolean(scores),
      facts: wardFacts(w),
      coverage: M.coverageOf(slug),
      growth: M.growthOf(slug),
      opportunities: scores ? scores.map((s) => scoreView(s, lang)) : [],
      copilot: copilotFor(w),
      method: L(METHOD, lang),
      caveat: L(CAVEAT, lang),
      sources: sourceList(['osm', 'population', 'metro'], lang),
    };
  });
}

/**
 * @param options.answerers  { primary, fallback } (tests)
 * @param options.rateLimits { global, ai } per minute per client
 */
function createOpportunityMap(options = {}) {
  const limits = { global: 240, ai: 12, ...options.rateLimits };
  const answerers = options.answerers ?? createAnswerers();
  const tooMany = (req, res) => res.status(429).json({ statusCode: 429, error: 'Too Many Requests', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' });
  const router = express.Router();
  router.use(rateLimit({ windowMs: 60_000, limit: limits.global, standardHeaders: true, legacyHeaders: false, handler: tooMany }));
  router.use(express.json({ limit: '4kb' }));

  router.get('/types', (req, res) => {
    const lang = requireLang(singleString(req.query.lang, 'lang'));
    res.json({ types: M.TYPE_KEYS.map((k) => typeView(k, lang)), signals: M.SIGNAL_LABELS[lang], sparseBelow: M.SPARSE_TOTAL });
  });

  router.get('/wards', (req, res) => {
    const lang = requireLang(singleString(req.query.lang, 'lang'));
    const horizon = requireHorizon(singleString(req.query.horizon, 'horizon'));
    const type = requireType(singleString(req.query.type, 'type'), { optional: true });
    res.json(wardsGeoJson(type, horizon, lang));
  });

  router.get('/wards/:slug', (req, res) => {
    const lang = requireLang(singleString(req.query.lang, 'lang'));
    const horizon = requireHorizon(singleString(req.query.horizon, 'horizon'));
    res.json(wardDetail(req.params.slug, horizon, lang));
  });

  router.get('/wards/:slug/places', (req, res) => {
    const w = requireWard(req.params.slug);
    const type = requireType(singleString(req.query.type, 'type'));
    const wardIndex = M.DATA.wards.indexOf(w);
    const typeIndex = M.DATA.types.indexOf(type);
    const features = M.DATA.places
      .filter(([t, wi]) => t === typeIndex && wi === wardIndex)
      .map(([, , lng, lat, name]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { name, type } }));
    res.json({ type: 'FeatureCollection', features, meta: { ward: w.slug, type, source: SOURCES.osm.publisher } });
  });

  router.get('/compare', (req, res) => {
    const lang = requireLang(singleString(req.query.lang, 'lang'));
    const horizon = requireHorizon(singleString(req.query.horizon, 'horizon'));
    const type = requireType(singleString(req.query.type, 'type'), { optional: true });
    const slugs = [...new Set((singleString(req.query.slugs, 'slugs') ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
    if (slugs.length < 2 || slugs.length > 3) throw badRequest('Cần 2–3 phường/xã để so sánh (slugs=a,b[,c]).');
    const wards = slugs.map((slug) => wardDetail(slug, horizon, lang));
    res.json({
      horizon,
      type: type ? typeView(type, lang) : null,
      wards: wards.map((w) => ({
        slug: w.slug,
        name: w.name,
        scored: w.scored,
        facts: w.facts,
        coverage: w.coverage,
        focus: type ? (w.opportunities.find((o) => o.type === type) ?? null) : (w.opportunities[0] ?? null),
        top3: w.opportunities.filter((o) => !o.sparseType).slice(0, 3).map((o) => ({ type: o.type, icon: o.icon, name: o.name, opportunity: o.opportunity })),
      })),
      sources: sourceList(['osm', 'population', 'metro'], lang),
    });
  });

  const AskSchema = z.strictObject({
    question: z.string().trim().min(2).max(500),
    type: z.enum(M.TYPE_KEYS).optional(),
    ward: z.string().max(80).regex(/^[a-z0-9-]+$/).optional(),
    horizon: z.enum(M.HORIZONS).optional(),
    lang: z.enum(LANGS).optional(),
  });
  router.post(
    '/ask',
    rateLimit({ windowMs: 60_000, limit: limits.ai, standardHeaders: true, legacyHeaders: false, handler: tooMany }),
    asyncHandler(async (req, res) => {
      const parsed = AskSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(`Dữ liệu gửi lên không hợp lệ — ${parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')}`);
      const body = parsed.data;
      if (body.ward) requireWard(body.ward);
      res.json(await ask(answerers, { ...body, horizon: body.horizon ?? 'now', lang: body.lang ?? 'vi' }));
    }),
  );

  router.use((req, res, next) => next(new HttpError(404, `Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}.`)));
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    let error = err;
    if (err?.type === 'entity.parse.failed') error = badRequest('Body JSON không hợp lệ.');
    const { status, body } = errorBody(error, req);
    if (status >= 500) logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
    res.status(status).json(body);
  });

  return { router, answerers };
}

module.exports = { createOpportunityMap, wardDetail, wardsGeoJson, sourceList, SOURCES, METHOD, CAVEAT, typeView };
