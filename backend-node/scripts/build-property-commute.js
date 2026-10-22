'use strict';
/**
 * `npm run data:wardtimes` — driving times between every pair of wards/communes, for the career compass ("where can I work
 * within 45 minutes of home"). From the public OSRM demo server (routing on OpenStreetMap roads, car profile,
 * free-flow: no traffic). Writes src/property-intel/data/commute.json.
 *
 * One table request: the 79 ward centres are 79 coordinates, under the demo server's limit of 100 per request.
 */
const fs = require('node:fs');
const path = require('node:path');
const M = require('../src/property-intel/model');

const OUT = path.join(__dirname, '..', 'src', 'property-intel', 'data', 'commute.json');
const OSRM = 'https://router.project-osrm.org/table/v1/driving';
const UA = 'hanoicenturyvista-property-intel/1.0 (ward-to-ward travel times)';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function table(coords) {
  const url = `${OSRM}/${coords.map((c) => c.join(',')).join(';')}?annotations=duration`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(120_000) });
      const body = await res.json();
      if (body.code !== 'Ok') throw new Error(`${body.code} ${body.message ?? ''}`);
      return body;
    } catch (error) {
      console.warn(`OSRM failed (${error.message}); retrying.`);
      await pause(5_000 * (attempt + 1));
    }
  }
  throw new Error('OSRM unavailable');
}

async function main() {
  const wards = M.WARDS;
  if (wards.length > 100) throw new Error('More than 100 wards: split the request.');
  const body = await table(wards.map((w) => w.centroid));
  const minutes = body.durations.map((row) => row.map((s) => (s === null ? null : Math.round(s / 60))));
  const data = {
    source: 'OSRM (router.project-osrm.org) — đường bộ OpenStreetMap, ô tô, đường thông thoáng (chưa tính kẹt xe)',
    sourceEn: 'OSRM (router.project-osrm.org) — OpenStreetMap roads, car, free-flow (no traffic)',
    license: 'Dữ liệu © OpenStreetMap contributors (ODbL)',
    generatedAt: new Date().toISOString(),
    /** Row i, column j: minutes by car from the centre of ward slugs[i] to the centre of ward slugs[j] (null: no route). */
    slugs: wards.map((w) => w.slug),
    minutes,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(data)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${wards.length} × ${wards.length} wards.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
