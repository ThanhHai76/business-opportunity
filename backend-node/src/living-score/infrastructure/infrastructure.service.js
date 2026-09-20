'use strict';

class InfrastructureService {
  constructor(data, cache) {
    this.data = data;
    this.cache = cache;
  }

  /** Metro lines/stations, including planned & under-construction ones, as one GeoJSON collection. */
  getGeoJson() {
    return this.cache.wrap('infrastructure:geojson', async () => {
      const items = await this.data.listInfrastructure();
      return {
        type: 'FeatureCollection',
        features: items.map((item) => ({
          type: 'Feature',
          id: item.id,
          geometry: item.geometry,
          properties: { name: item.name, kind: item.kind, status: item.status },
        })),
        meta: {
          sampleData: true,
          note: 'Tuyến và ga metro chỉ mang tính minh hoạ (vị trí xấp xỉ, tiến độ có thể đã thay đổi) — cần đối chiếu nguồn chính thức.',
        },
      };
    });
  }
}

module.exports = { InfrastructureService };
