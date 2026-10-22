// Runtime config — no build-time environments needed.
/**
 * Where the API is.
 *  - A page on localhost WITH a port in its address (ng serve on 4200, a preview, the dev compose on 8080) talks to
 *    backend-node on port 8000.
 *  - A page on a standard port (https://localhost: the docker stack, where Caddy sends /api to the backend) and any real
 *    domain use the same origin, so the session cookie stays first-party (nginx / Caddy forward /api, see
 *    frontend/nginx.conf and deploy/Caddyfile).
 */
export function apiBaseUrl(hostname: string, port: string): string {
  const local = /^(localhost|127\.0\.0\.1)$/.test(hostname);
  return local && port !== '' ? 'http://localhost:8000' : '';
}
export const API_BASE_URL = typeof location === 'undefined' ? '' : apiBaseUrl(location.hostname, location.port);

// Accounts and saved reports (PostgreSQL), under /api/account.
export const ACCOUNT_API_URL = `${API_BASE_URL}/api/account`;

// Purchases of report credits, and the paid reports they buy (computed and stored by the server).
export const BILLING_API_URL = `${API_BASE_URL}/api/billing`;
export const REPORTS_API_URL = `${API_BASE_URL}/api/reports`;

// Business Opportunity Map: Hanoi wards (2025) scored from OpenStreetMap data, under /api/opportunity.
export const OPPORTUNITY_API_URL = `${API_BASE_URL}/api/opportunity`;

// Hanoi Living Score lives in the same backend-node server, under /api/living-score.
export const LIVING_SCORE_API_URL = `${API_BASE_URL}/api/living-score`;

// Hanoi Future Map: sourced plan milestones 2026-2065 and the Capital Region, served by the same backend-node server.
export const FUTURE_MAP_API_URL = `${API_BASE_URL}/api/future-map`;

// AI Property Intelligence: area + project intelligence (sample data), served by backend-node.
export const PROPERTY_INTEL_API_URL = `${API_BASE_URL}/api/property-intel`;

// Hanoi Time Machine: AI Storyteller grounded in the page's landmark data, served by backend-node.
export const TIME_MACHINE_API_URL = `${API_BASE_URL}/api/time-machine`;

// Public address of the site: canonical links, the sitemap and share tags. Keep in step with SITE_URL in index.html / scripts/seo.mjs.
export const SITE_URL = 'https://hanoicenturyvista.com';

// Cookieless statistics (Plausible-compatible). Leave `domain` empty to keep analytics off.
export const ANALYTICS = { domain: '', script: 'https://plausible.io/js/script.js' };
