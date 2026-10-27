'use strict';
/**
 * The official list of the 126 wards/communes of Hà Nội from 1 July 2025 (data/ward-list-2025.json: area and population, as
 * published by Báo Hà Nội Mới). OpenStreetMap's `population` tag is right for most wards but wrong or missing for a few, so
 * the list is the reference: `applyOfficialPopulation` corrects and fills the population of the wards built from OpenStreetMap
 * (`npm run data:opportunity` calls it; `node scripts/apply-official-wards.js` applies it to the existing file).
 * The area stays the one computed from the outline drawn on the map (it agrees with the list within 5% for 78 of 79 wards).
 */
const LIST = require('./data/ward-list-2025.json');

const BY_NAME = new Map(LIST.units.map((u) => [u.name, u]));

/** The address of a ward: "Phường Cầu Giấy" → "phuong-cau-giay" (the same rule the map data was built with). */
const slugify = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const POPULATION_DATE = '2025-07-01';

/** Sets the population of each ward to the official figure. Returns what changed, for the log. */
function applyOfficialPopulation(wards) {
  const changed = [];
  for (const w of wards) {
    const unit = BY_NAME.get(w.name);
    if (!unit || w.population === unit.population) continue;
    changed.push({ name: w.name, was: w.population ?? null, now: unit.population });
    w.population = unit.population;
    w.populationDate = POPULATION_DATE;
    w.populationSource = LIST.source.publisher;
  }
  return changed;
}

module.exports = { LIST, applyOfficialPopulation, POPULATION_DATE, slugify };
