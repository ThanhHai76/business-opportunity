/**
 * Node.js/Express API for the Opportunity Map project.
 *
 *   /api/cities, /api/business-types, /api/areas ...   "Bản đồ Cơ hội Kinh doanh" — a drop-in
 *       replacement for the FastAPI backend (../backend), same endpoints and response shapes.
 *   /api/living-score/...                              Hanoi Living Score (src/living-score).
 *
 * Run this or the Python backend on port 8000, never both at once.
 */
try {
  process.loadEnvFile(); // optional .env (Node >= 20.12); real environment variables win
} catch {
  // no .env file
}

const express = require('express');
const cors = require('cors');
const { CITIES, squarePolygon } = require('./src/data');
const { BUSINESS_TYPES, scoreArea } = require('./src/scoring');
const { createLivingScore } = require('./src/living-score');

const PORT = process.env.PORT || 8000;

// Explicit origins always win (e.g. a real deployed frontend). Below that,
// any localhost/127.0.0.1 origin is allowed regardless of port — dev tools
// (VS Code's preview proxy, `ng serve` picking a random port when 4200 is
// busy, ...) routinely serve the app from a port other than 4200.
const EXTRA_CORS_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Flat slug -> { area, city } index, built once at startup so
// /api/areas/:slug is a lookup instead of a scan across every city.
const AREA_INDEX = new Map();
for (const city of Object.values(CITIES)) {
  for (const area of city.areas) {
    AREA_INDEX.set(area.slug, { area, city });
  }
}

function createApp(options = {}) {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        const allowed =
          !origin || // same-origin / non-browser requests (curl, health checks) send no Origin header
          LOCALHOST_ORIGIN.test(origin) ||
          EXTRA_CORS_ORIGINS.includes(origin);
        // Pass `false` (never an Error) for a disallowed origin: the cors
        // middleware then just omits Access-Control-Allow-Origin and lets the
        // request continue, instead of failing it with a 500.
        callback(null, allowed);
      },
    })
  );

  if (options.log !== false) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

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

  // Hanoi Living Score (its own JSON error format, rate limiting and security headers).
  const living = createLivingScore(options.living);
  app.use('/api/living-score', living.router);

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

  return { app, living };
}

async function main() {
  const { app, living } = createApp();
  await living.init();
  const server = app.listen(PORT, () => {
    console.log(`Opportunity Map API (Node/Express) listening on http://localhost:${PORT}`);
    console.log(`  Business Opportunity Map  /api/areas, /api/cities, /api/business-types`);
    console.log(`  Hanoi Living Score        /api/living-score  (data source: ${living.config.dataSource})`);
    if (!living.config.anthropicApiKey) console.log('  ANTHROPIC_API_KEY not set — AI recommendations use rule-based explanations.');
  });

  const shutdown = () => {
    server.close(() => living.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createApp };
