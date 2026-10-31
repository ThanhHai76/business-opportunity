// Draws the home page's hero illustration: the Hanoi skyline looking towards its 100-year plan, as an Angular
// component (inline SVG, so its colours follow the light / dark theme through CSS variables).
// Run after changing it: node scripts/skyline.mjs  → src/app/pages/home/hero-skyline.component.ts
// Deterministic (seeded): the same picture on every run.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'pages', 'home', 'hero-skyline.component.ts');

let seed = 20261019;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const r = (lo, hi) => lo + rand() * (hi - lo);
const f = (n) => Math.round(n * 10) / 10;

const W = 1600;
const H = 640;
const TOP = -170; // extra sky above y = 0, so the city stays below the hero's text
const BANK = 505; // where the city meets the river bank
const RIVER = 518;

// ------------------------------------------------------------------ sky
const stars = Array.from({ length: 46 }, (_, i) => {
  const x = f(r(10, W - 10));
  const y = f(r(TOP + 10, 300));
  return `<circle class="hcv-star" style="animation-delay:${f(r(0, 6))}s" cx="${x}" cy="${y}" r="${f(r(0.7, 1.8))}"/>`;
}).join('');

// The 9 development poles of the 100-year plan, as a constellation joined by planning lines.
const poles = [
  [90, 160], [250, 92], [400, 150], [330, 236], [800, -95], [1250, 330], [1290, 120], [1450, 170], [1530, 70],
];
const net =
  // left cluster, right cluster, and an arc above the heading joining them through the ninth pole
  `<polyline class="hcv-net" points="90,160 250,92 400,150 330,236"/>` +
  `<polyline class="hcv-net" points="1250,330 1290,120 1450,170 1530,70"/>` +
  `<path class="hcv-net" d="M250,92 Q420,-110 800,-95 Q1180,-110 1290,120"/>` +
  `<path class="hcv-net hcv-net--thin" d="M90,160 L330,236 L400,150 M1250,330 L1450,170 M1290,120 L1530,70"/>` +
  poles.map(([x, y]) => `<circle class="hcv-pole-halo" cx="${x}" cy="${y}" r="9"/><circle class="hcv-pole" cx="${x}" cy="${y}" r="3.2"/>`).join('');

// ------------------------------------------------------------------ far towers (the future city, hazy)
const envelope = (x) => {
  // taller towards the new centres: west (left) and north-east (right of centre)
  const west = Math.exp(-(((x - 230) / 220) ** 2)) * 80;
  const ne = Math.exp(-(((x - 1120) / 220) ** 2)) * 95;
  // lower under the heading (centre)
  const centreDip = Math.exp(-(((x - 760) / 260) ** 2)) * 40;
  return 60 + west + ne - centreDip;
};
let farTowers = '';
let windows = '';
for (let x = -10; x < W; ) {
  const w = f(r(24, 52));
  const h = f(envelope(x) + r(-25, 45));
  const top = BANK - 18 - h;
  const kind = rand();
  if (kind < 0.18) {
    // tower with a spire
    farTowers += `<rect x="${x}" y="${top}" width="${w}" height="${h + 20}"/><rect x="${f(x + w / 2 - 1.2)}" y="${f(top - r(18, 40))}" width="2.4" height="${f(r(18, 40))}"/>`;
  } else if (kind < 0.32) {
    // rounded top
    farTowers += `<path d="M${x},${BANK + 2} V${f(top + w / 2)} A${f(w / 2)},${f(w / 2)} 0 0 1 ${f(x + w)},${f(top + w / 2)} V${BANK + 2} Z"/>`;
  } else if (kind < 0.44) {
    // slanted roof
    farTowers += `<path d="M${x},${BANK + 2} V${f(top + 14)} L${f(x + w)},${top} V${BANK + 2} Z"/>`;
  } else {
    farTowers += `<rect x="${x}" y="${top}" width="${w}" height="${h + 20}"/>`;
  }
  // a few lit windows (shown at night)
  for (let wy = top + 10; wy < BANK - 30; wy += 11) {
    for (let wx = x + 5; wx < x + w - 6; wx += 8) {
      if (rand() < 0.09) windows += `<rect x="${f(wx)}" y="${f(wy)}" width="3" height="4"/>`;
    }
  }
  x = f(x + w + r(-6, 8));
}

