/**
 * Node.js/Express API for the Opportunity Map project.
 *
 *   /api/opportunity/...                               Business Opportunity Map — Hanoi wards (2025), OSM data (src/opportunity).
 *   /api/living-score/...                              Hanoi Living Score (src/living-score).
 *   /api/future-map/...                                Hanoi Future Map — sourced plan milestones 2026-2065 (src/future-map).
 *   /api/property-intel/...                            AI Property Intelligence — area and project intelligence (src/property-intel).
 *   /api/account/...                                   Accounts and saved reports, PostgreSQL (src/accounts).
 *   /api/billing/...                                   Purchases: report credits, AI question packs, Premium (src/billing).
 *   /api/reports/...                                   Paid feasibility reports, computed and stored by the server (src/reports).
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
const { createPropertyIntel } = require('./src/property-intel');
const { createTimeMachine } = require('./src/time-machine');
const { createAccounts } = require('./src/accounts');
const { createBilling } = require('./src/billing');
const { createPaidReports } = require('./src/reports');
const { createAiMeter } = require('./src/billing/ai-meter');
const { createMailer } = require('./src/mailer');

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
// Localhost is trusted only outside production (a deployed site must list its origin in CORS_ORIGIN).
const isAllowedOrigin = (origin) =>
  EXTRA_CORS_ORIGINS.includes(origin) || (process.env.NODE_ENV !== 'production' && LOCALHOST_ORIGIN.test(origin));

function createApp(options = {}) {
  const app = express();
  // Behind nginx / a load balancer: the client IP (rate limits) comes from X-Forwarded-For.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / non-browser requests (curl, health checks) send no Origin header.
        // Pass `false` (never an Error) for a disallowed origin: the cors
        // middleware then just omits Access-Control-Allow-Origin and lets the
        // request continue, instead of failing it with a 500.
        callback(null, !origin || isAllowedOrigin(origin));
      },
      // The account session is a cookie: the browser sends it to the API on another port only with credentials.
      credentials: true,
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

  // Accounts first: the AI meter needs them to count in-depth AI answers per account (src/billing/ai-meter.js).
  const mailer = options.mailer ?? createMailer({ log: options.log !== false });
  const accounts = createAccounts({ isAllowedOrigin, mailer, ...options.accounts });
  const meter = createAiMeter({ accounts, isAllowedOrigin, ...options.aiMeter });

  // Business Opportunity Map (Hanoi wards, OpenStreetMap data; AI answers from the data).
  const opportunity = createOpportunityMap({ meter, ...options.opportunity });
  app.use('/api/opportunity', opportunity.router);

  // Hanoi Living Score (its own JSON error format, rate limiting and security headers).
  const living = createLivingScore({ meter, ...options.living });
  app.use('/api/living-score', living.router);

  // Hanoi Future Map (illustrative scenario data; same error format as Living Score).
  const futureMap = createFutureMap({ meter, ...options.futureMap });
  app.use('/api/future-map', futureMap.router);

  // AI Property Intelligence (real data; Claude when ANTHROPIC_API_KEY is set, template answers otherwise).
  const propertyIntel = createPropertyIntel({ meter, ...options.propertyIntel });
  app.use('/api/property-intel', propertyIntel.router);

  // Hanoi Time Machine AI Storyteller (grounded in the page's own landmark data; mock unless ANTHROPIC_API_KEY is set).
  const timeMachine = createTimeMachine({ meter, ...options.timeMachine });
  app.use('/api/time-machine', timeMachine.router);

  // Accounts and saved reports (PostgreSQL when DATABASE_URL is set; off otherwise).
  app.use('/api/account', accounts.router);

  // Purchases (report credits, AI question packs, Premium) and the paid reports they buy; both need accounts.
  const billing = createBilling({ accounts, isAllowedOrigin, meter, ...options.billing });
  app.use('/api/billing', billing.router);
  app.use('/api/reports', createPaidReports({ accounts }).router);

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

  return { app, living, accounts, billing, meter, mailer };
}

async function main() {
  const { app, living, accounts, billing, meter, mailer } = createApp();
  await living.init();
  await accounts.init();
  const server = app.listen(PORT, () => {
    console.log(`Opportunity Map API (Node/Express) listening on http://localhost:${PORT}`);
    console.log('  Business Opportunity Map  /api/opportunity (Hanoi wards, OSM data)');
    console.log(`  Hanoi Living Score        /api/living-score  (data source: ${living.config.dataSource})`);
    console.log('  Hanoi Future Map          /api/future-map    (sourced plan data)');
    console.log('  AI Property Intelligence  /api/property-intel (79 wards, land prices 2026, market briefings)');
    console.log(`  Accounts                  /api/account       (${accounts.enabled ? accounts.store.kind : 'off — set DATABASE_URL'})`);
    console.log(`  Billing                   /api/billing       (${billing.enabled ? `provider: ${billing.provider.name}` : 'off'})  · paid reports /api/reports`);
    console.log(
      `  Email                     ${accounts.mailEnabled ? `${mailer.kind} — verify email, reset password${accounts.requireVerifiedEmail ? ', verified email needed to buy' : ''}` : 'off — no verify email / reset password (MAIL_PROVIDER, APP_URL)'}`,
    );
    console.log(
      `  AI metering               ${meter.enabled ? `on — ${meter.limits.freePerDay} free in-depth AI answers a day (${meter.limits.storyFreePerDay} for the Time Machine), ${meter.limits.premiumPerDay} with Premium` : 'off — AI answers are free (AI_METERING, accounts and ANTHROPIC_API_KEY)'}`,
    );
    if (!living.config.anthropicApiKey) console.log('  ANTHROPIC_API_KEY not set — AI recommendations use rule-based explanations.');
  });

  const shutdown = () => {
    server.close(() => Promise.allSettled([living.close(), accounts.close()]).finally(() => process.exit(0)));
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
