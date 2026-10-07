'use strict';
/**
 * `npm run data:opportunity` — the Business Opportunity Map dataset for Hanoi, from OpenStreetMap (Overpass):
 *
 *   - the new wards/communes (2025) of urban and peri-urban Hanoi: outline (simplified) and population
 *     (OSM tag `population`, dated 2025-07-01, source gis.vn);
 *   - per ward, counts of existing businesses for the 12 business types (the competition), and of the demand
 *     signals: schools, offices, apartment buildings;
 *   - construction sites (landuse=construction) — a signal of what the ward will look like in 3–5 years;
 *   - business places themselves (type, position, name) so the map can show the competition of one ward.
 *
 * Metro stations in service and track under construction come from the Living Score snapshot
 * (src/living-score/data/osm-hanoi.json); the Hanoi outline from src/future-map/data/provinces.json.
 * Writes src/opportunity/data/hanoi-wards.json. Data © OpenStreetMap contributors, ODbL.
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT_FILE = path.join(__dirname, '..', 'src', 'opportunity', 'data', 'hanoi-wards.json');
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
/** south, west, north, east — urban and peri-urban Hanoi. */
const BBOX = [20.85, 105.65, 21.25, 106.02];
const TOLERANCE_DEG = 0.0007;

/** The 12 business types: OSM selectors of the places that compete for the same customers. */
const BUSINESS = {
  cafe: ['["amenity"="cafe"]'],
  fnb: ['["amenity"~"^(restaurant|fast_food|food_court)$"]'],
  gym: ['["leisure"="fitness_centre"]'],
  education: ['["amenity"~"^(kindergarten|language_school|music_school|childcare)$"]'],
  convenience: ['["shop"~"^(convenience|supermarket)$"]'],
  beauty: ['["shop"~"^(beauty|hairdresser)$"]'],
  pharmacy: ['["amenity"~"^(pharmacy|clinic|doctors|dentist)$"]', '["shop"="chemist"]'],
  petshop: ['["shop"="pet"]', '["amenity"="veterinary"]'],
  realestate: ['["office"="estate_agent"]'],
  laundry: ['["shop"~"^(laundry|dry_cleaning)$"]'],
  bookstore: ['["shop"~"^(books|stationery)$"]'],
  carwash: ['["amenity"="car_wash"]', '["shop"~"^(car_repair|motorcycle_repair|tyres)$"]'],
};
const TYPE_KEYS = Object.keys(BUSINESS);
/** Demand signals counted per ward. */
const SIGNALS = {
  schools: ['["amenity"~"^(school|college|university)$"]'],
  offices: ['["office"]', '["building"="office"]'],
  apartments: ['["building"="apartments"]'],
};

