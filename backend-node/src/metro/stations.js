'use strict';
/**
 * The metro stations of Hà Nội, in one place for every tool (Business Opportunity Map, Property Intelligence, the
 * career compass).
 *
 * Which stations exist, their line and whether they are in service or under construction come from the Living Score
 * snapshot (OpenStreetMap, src/living-score/seed). The snapshot's coordinates are only approximate (up to 1 km off), so
 * a station near a ward boundary could land in the wrong ward and the tools disagreed with each other. Each station
 * therefore takes its coordinates from the OpenStreetMap station nodes of the same name (data/metro-stations.json,
 * built by `npm run data:stations`); a station with no match keeps the snapshot's coordinates (`source: 'seed'`).
 */
const fs = require('node:fs');
const path = require('node:path');
const { getSeedData } = require('../living-score/seed/seed-data');

const KM_LAT = 111.19;
const kmLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);
const distKm = (a, b) => Math.hypot((b[0] - a[0]) * kmLng((a[1] + b[1]) / 2), (b[1] - a[1]) * KM_LAT);

function segmentKm(p, a, b) {
  const k = kmLng(p[1]);
  const [px, py, ax, ay, bx, by] = [p[0] * k, p[1] * KM_LAT, a[0] * k, a[1] * KM_LAT, b[0] * k, b[1] * KM_LAT];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const lineKm = (p, line) => {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, segmentKm(p, line[i - 1], line[i]));
  return best;
};

const lineRef = (name) => /Tuyến (\w+)/.exec(name)?.[1] ?? '';
const slugOf = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** The stations as the snapshot has them: name, line, status and approximate coordinates. */
function seedStations() {
  const seed = getSeedData();
  const lines = seed.infrastructure.filter((i) => i.kind === 'metro_line' && i.status !== 'planned');
  return seed.infrastructure
    .filter((i) => i.kind === 'metro_station' && i.status !== 'planned')
    .map((i) => {
      const coords = i.geometry.coordinates;
      const line = [...lines].sort((a, b) => lineKm(coords, a.geometry.coordinates) - lineKm(coords, b.geometry.coordinates))[0];
      const name = i.name.replace(/^Ga /, '');
      return { slug: slugOf(name), name, line: lineRef(line.name), status: i.status === 'operating' ? 'operating' : 'construction', coords };
    });
}

const FILE = path.join(__dirname, 'data', 'metro-stations.json');
const OSM = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { stations: {} };

/** The stations with coordinates from OpenStreetMap wherever it has them. */
function snapToOsm(stations, osm = OSM) {
  return stations.map((s) => {
    const o = osm.stations?.[s.name];
    return o ? { ...s, coords: o.coords, source: 'osm', seedOffsetKm: Math.round(distKm(s.coords, o.coords) * 100) / 100 } : { ...s, source: 'seed' };
  });
}

const SEED_STATIONS = seedStations();
const STATIONS = snapToOsm(SEED_STATIONS);

module.exports = { STATIONS, SEED_STATIONS, snapToOsm, distKm, OSM_DATA: OSM };
