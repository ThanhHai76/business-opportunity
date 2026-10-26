'use strict';
/**
 * The metro stations are one set for every tool (src/metro/stations.js, coordinates from OpenStreetMap). These tests keep
 * the Business Opportunity Map and Property Intelligence from disagreeing again about which wards have a station.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const { STATIONS, SEED_STATIONS, distKm } = require('../src/metro/stations');
const M = require('../src/property-intel/model');
const opportunity = require('../src/opportunity/data/hanoi-wards.json');

describe('Metro stations: one set for every tool', () => {
  let server;
  let living;
  let base;

  before(async () => {
    const created = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      propertyIntel: { config: { aiProvider: 'mock' } },
      premium: { mode: 'off' },
    });
    living = created.living;
    server = await new Promise((resolve) => {
      const s = created.app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await living.close();
  });

  it('takes the coordinates of the stations from OpenStreetMap, which moves them by up to about a kilometre', () => {
    const snapped = STATIONS.filter((s) => s.source === 'osm');
    assert.equal(STATIONS.length, SEED_STATIONS.length);
    assert.ok(snapped.length >= 20, `only ${snapped.length} of ${STATIONS.length} stations have OpenStreetMap coordinates`);
    for (const s of snapped) {
      const seed = SEED_STATIONS.find((x) => x.name === s.name);
      assert.ok(distKm(s.coords, seed.coords) < 1.5, `${s.name} moved too far`);
      assert.ok(s.seedOffsetKm >= 0);
    }
    // Every station keeps its line and status.
    assert.ok(STATIONS.every((s) => ['2A', '3'].includes(s.line) && ['operating', 'construction'].includes(s.status)));
  });

  it('gives the Business Opportunity Map and Property Intelligence the same stations inside every ward', () => {
    const disagree = [];
    for (const w of opportunity.wards) {
      const a = [...w.metroStations].sort();
      const b = [...(M.FACTS.get(w.slug)?.stationsInside ?? [])].sort();
      if (JSON.stringify(a) !== JSON.stringify(b)) disagree.push(`${w.name}: ${a} / ${b}`);
    }
    assert.deepEqual(disagree, []);
  });

  it('finds the stations of Phường Thanh Xuân (Thượng Đình and Vành Đai 3), which it once missed', async () => {
    const res = await fetch(`${base}/api/opportunity/wards/phuong-thanh-xuan?horizon=now&lang=vi`);
    assert.equal(res.status, 200);
    const { facts } = await res.json();
    assert.deepEqual([...facts.metroStations].sort(), ['Thượng Đình', 'Vành Đai 3']);
    assert.equal(facts.metroNearest.line, '2A');
    assert.ok(facts.metroNearest.distanceM < 1500);
  });

  it('says which station is nearest for a ward that has none inside', async () => {
    const without = opportunity.wards.find((w) => !w.metroStations.length && w.population);
    const res = await fetch(`${base}/api/opportunity/wards/${without.slug}?horizon=now&lang=vi`);
    const { facts } = await res.json();
    assert.deepEqual(facts.metroStations, []);
    assert.ok(facts.metroNearest.name);
    assert.ok(Number.isInteger(facts.metroNearest.distanceM) && facts.metroNearest.distanceM > 0);
  });

  it('scores nearness to a station, so a ward beside one counts for more than a far one', () => {
    const scored = opportunity.wards.filter((w) => w.population && w.metroNearest);
    const near = scored.reduce((a, b) => (a.metroNearest.distanceM < b.metroNearest.distanceM ? a : b));
    const far = scored.reduce((a, b) => (a.metroNearest.distanceM > b.metroNearest.distanceM ? a : b));
    assert.ok(near.metroNearest.distanceM < 1000 && far.metroNearest.distanceM > 5000);
  });
});
