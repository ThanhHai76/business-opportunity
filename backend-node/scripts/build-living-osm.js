'use strict';
/**
 * `npm run data:living` — downloads the places the Living Score is computed from (schools, health care, shops,
 * cafés, parks, lakes, metro lines and stations, bus stops, and the new wards/communes of 2025) from OpenStreetMap
 * via the Overpass API, and writes a compact
 * snapshot to src/living-score/data/osm-hanoi.json. The server only reads that file, never Overpass.
 *
 * Parks and lakes are stored twice: as named points (for the map) and as a coverage raster of about 100 m cells
 * (for "how much of the area around here is park / water"), which is far smaller than the polygons themselves.
 *
 * Data © OpenStreetMap contributors, available under the Open Database License (ODbL).
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT_FILE = path.join(__dirname, '..', 'src', 'living-score', 'data', 'osm-hanoi.json');
/** The main instance first: mirrors can lag weeks behind. */
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
/** south, west, north, east — covers every Living Score area. */
const BBOX = [20.9, 105.7, 21.24, 105.98];
/** Raster cell size in degrees (≈ 111 m north-south, ≈ 104 m east-west in Hanoi). */
const CELL_DEG = 0.001;
/** Water that is not somewhere to walk around: rivers, canals, drains and treatment basins. */
const EXCLUDED_WATER = /^(river|canal|ditch|drain|stream|wastewater|lock|moat)$/;

/** [output type, Overpass selector]. Order matters: the first match wins for an element. */
const TYPES = [
  ['university', '["amenity"="university"]'],
  ['college', '["amenity"="college"]'],
  ['school', '["amenity"="school"]'],
  ['kindergarten', '["amenity"="kindergarten"]'],
  ['hospital', '["amenity"="hospital"]'],
  ['clinic', '["amenity"~"^(clinic|doctors)$"]'],
  ['mall', '["shop"="mall"]'],
  ['supermarket', '["shop"="supermarket"]'],
  ['convenience', '["shop"="convenience"]'],
  ['marketplace', '["amenity"="marketplace"]'],
  ['cafe', '["amenity"="cafe"]'],
  ['metro', '["railway"="station"]["station"~"^(subway|light_rail)$"]'],
  ['bus', '["highway"="bus_stop"]'],
];

function typeOf(tags) {
  if (tags.amenity === 'university') return 'university';
  if (tags.amenity === 'college') return 'college';
  if (tags.amenity === 'school') return 'school';
  if (tags.amenity === 'kindergarten') return 'kindergarten';
  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.amenity === 'clinic' || tags.amenity === 'doctors') return 'clinic';
  if (tags.shop === 'mall') return 'mall';
  if (tags.shop === 'supermarket') return 'supermarket';
  if (tags.shop === 'convenience') return 'convenience';
  if (tags.amenity === 'marketplace') return 'marketplace';
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.railway === 'station') return 'metro';
  if (tags.highway === 'bus_stop') return 'bus';
  return null;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tries each endpoint in turn, with one polite retry round (Overpass rate-limits bursts of large queries). */
async function overpass(query) {
  let lastError;
  for (const [round, url] of [...ENDPOINTS.map((u) => [0, u]), ...ENDPOINTS.map((u) => [1, u])]) {
    if (round === 1) await pause(20_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'hanoi100-living-score/1.0 (data snapshot)' },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(300_000),
      });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const text = await res.text();
      // Overpass reports timeouts and rate limits as an XML/HTML page with status 200.
      if (!text.startsWith('{')) throw new Error(`${url}: not JSON (${text.slice(0, 60).replace(/\s+/g, ' ')}…)`);
      return { json: JSON.parse(text), endpoint: url };
    } catch (error) {
      lastError = error;
      console.warn(`Overpass endpoint failed (${error.message}); trying the next one.`);
    }
  }
  throw lastError;
}

/** Code names OSM uses for planned (not built) metro stations. */
const PLANNED_STATION = /^S\d+[A-Z]?\.\d+$/;

const round5 = (n) => Math.round(n * 1e5) / 1e5;

