'use strict';
/**
 * GeoJSON layers for the Map Intelligence view, filtered by planning horizon (2026 / 2030 / 2045).
 * District outlines are illustrative Voronoi cells, not administrative boundaries; everything else
 * is sketched from the SAMPLE DATA in data.js.
 */
const { GeoFrame, buildIllustrativeCells } = require('../living-score/seed/geometry');
const { getSeedData } = require('../living-score/seed/seed-data');
const data = require('./data');
const engine = require('./engine');

const FRAME = new GeoFrame([105.85, 21.03]);
const fc = (features) => ({ type: 'FeatureCollection', features });
const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties });

const seedLines = getSeedData().infrastructure.filter((i) => i.kind === 'metro_line');
function seedLine(prefix) {
  const line = seedLines.find((l) => l.name.startsWith(prefix));
  if (!line) throw new Error(`property-intel: missing seed metro line "${prefix}"`);
  return line.geometry.coordinates;
}

/** Closed ring approximating an ellipse (km radii) around a [lng, lat] centre. */
function ellipse(center, rxKm, ryKm = rxKm, segments = 48) {
  const [cx, cy] = FRAME.project(center);
  const ring = Array.from({ length: segments }, (_, k) => {
    const a = (2 * Math.PI * k) / segments;
    return FRAME.unproject([cx + rxKm * Math.cos(a), cy + ryKm * Math.sin(a)]);
  });
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

/** Slightly skewed rectangle so zones do not look like perfect map tiles. */
function block(center, [wKm, hKm]) {
  const [cx, cy] = FRAME.project(center);
  const s = 0.12;
  const pts = [
    [cx - wKm / 2, cy - hKm / 2 + s * hKm],
    [cx + wKm / 2, cy - hKm / 2],
    [cx + wKm / 2 - s * wKm, cy + hKm / 2],
    [cx - wKm / 2, cy + hKm / 2 - s * hKm],
  ].map((p) => FRAME.unproject(p));
  pts.push(pts[0]);
  return { type: 'Polygon', coordinates: [pts] };
}

const CELLS = buildIllustrativeCells(
  data.DISTRICTS.map((d) => ({ id: d.slug, center: d.center, radiusKm: d.radiusKm })),
  FRAME,
);

function buildLayers(horizon) {
  const summaries = new Map(engine.listDistricts().map((d) => [d.slug, d]));

  const districts = fc(
    data.DISTRICTS.map((d) => {
      const s = summaries.get(d.slug);
      return feature(
        { type: 'Polygon', coordinates: [CELLS.get(d.slug)] },
        { slug: d.slug, name: d.name, growthScore: s.growthScore, price: d.price.now, yoy: s.yoy, density: d.density },
      );
    }),
  );

  const labels = fc(
    data.DISTRICTS.map((d) => {
      const s = summaries.get(d.slug);
      return feature({ type: 'Point', coordinates: d.center }, { slug: d.slug, name: d.name, growthScore: s.growthScore, price: d.price.now, yoy: s.yoy });
    }),
  );

  const metro = fc(
    data.METRO_LINES.map((l) =>
      feature(
        { type: 'LineString', coordinates: seedLine(l.seed) },
        { id: l.id, name: l.name, color: l.color, opens: l.opens, status: l.opens <= horizon ? 'operating' : 'planned' },
      ),
    ),
  );

  const stations = fc(
    data.STATIONS.map((s) =>
      feature({ type: 'Point', coordinates: s.coords }, { slug: s.slug, name: s.name, line: s.line, status: s.opens <= horizon ? 'operating' : 'planned' }),
    ),
  );

  const tod = fc(
    data.STATIONS.filter((s) => s.tod).map((s) =>
      feature(ellipse(s.coords, engine.TOD_RADIUS_M / 1000), {
        name: `TOD · ${s.name} · ${engine.TOD_RADIUS_M}m`,
        status: s.opens <= horizon ? 'active' : 'planned',
      }),
    ),
  );

  const infrastructure = fc(
    data.INFRASTRUCTURE.map((i) =>
      feature({ type: 'LineString', coordinates: i.coords }, { slug: i.slug, name: i.name, opens: i.opens, status: i.opens <= horizon ? 'open' : 'building' }),
    ),
  );

  const planning = fc(
    data.PLANNING_ZONES.filter((z) => z.from <= horizon).map((z) =>
      feature(block(z.center, z.sizeKm), { slug: z.slug, name: z.name, kind: z.kind, district: z.district, from: z.from }),
    ),
  );

  const projects = fc(
    data.PROJECTS.map((p) =>
      feature({ type: 'Point', coordinates: p.coords }, { slug: p.slug, name: p.name, price: p.pricePerM2, district: p.district, soldPct: p.soldPct }),
    ),
  );

  const social = fc(
    data.PROJECTS.flatMap((p) => engine.projectPois(p))
      .filter((poi) => poi.kind === 'school' || poi.kind === 'hospital')
      .map((poi) => feature({ type: 'Point', coordinates: poi.coords }, { kind: poi.kind, name: poi.name })),
  );

  const green = fc(data.GREEN_SPACES.map((g) => feature(ellipse(g.center, g.sizeKm[0] / 2, g.sizeKm[1] / 2), { name: g.name })));

  return {
    horizon,
    sampleData: true,
    layers: { districts, labels, metro, stations, tod, infrastructure, planning, projects, social, green },
  };
}

module.exports = { buildLayers };
