// Renders scripts/og-image.html to public/og-image.png (1200x630) with Playwright's Chromium. Run when the design changes:
//   node scripts/og-image.mjs   (needs `npx playwright` / a Chromium; set CHROMIUM_PATH if it is not found automatically)
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(join(here, 'og-image.html')).href);
await page.screenshot({ path: join(here, '..', 'public', 'og-image.png') });
await browser.close();
console.log('og-image.png written');
