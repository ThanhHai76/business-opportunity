'use strict';
/**
 * Builds src/time-machine/landmarks.json — the knowledge the AI Storyteller may answer from — out of the
 * Time Machine page's own data, so the page and the API can never tell different stories:
 *
 *   frontend/src/app/pages/time-machine/tm-data.ts                  eras + landmarks (name, sub, stories)
 *   frontend/src/app/pages/time-machine/landmark-info.ts            sources + dated events
 *   frontend/src/app/pages/time-machine/tm-i18n.ts                  English names, stories, events, Wikipedia titles
 *
 * Run `npm run sync:time-machine` after editing any of these files. test/time-machine.test.js fails when the JSON
 * is out of date. Needs the frontend's node_modules (for the TypeScript compiler).
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGE_DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'app', 'pages', 'time-machine');
const OUT_FILE = path.join(__dirname, '..', 'src', 'time-machine', 'landmarks.json');

function loadTypeScript() {
  return require(path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'typescript'));
}

/** The exports of a data-only .ts file in the page folder, by transpiling it to CommonJS. */
function readModule(ts, name) {
  const file = path.join(PAGE_DIR, name);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, encodeURIComponent }, { timeout: 1000 });
  return module.exports;
}

function buildKnowledge() {
  const ts = loadTypeScript();
  const { ERAS: eras, LANDMARKS: landmarks } = readModule(ts, 'tm-data.ts');
  const { LANDMARK_INFO, LANDMARK_EVENTS } = readModule(ts, 'landmark-info.ts');
  const { EN_LANDMARKS, EN_EVENTS, EN_ERAS, EN_WIKI } = readModule(ts, 'tm-i18n.ts');
  return {
    eras: eras.map(({ id, year, label, future }) => ({ id, year, label, labelEn: EN_ERAS[id]?.label ?? label, future })),
    enWiki: EN_WIKI,
    landmarks: Object.fromEntries(
      Object.entries(landmarks).map(([key, lm]) => [
        key,
        {
          name: lm.name,
          sub: lm.sub,
          stories: lm.stories,
          events: (LANDMARK_EVENTS[key] ?? []).map(({ year, text }) => ({ year, text })),
          sources: (LANDMARK_INFO[key]?.sources ?? []).map(({ title, site, url }) => ({ title, site, url })),
          en: {
            name: EN_LANDMARKS[key]?.name ?? lm.name,
            sub: EN_LANDMARKS[key]?.sub ?? lm.sub,
            stories: EN_LANDMARKS[key]?.stories ?? lm.stories,
            events: (LANDMARK_EVENTS[key] ?? []).map((event, i) => ({ year: EN_EVENTS[key]?.[i]?.year ?? event.year, text: EN_EVENTS[key]?.[i]?.text ?? event.text })),
          },
        },
      ]),
    ),
  };
}

function serialize(knowledge) {
  return `${JSON.stringify(knowledge, null, 2)}\n`;
}

if (require.main === module) {
  fs.writeFileSync(OUT_FILE, serialize(buildKnowledge()));
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`);
}

module.exports = { buildKnowledge, serialize, OUT_FILE };
