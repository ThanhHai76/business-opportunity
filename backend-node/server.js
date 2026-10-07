/**
 * Node.js/Express API for the Opportunity Map project.
 *
 *   /api/opportunity/...                               Business Opportunity Map — Hanoi wards (2025), OSM data (src/opportunity).
 *   /api/living-score/...                              Hanoi Living Score (src/living-score).
 *   /api/future-map/...                                Hanoi Future Map — sourced plan milestones 2026-2065 (src/future-map).
 *   /api/business-copilot/...                          Hanoi Business Copilot — location intelligence (src/business-copilot).
 *   /api/property-intel/...                            AI Property Intelligence — area and project intelligence (src/property-intel).
 */
try {
  process.loadEnvFile(); // optional .env (Node >= 20.12); real environment variables win
} catch {
  // no .env file
}

const express = require('express');
const cors = require('cors');
const { createOpportunityMap } = require('./src/opportunity');
const { createLivingScore } = require('./src/living-score');
const { createFutureMap } = require('./src/future-map');
const { createBusinessCopilot } = require('./src/business-copilot');
const { createPropertyIntel } = require('./src/property-intel');
const { createTimeMachine } = require('./src/time-machine');

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

  // Business Opportunity Map (Hanoi wards, OpenStreetMap data; AI answers from the data).
  const opportunity = createOpportunityMap(options.opportunity);
  app.use('/api/opportunity', opportunity.router);

  // Hanoi Living Score (its own JSON error format, rate limiting and security headers).
  const living = createLivingScore(options.living);
  app.use('/api/living-score', living.router);

  // Hanoi Future Map (illustrative scenario data; same error format as Living Score).
  const futureMap = createFutureMap(options.futureMap);
  app.use('/api/future-map', futureMap.router);

  // Hanoi Business Copilot (demo data; mock AI unless ANTHROPIC_API_KEY / AI_PROVIDER is set).
  const businessCopilot = createBusinessCopilot(options.businessCopilot);
  app.use('/api/business-copilot', businessCopilot.router);

  // AI Property Intelligence (sample data; rule-based analyst).
  const propertyIntel = createPropertyIntel(options.propertyIntel);
  app.use('/api/property-intel', propertyIntel.router);

  // Hanoi Time Machine AI Storyteller (grounded in the page's own landmark data; mock unless ANTHROPIC_API_KEY is set).
  const timeMachine = createTimeMachine(options.timeMachine);
  app.use('/api/time-machine', timeMachine.router);

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
    console.log('  Business Opportunity Map  /api/opportunity (Hanoi wards, OSM data)');
    console.log(`  Hanoi Living Score        /api/living-score  (data source: ${living.config.dataSource})`);
    console.log('  Hanoi Future Map          /api/future-map    (sourced plan data)');
    console.log('  Hanoi Business Copilot    /api/business-copilot (demo data)');
    console.log('  AI Property Intelligence  /api/property-intel (79 wards, land prices 2026, market briefings)');
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