/** Area in m² of a [lng, lat] ring (equirectangular projection — fine at the scale of a park). */
function ringAreaM2(ring) {
  if (ring.length < 4) return 0;
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const kx = 111_320 * Math.cos(lat0);
  const ky = 110_574;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * kx * (ring[i + 1][1] * ky) - ring[i + 1][0] * kx * (ring[i][1] * ky);
  }
  return Math.abs(sum) / 2;
}

const pointKey = ([lng, lat]) => `${lng},${lat}`;

/** Joins ways into closed rings (a multipolygon ring is often split over several ways). Open pieces are dropped. */
function assembleRings(ways) {
  const pieces = ways.map((w) => w.map((p) => [p.lon, p.lat])).filter((w) => w.length > 1);
  const rings = [];
  while (pieces.length) {
    let ring = pieces.shift();
    let grown = true;
    while (pointKey(ring[0]) !== pointKey(ring.at(-1)) && grown) {
      grown = false;
      const end = pointKey(ring.at(-1));
      const i = pieces.findIndex((p) => pointKey(p[0]) === end || pointKey(p.at(-1)) === end);
      if (i >= 0) {
        const [piece] = pieces.splice(i, 1);
        ring = ring.concat((pointKey(piece[0]) === end ? piece : [...piece].reverse()).slice(1));
        grown = true;
      }
    }
    if (ring.length >= 4 && pointKey(ring[0]) === pointKey(ring.at(-1))) rings.push(ring);
  }
  return rings;
}

/** { outer, inner } closed rings of an Overpass way/relation returned with `out geom`. */
function ringsOf(e) {
  if (e.type === 'way' && e.geometry) return { outer: assembleRings([e.geometry]), inner: [] };
  if (e.type !== 'relation') return { outer: [], inner: [] };
  const members = (e.members ?? []).filter((m) => m.geometry);
  return {
    outer: assembleRings(members.filter((m) => m.role !== 'inner').map((m) => m.geometry)),
    inner: assembleRings(members.filter((m) => m.role === 'inner').map((m) => m.geometry)),
  };
}

/** Even-odd point-in-polygon over all rings, so inner rings (islands) are holes. */
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

/** Row/column window of the raster covered by a shape's bounding box. */
function cellWindow(rings) {
  const [south, west] = BBOX;
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);
  const { rows, cols } = gridSize();
  return {
    r0: Math.max(0, Math.floor((Math.min(...ys) - south) / CELL_DEG)),
    r1: Math.min(rows - 1, Math.floor((Math.max(...ys) - south) / CELL_DEG)),
    c0: Math.max(0, Math.floor((Math.min(...xs) - west) / CELL_DEG)),
    c1: Math.min(cols - 1, Math.floor((Math.max(...xs) - west) / CELL_DEG)),
  };
}
function gridSize() {
  const [south, west, north, east] = BBOX;
  return { rows: Math.round((north - south) / CELL_DEG), cols: Math.round((east - west) / CELL_DEG) };
}
const cellCentre = (r, c) => [BBOX[1] + (c + 0.5) * CELL_DEG, BBOX[0] + (r + 0.5) * CELL_DEG];

/**
 * Index raster: each cell holds 1 + the index of the shape covering its centre (0 = none), one byte per cell,
 * base64. Used for wards, so an area can say which new wards it overlaps and by how much.
 */
function rasteriseIndex(shapes) {
  const { rows, cols } = gridSize();
  const cells = new Uint8Array(rows * cols);
  shapes.forEach((rings, index) => {
    const { r0, r1, c0, c1 } = cellWindow(rings);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) if (inRings(cellCentre(r, c), rings)) cells[r * cols + c] = index + 1;
    }
  });
  return { rows, cols, cells: Buffer.from(cells).toString('base64') };
}

