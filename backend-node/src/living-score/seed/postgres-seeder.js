'use strict';
const { createLogger } = require('../common/logger');
const { SAMPLE_DATA_LABEL } = require('../data/living.types');
const { CRITERION_KEYS } = require('../scoring/criteria');
const { getSeedData } = require('./seed-data');

const logger = createLogger('PostgresSeeder');

async function insertNotes(client, areaId, kind, notes) {
  for (const [position, text] of notes.entries()) {
    await client.query('INSERT INTO area_notes (area_id, kind, position, text) VALUES ($1, $2, $3, $4)', [areaId, kind, position, text]);
  }
}

/**
 * Loads the SAMPLE DATA into PostgreSQL/PostGIS inside a single transaction.
 * Returns false (and does nothing) when data already exists and `reset` is not set.
 */
async function seedPostgres(pool, options = {}, seed = getSeedData()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (options.reset) {
      await client.query('TRUNCATE area_knowledge, amenities, infrastructure, area_notes, area_scores, areas RESTART IDENTITY CASCADE');
    } else {
      const { rows } = await client.query('SELECT count(*)::int AS n FROM areas');
      if ((rows[0]?.n ?? 0) > 0) {
        await client.query('ROLLBACK');
        return false;
      }
    }

    const idBySlug = new Map();
    for (const area of seed.areas) {
      const inserted = await client.query(
        `INSERT INTO areas (slug, name, name_en, search_text, description, population, area_km2,
                            avg_rent_vnd, avg_price_per_m2_vnd, centroid, boundary, data_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                 ST_SetSRID(ST_MakePoint($10::float8, $11::float8), 4326),
                 ST_SetSRID(ST_GeomFromGeoJSON($12::text), 4326),
                 $13)
         RETURNING id`,
        [
          area.slug,
          area.name,
          area.nameEn,
          area.searchText,
          area.description,
          area.population,
          area.areaKm2,
          area.avgRentVnd,
          area.avgPricePerM2Vnd,
          area.centroid.lng,
          area.centroid.lat,
          JSON.stringify(area.boundary),
          SAMPLE_DATA_LABEL,
        ],
      );
      const areaId = inserted.rows[0].id;
      idBySlug.set(area.slug, areaId);

      for (const key of CRITERION_KEYS) {
        await client.query('INSERT INTO area_scores (area_id, criterion, score) VALUES ($1, $2, $3)', [areaId, key, area.scores[key]]);
      }
      await insertNotes(client, areaId, 'pro', area.pros);
      await insertNotes(client, areaId, 'con', area.cons);
    }

    for (const m of seed.amenities) {
      await client.query(
        `INSERT INTO amenities (area_id, type, name, search_text, rating, location)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6::float8, $7::float8), 4326))`,
        [idBySlug.get(m.areaSlug), m.type, m.name, m.searchText, m.rating, m.lng, m.lat],
      );
    }

    for (const item of seed.infrastructure) {
      await client.query(
        `INSERT INTO infrastructure (name, kind, status, geometry)
         VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4::text), 4326))`,
        [item.name, item.kind, item.status, JSON.stringify(item.geometry)],
      );
    }

    for (const k of seed.knowledge) {
      await client.query('INSERT INTO area_knowledge (area_id, topic, content) VALUES ($1, $2, $3)', [
        idBySlug.get(k.areaSlug),
        k.topic,
        k.content,
      ]);
    }

    await client.query('COMMIT');
    logger.log(
      `Seeded SAMPLE DATA: ${seed.areas.length} areas, ${seed.amenities.length} amenities, ${seed.infrastructure.length} infrastructure items.`,
    );
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { seedPostgres };
