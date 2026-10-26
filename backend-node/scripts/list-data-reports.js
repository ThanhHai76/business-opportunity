'use strict';
/** `npm run reports:list [limit]` — prints the latest reports of wrong figures ("Báo sai số liệu") from the accounts database (DATABASE_URL). */
try {
  process.loadEnvFile(); // the .env of the server (Node >= 20.12); real environment variables win
} catch {
  /* no .env file */
}
const { Pool } = require('pg');
const { PostgresStore } = require('../src/accounts/postgres-store');

const limit = Math.min(500, Math.max(1, Number(process.argv[2]) || 30));

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL (the accounts database) first.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const rows = await new PostgresStore(pool).listDataReports(limit);
  for (const r of rows) {
    console.log(`${r.created_at.toISOString().slice(0, 16)}  ${r.status.padEnd(8)} ${r.kind} ${r.target}${r.target_name ? ` (${r.target_name})` : ''}${r.page ? ` [${r.page}]` : ''}`);
    console.log(`    ${r.message.replace(/\s+/g, ' ')}${r.contact ? `\n    liên hệ: ${r.contact}` : ''}`);
  }
  console.log(`${rows.length} report(s).`);
  await pool.end();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
