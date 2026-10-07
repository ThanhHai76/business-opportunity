'use strict';
/**
 * GeoJSON layers for the Map Intelligence view, per planning horizon (2026 / 2030 / 2045) and language.
 *
 * Real data: ward boundaries (2025), metro lines and stations, Ring Road 4 and the Red River bridges (OSM), the
 * planned lines and the development poles of the approved plans (schematic routes and pole circles, as in the
 * Future Map), construction sites, schools, health facilities and parks (OSM).
 * Prices: each ward carries its official land price (2026 table, VT1 median); projects carry their published price.
 */
const { circleRing } = require('../future-map/geo');
const M = require('./model');
const MK = require('./market');
const E = require('./engine');

const fc = (features) => ({ type: 'FeatureCollection', features });
const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties });
const lineGeometry = (lines) => (lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : { type: 'MultiLineString', coordinates: lines });

/** 2026 shows today's network; later horizons show what should be open by then if the plans hold. */
const lineStatus = (item, horizon) => {
  const s = M.statusAt(item, horizon);
  return s === 'expected' ? 'operating' : s === 'construction' ? 'building' : s === 'plan' ? 'planned' : 'operating';
};

const SOCIAL = { school: 'school', kindergarten: 'school', hospital: 'hospital', clinic: 'hospital' };

function buildLayers(horizon, lang) {
  const L = (text) => M.L(text, lang);

  const wards = fc(
    M.WARDS.map((w) => {
      const s = M.SCORES.get(w.slug);
      const f = M.FACTS.get(w.slug);
      return feature(w.geometry, {
        slug: w.slug,
        name: w.name,
        score: s.score,
        rank: M.rankOf(w.slug),
        partial: s.partial,
        connectivity: s.values.connectivity,
        infrastructure: s.values.infrastructure,
        development: s.values.development,
        density: f.density ?? -1,
        landPrice: M.LAND.wards[w.slug]?.medianVT1 ?? -1,
      });
    }),
  );

  const labels = fc(
    M.WARDS.map((w) => {
      const s = M.SCORES.get(w.slug);
      return feature({ type: 'Point', coordinates: w.centroid }, { slug: w.slug, name: w.name, label: w.shortName, score: s.score, rank: M.rankOf(w.slug), population: w.population ?? 0 });
    }),
  );

  const metro = fc(
    M.INFRA.filter((i) => i.kind === 'metro').map((i) =>
      feature(lineGeometry(i.lines), { id: i.id, name: L(i.name), note: L(i.note), color: i.color, opens: i.openYear, schematic: i.schematic, status: lineStatus(i, horizon) }),
    ),
  );

  const stations = fc(
    M.STATIONS.map((s) =>
      feature({ type: 'Point', coordinates: s.coords }, { slug: s.slug, name: s.name, line: s.line, status: s.status === 'operating' || horizon >= 2027 ? 'operating' : 'building' }),
    ),
  );

  const tod = fc(
    M.STATIONS.map((s) =>
      feature({ type: 'Polygon', coordinates: [circleRing(s.coords, M.TOD_RADIUS_M / 1000)] }, {
        name: `TOD · ${s.name} · ${M.TOD_RADIUS_M} m`,
        status: s.status === 'operating' || horizon >= 2027 ? 'active' : 'planned',
      }),
    ),
  );

  const infrastructure = fc(
    M.INFRA.filter((i) => i.kind !== 'metro').map((i) =>
      feature(lineGeometry(i.lines), { id: i.id, kind: i.kind, name: L(i.name), note: L(i.note), opens: i.openYear, status: lineStatus(i, horizon) === 'operating' ? 'open' : 'building' }),
    ),
  );

  // Development poles of the 100-year plan (schematic circles) and the construction sites mapped in OSM today.
  const planning = fc([
    ...M.POLES.map((p) =>
      feature({ type: 'Polygon', coordinates: [circleRing(p.center, p.radiusKm, { wobble: 0.06, phase: p.radiusKm })] }, {
        slug: p.slug,
        name: L(p.name),
        role: L(p.role),
        kind: 'zone',
        from: p.year,
        status: p.year <= horizon ? 'active' : 'planned',
      }),
    ),
    ...M.INFRA_OSM.construction.map((c) => feature({ type: 'Polygon', coordinates: [c.ring] }, { slug: c.id, name: c.name ?? (lang === 'en' ? 'Construction site' : 'Công trường'), kind: 'development', areaHa: c.areaHa })),
  ]);

  const projects = fc(
    M.PROJECTS.map((p) =>
      feature({ type: 'Point', coordinates: p.coords }, { slug: p.slug, name: p.name, price: E.priceLabel(p, lang), kind: M.L(MK.KIND[p.kind], lang), approx: p.approx }),
    ),
  );

  const social = fc(
    M.POIS.filter((p) => SOCIAL[p.kind]).map((p) =>
      feature({ type: 'Point', coordinates: p.coords }, { kind: SOCIAL[p.kind], name: p.name ?? (SOCIAL[p.kind] === 'school' ? (lang === 'en' ? 'School' : 'Trường học') : lang === 'en' ? 'Health facility' : 'Cơ sở y tế') }),
    ),
  );

  const green = fc(
    M.PARKS.filter((p) => p.ha >= 0.3).map((p) => feature({ type: 'Point', coordinates: p.coords }, { name: p.name ?? (lang === 'en' ? 'Park' : 'Công viên'), ha: p.ha })),
  );

  return {
    horizon,
    lang,
    layers: { wards, labels, metro, stations, tod, infrastructure, planning, projects, social, green },
  };
}

module.exports = { buildLayers };
