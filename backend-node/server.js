/**
 * Node.js/Express API for "Bản đồ Cơ hội Kinh doanh" — a drop-in
 * replacement for the FastAPI backend (../backend), same endpoints and
 * same response shapes, just running on Node instead of Python. Run one
 * or the other on port 8000, never both at once.
 */
const express = require('express');
const cors = require('cors');
const { CITIES, squarePolygon } = require('./src/data');
const { BUSINESS_TYPES, scoreArea } = require('./src/scoring');

const app = express();
const PORT = process.env.PORT || 8000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4200';

// Flat slug -> { area, city } index, built once at startup so
// /api/areas/:slug is a lookup instead of a scan across every city.
const AREA_INDEX = new Map();
for (const city of Object.values(CITIES)) {
  for (const area of city.areas) {
    AREA_INDEX.set(area.slug, { area, city });
  }
}

app.use(
  cors({
    origin: CORS_ORIGIN,
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/cities', (req, res) => {
  const cities = Object.entries(CITIES).map(([id, city]) => ({ id, label: city.label }));
  res.json(cities);
});

app.get('/api/business-types', (req, res) => {
  const types = Object.entries(BUSINESS_TYPES).map(([id, spec]) => ({
    id,
    name: spec.name,
    icon: spec.icon,
    description: spec.description,
  }));
  res.json(types);
});

// GeoJSON FeatureCollection for one city (?city=hcm|hanoi, default hcm) —
// one polygon Feature per area, with the top-ranked opportunity baked into
// `properties` so the map can choropleth-color every zone in one request.
app.get('/api/areas', (req, res, next) => {
  try {
    const cityId = req.query.city || 'hcm';
    const city = CITIES[cityId];
    if (!city) {
      return res.status(404).json({ detail: `Unknown city "${cityId}". Try one of: ${Object.keys(CITIES).join(', ')}` });
    }

    const features = city.areas.map((area) => {
      const opportunities = scoreArea(area.metrics, area.competition);
      const top = opportunities[0];
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: squarePolygon(area.lat, area.lng) },
        properties: {
          slug: area.slug,
          name: area.name,
          district: area.district,
          city: city.label,
          lat: area.lat,
          lng: area.lng,
          top_opportunity: {
            type_id: top.type_id,
            name: top.name,
            icon: top.icon,
            opportunity_score: top.opportunity_score,
          },
          metrics: area.metrics,
        },
      };
    });

    res.json({ type: 'FeatureCollection', features });
  } catch (err) {
    next(err);
  }
});

// Area detail by slug, looked up across every city (slugs are globally
// unique), so the frontend never has to pass a city alongside the slug.
app.get('/api/areas/:slug', (req, res, next) => {
  try {
    const entry = AREA_INDEX.get(req.params.slug);
    if (!entry) {
      return res.status(404).json({ detail: 'Area not found' });
    }
    const { area, city } = entry;
    const opportunities = scoreArea(area.metrics, area.competition);
    res.json({
      slug: area.slug,
      name: area.name,
      district: area.district,
      city: city.label,
      lat: area.lat,
      lng: area.lng,
      summary: area.summary,
      metrics: area.metrics,
      opportunities,
    });
  } catch (err) {
    next(err);
  }
});

// Unmatched routes and uncaught errors still respond with JSON, matching
// every other endpoint's contract (the frontend never has to special-case
// an HTML error page).
app.use((req, res) => {
  res.status(404).json({ detail: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ detail: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Business Opportunity Map API (Node/Express) listening on http://localhost:${PORT}`);
});
