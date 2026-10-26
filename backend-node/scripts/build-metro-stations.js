'use strict';
/**
 * `npm run data:stations` — accurate coordinates of the metro stations, from OpenStreetMap (Overpass API).
 *
 * The Living Score snapshot says which stations exist (name, line, in service or under construction) but its coordinates
 * are up to 1 km off. For each of those stations, the OpenStreetMap subway station and stop nodes of the same name within
 * MAX_KM of the snapshot's point are averaged (a station is often mapped as a few nodes: building, platforms, entrances).
 * Writes src/metro/data/metro-stations.json. A station with no match is left out and keeps the snapshot's coordinates.
 */
const fs = require('node:fs');
const path = require('node:path');
const { SEED_STATIONS, distKm } = require('../src/metro/stations');

const OUT = path.join(__dirname, '..', 'src', 'metro', 'data', 'metro-stations.json');
const BBOX = '20.85,105.6,21.25,106.0';
const MAX_KM = 1.5;
const norm = (s) => s.normalize('NFC').replace(/^Ga\s+/i, '').trim().toLowerCase();

async function overpass(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'hanoicenturyvista-metro-stations/1.0' },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.warn(`Overpass failed (${error.message}); retrying.`);
      await new Promise((r) => setTimeout(r, 5_000 * (attempt + 1)));
    }
  }
  throw new Error('Overpass unavailable');
}

async function main() {
  const query = `[out:json][timeout:90];(node["railway"="station"]["station"="subway"](${BBOX});node["railway"="station"]["subway"="yes"](${BBOX});node["railway"="stop"]["subway"="yes"](${BBOX}););out body;`;
  const json = await overpass(query);
  const nodes = json.elements.map((e) => ({ name: norm(e.tags?.name ?? e.tags?.['name:vi'] ?? ''), at: [e.lon, e.lat] })).filter((n) => n.name);
  console.log(`${nodes.length} named subway nodes in the box.`);

  const stations = {};
  const missing = [];
  for (const s of SEED_STATIONS) {
    const near = nodes.filter((n) => n.name === norm(s.name) && distKm(n.at, s.coords) <= MAX_KM);
    if (!near.length) {
      missing.push(s.name);
      continue;
    }
    const lng = near.reduce((a, n) => a + n.at[0], 0) / near.length;
    const lat = near.reduce((a, n) => a + n.at[1], 0) / near.length;
    stations[s.name] = { coords: [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5], nodes: near.length };
  }
  const data = {
    source: 'OpenStreetMap contributors (ODbL), Overpass API',
    generatedAt: new Date().toISOString(),
    stations,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${Object.keys(stations).length} of ${SEED_STATIONS.length} stations matched.`);
  if (missing.length) console.log(`No OpenStreetMap node found for: ${missing.join(', ')} (they keep the snapshot's coordinates).`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
