'use strict';
/**
 * `npm run data:wardpages` — writes frontend/scripts/ward-pages.json: for each of the 126 wards and communes, the address,
 * the title and the description that go into the page's own HTML (frontend/scripts/route-meta.mjs), so a link to a ward
 * shows its name and figures when it is pasted into Zalo or Facebook, and into the sitemap. Built from the same data as the
 * pages (GET /api/opportunity/directory), so the two cannot say different things.
 */
const fs = require('node:fs');
const path = require('node:path');
const { directory } = require('../src/opportunity');

const OUT = path.join(__dirname, '..', '..', 'frontend', 'scripts', 'ward-pages.json');
const vn = (n, digits = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: digits });

const units = directory('vi').units;
const pages = units.map((u) => {
  const kind = u.kind === 'ward' ? 'phường' : 'xã';
  const parts = [`${u.name} (${kind} của Hà Nội): dân số ${vn(u.population)} người (1/7/2025), diện tích ${vn(u.areaKm2, 1)} km², mật độ ${vn(u.density)} người/km².`];
  if (u.top) parts.push(`Ngành có điểm cơ hội cao nhất: ${u.top.name} (${vn(u.top.score, 0)}/100).`);
  if (u.metroNearest) parts.push(`Ga metro gần nhất: ${u.metroNearest.name} (tuyến ${u.metroNearest.line}, cách ${vn(u.metroNearest.distanceM / 1000, 1)} km).`);
  return { slug: u.slug, name: u.name, title: `${u.name}, Hà Nội · Hanoi Century Vista`, description: parts.join(' ') };
});
fs.writeFileSync(OUT, `${JSON.stringify(pages, null, 1)}\n`);
console.log(`${pages.length} ward pages written to ${path.relative(process.cwd(), OUT)}`);
