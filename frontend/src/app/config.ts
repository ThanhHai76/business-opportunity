// Simple runtime config — no build-time environments needed for this MVP.
// Point this at your deployed backend (backend-node or the FastAPI one) when you move past localhost.
export const API_BASE_URL = 'http://localhost:8000';

// Hanoi Living Score lives in the same backend-node server, under /api/living-score.
export const LIVING_SCORE_API_URL = `${API_BASE_URL}/api/living-score`;

// Hanoi Future Map: illustrative scenario layers for 2026-2100, served by the same backend-node server.
export const FUTURE_MAP_API_URL = `${API_BASE_URL}/api/future-map`;

// Hanoi Business Copilot: location intelligence (demo data), served by backend-node.
export const BUSINESS_COPILOT_API_URL = `${API_BASE_URL}/api/business-copilot`;

// AI Property Intelligence: area + project intelligence (sample data), served by backend-node.
export const PROPERTY_INTEL_API_URL = `${API_BASE_URL}/api/property-intel`;
