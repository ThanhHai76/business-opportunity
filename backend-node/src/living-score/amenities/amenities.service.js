'use strict';

class AmenitiesService {
  constructor(data, cache) {
    this.data = data;
    this.cache = cache;
  }

  /** Amenities as GeoJSON points, optionally limited by type, area and map viewport (bbox). */
  async findAsGeoJson(filter) {
    const bboxKey = filter.bbox ? Object.values(filter.bbox).map((n) => n.toFixed(3)).join(',') : 'all';
    const key = `amenities:${(filter.types ?? []).slice().sort().join('+') || 'all'}:${filter.areaSlug ?? 'all'}:${bboxKey}`;
    return this.cache.wrap(key, async () => {
      const records = await this.data.listAmenities(filter);
      return {
        type: 'FeatureCollection',
        features: records.map((m) => ({
          type: 'Feature',
          id: m.id,
          geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
          properties: { name: m.name, type: m.type, rating: m.rating, areaSlug: m.areaSlug },
        })),
        meta: { total: records.length, sampleData: true },
      };
    });
  }
}

module.exports = { AmenitiesService };
