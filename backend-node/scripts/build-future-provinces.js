'use strict';
/**
 * `npm run data:provinces` — outlines of Hanoi and the six neighbouring provinces of the Capital Region (as after the
 * 2025 merger of provinces), from OpenStreetMap via Overpass. Rings are simplified (Douglas–Peucker, ~300 m) so the
 * file stays small; writes src/future-map/data/provinces.json, which the server only reads.
 *
 * Data © OpenStreetMap contributors, ODbL.
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT_FILE = path.join(__dirname, '..', 'src', 'future-map', 'data', 'provinces.json');
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
/** OSM relation of each unit (admin_level 4). `corridor` = the Capital Region direction it belongs to. */
const UNITS = [
  { slug: 'ha-noi', corridor: null, relation: 1903516 },
  { slug: 'thai-nguyen', corridor: 'thai-nguyen', relation: 1902967 },
  { slug: 'bac-ninh', corridor: 'bac-ninh', relation: 1902690 },
  { slug: 'hung-yen', corridor: 'hung-yen', relation: 1901032 },
  { slug: 'hai-phong', corridor: 'hai-phong', relation: 1902682 },
  { slug: 'ninh-binh', corridor: 'ninh-binh', relation: 1900963 },
  { slug: 'phu-tho', corridor: 'phu-tho', relation: 1902930 },
];
const TOLERANCE_DEG = 0.003;

async function overpass(query) {
  let lastError;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'hanoi100-future-map/1.0 (province outlines)' },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(300_000),
      });
      const text = await res.text();
      if (!res.ok || !text.startsWith('{')) throw new Error(`${url}: HTTP ${res.status}`);
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      console.warn(`Overpass failed (${error.message}); trying the next endpoint.`);
    }
  }
  throw lastError;
}

const key = ([x, y]) => `${x},${y}`;
/** Joins member ways into closed rings. */
function assembleRings(ways) {
  const pieces = ways.map((w) => w.map((p) => [p.lon, p.lat])).filter((w) => w.length > 1);
  const rings = [];
  while (pieces.length) {
    let ring = pieces.shift();
    for (let grown = true; key(ring[0]) !== key(ring.at(-1)) && grown; ) {
      grown = false;
      const end = key(ring.at(-1));
      const i = pieces.findIndex((p) => key(p[0]) === end || key(p.at(-1)) === end);
      if (i >= 0) {
        const [piece] = pieces.splice(i, 1);
        ring = ring.concat((key(piece[0]) === end ? piece : [...piece].reverse()).slice(1));
        grown = true;
      }
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring.at(-1))) rings.push(ring);
  }
  return rings;
}

/** Douglas–Peucker simplification of an open polyline. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points.at(-1);
  const len = Math.hypot(bx - ax, by - ay) || 1e-12;
  let max = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / len;
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= tolerance) return [points[0], points.at(-1)];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

const round4 = ([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4];
function simplifyRing(ring) {
  // Split a closed ring in two so the endpoints of the simplification are not the same point.
  const half = Math.floor(ring.length / 2);
  const a = simplify(ring.slice(0, half + 1), TOLERANCE_DEG);
  const b = simplify(ring.slice(half), TOLERANCE_DEG);
  const out = [...a, ...b.slice(1)].map(round4);
  return out.length >= 4 ? out : null;
}

function ringAreaDeg2(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(sum) / 2;
}

async function main() {
  const ids = UNITS.map((u) => u.relation).join(',');
  const json = await overpass(`[out:json][timeout:240];rel(id:${ids});out geom;`);
  const features = [];
  for (const unit of UNITS) {
    const rel = json.elements.find((e) => e.id === unit.relation);
    if (!rel) throw new Error(`relation ${unit.relation} (${unit.slug}) missing`);
    const members = (rel.members ?? []).filter((m) => m.type === 'way' && m.geometry);
    const outer = assembleRings(members.filter((m) => m.role !== 'inner').map((m) => m.geometry))
      .map(simplifyRing)
      .filter(Boolean)
      // Drop tiny islands: they add weight and nothing visible at region scale.
      .filter((ring) => ringAreaDeg2(ring) > 0.0004);
    if (!outer.length) throw new Error(`no outline for ${unit.slug}`);
    features.push({
      type: 'Feature',
      properties: { slug: unit.slug, corridor: unit.corridor, name: rel.tags.name, osm: `relation/${unit.relation}` },
      geometry: { type: 'MultiPolygon', coordinates: outer.map((ring) => [ring]) },
    });
    console.log(unit.slug, rel.tags.name, outer.length, 'ring(s),', outer.reduce((n, r) => n + r.length, 0), 'points');
  }
  const out = { source: 'OpenStreetMap contributors (ODbL)', osmBase: json.osm3s?.timestamp_osm_base ?? null, generatedAt: new Date().toISOString(), type: 'FeatureCollection', features };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(out)}\n`);
  console.log('Wrote', path.relative(process.cwd(), OUT_FILE), `${Math.round(fs.statSync(OUT_FILE).size / 1024)} KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
