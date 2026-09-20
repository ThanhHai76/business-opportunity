'use strict';
const { normalizeText } = require('../common/text');

class SearchService {
  constructor(areas, data) {
    this.areas = areas;
    this.data = data;
  }

  /** Accent-insensitive search over areas and named places ("cau giay" finds "Cầu Giấy"). */
  async search(query) {
    const normalized = normalizeText(query);
    if (!normalized) return { query, areas: [], places: [] };
    const [areas, places] = await Promise.all([
      this.areas.list({ q: query, sort: 'score' }),
      this.data.searchAmenities(normalized, 8),
    ]);
    return {
      query,
      areas: areas.data.slice(0, 5),
      places: places.map(({ name, type, areaSlug, lng, lat }) => ({ name, type, areaSlug, lng, lat })),
    };
  }
}

module.exports = { SearchService };
