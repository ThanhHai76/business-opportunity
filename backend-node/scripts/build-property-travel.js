'use strict';
/**
 * `npm run data:travel` — driving times for AI Property Intelligence, from the public OSRM demo server (routing on
 * OpenStreetMap roads, car profile, free-flow: no traffic). Writes src/property-intel/data/travel.json.
 *
 * From every ward centre and every project to:
 *   - three destinations: Hoàn Kiếm Lake (city centre), the Cầu Giấy – Duy Tân office cluster, Nội Bài airport;
 *   - every metro station in service (the nearest by road is kept).
 * A few table requests (≤ 100 coordinates each), well within the demo server's usage policy.
 */
const fs = require('node:fs');
const path = require('node:path');
const M = require('../src/property-intel/model');

const OUT = path.join(__dirname, '..', 'src', 'property-intel', 'data', 'travel.json');
const OSRM = 'https://router.project-osrm.org/table/v1/driving';
const UA = 'hanoi100-property-intel/1.0 (travel times)';

const DESTINATIONS = [
  { id: 'centre', name: { vi: 'Hồ Gươm', en: 'Hoàn Kiếm Lake' }, coords: [105.8522, 21.0287] },
  { id: 'offices', name: { vi: 'Khu văn phòng Cầu Giấy – Duy Tân', en: 'Cầu Giấy – Duy Tân office cluster' }, coords: [105.7835, 21.0306] },
  { id: 'airport', name: { vi: 'Sân bay Nội Bài', en: 'Nội Bài airport' }, coords: [105.8067, 21.2187] },
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function table(sources, destinations) {
  const coords = [...sources, ...destinations].map((c) => c.join(',')).join(';');
  const src = sources.map((_, i) => i).join(';');
  const dst = destinations.map((_, i) => sources.length + i).join(';');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${OSRM}/${coords}?sources=${src}&destinations=${dst}&annotations=duration,distance`, {
        headers: { 'user-agent': UA },
        signal: AbortSignal.timeout(90_000),
      });
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
  const stations = M.STATIONS.filter((s) => s.status === 'operating');
  const targets = [...DESTINATIONS.map((d) => d.coords), ...stations.map((s) => s.coords)];
  const origins = [
    ...M.WARDS.map((w) => ({ type: 'ward', slug: w.slug, coords: w.centroid })),
    ...M.PROJECTS.map((p) => ({ type: 'project', slug: p.slug, coords: p.coords })),
  ];
  const out = { wards: {}, projects: {} };
  const batch = 100 - targets.length;
  for (let i = 0; i < origins.length; i += batch) {
    const part = origins.slice(i, i + batch);
    const body = await table(part.map((o) => o.coords), targets);
    part.forEach((o, k) => {
      const minutes = body.durations[k].map((s) => (s === null ? null : Math.round(s / 60)));
      const km = body.distances[k].map((m) => (m === null ? null : Math.round(m / 100) / 10));
      const to = Object.fromEntries(DESTINATIONS.map((d, j) => [d.id, { minutes: minutes[j], km: km[j] }]));
      let best = null;
      stations.forEach((s, j) => {
        const m = minutes[DESTINATIONS.length + j];
        if (m !== null && (!best || m < best.minutes)) best = { station: s.name, line: s.line, minutes: m, km: km[DESTINATIONS.length + j] };
      });
      (o.type === 'ward' ? out.wards : out.projects)[o.slug] = { ...to, metro: best };
    });
    await pause(1_500);
  }
  const data = {
    source: 'OSRM (router.project-osrm.org) — đường bộ OpenStreetMap, ô tô, đường thông thoáng (chưa tính kẹt xe)',
    sourceEn: 'OSRM (router.project-osrm.org) — OpenStreetMap roads, car, free-flow (no traffic)',
    license: 'Dữ liệu © OpenStreetMap contributors (ODbL)',
    generatedAt: new Date().toISOString(),
    destinations: DESTINATIONS,
    ...out,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(data)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${Object.keys(out.wards).length} wards, ${Object.keys(out.projects).length} projects.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { DESTINATIONS };
