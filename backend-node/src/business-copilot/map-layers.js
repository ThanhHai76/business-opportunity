'use strict';
/** GeoJSON layers for the Map Explorer. Every point here is a DEMO position, not a real address. */
const { getSeedData } = require('../living-score/seed/seed-data');
const { circleRing, circleLine } = require('../future-map/geo');
const FUTURE = require('../future-map/data');
const { LOCATIONS } = require('./data');
const { computeScore, competitorsFor } = require('./scoring');
const { mulberry32, hashString } = require('./prng');

const fc = (features) => ({ type: 'FeatureCollection', features });
const point = (coords, properties) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties });
const KM_LAT = 110.574;
const kmLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** n random points in a disc of `radiusKm` around `center` (deterministic per seed). */
function scatter(center, radiusKm, n, seed) {
  const rand = mulberry32(hashString(seed));
  return Array.from({ length: n }, () => {
    const r = radiusKm * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    return [
      Math.round((center[0] + (r * Math.cos(a)) / kmLng(center[1])) * 1e5) / 1e5,
      Math.round((center[1] + (r * Math.sin(a)) / KM_LAT) * 1e5) / 1e5,
    ];
  });
}

const cache = new Map();

function mapLayers(category, budgetVnd) {
  const key = `${category.key}|${budgetVnd}`;
  if (cache.has(key)) return cache.get(key);

  const scored = LOCATIONS.map((l) => ({ l, s: computeScore(l, category, budgetVnd) }));

  const areas = fc(
    scored.map(({ l, s }, i) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [circleRing(l.center, Math.min(3.2, 1.2 + Math.sqrt(l.areaKm2) * 0.28), { wobble: 0.12, phase: i })] },
      properties: { slug: l.slug, name: l.name, businessScore: s.totalScore, demand: s.scores.demand, competitionLabel: s.competitionLabel },
    })),
  );

  const heat = fc(
    scored.flatMap(({ l, s }) =>
      scatter(l.center, 1.8, 40, `${l.slug}|heat`).map((c, i) =>
        point(c, {
          demand: Math.round(s.scores.demand * (0.6 + ((i * 37) % 40) / 100)) / 100,
          population: Math.round((l.population / l.areaKm2 / 40000) * 100) / 100,
        }),
      ),
    ),
  );

  const competitors = fc(
    scored.flatMap(({ l }) => {
      const c = competitorsFor(l, category);
      const pts = scatter(l.center, 1.5, Math.min(14, c.total), `${l.slug}|${category.key}|comp`);
      return pts.map((coords, i) => {
        const subtype = c.subtypes[i % c.subtypes.length];
        return point(coords, { kind: 'competitor', subtype: subtype.key, label: subtype.label, area: l.slug });
      });
    }),
  );

  const poi = (kind, countOf) =>
    fc(scored.flatMap(({ l }) => scatter(l.center, 1.6, countOf(l), `${l.slug}|${kind}`).map((coords) => point(coords, { kind, area: l.slug }))));
  const schools = poi('school', (l) => Math.min(8, Math.round(l.schools / 2.5) + l.universities));
  const offices = poi('office', (l) => Math.min(10, Math.round(l.offices / 20)));
  const shopping = poi('shopping', (l) => Math.max(1, Math.round(l.visitorIndex / 16)));

  const infra = getSeedData().infrastructure;
  const metroLines = fc(infra.filter((i) => i.kind === 'metro_line').map((i) => ({ type: 'Feature', geometry: i.geometry, properties: { name: i.name, status: i.status } })));
  const metroStations = fc(infra.filter((i) => i.kind === 'metro_station').map((i) => ({ type: 'Feature', geometry: i.geometry, properties: { name: i.name, status: i.status } })));

  const roads = fc([
    ...FUTURE.RING_ROADS.filter((r) => r.year <= 2030).map((r, i) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: circleLine(FUTURE.CENTER, r.radiusKm, { wobble: 0.05, phase: i + 0.5 }) },
      properties: { name: r.name, kind: 'ring' },
    })),
    ...FUTURE.EXPRESSWAYS.filter((r) => r.year <= 2026).map((r) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords }, properties: { name: r.name, kind: 'expressway' } })),
  ]);

  const developmentZones = fc(
    scored
      .filter(({ l }) => l.developmentZone)
      .map(({ l }, i) => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circleRing(l.center, 2.6, { wobble: 0.1, phase: i + 3 })] },
        properties: { name: `Vùng phát triển ${l.name}`, area: l.slug },
      })),
  );

  const result = {
    category: { key: category.key, nameVi: category.nameVi },
    layers: { areas, heat, competitors, metroLines, metroStations, schools, offices, shopping, roads, developmentZones },
    demo: true,
  };
  cache.set(key, result);
  if (cache.size > 60) cache.delete(cache.keys().next().value);
  return result;
}

module.exports = { mapLayers };
