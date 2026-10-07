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

describe('seed data (from the OpenStreetMap snapshot)', () => {
  const seed = getSeedData();
  const ringOf = (slug) => seed.areas.find((a) => a.slug === slug).boundary.coordinates[0];

  it('covers the thirteen areas with complete, in-range scores', () => {
    assert.deepEqual(
      seed.areas.map((a) => a.slug).sort(),
      ['ba-dinh', 'bac-tu-liem', 'cau-giay', 'dong-anh', 'dong-da', 'ha-dong', 'hai-ba-trung', 'hoan-kiem', 'hoang-mai', 'long-bien', 'nam-tu-liem', 'tay-ho', 'thanh-xuan'],
    );
    for (const area of seed.areas) {
      for (const key of CRITERION_KEYS) {
        assert.ok(area.scores[key] >= 0 && area.scores[key] <= 100, `${area.slug}.${key}`);
      }
      assert.ok(area.pros.length > 0);
      assert.ok(area.cons.length > 0);
      assert.deepEqual(area.metrics.map((m) => m.criterion), CRITERION_KEYS);
    }
  });

  it('scores relative to the best area: every criterion has a 100', () => {
    for (const key of CRITERION_KEYS) {
      assert.equal(Math.max(...seed.areas.map((a) => a.scores[key])), 100, key);
    }
  });

  it('measures lakes: Tây Hồ has the most water and names Hồ Tây', () => {
    const tayHo = seed.areas.find((a) => a.slug === 'tay-ho');
    assert.ok(tayHo.facts.waterPct > 20);
    assert.ok(tayHo.facts.lakes.includes('Hồ Tây'));
    assert.ok(seed.areas.find((a) => a.slug === 'hoan-kiem').facts.lakes.includes('Hồ Hoàn Kiếm'));
  });

  it('names the new (2025) wards each circle falls in', () => {
    const cauGiay = seed.areas.find((a) => a.slug === 'cau-giay');
    assert.equal(cauGiay.facts.wards[0].name, 'Phường Cầu Giấy');
    for (const area of seed.areas) {
      assert.ok(area.facts.wards.length > 0, area.slug);
      assert.ok(area.facts.wards.every((w) => /^(Phường|Xã) /.test(w.name) && w.pct >= 8));
    }
  });

  it('writes every text in Vietnamese and English', () => {
    for (const area of seed.areas) {
      for (const text of [area.description, ...area.pros, ...area.cons, ...area.metrics.map((m) => m.text)]) {
        assert.ok(text.vi && text.en && text.vi !== text.en, area.slug);
      }
    }
  });

  it('draws only lines that serve stations in service as operating (OSM also tags planned line 2 as subway)', () => {
    const operating = seed.metro.filter((m) => m.kind === 'metro_line' && m.status === 'operating');
    assert.ok(operating.length >= 2);
    assert.ok(operating.every((m) => m.source === 'osm' && !/Nam Thăng Long/.test(m.name)));
  });

  it('only counts metro stations in service (no planned "S2.01"-style codes)', () => {
    const stations = seed.areas.flatMap((a) => a.facts.metroStations);
    assert.ok(stations.length > 0);
    assert.ok(stations.every((name) => !/^S\d/.test(name)));
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