// ------------------------------------------------------------------ mid layer: the new centre and the old town
let lowRise = '';
for (let x = 430; x < 900; ) {
  const w = f(r(22, 46));
  const h = f(r(30, 95));
  lowRise += `<rect x="${x}" y="${f(BANK - h)}" width="${w}" height="${h + 4}"/>`;
  x = f(x + w + r(0, 6));
}
const centre = [
  // a landmark tower with a slanted crown
  `<path d="M985,${BANK + 2} V292 L1061,272 V${BANK + 2} Z"/>`,
  `<rect x="1018" y="246" width="3" height="30"/>`,
  // twin towers
  `<rect x="1080" y="326" width="34" height="${BANK - 324}"/>`,
  `<rect x="1122" y="306" width="34" height="${BANK - 304}"/>`,
  `<rect x="1112" y="360" width="12" height="6"/>`,
  // curved tower
  `<path d="M905,${BANK + 2} V372 Q905,340 930,334 Q955,340 955,372 V${BANK + 2} Z"/>`,
  // stepped tower
  `<path d="M1176,${BANK + 2} V370 H1188 V346 H1208 V370 H1220 V${BANK + 2} Z"/>`,
].join('');
// Green tower: a made-up tower of the plan's "green city" — a rectangular body with a planted terrace on every
// other floor and a roof garden. Stands on the left, behind the Long Biên bridge, clear of the Nhật Tân cables.
const GT = { x: 318, w: 58, top: 318 };
// Neighbours of the green tower, so it stands in a green district and not alone: lower blocks on both sides, a
// couple of them with planted terraces, drawn from the farthest to the nearest. No random numbers (the rest of the
// picture keeps its trees and ripples).
let neighbours = '';
[
  { x: 214, w: 40, top: 376, far: true },
  { x: 402, w: 34, top: 362, far: true },
  { x: 292, w: 30, top: 332, far: true }, // partly behind the green tower
  { x: 258, w: 44, top: 350, planters: true },
  { x: 382, w: 40, top: 342, planters: true, slant: true },
].forEach((b, n) => {
  const cls = b.far ? 'hcv-mid' : 'hcv-mid-strong';
  neighbours += b.slant
    ? `<path class="${cls}" d="M${b.x},${BANK + 2} V${b.top + 12} L${b.x + b.w},${b.top} V${BANK + 2} Z"/>`
    : `<rect class="${cls}" x="${b.x}" y="${b.top}" width="${b.w}" height="${BANK + 2 - b.top}"/>`;
  let lit = '';
  for (let j = 0, y = b.top + 12; y < BANK - 24; j++, y += 11) {
    for (let i = 0, x = b.x + 6; x < b.x + b.w - 8; i++, x += 8) if ((i * 5 + j * 3 + n) % 4 === 0) lit += `<rect x="${x}" y="${y}" width="3" height="4"/>`;
  }
  neighbours += `<g class="hcv-windows">${lit}</g>`;
  if (b.planters) {
    for (let k = 0, y = b.top + 16; y < BANK - 14; k++, y += 17) {
      const x = k % 2 === 0 ? b.x - 3 : b.x + b.w - 23;
      neighbours += `<rect class="hcv-terrace" x="${x}" y="${y}" width="26" height="3.5"/>`;
      for (let i = 0; i < 3; i++) neighbours += `<circle class="hcv-green" cx="${f(x + 4 + i * 9)}" cy="${y - 1}" r="${i === 1 ? 3.6 : 3}"/>`;
    }
    neighbours += `<circle class="hcv-green" cx="${b.x + b.w / 2}" cy="${b.top - 3}" r="6"/>`;
  }
});

let greenTower = neighbours +
  `<rect class="hcv-mid-strong" x="${GT.x}" y="${GT.top}" width="${GT.w}" height="${BANK + 2 - GT.top}"/>` +
  `<rect class="hcv-mid-strong" x="${GT.x + 10}" y="${GT.top - 14}" width="${GT.w - 20}" height="15"/>`;
