'use strict';
/**
 * `node scripts/apply-official-wards.js` — corrects and fills the population of the wards in
 * src/opportunity/data/hanoi-wards.json from the official list (src/opportunity/data/ward-list-2025.json).
 */
const fs = require('node:fs');
const path = require('node:path');
const { applyOfficialPopulation } = require('../src/opportunity/official-wards');

const FILE = path.join(__dirname, '..', 'src', 'opportunity', 'data', 'hanoi-wards.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const changed = applyOfficialPopulation(data.wards);
for (const c of changed) console.log(`${c.name}: ${c.was ?? 'no figure'} -> ${c.now}`);
fs.writeFileSync(FILE, `${JSON.stringify(data)}\n`);
console.log(`${changed.length} wards updated; ${data.wards.filter((w) => w.population).length} of ${data.wards.length} now have a population.`);
