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
          properties: { name: item.name, kind: item.kind, status: item.status, source: item.source ?? 'plan' },
        })),
        meta: {
          note: 'Tuyến và ga đang chạy, đoạn đang xây theo OpenStreetMap; tuyến dự kiến là hướng tuyến xấp xỉ theo quy hoạch.',
          noteEn: 'Lines and stations in service and track under construction as mapped on OpenStreetMap; planned lines are approximate routes from the plans.',
          source: 'OpenStreetMap contributors (ODbL)',
        },
      };
    });
  }
}

module.exports = { InfrastructureService };