/** Marks every raster cell whose centre lies inside one of the shapes. Returns a base64 bitset (row-major, from the south-west). */
function rasterise(shapes) {
  const [south, west, north, east] = BBOX;
  const rows = Math.round((north - south) / CELL_DEG);
  const cols = Math.round((east - west) / CELL_DEG);
  const bits = new Uint8Array(Math.ceil((rows * cols) / 8));
  for (const rings of shapes) {
    const xs = rings.flat().map((p) => p[0]);
    const ys = rings.flat().map((p) => p[1]);
    const r0 = Math.max(0, Math.floor((Math.min(...ys) - south) / CELL_DEG));
    const r1 = Math.min(rows - 1, Math.floor((Math.max(...ys) - south) / CELL_DEG));
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - west) / CELL_DEG));
    const c1 = Math.min(cols - 1, Math.floor((Math.max(...xs) - west) / CELL_DEG));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (inRings([west + (c + 0.5) * CELL_DEG, south + (r + 0.5) * CELL_DEG], rings)) {
          const i = r * cols + c;
          bits[i >> 3] |= 1 << (i & 7);
        }
      }
    }
  }
  return { rows, cols, bits: Buffer.from(bits).toString('base64') };
}

/** Ring lists for the raster, plus [lng, lat, areaM2, name] (centroid of the outline) for each usable element. */
function shapesOf(elements) {
  const shapes = [];
  const points = [];
  for (const e of elements) {
    const { outer, inner } = ringsOf(e);
    const areaM2 = outer.reduce((s, r) => s + ringAreaM2(r), 0) - inner.reduce((s, r) => s + ringAreaM2(r), 0);
    if (!outer.length || areaM2 <= 0) continue;
    shapes.push([...outer, ...inner]);
    const all = outer.flat();
    const lng = all.reduce((s, p) => s + p[0], 0) / all.length;
    const lat = all.reduce((s, p) => s + p[1], 0) / all.length;
    points.push([round5(lng), round5(lat), Math.round(areaM2), e.tags?.name ?? null]);
  }
  return { shapes, points };
}

const round5pair = ([lng, lat]) => [round5(lng), round5(lat)];

/**
 * Metro lines from the Overpass result: one route relation per operating line (the other direction is the same
 * track), and the ways tagged as under construction. Depot branches are dropped.
 */
function metroLinesOf(elements) {
  const lines = [];
  const seenRefs = new Set();
  for (const e of elements) {
    if (e.type === 'relation') {
      const ref = e.tags?.ref;
      if (!ref || seenRefs.has(ref)) continue;
      const ways = (e.members ?? []).filter((m) => m.type === 'way' && m.geometry && !/platform/.test(m.role ?? ''));
      if (!ways.length) continue;
      seenRefs.add(ref);
      const name = (e.tags.name ?? ref).replace(/\s*:.*$/, '');
      lines.push({ ref, name, status: 'operating', coords: ways.map((w) => w.geometry.map((p) => round5pair([p.lon, p.lat]))) });
    }
  }
  const building = elements.filter((e) => e.type === 'way' && e.tags?.railway === 'construction' && e.geometry && !/depot/i.test(e.tags?.name ?? ''));
  if (building.length) {
    lines.push({
      ref: 'construction',
      name: 'Đoạn đang xây dựng',
      status: 'under_construction',
      coords: building.map((w) => w.geometry.map((p) => round5pair([p.lon, p.lat]))),
    });
  }
  return lines;
}

