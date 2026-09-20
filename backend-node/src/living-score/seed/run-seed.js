'use strict';
/**
 * `npm run seed:living` — inserts the Living Score SAMPLE DATA into PostgreSQL/PostGIS.
 * Set SEED_RESET=true to wipe and reload. Apply database/living-score/01-schema.sql first.
 */
const { loadConfig } = require('../config');
const { seedPostgres } = require('./postgres-seeder');

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file — rely on the real environment
  }
  const config = loadConfig();
  if (config.dataSource !== 'postgres') {
    console.log('DATA_SOURCE is not "postgres" — nothing to seed.');
    return;
  }
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    const seeded = await seedPostgres(pool, { reset: process.env.SEED_RESET === 'true' });
    console.log(seeded ? 'Seed complete.' : 'Areas table already populated — use SEED_RESET=true to reload.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
