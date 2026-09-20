type Position = [number, number];

/** Segments used to approximate each rounded corner. */
const CORNER_STEPS = 8;

/**
 * Turns an axis-aligned rectangular ring ([lng, lat] pairs, closed) into the same rectangle with
 * rounded corners. `radius` is the fraction (0-0.5) of the half-width/half-height that is rounded off.
 * Any other shape is returned untouched, so a backend that starts sending real boundaries keeps working.
 */
export function roundRectRing(ring: Position[], radius = 0.42): Position[] {
  if (ring.length !== 5) return ring;
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const isAxisAligned = ring.every((p) => (p[0] === minX || p[0] === maxX) && (p[1] === minY || p[1] === maxY));
  if (!isAxisAligned || minX === maxX || minY === maxY) return ring;

  const rx = ((maxX - minX) / 2) * Math.min(Math.max(radius, 0), 0.5);
  const ry = ((maxY - minY) / 2) * Math.min(Math.max(radius, 0), 0.5);

  // Corner centres and the angle at which each arc starts (counter-clockwise from bottom-right).
  const corners: Array<{ cx: number; cy: number; from: number }> = [
    { cx: maxX - rx, cy: minY + ry, from: -Math.PI / 2 },
    { cx: maxX - rx, cy: maxY - ry, from: 0 },
    { cx: minX + rx, cy: maxY - ry, from: Math.PI / 2 },
    { cx: minX + rx, cy: minY + ry, from: Math.PI },
  ];

  const out: Position[] = [];
  for (const { cx, cy, from } of corners) {
    for (let i = 0; i <= CORNER_STEPS; i++) {
      const angle = from + ((Math.PI / 2) * i) / CORNER_STEPS;
      out.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
    }
  }
  out.push(out[0]);
  return out;
}

/** Returns a copy of a GeoJSON collection whose rectangular Polygon features have rounded corners. */
export function roundCollection<T extends GeoJSON.FeatureCollection>(collection: T, radius = 0.42): T {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      const geometry = feature.geometry;
      if (geometry?.type !== 'Polygon' || geometry.coordinates.length === 0) return feature;
      const [outer, ...holes] = geometry.coordinates as Position[][];
      return { ...feature, geometry: { ...geometry, coordinates: [roundRectRing(outer, radius), ...holes] } };
    }),
  };
}
