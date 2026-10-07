'use strict';
/**
 * `npm run data:region` — driving times from central Hanoi to each Capital Region corridor, from the public OSRM
 * demo server (OpenStreetMap roads, free-flow: no traffic). One table request; writes
 * src/future-map/data/region-times.json, which the server only reads.
 */
const fs = require('node:fs');
const path = require('node:path');
const { ORIGIN, CORRIDORS } = require('../src/future-map/region');

const OUT_FILE = path.join(__dirname, '..', 'src', 'future-map', 'data', 'region-times.json');

async function main() {
  const points = [ORIGIN, ...CORRIDORS.map((c) => c.destination)].map((p) => p.join(',')).join(';');
  const url = `https://router.project-osrm.org/table/v1/driving/${points}?sources=0&annotations=duration,distance`;
  const res = await fetch(url, { headers: { 'user-agent': 'hanoi100-future-map/1.0 (region times)' }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`OSRM: HTTP ${res.status}`);
  const body = await res.json();
  if (body.code !== 'Ok') throw new Error(`OSRM: ${body.code}`);
  const times = Object.fromEntries(
    CORRIDORS.map((c, i) => [c.slug, { minutes: Math.round(body.durations[0][i + 1] / 60), km: Math.round(body.distances[0][i + 1] / 1000) }]),
  );
  fs.writeFileSync(OUT_FILE, `${JSON.stringify({ generatedAt: new Date().toISOString(), from: 'Hoàn Kiếm', times }, null, 1)}\n`);
  console.log('Wrote', path.relative(process.cwd(), OUT_FILE), times);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