for (let k = 0, y = GT.top + 12; y < BANK - 12; k++, y += 17) {
  const x = k % 2 === 0 ? GT.x - 5 : GT.x + GT.w - 37; // terraces alternate left and right
  greenTower += `<rect class="hcv-terrace" x="${x}" y="${y}" width="42" height="4"/>`;
  for (let i = 0; i < 5; i++) greenTower += `<circle class="hcv-green" cx="${f(x + 4 + i * 8.5)}" cy="${y - 1}" r="${i % 2 ? 4.2 : 3.4}"/>`;
}
for (const [dx, dy, rr] of [[18, -15, 7], [30, -19, 9], [42, -14, 6.5]]) greenTower += `<circle class="hcv-green" cx="${GT.x + dx}" cy="${GT.top + dy}" r="${rr}"/>`;

// ------------------------------------------------------------------ elevated metro (with a train)
let metro = `<rect class="hcv-landmark" x="430" y="452" width="740" height="6" rx="2"/>`;
for (let x = 450; x <= 1150; x += 70) metro += `<rect class="hcv-landmark" x="${x}" y="456" width="7" height="${BANK - 456}"/>`;
const train =
  `<g class="hcv-train">` +
  [0, 1, 2]
    .map((i) => {
      const x = 440 + i * 47;
      return `<rect x="${x}" y="437" width="44" height="14" rx="5"/><rect class="hcv-train-win" x="${x + 6}" y="440" width="32" height="4" rx="2"/>`;
    })
    .join('') +
  `</g>`;

// ------------------------------------------------------------------ landmarks
// Hanoi Flag Tower: three tiers, the octagonal shaft, the lantern, the flag.
const flagTower =
  `<g class="hcv-landmark">` +
  `<rect x="700" y="470" width="120" height="37"/><rect x="714" y="446" width="92" height="25"/><rect x="728" y="426" width="64" height="21"/>` +
  `<rect x="748" y="366" width="24" height="61"/><rect x="742" y="355" width="36" height="12"/><rect x="752" y="340" width="16" height="16"/>` +
  `<rect x="759" y="300" width="2" height="42"/></g>` +
  `<rect class="hcv-flag-gate" x="752" y="488" width="16" height="19" rx="8"/>` +
  `<path class="hcv-flag" d="M761,302 L793,309 L761,317 Z"/>`;
// The small pavilion next to the metro: the gate of four arches, the square pavilion with its round windows, two tiers of curved eaves.
const pavilion =
  `<g class="hcv-landmark">` +
  `<rect x="520" y="474" width="80" height="33"/>` +
  `<rect x="538" y="440" width="44" height="30"/>` +
  `<path d="M512,476 Q560,466 608,476 L600,470 Q560,461 520,470 Z"/>` +
  `<path d="M530,442 Q560,431 590,442 L583,435 Q560,426 537,435 Z"/>` +
  `<path d="M546,436 Q560,420 574,436 Z"/><rect x="559" y="414" width="2" height="9"/></g>` +
  `<g class="hcv-gap">` +
  [526, 545, 564, 583].map((x) => `<path d="M${x},507 V490 Q${x + 5.5},482 ${x + 11},490 V507 Z"/>`).join('') +
  `<circle cx="551" cy="455" r="5"/><circle cx="569" cy="455" r="5"/></g>`;

