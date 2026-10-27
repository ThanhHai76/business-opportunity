// Writes public/robots.txt and public/sitemap.xml from SITE_URL (env, default the production address).
// Runs before every build (npm run build / start). SITE_URL=https://example.com npm run build
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = (process.env.SITE_URL || 'https://hanoicenturyvista.com').replace(/\/+$/, '');
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const pages = ['', 'opportunity-map', 'time-machine', 'living-score', 'future-map', 'property-intelligence', 'career', 'giai-thich-diem', 'premium', 'terms', 'privacy', 'refund'];
const lastmod = new Date().toISOString().slice(0, 10);
// The page of each ward and commune (scripts/ward-pages.json, built by npm run data:wardpages in backend-node).
const wardFile = join(dirname(fileURLToPath(import.meta.url)), 'ward-pages.json');
if (existsSync(wardFile)) pages.push('phuong-xa', ...JSON.parse(readFileSync(wardFile, 'utf8')).map((w) => `phuong-xa/${w.slug}`));

mkdirSync(publicDir, { recursive: true });
writeFileSync(
  join(publicDir, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /reset-password\nDisallow: /verify-email\nDisallow: /forgot-password\n\nSitemap: ${site}/sitemap.xml\n`,
);
writeFileSync(
  join(publicDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${site}/${p}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
console.log(`seo: robots.txt and sitemap.xml for ${site}`);
