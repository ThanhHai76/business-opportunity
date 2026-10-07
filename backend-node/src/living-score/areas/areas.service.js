'use strict';
const { notFound } = require('../common/http');
const { haversineKm } = require('../common/geo');
const { normalizeText } = require('../common/text');
const { AMENITY_TYPES } = require('../data/living.types');
const { MISSING_CRITERIA } = require('../scoring/criteria');
const { dataInfo } = require('../seed/seed-data');

const BOUNDARY_NOTE = {
  vi: 'Khu vực quanh trung tâm các quận cũ (trước sắp xếp năm 2025); ranh giới minh hoạ, không phải địa giới hành chính.',
  en: 'Areas around the centres of the former districts (before the 2025 reorganisation); illustrative shapes, not administrative boundaries.',
};

/** Picks one language out of a { vi, en } text (plain strings pass through). */
const pick = (text, lang) => (text && typeof text === 'object' ? (text[lang] ?? text.vi) : text);

class AreasService {
  /**
   * @param data    a data source (memory / postgres)
   * @param scoring ScoringService
   * @param cache   CacheService
   */
  constructor(data, scoring, cache) {
    this.data = data;
    this.scoring = scoring;
    this.cache = cache;
  }

  /** Raw area records (cached — they only change when the database is re-seeded). */
  getAllRecords() {
    return this.cache.wrap('areas:records', () => this.data.listAreas());
  }

  async getRecordOrThrow(slug) {
    const area = (await this.getAllRecords()).find((a) => a.slug === slug);
    if (!area) throw notFound(`Không tìm thấy khu vực "${slug}".`);
    return area;
  }

  /** Summary with the Living Score under the weights of this request (default or personalised). */
  toSummary(area, overrides) {
    const result = this.scoring.compute(area.scores, this.scoring.resolveWeights(overrides));
    return {
      slug: area.slug,
      name: area.name,
      nameEn: area.nameEn,
      livingScore: result.score,
      band: result.band,
      scores: area.scores,
      facts: area.facts,
      centroid: area.centroid,
      dataSource: area.dataSource,
    };
  }

  /** What each score was computed from, in one language. */
  localMetrics(area, lang) {
    return area.metrics.map((m) => ({ criterion: m.criterion, text: pick(m.text, lang) }));
  }

  /** @param options { q?: string, sort: 'score'|'name', weights?: PartialWeights, lang?: 'vi'|'en' } */
  async list(options) {
    const lang = options.lang ?? 'vi';
    const key = `areas:list:${lang}:${options.sort}:${normalizeText(options.q ?? '')}:${this.scoring.cacheKey(options.weights)}`;
    return this.cache.wrap(key, async () => {
      const query = normalizeText(options.q ?? '');
      const records = (await this.getAllRecords()).filter((a) => !query || (a.searchText ?? normalizeText(`${a.name} ${a.nameEn}`)).includes(query));
      const data = records.map((a) => this.toSummary(a, options.weights));
      // When searching, areas whose own name matches come before areas that only contain a matching ward.
      const byName = (a) => (query && !normalizeText(`${a.name} ${a.nameEn}`).includes(query) ? 1 : 0);
      data.sort((a, b) => {
        if (byName(a) !== byName(b)) return byName(a) - byName(b);
        if (options.sort === 'name') return a.name.localeCompare(b.name, 'vi');
        return b.livingScore - a.livingScore || a.name.localeCompare(b.name, 'vi');
      });
      return { data, meta: { total: data.length, isPersonalized: this.scoring.isPersonalized(options.weights), data: dataInfo(lang) } };
    });
  }

  /** Polygons coloured by Living Score (or one criterion), ready for the map. */
  async geojson(options) {
    const visual = options.visual ?? 'livingScore';
    const lang = options.lang ?? 'vi';
    const key = `areas:geojson:${lang}:${visual}:${this.scoring.cacheKey(options.weights)}`;
    return this.cache.wrap(key, async () => {
      const records = await this.getAllRecords();
      const features = records.map((area) => {
        const summary = this.toSummary(area, options.weights);
        const value = visual === 'livingScore' ? summary.livingScore : area.scores[visual];
        return {
          type: 'Feature',
          id: area.id,
          geometry: area.boundary,
          properties: {
            slug: area.slug,
            name: area.name,
            value,
            band: this.scoring.bandFor(value),
            visual,
            livingScore: summary.livingScore,
            lng: area.centroid.lng,
            lat: area.centroid.lat,
          },
        };
      });
      return {
        type: 'FeatureCollection',
        features,
        meta: {
          isPersonalized: this.scoring.isPersonalized(options.weights),
          visual,
          data: dataInfo(lang),
          boundaryNote: BOUNDARY_NOTE[lang],
        },
      };
    });
  }

  async detail(slug, overrides, lang = 'vi') {
    const key = `areas:detail:${lang}:${slug}:${this.scoring.cacheKey(overrides)}`;
    return this.cache.wrap(key, async () => {
      const area = await this.getRecordOrThrow(slug);
      const weights = this.scoring.resolveWeights(overrides);
      const result = this.scoring.compute(area.scores, weights);
      const defaultResult = this.scoring.compute(area.scores, this.scoring.getDefaultWeights());
      const info = dataInfo(lang);
      // Same circle as the scores, so the listed places and the counts agree.
      const nearby = (await this.data.listAmenities({})).filter((m) => haversineKm(area.centroid, m) <= info.walkKm);
      return {
        ...this.toSummary(area, overrides),
        description: pick(area.description, lang),
        areaKm2: area.areaKm2,
        metrics: this.localMetrics(area, lang),
        missingCriteria: MISSING_CRITERIA.map((c) => ({ key: c.key, label: lang === 'en' ? c.labelEn : c.label, labelEn: c.labelEn, reason: lang === 'en' ? c.reasonEn : c.reason })),
        dataInfo: info,
        defaultLivingScore: defaultResult.score,
        isPersonalized: this.scoring.isPersonalized(overrides),
        weights: this.scoring.normalizeWeights(weights),
        breakdown: result.breakdown,
        pros: area.pros.map((p) => pick(p, lang)),
        cons: area.cons.map((c) => pick(c, lang)),
        amenities: this.groupAmenities(nearby),
      };
    });
  }

  groupAmenities(amenities) {
    return AMENITY_TYPES.map((type) => {
      // OSM sometimes maps one place twice (e.g. a building and its entrance): each name counts once.
      const unique = [...new Map(amenities.filter((m) => m.type === type).map((m) => [normalizeText(m.name), m])).values()];
      const top = unique
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        .slice(0, 3)
        .map(({ name, lng, lat }) => ({ name, lng, lat }));
      return { type, count: unique.length, top };
    }).filter((group) => group.count > 0);
  }
}

module.exports = { AreasService, pick };