// Văn Miếu's Khuê Văn Các (Temple of Literature), the same drawing as the site logo, scaled up and given heavier strokes so it sits with the
// solid shapes around it: flame finial, horned upper roof, wide lower roof with curled tips, red body with the square window and its ring
// of rays, solid railings, platform, tall stone pillars. Drawn in a 32 x 32 box; the top part is lifted (UP) so the platform clears the metro deck.
const PAV = { scale: 3, cx: 1030, up: 4.7 };
const vanMieu =
  `<g transform="translate(${PAV.cx - 16 * PAV.scale} ${BANK - 32 * PAV.scale}) scale(${PAV.scale})">` +
  `<g transform="translate(0 -${PAV.up})">` +
  `<path class="hcv-landmark" d="M16 .1 C16.9 1.2 17.7 2 17.2 3.2 L14.8 3.2 C14.3 2 15.1 1.2 16 .1Z"/><circle class="hcv-landmark" cx="16" cy="2.9" r="1"/>` +
  `<path class="hcv-landmark" d="M9.4 .8 C10.3 2.8 12.6 3.7 16 3.8 C19.4 3.7 21.7 2.8 22.6 .8 C22.8 2.6 23.6 4.2 24.9 5.2 H7.1 C8.4 4.2 9.2 2.6 9.4 .8Z"/>` +
  `<path class="hcv-landmark" fill="none" stroke-width="1" stroke-linecap="round" d="M7.1 4.8 C5.9 5.1 5 4.3 5.2 3.3 C5.4 2.6 6.3 2.8 6.2 3.5 M24.9 4.8 C26.1 5.1 27 4.3 26.8 3.3 C26.6 2.6 25.7 2.8 25.8 3.5" style="stroke: var(--hcv-landmark)"/>` +
  `<path class="hcv-landmark" opacity=".75" d="M7.2 5.2 H24.8 L22.9 7 H9.1Z"/>` +
  `<path class="hcv-landmark" opacity=".9" d="M3.7 7.4 L9.1 8.2 V14.8 L7.5 14.8Z M28.3 7.4 L22.9 8.2 V14.8 L24.5 14.8Z"/>` +
  `<path class="hcv-landmark" d="M2.1 4.7 C2.6 7 4.8 7.6 7.6 6.6 H24.4 C27.2 7.6 29.4 7 29.9 4.7 C30.3 7.4 28 9.2 23.6 9.3 H8.4 C4 9.2 1.7 7.4 2.1 4.7Z"/>` +
  `<clipPath id="hcv-win"><rect x="12.4" y="9.8" width="7.2" height="6.5"/></clipPath>` +
  `<rect class="hcv-pav-red" x="9.1" y="8.8" width="13.8" height="8.8"/><rect class="hcv-gap" x="12.4" y="9.8" width="7.2" height="6.5"/>` +
  `<g clip-path="url(#hcv-win)" fill="none" style="stroke: var(--hcv-pav-red)"><circle cx="16" cy="13" r="2.4" stroke-width="1.1"/>` +
  `<path stroke-width=".8" d="M16 7.5 V10.2 M16 15.8 V18.3 M10 13 H13.6 M18.4 13 H22 M12 9.3 L14.1 11.2 M20 9.3 L17.9 11.2 M12 16.7 L14.1 14.8 M20 16.7 L17.9 14.8"/></g>` +
  `<g class="hcv-pav-red"><rect x="5.8" y="15.2" width="6.6" height="2.2" opacity=".85"/><rect x="19.6" y="15.2" width="6.6" height="2.2" opacity=".85"/>` +
  `<rect x="5.4" y="17.4" width="21.2" height="2" rx=".3"/></g></g>` +
  `<g class="hcv-landmark"><rect x="5.4" y="${19.4 - PAV.up}" width="4.2" height="${12.6 + PAV.up}"/><rect x="22.4" y="${19.4 - PAV.up}" width="4.2" height="${12.6 + PAV.up}"/>` +
  `<rect x="9.6" y="${19.4 - PAV.up}" width="12.8" height="2" opacity=".8"/><rect x="9.6" y="${21.4 - PAV.up}" width="2.6" height="${9.3 + PAV.up}" opacity=".8"/><rect x="19.8" y="${21.4 - PAV.up}" width="2.6" height="${9.3 + PAV.up}" opacity=".8"/></g></g>`;

// Hồ Chí Minh Mausoleum: the stepped granite base, the colonnade, the heavy flat roof in tiers.
const mausoleum =
  `<g class="hcv-landmark">` +
  `<rect x="828" y="492" width="144" height="15"/><rect x="836" y="482" width="128" height="11"/>` +
  `<rect x="846" y="452" width="108" height="31"/>` +
  `<rect x="840" y="440" width="120" height="13"/><rect x="852" y="432" width="96" height="9"/><rect x="864" y="426" width="72" height="7"/></g>` +
  `<g class="hcv-gap">` +
  Array.from({ length: 8 }, (_, i) => `<rect x="${852 + i * 12.6}" y="455" width="6.4" height="27"/>`).join('') +
  `</g>`;

