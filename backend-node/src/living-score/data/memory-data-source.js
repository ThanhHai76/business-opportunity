'use strict';
const { getSeedData } = require('../seed/seed-data');
const { DATA_SOURCE_LABEL } = require('./living.types');

/**
 * Read-side port of the domain (listAreas, listAmenities, searchAmenities, listInfrastructure,
 * listKnowledge, ping). Implemented by PostgreSQL/PostGIS and by this in-memory store over the
 * same OpenStreetMap-derived data, so services never care where the data lives.
 */
class MemoryDataSource {
  constructor(seed = getSeedData()) {
    this.kind = 'memory';
    this.areas = seed.areas.map((a, index) => ({
      id: index + 1,
      slug: a.slug,
      name: a.name,
      nameEn: a.nameEn,
      searchText: a.searchText,
      description: a.description,
      areaKm2: a.areaKm2,
      metrics: a.metrics,
      facts: a.facts,
      centroid: a.centroid,
      boundary: a.boundary,
      scores: a.scores,
      pros: a.pros,
      cons: a.cons,
      dataSource: DATA_SOURCE_LABEL,
    }));
    this.amenities = seed.amenities.map((m, index) => ({
      id: index + 1,
      areaSlug: m.areaSlug,
      type: m.type,
      name: m.name,
      lng: m.lng,
      lat: m.lat,
      searchText: m.searchText,
    }));
    this.infrastructure = seed.metro.map((item, index) => ({ id: index + 1, ...item }));
    const idBySlug = new Map(this.areas.map((a) => [a.slug, a.id]));
    this.knowledge = seed.knowledge.map((k, index) => ({
      id: index + 1,
      areaId: idBySlug.get(k.areaSlug) ?? 0,
      topic: k.topic,
      content: k.content,
    }));
  }

  async listAreas() {
    return this.areas;
  }

  async listAmenities(filter) {
    const { types, areaSlug, bbox } = filter;
    return this.amenities
      .filter((m) => !types || types.includes(m.type))
      .filter((m) => !areaSlug || m.areaSlug === areaSlug)
      .filter((m) => !bbox || (m.lng >= bbox.minLng && m.lng <= bbox.maxLng && m.lat >= bbox.minLat && m.lat <= bbox.maxLat))
      .map(({ searchText: _searchText, ...record }) => record);
  }

  /** `normalizedQuery` is already run through normalizeText(). */
  async searchAmenities(normalizedQuery, limit) {
    return this.amenities
      .filter((m) => m.searchText.includes(normalizedQuery))
      .slice(0, limit)
      .map(({ searchText: _searchText, ...record }) => record);
  }

  async listInfrastructure() {
    return this.infrastructure;
  }

  async listKnowledge(areaIds) {
    return this.knowledge.filter((k) => areaIds.includes(k.areaId));
  }

  async ping() {
    return true;
  }

  async close() {}
}

module.exports = { MemoryDataSource };
