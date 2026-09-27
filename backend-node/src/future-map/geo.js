'use strict';
const { haversineKm } = require('../living-score/common/geo');

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);
const round5 = (n) => Math.round(n * 1e5) / 1e5;

/**
 * Closed ring approximating a circle (radius in km) around [lng, lat]. `wobble` (0-0.3) makes the outline
 * organic so illustrative zones do not look machine-drawn; it is deterministic (no randomness).
 */
function circleRing([lng, lat], radiusKm, { points = 56, wobble = 0, phase = 0 } = {}) {
  const ring = [];
  for (let i = 0; i < points; i++) {
    const angle = (2 * Math.PI * i) / points;
    const r = radiusKm * (1 + wobble * (0.6 * Math.sin(3 * angle + phase) + 0.4 * Math.sin(5 * angle + 2 * phase)));
    ring.push([round5(lng + (r * Math.cos(angle)) / kmPerDegLng(lat)), round5(lat + (r * Math.sin(angle)) / KM_PER_DEG_LAT)]);
  }
  ring.push(ring[0]);
  return ring;
}

/** Open polyline of a circle/ellipse arc (used for ring roads). */
function circleLine(center, radiusKm, options = {}) {
  return circleRing(center, radiusKm, { points: 72, ...options });
}

/** Polygon covering a corridor of `halfWidthKm` on both sides of a polyline. */
function bufferLine(coords, halfWidthKm) {
  const left = [];
  const right = [];
  coords.forEach(([lng, lat], i) => {
    const prev = coords[Math.max(0, i - 1)];
    const next = coords[Math.min(coords.length - 1, i + 1)];
    const dx = (next[0] - prev[0]) * kmPerDegLng(lat);
    const dy = (next[1] - prev[1]) * KM_PER_DEG_LAT;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    left.push([round5(lng + (nx * halfWidthKm) / kmPerDegLng(lat)), round5(lat + (ny * halfWidthKm) / KM_PER_DEG_LAT)]);
    right.push([round5(lng - (nx * halfWidthKm) / kmPerDegLng(lat)), round5(lat - (ny * halfWidthKm) / KM_PER_DEG_LAT)]);
  });
  const ring = [...left, ...right.reverse()];
  ring.push(ring[0]);
  return ring;
}

function lineLengthKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] });
  }
  return total;
}

const distanceKm = (a, b) => haversineKm({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });

module.exports = { circleRing, circleLine, bufferLine, lineLengthKm, distanceKm };