async function main() {
  const bbox = BBOX.join(',');
  const pointsQuery = `[out:json][timeout:240];(${TYPES.map(([, sel]) => `nwr${sel}(${bbox});`).join('')});out center tags;`;
  const parksQuery = `[out:json][timeout:240];(way["leisure"="park"](${bbox});relation["leisure"="park"](${bbox}););out geom;`;
  const waterQuery = `[out:json][timeout:240];(way["natural"="water"](${bbox});relation["natural"="water"](${bbox}););out geom;`;
  // Operating lines as mapped routes (one direction each), plus track that is still under construction.
  const metroQuery = `[out:json][timeout:120];(relation["route"~"^(subway|light_rail)$"](${bbox});way["railway"="construction"]["construction"~"^(subway|light_rail)$"](${bbox}););out geom;`;
  // Wards and communes created by the 2025 reorganisation (admin_level 6), and Hanoi itself to drop neighbouring provinces.
  const wardsQuery = `[out:json][timeout:240];relation["boundary"="administrative"]["admin_level"="6"](${bbox});out geom;`;
  const cityQuery = `[out:json][timeout:240];relation["boundary"="administrative"]["admin_level"="4"]["name"="Thành phố Hà Nội"];out geom;`;

  console.log('Downloading places…');
  const points = await overpass(pointsQuery);
  console.log('Downloading parks…');
  const parks = await overpass(parksQuery);
  console.log('Downloading lakes and ponds…');
  const water = await overpass(waterQuery);
  console.log('Downloading metro lines…');
  const metro = await overpass(metroQuery);
  console.log('Downloading wards (2025) and the city boundary…');
  const wards = await overpass(wardsQuery);
  await pause(5_000);
  const city = await overpass(cityQuery);

  const pois = [];
  const seen = new Set();
  for (const e of points.json.elements) {
    const type = typeOf(e.tags ?? {});
    const lng = e.lon ?? e.center?.lon;
    const lat = e.lat ?? e.center?.lat;
    if (!type || lng === undefined || seen.has(`${e.type}/${e.id}`)) continue;
    // OSM also maps planned metro stations under codes such as "S2.01": only stations in service count.
    if (type === 'metro' && (!e.tags.name || PLANNED_STATION.test(e.tags.name))) continue;
    seen.add(`${e.type}/${e.id}`);
    // Bus stops: position only (there are thousands; names are not shown).
    pois.push(type === 'bus' ? [type, round5(lng), round5(lat)] : [type, round5(lng), round5(lat), e.tags.name ?? null]);
  }

  const park = shapesOf(parks.json.elements);
  const lake = shapesOf(water.json.elements.filter((e) => !EXCLUDED_WATER.test(e.tags?.water ?? '')));
  console.log(`Rasterising ${park.shapes.length} parks and ${lake.shapes.length} bodies of water…`);

  const metroLines = metroLinesOf(metro.json.elements);
  const cityRings = ringsOf(city.json.elements[0] ?? {});
  const cityShape = [...cityRings.outer, ...cityRings.inner];
  if (!cityShape.length) throw new Error('Hanoi city boundary not found');
  const wardShapes = [];
  const wardNames = [];
  for (const e of wards.json.elements) {
    const { outer, inner } = ringsOf(e);
    if (!outer.length || !e.tags?.name) continue;
    const all = outer.flat();
    const centre = [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length];
    if (!inRings(centre, cityShape)) continue; // a ward of Bắc Ninh or Hưng Yên inside the bounding box
    wardShapes.push([...outer, ...inner]);
    wardNames.push(e.tags.name);
  }
  if (wardShapes.length > 255) throw new Error('too many wards for a one-byte raster');
  console.log(`Rasterising ${wardShapes.length} wards of Hanoi…`);

  const counts = pois.reduce((acc, [t]) => ({ ...acc, [t]: (acc[t] ?? 0) + 1 }), {
    park: park.points.length,
    water: lake.points.length,
    metroLines: metroLines.length,
    wards: wardNames.length,
  });
  const snapshot = {
    source: 'OpenStreetMap contributors',
    license: 'ODbL 1.0 — https://www.openstreetmap.org/copyright',
    endpoint: points.endpoint,
    osmBase: points.json.osm3s?.timestamp_osm_base ?? null,
    generatedAt: new Date().toISOString(),
    bbox: BBOX,
    counts,
    /** [type, lng, lat, name?] */
    pois,
    /** [lng, lat, areaM2, name] — centroid of the park outline */
    parks: park.points,
    /** [lng, lat, areaM2, name] — named lakes of at least 1 ha (smaller ponds only count in the raster) */
    lakes: lake.points.filter(([, , areaM2, name]) => name && areaM2 >= 10_000),
    /** Coverage rasters: cell (row r, col c) is centred at (south + (r + ½)·cellDeg, west + (c + ½)·cellDeg). */
    raster: { cellDeg: CELL_DEG, south: BBOX[0], west: BBOX[1], park: rasterise(park.shapes), water: rasterise(lake.shapes) },
    /** { ref, name, status: 'operating' | 'under_construction', coords: [[lng, lat], …][] } — track as mapped on OSM */
    metroLines,
    /** New wards/communes (2025) of Hanoi in the bounding box; `raster.cells` holds 1 + index into `names`. */
    wards: { names: wardNames, raster: rasteriseIndex(wardShapes) },
  };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(snapshot)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} — OSM data as of ${snapshot.osmBase}`, counts);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