// Hoàn Kiếm Lake: the Turtle Tower on its islet (three tiers, arched openings, a small spire), a willow, its reflection.
const TURTLE_BASE = 574;
const turtleTower =
  `<g class="hcv-turtle">` +
  `<rect x="610" y="${TURTLE_BASE - 32}" width="60" height="32"/>` +
  `<path d="M602,${TURTLE_BASE - 30} Q640,${TURTLE_BASE - 38} 678,${TURTLE_BASE - 30} L672,${TURTLE_BASE - 35} Q640,${TURTLE_BASE - 42} 608,${TURTLE_BASE - 35} Z"/>` +
  `<rect x="620" y="${TURTLE_BASE - 56}" width="40" height="22"/>` +
  `<path d="M613,${TURTLE_BASE - 54} Q640,${TURTLE_BASE - 61} 667,${TURTLE_BASE - 54} L662,${TURTLE_BASE - 59} Q640,${TURTLE_BASE - 65} 618,${TURTLE_BASE - 59} Z"/>` +
  `<rect x="629" y="${TURTLE_BASE - 74}" width="22" height="16"/>` +
  `<path d="M624,${TURTLE_BASE - 72} Q640,${TURTLE_BASE - 80} 656,${TURTLE_BASE - 72} Z"/>` +
  `<rect x="639" y="${TURTLE_BASE - 90}" width="2" height="12"/><circle cx="640" cy="${TURTLE_BASE - 91}" r="2.5"/></g>` +
  `<g class="hcv-turtle-arch">` +
  [614, 634, 654].map((x) => `<path d="M${x},${TURTLE_BASE} V${TURTLE_BASE - 16} Q${x + 6},${TURTLE_BASE - 25} ${x + 12},${TURTLE_BASE - 16} V${TURTLE_BASE} Z"/>`).join('') +
  [628, 644].map((x) => `<path d="M${x},${TURTLE_BASE - 36} V${TURTLE_BASE - 44} Q${x + 4},${TURTLE_BASE - 50} ${x + 8},${TURTLE_BASE - 44} V${TURTLE_BASE - 36} Z"/>`).join('') +
  `<circle cx="640" cy="${TURTLE_BASE - 66}" r="3.2"/></g>`;
const willow =
  `<g class="hcv-tree">` +
  `<path d="M690,${TURTLE_BASE} V${TURTLE_BASE - 34}" class="hcv-trunk"/>` +
  `<path d="M666,${TURTLE_BASE - 2} Q668,${TURTLE_BASE - 48} 690,${TURTLE_BASE - 52} Q714,${TURTLE_BASE - 48} 714,${TURTLE_BASE - 4} Q706,${TURTLE_BASE - 26} 700,${TURTLE_BASE - 6} Q694,${TURTLE_BASE - 30} 688,${TURTLE_BASE - 4} Q680,${TURTLE_BASE - 28} 676,${TURTLE_BASE - 6} Q672,${TURTLE_BASE - 22} 666,${TURTLE_BASE - 2} Z"/></g>`;
// Thê Húc Bridge: the red wooden arched bridge, with its railing, leading from a bit of shore to the islet.
const BR = { x0: 462, x1: 576, peak: 17 }; // landing, islet end, rise of the arch
const BR_Y = TURTLE_BASE + 2;
const bridgeAt = (t) => ({
  x: f(BR.x0 + (BR.x1 - BR.x0) * t),
  y: f((1 - t) * (1 - t) * BR_Y + 2 * (1 - t) * t * (BR_Y - 2 * BR.peak) + t * t * BR_Y),
});
const BR_RAIL = 10;
const theHuc =
  `<ellipse class="hcv-islet" cx="${BR.x0 - 8}" cy="${BR_Y}" rx="34" ry="6"/>` +
  `<g class="hcv-bridge">` +
  `<path class="hcv-bridge-deck" d="M${BR.x0},${BR_Y} Q${f((BR.x0 + BR.x1) / 2)},${BR_Y - 2 * BR.peak} ${BR.x1},${BR_Y}"/>` +
  `<path class="hcv-bridge-rail" d="M${BR.x0},${BR_Y - BR_RAIL} Q${f((BR.x0 + BR.x1) / 2)},${BR_Y - 2 * BR.peak - BR_RAIL} ${BR.x1},${BR_Y - BR_RAIL}"/>` +
  Array.from({ length: 11 }, (_, i) => {
    const p = bridgeAt(i / 10);
    return `<path class="hcv-bridge-post" d="M${p.x},${p.y} V${f(p.y - BR_RAIL)}"/>`;
  }).join('') +
  // two low supports under the deck
  [0.3, 0.7].map((t) => { const p = bridgeAt(t); return `<path class="hcv-bridge-post" d="M${p.x},${p.y} V${p.y + 6}"/>`; }).join('') +
  `</g>`;
