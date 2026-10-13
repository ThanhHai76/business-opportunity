// Runtime config — no build-time environments needed.
// On localhost (ng serve, a preview) the API is backend-node on port 8000. Deployed, the page and the API share one
// origin (nginx forwards /api to backend-node, see frontend/nginx.conf), so the session cookie stays first-party.
const onLocalhost = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const API_BASE_URL = onLocalhost ? 'http://localhost:8000' : '';

// Accounts and saved reports (PostgreSQL), under /api/account.
export const ACCOUNT_API_URL = `${API_BASE_URL}/api/account`;

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
