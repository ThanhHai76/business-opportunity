'use strict';
/**
 * No PostgreSQL is needed here: a recording fake pool checks the transaction flow of the seeder and
 * the SQL parameter binding of the data source. (SQL semantics still need a real PostGIS run.)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PostgresDataSource } = require('../../src/living-score/data/postgres-data-source');
const { seedPostgres } = require('../../src/living-score/seed/postgres-seeder');
const { getSeedData } = require('../../src/living-score/seed/seed-data');

function fakePool({ existingAreas = 0 } = {}) {
  const calls = [];
  let nextId = 0;
  const client = {
    released: false,
    async query(sql, params) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/SELECT count\(\*\)/.test(sql)) return { rows: [{ n: existingAreas }] };
      if (/INSERT INTO areas/.test(sql)) return { rows: [{ id: ++nextId }] };
      return { rows: [] };
    },
    release() {
      this.released = true;
    },
  };
  return { calls, client, connect: async () => client, query: async (sql, params) => client.query(sql, params) };
}

describe('seedPostgres', () => {
  const seed = getSeedData();

  it('loads all SAMPLE DATA inside one transaction', async () => {
    const pool = fakePool();
    assert.equal(await seedPostgres(pool), true);
    const sqls = pool.calls.map((c) => c.sql);
    assert.equal(sqls[0], 'BEGIN');
    assert.equal(sqls.at(-1), 'COMMIT');
    const count = (re) => sqls.filter((s) => re.test(s)).length;
    assert.equal(count(/^INSERT INTO areas/), seed.areas.length);
    assert.equal(count(/^INSERT INTO area_scores/), seed.areas.length * 8);
    assert.equal(count(/^INSERT INTO amenities/), seed.amenities.length);
    assert.equal(count(/^INSERT INTO infrastructure/), seed.infrastructure.length);
    assert.equal(count(/^INSERT INTO area_knowledge/), seed.knowledge.length);
    assert.equal(pool.client.released, true);
    const areaInsert = pool.calls.find((c) => /^INSERT INTO areas/.test(c.sql));
    assert.equal(areaInsert.params.length, 13);
    assert.equal(areaInsert.params.at(-1), 'SAMPLE DATA');
    assert.equal(JSON.parse(areaInsert.params[11]).type, 'Polygon');
  });

  it('does nothing when data already exists, unless reset is requested', async () => {
    const populated = fakePool({ existingAreas: 10 });
    assert.equal(await seedPostgres(populated), false);
    assert.deepEqual(populated.calls.map((c) => c.sql).slice(-1), ['ROLLBACK']);
    assert.ok(!populated.calls.some((c) => /^INSERT/.test(c.sql)));

    const reset = fakePool({ existingAreas: 10 });
    assert.equal(await seedPostgres(reset, { reset: true }), true);
    assert.ok(reset.calls.some((c) => /^TRUNCATE/.test(c.sql)));
  });

  it('rolls back and releases the client when an insert fails', async () => {
    const pool = fakePool();
    const original = pool.client.query.bind(pool.client);
    pool.client.query = async (sql, params) => {
      if (/INSERT INTO amenities/.test(sql)) throw new Error('boom');
      return original(sql, params);
    };
    await assert.rejects(() => seedPostgres(pool), /boom/);
    assert.equal(pool.calls.at(-1).sql, 'ROLLBACK');
    assert.equal(pool.client.released, true);
  });
});

describe('PostgresDataSource', () => {
  it('binds amenity filters as parameters (never string-concatenated)', async () => {
    const pool = fakePool();
    const source = new PostgresDataSource(pool);
    const hostile = "x'; DROP TABLE areas; --";
    await source.listAmenities({
      types: ['school', 'park'],
      areaSlug: hostile,
      bbox: { minLng: 105.7, minLat: 20.9, maxLng: 105.9, maxLat: 21.1 },
    });
    const { sql, params } = pool.calls[0];
    assert.ok(!sql.includes('DROP TABLE'));
    assert.deepEqual(params, [['school', 'park'], hostile, 105.7, 20.9, 105.9, 21.1]);
    assert.match(sql, /m\.type = ANY\(\$1::text\[\]\)/);
    assert.match(sql, /a\.slug = \$2/);
    assert.match(sql, /ST_MakeEnvelope\(\$3::float8, \$4::float8, \$5::float8, \$6::float8, 4326\)/);
  });

  it('reports an unreachable database through ping() instead of throwing', async () => {
    const source = new PostgresDataSource({ query: async () => Promise.reject(new Error('down')) });
    assert.equal(await source.ping(), false);
  });
});