const islet = `<ellipse class="hcv-islet" cx="652" cy="${TURTLE_BASE + 2}" rx="78" ry="7"/>`;
const hoanKiem =
  // the reflection: the same drawing mirrored under the islet
  `<g class="hcv-reflection" transform="translate(0 ${2 * TURTLE_BASE + 4}) scale(1 -1)">${turtleTower}${willow}${theHuc}</g>` +
  islet +
  theHuc +
  turtleTower +
  willow;

// ------------------------------------------------------------------ trees along the bank
let trees = '';
for (let x = 430; x < 1175; x += r(9, 16)) {
  if ((x > 512 && x < 610) || (x > 694 && x < 826) || (x > 822 && x < 978)) continue;
  trees += `<circle cx="${f(x)}" cy="${f(BANK - r(0, 6))}" r="${f(r(7, 15))}"/>`;
}

// ------------------------------------------------------------------ Long Biên bridge (left): steel truss spans
let longBien = `<rect class="hcv-steel-fill" x="-10" y="506" width="450" height="5"/>`;
for (let x = -10; x < 440; x += 90) {
  const mid = x + 45;
  longBien += `<path class="hcv-steel" d="M${x},507 Q${mid},458 ${x + 90},507"/>`;
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    const px = x + 90 * t;
    const py = (1 - t) * (1 - t) * 507 + 2 * (1 - t) * t * 458 + t * t * 507;
    longBien += `<path class="hcv-steel hcv-steel--thin" d="M${f(px)},507 V${f(py)} ${k < 8 ? `L${f(px + 10)},507` : ''}"/>`;
  }
  longBien += `<rect class="hcv-steel-fill" x="${x - 4}" y="507" width="8" height="${RIVER + 26 - 507}"/>`;
}

// ------------------------------------------------------------------ Nhật Tân bridge (right): five diamond pylons, cable fans
let nhatTan = `<rect class="hcv-cable-fill" x="1170" y="510" width="440" height="4"/>`;
for (const px of [1225, 1320, 1415, 1510, 1605]) {
  nhatTan += `<path class="hcv-pylon" d="M${px - 15},512 L${px},372 L${px + 15},512 M${px - 9},462 H${px + 9}"/>`;
  for (let k = 0; k < 7; k++) {
    const y = 384 + k * 9;
    const d = 22 + k * 10;
    nhatTan += `<path class="hcv-cable" d="M${px},${y} L${px - d},511 M${px},${y} L${px + d},511"/>`;
  }
}

// ------------------------------------------------------------------ river shimmer
let shimmer = '';
for (let i = 0; i < 70; i++) {
  const x = f(r(0, W));
  const y = f(r(RIVER + 8, H - 40));
  shimmer += `<path d="M${x},${y} h${f(r(10, 46))}"/>`;
}
// the sun's (or the moon's) path on the water
let sunPath = '';
for (let y = RIVER + 10; y < H - 30; y += 9) {
  const half = f(40 + (y - RIVER) * 0.35 + r(-8, 8));
  sunPath += `<path d="M${f(1180 - half + r(-6, 6))},${y} h${f(half * r(0.4, 0.9))} M${f(1180 + r(0, 20))},${y + 3} h${f(half * r(0.3, 0.8))}"/>`;
}

