'use strict';
/**
 * AI Property Intelligence — infrastructure snapshot from OpenStreetMap.
 *
 *   npm run data:property   →   src/property-intel/data/infra-osm.json
 *
 * Downloads, for the Hanoi map area:
 *   - Ring Road 4 (Capital Region), under construction (ways named "… vành đai 4 …");
 *   - the Red River bridges under construction (Trần Hưng Đạo, Tứ Liên, Thượng Cát) and their approach roads;
 *   - construction sites (landuse=construction) of at least 2 ha.
 * Lines and outlines are simplified (Douglas–Peucker, ~15 m). The ward boundaries, metro and amenities come from
 * the other snapshots (data:opportunity, data:living); this script only adds what they do not have.
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'src', 'property-intel', 'data', 'infra-osm.json');
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const BBOX = '20.9,105.7,21.24,105.98';
const RING4_BBOX = '20.8,105.6,21.25,106.05';
const BRIDGES = [
  { id: 'bridge-tran-hung-dao', match: /Trần Hưng Đạo/ },
  { id: 'bridge-tu-lien', match: /Tứ Liên/ },
  { id: 'bridge-thuong-cat', match: /Thượng Cát/ },
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function overpass(query) {
  let lastError;
  for (const [round, url] of [...ENDPOINTS.map((u) => [0, u]), ...ENDPOINTS.map((u) => [1, u])]) {
    if (round === 1) await pause(20_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'hanoi100-property-intel/1.0 (data snapshot)' },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(240_000),
      });
      const text = await res.text();
      if (!res.ok || !text.startsWith('{')) throw new Error(`${url}: HTTP ${res.status} ${text.slice(0, 60).replace(/\s+/g, ' ')}`);
      return { json: JSON.parse(text), url };
    } catch (error) {
      lastError = error;
      console.warn(`Overpass failed (${error.message}); trying again.`);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------- geometry
const round5 = (n) => Math.round(n * 1e5) / 1e5;
const KM_LAT = 110.574;
const kmLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

function perpendicularKm(p, a, b) {
  const k = kmLng(p[1]);
  const [px, py, ax, ay, bx, by] = [p[0] * k, p[1] * KM_LAT, a[0] * k, a[1] * KM_LAT, b[0] * k, b[1] * KM_LAT];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function simplify(points, toleranceKm = 0.015) {
  if (points.length < 3) return points;
  let maxD = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularKm(points[i], points[0], points.at(-1));
    if (d > maxD) [maxD, index] = [d, i];
  }
  if (maxD <= toleranceKm) return [points[0], points.at(-1)];
  return [...simplify(points.slice(0, index + 1), toleranceKm).slice(0, -1), ...simplify(points.slice(index), toleranceKm)];
}

/** Joins ways that share end points into as few lines as possible. */
const key = ([x, y]) => `${x},${y}`;
function mergeLines(ways) {
  const pieces = ways.map((w) => w.map((p) => [round5(p.lon), round5(p.lat)])).filter((w) => w.length > 1);
  const lines = [];
  while (pieces.length) {
    let line = pieces.shift();
    for (let grown = true; grown; ) {
      grown = false;
      const head = key(line[0]);
      const tail = key(line.at(-1));
      const i = pieces.findIndex((p) => [key(p[0]), key(p.at(-1))].some((k) => k === head || k === tail));
      if (i < 0) break;
      const [p] = pieces.splice(i, 1);
      if (key(p[0]) === tail) line = line.concat(p.slice(1));
      else if (key(p.at(-1)) === tail) line = line.concat([...p].reverse().slice(1));
      else if (key(p.at(-1)) === head) line = p.concat(line.slice(1));
      else line = [...p].reverse().concat(line.slice(1));
      grown = true;
    }
    lines.push(simplify(line));
  }
  return lines;
}

function ringAreaHa(ring) {
  const lat0 = ring[0][1];
  const k = kmLng(lat0);
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * k * ring[i + 1][1] * KM_LAT - ring[i + 1][0] * k * ring[i][1] * KM_LAT;
  return (Math.abs(sum) / 2) * 100;
}
const lineKm = (line) => line.slice(1).reduce((s, p, i) => s + Math.hypot((p[0] - line[i][0]) * kmLng(p[1]), (p[1] - line[i][1]) * KM_LAT), 0);

// ---------------------------------------------------------------- main
async function main() {
  console.log('Downloading Ring Road 4…');
  const ring = await overpass(`[out:json][timeout:180];(way["highway"]["name"~"[Vv]ành [đĐ]ai 4"](${RING4_BBOX}););out geom;`);
  await pause(5_000);
  console.log('Downloading bridges under construction…');
  const bridges = await overpass(`[out:json][timeout:180];way["highway"]["name"~"Cầu (Trần Hưng Đạo|Tứ Liên|Thượng Cát)|Đường dẫn [Cc]ầu (Trần Hưng Đạo|Tứ Liên|Thượng Cát)"](${BBOX});out geom;`);
  await pause(5_000);
  console.log('Downloading construction sites…');
  const sites = await overpass(`[out:json][timeout:180];way["landuse"="construction"](${BBOX});out geom;`);

  const ringWays = ring.json.elements.filter((e) => e.type === 'way' && e.geometry);
  const ring4 = mergeLines(ringWays.map((w) => w.geometry)).filter((l) => lineKm(l) >= 0.3);

  const bridgeLines = BRIDGES.map((b) => {
    const ways = bridges.json.elements.filter((e) => e.type === 'way' && e.geometry && b.match.test(e.tags?.name ?? ''));
    const lines = mergeLines(ways.map((w) => w.geometry));
    return { id: b.id, osmName: ways.find((w) => /^Cầu/.test(w.tags.name))?.tags.name ?? null, highway: ways[0]?.tags.highway ?? null, lines };
  }).filter((b) => b.lines.length);

  const construction = sites.json.elements
    .filter((e) => e.type === 'way' && e.geometry && e.geometry.length >= 4)
    .map((e) => {
      const ringPts = simplify(e.geometry.map((p) => [round5(p.lon), round5(p.lat)]), 0.01);
      if (key(ringPts[0]) !== key(ringPts.at(-1))) ringPts.push(ringPts[0]);
      return { id: `way/${e.id}`, name: e.tags?.name ?? null, areaHa: Math.round(ringAreaHa(ringPts) * 10) / 10, ring: ringPts };
    })
    .filter((c) => c.ring.length >= 4 && c.areaHa >= 2)
    .sort((a, b) => b.areaHa - a.areaHa);

  const out = {
    source: 'OpenStreetMap contributors',
    license: 'ODbL 1.0 — https://www.openstreetmap.org/copyright',
    endpoint: sites.url,
    osmBase: sites.json.osm3s?.timestamp_osm_base ?? null,
    generatedAt: new Date().toISOString(),
    ring4: { lines: ring4, km: Math.round(ring4.reduce((s, l) => s + lineKm(l), 0) * 10) / 10 },
    bridges: bridgeLines,
    construction,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
  console.log(
    `Wrote ${path.relative(process.cwd(), OUT)}: Ring Road 4 ${out.ring4.km} km in ${ring4.length} pieces, ` +
      `${bridgeLines.map((b) => `${b.osmName} (${b.lines.length})`).join(', ')}, ${construction.length} construction sites ≥ 2 ha.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
