// After `ng build`: one copy of index.html per page, with that page's own title, description, canonical link and share tags.
// Angular draws the page in the browser, so a link preview (Facebook, Zalo, Messenger...) reads only the tags that are in the
// HTML file itself: without this every page would be previewed with the home page's title. nginx serves /career from career.html.
//
// The titles come from src/app/app.routes.ts and the descriptions from src/app/services/seo.service.ts, so there is one
// place to edit them. SITE_URL=https://example.com npm run build  for another address.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = (process.env.SITE_URL || 'https://hanoicenturyvista.com').replace(/\/+$/, '');
const dist = join(root, 'dist', 'opportunity-map', 'browser');
const PAGES = ['opportunity-map', 'time-machine', 'living-score', 'future-map', 'property-intelligence', 'career', 'giai-thich-diem', 'premium', 'terms', 'privacy', 'refund'];
/** The career page's title is chosen in code (Vietnamese or English), so the file carries the Vietnamese one. */
const FIXED_TITLES = { career: 'La bàn nghề nghiệp Hà Nội · Hanoi Century Vista' };

const routes = readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8');
const seo = readFileSync(join(root, 'src/app/services/seo.service.ts'), 'utf8');

/** Pages whose own route has no title: the first title of their child routes is the one the browser shows. */
const NESTED = { 'living-score': 'src/app/living-score/living-score.routes.ts', 'property-intelligence': 'src/app/property-intel/pi.routes.ts' };
const titleOf = (path) => {
  if (FIXED_TITLES[path]) return FIXED_TITLES[path];
  // The title must come right after the path, in the same route (never a later route's).
  const own = routes.match(new RegExp(`path:\\s*'${path}',\\s*title:\\s*'([^']+)'`));
  if (own) return own[1];
  if (NESTED[path]) return readFileSync(join(root, NESTED[path]), 'utf8').match(/title:\s*'([^']+)'/)?.[1] ?? null;
  return null;
};
const descriptionOf = (path) => {
  const key = /^[a-z]+$/.test(path) ? path : `'${path}'`;
  const m = seo.match(new RegExp(`\\n\\s*${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  return m ? m[1].replace(/\\'/g, "'") : null;
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const src = join(dist, 'index.html');
if (!existsSync(src)) {
  console.error(`route-meta: ${src} not found: run ng build first.`);
  process.exit(1);
}
const html = readFileSync(src, 'utf8');

/** Replaces the content of one tag (matched by its opening), and fails the build if it is not there. */
function setTag(text, open, content) {
  const re = new RegExp(`(${open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*?content=")[^"]*(")`);
  if (!re.test(text)) throw new Error(`route-meta: tag not found in index.html: ${open}`);
  return text.replace(re, (_, a, b) => `${a}${content}${b}`);
}

for (const path of PAGES) {
  const title = titleOf(path);
  const description = descriptionOf(path);
  if (!title || !description) {
    console.error(`route-meta: no title or description found for "${path}" (app.routes.ts, seo.service.ts).`);
    process.exit(1);
  }
  const url = `${site}/${path}`;
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  out = setTag(out, '<meta name="description"', esc(description));
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  out = setTag(out, '<meta property="og:title"', esc(title));
  out = setTag(out, '<meta property="og:description"', esc(description));
  out = setTag(out, '<meta property="og:url"', url);
  out = setTag(out, '<meta name="twitter:title"', esc(title));
  out = setTag(out, '<meta name="twitter:description"', esc(description));
  writeFileSync(join(dist, `${path}.html`), out);
}
// The page of each ward and commune, and the list of them (figures from the same data as the pages: npm run data:wardpages in backend-node).
const wardFile = join(root, 'scripts', 'ward-pages.json');
const wards = existsSync(wardFile) ? JSON.parse(readFileSync(wardFile, 'utf8')) : [];
const write = (relative, title, description, url) => {
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  out = setTag(out, '<meta name="description"', esc(description));
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  out = setTag(out, '<meta property="og:title"', esc(title));
  out = setTag(out, '<meta property="og:description"', esc(description));
  out = setTag(out, '<meta property="og:url"', url);
  out = setTag(out, '<meta name="twitter:title"', esc(title));
  out = setTag(out, '<meta name="twitter:description"', esc(description));
  writeFileSync(join(dist, relative), out);
};
if (wards.length) {
  mkdirSync(join(dist, 'phuong-xa'), { recursive: true });
  write('phuong-xa.html', 'Phường/xã Hà Nội: dân số, diện tích, ga metro, ngành nổi bật · Hanoi Century Vista', 'Danh bạ 126 phường/xã của Hà Nội sau sắp xếp 2025: dân số, diện tích, mật độ, ga metro gần nhất và ngành có điểm cơ hội cao nhất, từ dữ liệu có nguồn.', `${site}/phuong-xa`);
  for (const w of wards) write(join('phuong-xa', `${w.slug}.html`), w.title, w.description, `${site}/phuong-xa/${w.slug}`);
}
console.log(`route-meta: ${PAGES.length} pages and ${wards.length ? wards.length + 1 : 0} ward pages written to ${dist}`);
