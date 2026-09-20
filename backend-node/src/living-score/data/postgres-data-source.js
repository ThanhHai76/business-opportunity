'use strict';
const { createLogger } = require('../common/logger');

const logger = createLogger('PostgresDataSource');

const AREAS_SQL = `
  SELECT a.id, a.slug, a.name, a.name_en, a.description, a.population,
         a.area_km2::float8 AS area_km2, a.avg_rent_vnd, a.avg_price_per_m2_vnd,
         ST_X(a.centroid) AS lng, ST_Y(a.centroid) AS lat,
         ST_AsGeoJSON(a.boundary, 6)::json AS boundary,
         a.data_source,
         COALESCE((SELECT json_object_agg(s.criterion, s.score) FROM area_scores s WHERE s.area_id = a.id), '{}'::json) AS scores,
         COALESCE((SELECT json_agg(n.text ORDER BY n.position, n.id) FROM area_notes n WHERE n.area_id = a.id AND n.kind = 'pro'), '[]'::json) AS pros,
         COALESCE((SELECT json_agg(n.text ORDER BY n.position, n.id) FROM area_notes n WHERE n.area_id = a.id AND n.kind = 'con'), '[]'::json) AS cons
  FROM areas a
  ORDER BY a.name`;

const AMENITY_SELECT = `
  SELECT m.id, a.slug AS area_slug, m.type, m.name, m.rating::float8 AS rating,
         ST_X(m.location) AS lng, ST_Y(m.location) AS lat
  FROM amenities m
  JOIN areas a ON a.id = m.area_id`;

function toAmenity(r) {
  return { id: r.id, areaSlug: r.area_slug, type: r.type, name: r.name, rating: r.rating, lng: r.lng, lat: r.lat };
}

/** PostgreSQL + PostGIS implementation. Geometry is read back as GeoJSON via ST_AsGeoJSON. */
class PostgresDataSource {
  /** @param pool a `pg` Pool */
  constructor(pool) {
    this.kind = 'postgres';
    this.pool = pool;
  }

  async close() {
    await this.pool.end();
  }

  async listAreas() {
    const { rows } = await this.pool.query(AREAS_SQL);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      nameEn: r.name_en,
      description: r.description,
      population: r.population,
      areaKm2: r.area_km2,
      avgRentVnd: r.avg_rent_vnd,
      avgPricePerM2Vnd: r.avg_price_per_m2_vnd,
      centroid: { lng: r.lng, lat: r.lat },
      boundary: r.boundary,
      scores: r.scores,
      pros: r.pros,
      cons: r.cons,
      dataSource: r.data_source,
    }));
  }

  async listAmenities(filter) {
    const conditions = [];
    const params = [];
    const bind = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (filter.types?.length) conditions.push(`m.type = ANY(${bind(filter.types)}::text[])`);
    if (filter.areaSlug) conditions.push(`a.slug = ${bind(filter.areaSlug)}`);
    if (filter.bbox) {
      const { minLng, minLat, maxLng, maxLat } = filter.bbox;
      conditions.push(
        `m.location && ST_MakeEnvelope(${bind(minLng)}::float8, ${bind(minLat)}::float8, ${bind(maxLng)}::float8, ${bind(maxLat)}::float8, 4326)`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(`${AMENITY_SELECT} ${where} ORDER BY m.id`, params);
    return rows.map(toAmenity);
  }

  async searchAmenities(normalizedQuery, limit) {
    const { rows } = await this.pool.query(`${AMENITY_SELECT} WHERE m.search_text LIKE $1 ORDER BY m.id LIMIT $2`, [
      `%${normalizedQuery}%`,
      limit,
    ]);
    return rows.map(toAmenity);
  }

  async listInfrastructure() {
    const { rows } = await this.pool.query(
      `SELECT id, name, kind, status, ST_AsGeoJSON(geometry, 6)::json AS geometry FROM infrastructure ORDER BY id`,
    );
    return rows;
  }

  async listKnowledge(areaIds) {
    if (areaIds.length === 0) return [];
    const { rows } = await this.pool.query(
      `SELECT id, area_id, topic, content FROM area_knowledge WHERE area_id = ANY($1::int[]) ORDER BY id`,
      [areaIds],
    );
    return rows.map((r) => ({ id: r.id, areaId: r.area_id, topic: r.topic, content: r.content }));
  }

  async ping() {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      logger.warn(`Database ping failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

module.exports = { PostgresDataSource };
