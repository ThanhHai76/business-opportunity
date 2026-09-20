'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { CRITERION_KEYS } = require('../../src/living-score/scoring/criteria');
const { getSeedData } = require('../../src/living-score/seed/seed-data');

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

describe('seed data (SAMPLE DATA)', () => {
  const seed = getSeedData();
  const ringOf = (slug) => seed.areas.find((a) => a.slug === slug).boundary.coordinates[0];

  it('covers the ten requested areas with complete, in-range scores', () => {
    assert.deepEqual(
      seed.areas.map((a) => a.slug).sort(),
      ['ba-dinh', 'cau-giay', 'dong-anh', 'dong-da', 'ha-dong', 'hoan-kiem', 'long-bien', 'nam-tu-liem', 'tay-ho', 'thanh-xuan'],
    );
    for (const area of seed.areas) {
      for (const key of CRITERION_KEYS) {
        assert.ok(area.scores[key] >= 0 && area.scores[key] <= 100, `${area.slug}.${key}`);
      }
      assert.ok(area.pros.length > 0);
      assert.ok(area.cons.length > 0);
    }
  });

  it('builds closed boundary rings that contain their own centroid', () => {
    for (const area of seed.areas) {
      const ring = ringOf(area.slug);
      assert.ok(ring.length > 4);
      assert.deepEqual(ring[0], ring[ring.length - 1]);
      assert.equal(pointInRing([area.centroid.lng, area.centroid.lat], ring), true, area.slug);
    }
  });

  it('keeps neighbouring illustrative areas from overlapping', () => {
    for (const area of seed.areas) {
      for (const other of seed.areas) {
        if (other.slug === area.slug) continue;
        assert.equal(pointInRing([other.centroid.lng, other.centroid.lat], ringOf(area.slug)), false, `${other.slug} in ${area.slug}`);
      }
    }
  });

  it('places every generated amenity inside its own area', () => {
    for (const amenity of seed.amenities) {
      assert.equal(pointInRing([amenity.lng, amenity.lat], ringOf(amenity.areaSlug)), true, amenity.name);
    }
  });

  it('is deterministic between calls', () => {
    assert.equal(getSeedData(), seed);
  });
});