const svg = `<svg class="hcv" viewBox="0 ${TOP} ${W} ${H - TOP}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="hcv-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color: var(--app-bg)"/>
      <stop offset="0.45" style="stop-color: var(--hcv-sky-mid)"/>
      <stop offset="0.82" style="stop-color: var(--hcv-sky-horizon)"/>
    </linearGradient>
    <radialGradient id="hcv-glow">
      <stop offset="0" style="stop-color: var(--hcv-sun); stop-opacity: 0.55"/>
      <stop offset="1" style="stop-color: var(--hcv-sun); stop-opacity: 0"/>
    </radialGradient>
    <linearGradient id="hcv-river" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color: var(--hcv-river)"/>
      <stop offset="1" style="stop-color: var(--app-bg)"/>
    </linearGradient>
  </defs>
  <rect y="${TOP}" width="${W}" height="${H - TOP}" fill="url(#hcv-sky)"/>
  <g class="hcv-stars">${stars}</g>
  <circle cx="1180" cy="250" r="230" fill="url(#hcv-glow)"/>
  <circle class="hcv-sun" cx="1180" cy="250" r="58"/>
  <g class="hcv-plan">${net}</g>
  <g class="hcv-far">${farTowers}</g>
  <g class="hcv-windows">${windows}</g>
  <g class="hcv-mid">${lowRise}</g>
  <g class="hcv-mid-strong">${centre}</g>
  ${greenTower}
  ${metro}
  ${train}
  ${pavilion}
  ${vanMieu}
  ${flagTower}
  ${mausoleum}
  <g class="hcv-tree">${trees}</g>
  <rect class="hcv-bank" x="0" y="${BANK}" width="${W}" height="${RIVER - BANK + 2}"/>
  <rect x="0" y="${RIVER}" width="${W}" height="${H - RIVER}" fill="url(#hcv-river)"/>
  <g class="hcv-sunpath">${sunPath}</g>
  <g class="hcv-shimmer">${shimmer}</g>
  ${hoanKiem}
  ${longBien}
  ${nhatTan}
</svg>`;

