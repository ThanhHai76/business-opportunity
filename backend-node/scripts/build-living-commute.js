'use strict';
/**
 * `npm run data:commute` — road travel times between the Living Score areas, from the public OSRM demo server
 * (routing on OpenStreetMap roads, driving profile, free-flow: no traffic). Writes
 * src/living-score/data/commute.json; the server only reads that file.
 *
 * One table request for all area centres, so this stays well within the demo server's usage policy.
 */
const fs = require('node:fs');
const path = require('node:path');
const { AREA_DEFINITIONS } = require('../src/living-score/seed/seed-data');

const OUT_FILE = path.join(__dirname, '..', 'src', 'living-score', 'data', 'commute.json');
const OSRM = 'https://router.project-osrm.org/table/v1/driving';

async function main() {
  const coords = AREA_DEFINITIONS.map((a) => a.center.join(',')).join(';');
  const res = await fetch(`${OSRM}/${coords}?annotations=duration,distance`, {
    headers: { 'user-agent': 'hanoi100-living-score/1.0 (commute table)' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OSRM: HTTP ${res.status}`);
  const body = await res.json();
  if (body.code !== 'Ok') throw new Error(`OSRM: ${body.code} ${body.message ?? ''}`);
  const table = {
    source: 'OSRM (router.project-osrm.org) — đường bộ OpenStreetMap, hồ sơ ô tô, chưa tính kẹt xe',
    sourceEn: 'OSRM (router.project-osrm.org) — OpenStreetMap roads, driving profile, no traffic',
    license: 'Dữ liệu © OpenStreetMap contributors (ODbL)',
    generatedAt: new Date().toISOString(),
    slugs: AREA_DEFINITIONS.map((a) => a.slug),
    /** minutes[i][j]: from area i to area j */
    minutes: body.durations.map((row) => row.map((s) => (s === null ? null : Math.round(s / 60)))),
    km: body.distances.map((row) => row.map((m) => (m === null ? null : Math.round(m / 100) / 10))),
  };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(table, null, 1)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} for ${table.slugs.length} areas.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
