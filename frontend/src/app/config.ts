// Simple runtime config — no build-time environments needed for this MVP.
// Point this at your deployed backend (backend-node or the FastAPI one) when you move past localhost.
export const API_BASE_URL = 'http://localhost:8000';

// Hanoi Living Score lives in the same backend-node server, under /api/living-score.
export const LIVING_SCORE_API_URL = `${API_BASE_URL}/api/living-score`;
