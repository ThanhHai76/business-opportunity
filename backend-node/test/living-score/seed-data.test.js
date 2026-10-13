'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { CRITERION_KEYS } = require('../../src/living-score/scoring/criteria');
const { getSeedData, LEGACY_SLUGS } = require('../../src/living-score/seed/seed-data');
const WARDS = require('../../src/opportunity/data/hanoi-wards.json').wards;

/** Even-odd point-in-polygon over a GeoJSON Polygon / MultiPolygon. */
function inGeometry([x, y], geometry) {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  return polygons.some((rings) => {
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  });
}

describe('seed data (from the OpenStreetMap snapshot)', () => {
  const seed = getSeedData();
  const area = (slug) => seed.areas.find((a) => a.slug === slug);

  it('covers the 2025 wards of the Opportunity Map, slug for slug, with complete, in-range scores', () => {
    assert.deepEqual(seed.areas.map((a) => a.slug).sort(), WARDS.map((w) => w.slug).sort());
    for (const a of seed.areas) {
      for (const key of CRITERION_KEYS) assert.ok(a.scores[key] >= 0 && a.scores[key] <= 100, `${a.slug}.${key}`);
      assert.ok(a.pros.length > 0);
      assert.ok(a.cons.length > 0);
      assert.deepEqual(a.metrics.map((m) => m.criterion), CRITERION_KEYS);
      assert.match(a.name, /^(Phường|Xã) /);
    }
  });

  it('scores relative to the best ward: every measured criterion has a 100', () => {
    // Transportation mixes bus (60%) and metro (40%) scores, so its best ward need not top both.
    for (const key of CRITERION_KEYS.filter((k) => k !== 'transportation')) assert.equal(Math.max(...seed.areas.map((a) => a.scores[key])), 100, key);
    assert.ok(Math.max(...seed.areas.map((a) => a.scores.transportation)) >= 80);
  });

  it('measures lakes: Tây Hồ has the most water and names Hồ Tây', () => {
    const tayHo = area('phuong-tay-ho');
    assert.equal(Math.max(...seed.areas.map((a) => a.facts.waterPct)), tayHo.facts.waterPct);
    assert.ok(tayHo.facts.lakes.includes('Hồ Tây'));
    assert.ok(area('phuong-hoan-kiem').facts.lakes.includes('Hồ Hoàn Kiếm'));
  });

  it('maps every former district area to the ward that contains its centre', () => {
    assert.equal(Object.keys(LEGACY_SLUGS).length, 13);
    assert.equal(LEGACY_SLUGS['cau-giay'], 'phuong-cau-giay');
    assert.equal(LEGACY_SLUGS['hoan-kiem'], 'phuong-hoan-kiem');
    for (const slug of Object.values(LEGACY_SLUGS)) assert.ok(area(slug), slug);
  });

  it('writes every text in Vietnamese and English', () => {
    for (const a of seed.areas) {
      for (const text of [a.description, ...a.pros, ...a.cons, ...a.metrics.map((m) => m.text)]) {
        assert.ok(text.vi && text.en && text.vi !== text.en, a.slug);
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

  it('measures each ward from a centre inside it, even when its centroid falls outside an odd shape', () => {
    for (const a of seed.areas) assert.equal(inGeometry([a.centroid.lng, a.centroid.lat], a.boundary), true, a.slug);
  });

  it('keeps the wards apart: no ward contains the centre of another', () => {
    for (const a of seed.areas) {
      for (const other of seed.areas) {
        if (other.slug !== a.slug) assert.equal(inGeometry([other.centroid.lng, other.centroid.lat], a.boundary), false, `${other.slug} in ${a.slug}`);
      }
    }
  });

  it('places every listed amenity inside its own ward', () => {
    assert.ok(seed.amenities.length > 1000);
    for (const m of seed.amenities) assert.equal(inGeometry([m.lng, m.lat], area(m.areaSlug).boundary), true, m.name);
  });

  it('is deterministic between calls', () => {
    assert.equal(getSeedData(), seed);
  });
});