const component = `// GENERATED by frontend/scripts/skyline.mjs — edit the script and run it again, not this file.
import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The home page's hero illustration: Hanoi looking towards its 100-year plan — the Red River with the Long Biên and
 * Nhật Tân bridges, the Flag Tower, Khuê Văn Các, Hồ Chí Minh Mausoleum, the Turtle Tower and the red Thê Húc Bridge on Hoàn Kiếm Lake, an elevated metro, the new centres, and the plan's 9 development
 * poles as a constellation. Dawn in the light theme, night (stars, lit windows) in the dark one. Decorative only.
 */
@Component({
  selector: 'app-hero-skyline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`${svg}\`,
  styles: \`
    :host {
      --hcv-sky-mid: #f4e7d4;
      --hcv-sky-horizon: #f0cda4;
      --hcv-sun: #f0a457;
      --hcv-accent: var(--app-future);
      --hcv-far: #e3d5c2;
      --hcv-mid: #cfbca3;
      --hcv-mid-strong: #b9a286;
      --hcv-landmark: #8c745c;
      --hcv-green: #86a873;
      --hcv-flag: #c8402f;
      --hcv-pav-red: #b5543f;
      --hcv-turtle: #a88f6e;
      --hcv-steel: #97705a;
      --hcv-cable: #b8a089;
      --hcv-tree: #7d9768;
      --hcv-bank: #c7b498;
      --hcv-river: #e6d3b9;
      --hcv-shimmer: #fff8ec;
      --hcv-window: #ffd27a;
      --hcv-stars-opacity: 0;
      --hcv-windows-opacity: 0;
      display: block;
    }
    :host-context([data-theme='dark']) {
      --hcv-sky-mid: #171528;
      --hcv-sky-horizon: #2a2340;
      --hcv-sun: #f3ead9;
      --hcv-far: #24213a;
      --hcv-mid: #1e1b2f;
      --hcv-mid-strong: #1a1729;
      --hcv-landmark: #110f19;
      --hcv-green: #1d3a2d;
      --hcv-flag: #e0705f;
      --hcv-pav-red: #d46f5c;
      --hcv-turtle: #b08a52; /* lit up at night, as it is */
      --hcv-steel: #3d3448;
      --hcv-cable: #4c4565;
      --hcv-tree: #12161a;
      --hcv-bank: #14121b;
      --hcv-river: #191628;
      --hcv-shimmer: #f3ead9;
      --hcv-stars-opacity: 0.85;
      --hcv-windows-opacity: 0.9;
    }
    .hcv { display: block; width: 100%; height: 100%; }
    .hcv-sun { fill: var(--hcv-sun); }
    .hcv-stars { opacity: var(--hcv-stars-opacity); fill: var(--app-ink); }
    .hcv-star { animation: hcv-twinkle 6s ease-in-out infinite; }
    .hcv-net { fill: none; stroke: var(--hcv-accent); stroke-width: 1.4; stroke-dasharray: 5 7; opacity: 0.55; animation: hcv-flow 40s linear infinite; }
    .hcv-net--thin { stroke-width: 1; opacity: 0.3; }
    .hcv-pole { fill: var(--hcv-accent); }
    .hcv-pole-halo { fill: var(--hcv-accent); opacity: 0.18; }
    .hcv-far { fill: var(--hcv-far); }
    .hcv-windows { fill: var(--hcv-window); opacity: var(--hcv-windows-opacity); }
    .hcv-mid { fill: var(--hcv-mid); }
    .hcv-mid-strong { fill: var(--hcv-mid-strong); }
    .hcv-green { fill: var(--hcv-green); }
    .hcv-terrace { fill: var(--hcv-landmark); opacity: 0.55; }
    .hcv-landmark { fill: var(--hcv-landmark); }
    .hcv-gap, .hcv-flag-gate { fill: var(--hcv-sky-horizon); }
    .hcv-flag { fill: var(--hcv-flag); }
    .hcv-pav-red { fill: var(--hcv-pav-red); }
    .hcv-turtle { fill: var(--hcv-turtle); }
    .hcv-turtle-arch { fill: var(--hcv-river); }
    .hcv-islet { fill: var(--hcv-tree); }
    .hcv-trunk { fill: none; stroke: var(--hcv-landmark); stroke-width: 2.5; }
    .hcv-reflection { opacity: 0.2; }
    .hcv-bridge-deck { fill: none; stroke: var(--hcv-flag); stroke-width: 5; stroke-linecap: round; }
    .hcv-bridge-rail { fill: none; stroke: var(--hcv-flag); stroke-width: 1.8; stroke-linecap: round; }
    .hcv-bridge-post { stroke: var(--hcv-flag); stroke-width: 1.8; }
    .hcv-train { fill: var(--hcv-accent); animation: hcv-train 26s linear infinite; }
    .hcv-train-win { fill: var(--app-bg); opacity: 0.85; }
    .hcv-tree { fill: var(--hcv-tree); }
    .hcv-bank { fill: var(--hcv-bank); }
    .hcv-sunpath { stroke: var(--hcv-sun); stroke-width: 2; stroke-linecap: round; opacity: 0.45; }
    .hcv-shimmer { stroke: var(--hcv-shimmer); stroke-width: 1.4; stroke-linecap: round; opacity: 0.45; }
    .hcv-steel { fill: none; stroke: var(--hcv-steel); stroke-width: 3; }
    .hcv-steel--thin { stroke-width: 1.3; }
    .hcv-steel-fill { fill: var(--hcv-steel); }
    .hcv-pylon { fill: none; stroke: var(--hcv-landmark); stroke-width: 5; stroke-linejoin: round; }
    .hcv-cable { stroke: var(--hcv-cable); stroke-width: 0.9; }
    .hcv-cable-fill { fill: var(--hcv-landmark); }
    @keyframes hcv-twinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
    @keyframes hcv-flow { to { stroke-dashoffset: -480; } }
    @keyframes hcv-train {
      0% { transform: translateX(0); opacity: 0; }
      6% { opacity: 1; }
      92% { opacity: 1; }
      100% { transform: translateX(560px); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .hcv-star, .hcv-net, .hcv-train { animation: none; }
    }
  \`,
})
export class HeroSkylineComponent {}
`;

writeFileSync(OUT, component);
console.log(`wrote ${OUT} (${(component.length / 1024).toFixed(1)} KB)`);