/** Which business type (or signal) an OSM element is; the order of checks mirrors the selectors above. */
function classify(t) {
  const out = [];
  if (t.amenity === 'cafe') out.push('cafe');
  if (/^(restaurant|fast_food|food_court)$/.test(t.amenity ?? '')) out.push('fnb');
  if (t.leisure === 'fitness_centre') out.push('gym');
  if (/^(kindergarten|language_school|music_school|childcare)$/.test(t.amenity ?? '')) out.push('education');
  if (/^(convenience|supermarket)$/.test(t.shop ?? '')) out.push('convenience');
  if (/^(beauty|hairdresser)$/.test(t.shop ?? '')) out.push('beauty');
  if (/^(pharmacy|clinic|doctors|dentist)$/.test(t.amenity ?? '') || t.shop === 'chemist') out.push('pharmacy');
  if (t.shop === 'pet' || t.amenity === 'veterinary') out.push('petshop');
  if (t.office === 'estate_agent') out.push('realestate');
  if (/^(laundry|dry_cleaning)$/.test(t.shop ?? '')) out.push('laundry');
  if (/^(books|stationery)$/.test(t.shop ?? '')) out.push('bookstore');
  if (t.amenity === 'car_wash' || /^(car_repair|motorcycle_repair|tyres)$/.test(t.shop ?? '')) out.push('carwash');
  if (/^(school|college|university)$/.test(t.amenity ?? '')) out.push('schools');
  if (t.office || t.building === 'office') out.push('offices');
  if (t.building === 'apartments') out.push('apartments');
  return out;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function overpass(query) {
  let lastError;
  for (const [round, url] of [...ENDPOINTS.map((u) => [0, u]), ...ENDPOINTS.map((u) => [1, u])]) {
    if (round === 1) await pause(20_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'hanoi100-opportunity-map/1.0 (data snapshot)' },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(300_000),
      });
      const text = await res.text();
      if (!res.ok || !text.startsWith('{')) throw new Error(`${url}: HTTP ${res.status} ${text.slice(0, 60).replace(/\s+/g, ' ')}`);
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      console.warn(`Overpass failed (${error.message}); trying again.`);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------- geometry helpers
const key = ([x, y]) => `${x},${y}`;
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
function inRings([x, y], rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}
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
const r5 = (n) => Math.round(n * 1e5) / 1e5;
function simplifyRing(ring) {
  const half = Math.floor(ring.length / 2);
  const out = [...simplify(ring.slice(0, half + 1), TOLERANCE_DEG), ...simplify(ring.slice(half), TOLERANCE_DEG).slice(1)].map(([x, y]) => [r5(x), r5(y)]);
  return out.length >= 4 ? out : null;
}
/** Area in km² of a [lng, lat] ring (equirectangular). */
function ringAreaKm2(ring) {
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const kx = 111.32 * Math.cos(lat0);
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * kx * (ring[i + 1][1] * 110.574) - ring[i + 1][0] * kx * (ring[i][1] * 110.574);
  return Math.abs(sum) / 2;
}
const distanceKm = ([x1, y1], [x2, y2]) => Math.hypot((x2 - x1) * 111.32 * Math.cos((((y1 + y2) / 2) * Math.PI) / 180), (y2 - y1) * 110.574);
const slugify = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---------------------------------------------------------------- main
async function main() {
  const bbox = BBOX.join(',');
  const selectors = [...Object.values(BUSINESS), ...Object.values(SIGNALS)].flat();
  console.log('Downloading wards…');
  const wardsJson = await overpass(`[out:json][timeout:240];relation["boundary"="administrative"]["admin_level"="6"](${bbox});out geom;`);
  await pause(5_000);
  console.log('Downloading businesses and demand signals…');
  const poiJson = await overpass(`[out:json][timeout:280];(${selectors.map((s) => `nwr${s}(${bbox});`).join('')});out center tags;`);
  await pause(5_000);
  console.log('Downloading construction sites…');
  const buildJson = await overpass(`[out:json][timeout:240];(way["landuse"="construction"](${bbox});relation["landuse"="construction"](${bbox}););out geom;`);

  const hanoi = require('../src/future-map/data/provinces.json').features.find((f) => f.properties.slug === 'ha-noi');
  const hanoiRings = hanoi.geometry.coordinates.flat();
  const living = require('../src/living-score/data/osm-hanoi.json');
  const stations = living.pois.filter(([t]) => t === 'metro').map(([, lng, lat, name]) => ({ at: [lng, lat], name }));
  const building = (living.metroLines ?? []).filter((l) => l.status === 'under_construction').flatMap((l) => l.coords).flat();

  // Wards of Hanoi in the bounding box.
  const wards = [];
  for (const e of wardsJson.elements) {
    const members = (e.members ?? []).filter((m) => m.type === 'way' && m.geometry);
    const outer = assembleRings(members.filter((m) => m.role !== 'inner').map((m) => m.geometry));
    if (!outer.length || !e.tags?.name) continue;
    const all = outer.flat();
    const centroid = [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length];
    if (!inRings(centroid, hanoiRings)) continue; // a ward of Bắc Ninh or Hưng Yên
    const [s, w, n, east] = BBOX;
    if (centroid[1] < s || centroid[1] > n || centroid[0] < w || centroid[0] > east) continue;
    wards.push({
      name: e.tags.name,
      slug: slugify(e.tags.name),
      osm: `relation/${e.id}`,
      population: Number(e.tags.population) || null,
      populationDate: e.tags['population:date'] ?? null,
      populationSource: e.tags['source:population'] ?? e.tags.source ?? null,
      rings: outer,
      areaKm2: Math.round(outer.reduce((sum, r) => sum + ringAreaKm2(r), 0) * 100) / 100,
      centroid: [r5(centroid[0]), r5(centroid[1])],
      counts: Object.fromEntries([...TYPE_KEYS, ...Object.keys(SIGNALS)].map((k) => [k, 0])),
      constructionHa: 0,
      metroStations: [],
      metroBuildingKm: null,
    });
  }
  const wardAt = (point) => wards.find((w) => inRings(point, w.rings));

  // Businesses and signals per ward; business places kept for the map.
  const places = [];
  const seen = new Set();
  for (const e of poiJson.elements) {
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const lng = e.lon ?? e.center?.lon;
    const lat = e.lat ?? e.center?.lat;
    if (lng === undefined) continue;
    const kinds = classify(e.tags ?? {});
    if (!kinds.length) continue;
    const ward = wardAt([lng, lat]);
    if (!ward) continue;
    for (const k of kinds) ward.counts[k]++;
    const type = kinds.find((k) => TYPE_KEYS.includes(k));
    if (type) places.push([TYPE_KEYS.indexOf(type), wards.indexOf(ward), r5(lng), r5(lat), e.tags.name ?? null]);
  }

  // Construction sites (hectares) per ward, by the centre of each site.
  for (const e of buildJson.elements) {
    const rings = e.type === 'way' ? assembleRings([e.geometry ?? []]) : assembleRings((e.members ?? []).filter((m) => m.role !== 'inner' && m.geometry).map((m) => m.geometry));
    for (const ring of rings) {
      const c = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
      const ward = wardAt(c);
      if (ward) ward.constructionHa += ringAreaKm2(ring) * 100;
    }
  }

  // Metro: stations in service inside the ward, and the distance to track under construction.
  for (const ward of wards) {
    ward.metroStations = stations.filter((s) => inRings(s.at, ward.rings)).map((s) => s.name);
    const d = building.length ? Math.min(...building.map((p) => distanceKm(p, ward.centroid))) : null;
    ward.metroBuildingKm = d === null ? null : Math.round(d * 10) / 10;
    ward.constructionHa = Math.round(ward.constructionHa * 10) / 10;
  }

  const out = {
    source: 'OpenStreetMap contributors (ODbL)',
    osmBase: poiJson.osm3s?.timestamp_osm_base ?? null,
    generatedAt: new Date().toISOString(),
    bbox: BBOX,
    types: TYPE_KEYS,
    wards: wards.map(({ rings, ...w }) => ({
      ...w,
      geometry: { type: 'MultiPolygon', coordinates: rings.map(simplifyRing).filter(Boolean).map((r) => [r]) },
    })),
    /** [typeIndex, wardIndex, lng, lat, name] */
    places,
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(out)}\n`);
  const withPop = wards.filter((w) => w.population).length;
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}: ${wards.length} wards (${withPop} with population), ${places.length} business places, ${Math.round(fs.statSync(OUT_FILE).size / 1024)} KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
