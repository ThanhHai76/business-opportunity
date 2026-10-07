// Simple runtime config — no build-time environments needed for this MVP.
// Point this at your deployed backend-node when you move past localhost.
export const API_BASE_URL = 'http://localhost:8000';

// Business Opportunity Map: Hanoi wards (2025) scored from OpenStreetMap data, under /api/opportunity.
export const OPPORTUNITY_API_URL = `${API_BASE_URL}/api/opportunity`;

// Hanoi Living Score lives in the same backend-node server, under /api/living-score.
export const LIVING_SCORE_API_URL = `${API_BASE_URL}/api/living-score`;

// Hanoi Future Map: sourced plan milestones 2026-2065 and the Capital Region, served by the same backend-node server.
export const FUTURE_MAP_API_URL = `${API_BASE_URL}/api/future-map`;

// Hanoi Business Copilot: location intelligence (demo data), served by backend-node.
export const BUSINESS_COPILOT_API_URL = `${API_BASE_URL}/api/business-copilot`;

// AI Property Intelligence: area + project intelligence (sample data), served by backend-node.
export const PROPERTY_INTEL_API_URL = `${API_BASE_URL}/api/property-intel`;

// Hanoi Time Machine: AI Storyteller grounded in the page's landmark data, served by backend-node.
export const TIME_MACHINE_API_URL = `${API_BASE_URL}/api/time-machine`;
