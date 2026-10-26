'use strict';
/**
 * `node scripts/add-opportunity-kindergartens.js` — adds `counts.kindergartens` (amenity=kindergarten on OpenStreetMap) to every
 * ward of src/opportunity/data/hanoi-wards.json, so the ward panel can show nursery and kindergarten schools apart from
 * `counts.schools` (school, college, university). Kindergartens are also part of the `education` business type: that count is
 * unchanged. The full rebuild (`npm run data:opportunity`) now counts them too; this script only adds the figure to the
 * existing file without downloading everything again. Wards are tested with the file's (simplified) outlines.
 */
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'src', 'opportunity', 'data', 'hanoi-wards.json');
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inWard = (p, g) => g.coordinates.some((poly) => inRing(p, poly[0]) && !poly.slice(1).some((hole) => inRing(p, hole)));

async function overpass(query) {
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(endpoint, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'hanoicenturyvista-kindergartens/1.0' }, signal: AbortSignal.timeout(200_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (error) {
        console.warn(`${endpoint} failed (${error.message}); retrying.`);
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  }
  throw new Error('Overpass unavailable');
}

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const [s, w, n, e] = data.bbox;
  const json = await overpass(`[out:json][timeout:180];nwr["amenity"="kindergarten"](${s},${w},${n},${e});out center tags;`);
  for (const ward of data.wards) ward.counts.kindergartens = 0;
  const seen = new Set();
  let outside = 0;
  for (const el of json.elements) {
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const lng = el.lon ?? el.center?.lon;
    const lat = el.lat ?? el.center?.lat;
    if (lng === undefined) continue;
    const ward = data.wards.find((x) => inWard([lng, lat], x.geometry));
    if (ward) ward.counts.kindergartens++;
    else outside++;
  }
  data.kindergartensCountedAt = json.osm3s?.timestamp_osm_base ?? new Date().toISOString();
  fs.writeFileSync(FILE, `${JSON.stringify(data)}\n`);
  const total = data.wards.reduce((sum, x) => sum + x.counts.kindergartens, 0);
  console.log(`${seen.size} kindergartens downloaded: ${total} inside the ${data.wards.length} wards, ${outside} outside.`);
  const tx = data.wards.find((x) => x.slug === 'phuong-thanh-xuan');
  if (tx) console.log(`Phường Thanh Xuân: ${tx.counts.kindergartens} kindergartens, ${tx.counts.schools} schools.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
