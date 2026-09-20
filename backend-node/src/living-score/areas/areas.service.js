'use strict';
const { notFound } = require('../common/http');
const { normalizeText } = require('../common/text');
const { AMENITY_TYPES } = require('../data/living.types');

const BOUNDARY_NOTE = 'Ranh giới minh hoạ, không phải ranh giới hành chính chính thức.';

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
      avgRentVnd: area.avgRentVnd,
      population: area.population,
      centroid: area.centroid,
      dataSource: area.dataSource,
    };
  }

  /** @param options { q?: string, sort: 'score'|'name'|'rent', weights?: PartialWeights } */
  async list(options) {
    const key = `areas:list:${options.sort}:${normalizeText(options.q ?? '')}:${this.scoring.cacheKey(options.weights)}`;
    return this.cache.wrap(key, async () => {
      const query = normalizeText(options.q ?? '');
      const records = (await this.getAllRecords()).filter((a) => !query || normalizeText(`${a.name} ${a.nameEn}`).includes(query));
      const data = records.map((a) => this.toSummary(a, options.weights));
      data.sort((a, b) => {
        if (options.sort === 'name') return a.name.localeCompare(b.name, 'vi');
        if (options.sort === 'rent') return a.avgRentVnd - b.avgRentVnd;
        return b.livingScore - a.livingScore || a.name.localeCompare(b.name, 'vi');
      });
      return { data, meta: { total: data.length, isPersonalized: this.scoring.isPersonalized(options.weights), sampleData: true } };
    });
  }

  /** Polygons coloured by Living Score (or one criterion), ready for the map. */
  async geojson(options) {
    const visual = options.visual ?? 'livingScore';
    const key = `areas:geojson:${visual}:${this.scoring.cacheKey(options.weights)}`;
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
            avgRentVnd: area.avgRentVnd,
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
          sampleData: true,
          boundaryNote: BOUNDARY_NOTE,
        },
      };
    });
  }

  async detail(slug, overrides) {
    const key = `areas:detail:${slug}:${this.scoring.cacheKey(overrides)}`;
    return this.cache.wrap(key, async () => {
      const area = await this.getRecordOrThrow(slug);
      const weights = this.scoring.resolveWeights(overrides);
      const result = this.scoring.compute(area.scores, weights);
      const defaultResult = this.scoring.compute(area.scores, this.scoring.getDefaultWeights());
      const amenities = await this.data.listAmenities({ areaSlug: slug });
      return {
        ...this.toSummary(area, overrides),
        description: area.description,
        areaKm2: area.areaKm2,
        populationDensity: Math.round(area.population / area.areaKm2),
        avgPricePerM2Vnd: area.avgPricePerM2Vnd,
        defaultLivingScore: defaultResult.score,
        isPersonalized: this.scoring.isPersonalized(overrides),
        weights: this.scoring.normalizeWeights(weights),
        breakdown: result.breakdown,
        pros: area.pros,
        cons: area.cons,
        amenities: this.groupAmenities(amenities),
      };
    });
  }

  groupAmenities(amenities) {
    return AMENITY_TYPES.map((type) => {
      const ofType = amenities.filter((m) => m.type === type);
      const top = [...ofType]
        .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, 'vi'))
        .slice(0, 3)
        .map(({ name, rating, lng, lat }) => ({ name, rating, lng, lat }));
      return { type, count: ofType.length, top };
    }).filter((group) => group.count > 0);
  }
}

module.exports = { AreasService };
