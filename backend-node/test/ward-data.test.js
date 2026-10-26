'use strict';
/**
 * The ward data (OpenStreetMap outlines and counts) is checked against the official list of the 126 wards and communes of
 * Hà Nội from 1 July 2025 (src/opportunity/data/ward-list-2025.json, from Báo Hà Nội Mới).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../src/opportunity/data/hanoi-wards.json');
const { LIST, applyOfficialPopulation } = require('../src/opportunity/official-wards');

const NQ = require('../src/opportunity/data/nq-1656-units.json');
const official = new Map(LIST.units.map((u) => [u.name, u]));

describe('Ward data against the official list', () => {
  it('lists the 126 units, each once, with an area and a population', () => {
    assert.equal(LIST.units.length, 126);
    assert.equal(new Set(LIST.units.map((u) => u.name)).size, 126);
    assert.ok(LIST.units.every((u) => u.areaKm2 > 0 && Number.isInteger(u.population) && u.population > 0));
    assert.match(LIST.source.url, /^https:\/\//);
  });

  it('has exactly the 126 units that Resolution 1656/NQ-UBTVQH15 creates in Hà Nội (51 wards, 75 communes)', () => {
    assert.equal(NQ.units.length, 126);
    assert.equal(NQ.units.filter((n) => n.startsWith('Phường')).length, 51);
    assert.deepEqual([...NQ.units].sort(), LIST.units.map((u) => u.name).sort());
    assert.match(NQ.source.url, /^https:\/\//);
  });

  it('knows every ward of the map by its official name', () => {
    assert.deepEqual(DATA.wards.filter((w) => !official.has(w.name)).map((w) => w.name), []);
  });

  it('gives every ward the official population', () => {
    const wrong = DATA.wards.filter((w) => w.population !== official.get(w.name).population).map((w) => `${w.name}: ${w.population} / ${official.get(w.name).population}`);
    assert.deepEqual(wrong, []);
    // Re-applying the list changes nothing (the build and the file agree).
    assert.deepEqual(applyOfficialPopulation(structuredClone(DATA.wards)), []);
  });

  it('draws every ward with an area within 8% of the official one (the outlines are right)', () => {
    const far = DATA.wards.filter((w) => Math.abs(w.areaKm2 / official.get(w.name).areaKm2 - 1) > 0.08).map((w) => `${w.name}: ${w.areaKm2} / ${official.get(w.name).areaKm2}`);
    assert.deepEqual(far, []);
  });

  it('counts kindergartens apart from schools in every ward', () => {
    assert.ok(DATA.wards.every((w) => Number.isInteger(w.counts.kindergartens) && w.counts.kindergartens >= 0));
    assert.ok(DATA.wards.reduce((sum, w) => sum + w.counts.kindergartens, 0) > 300);
  });
});
