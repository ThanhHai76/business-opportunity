"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoFrame = void 0;
exports.buildIllustrativeCells = buildIllustrativeCells;
exports.mulberry32 = mulberry32;
exports.hashString = hashString;
const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LNG_AT_EQUATOR = 111.32;
/** Local equirectangular projection around a reference point; plenty accurate at city scale. */
class GeoFrame {
    origin;
    kmPerDegLng;
    constructor(origin) {
        this.origin = origin;
        this.kmPerDegLng = KM_PER_DEG_LNG_AT_EQUATOR * Math.cos((origin[1] * Math.PI) / 180);
    }
    project([lng, lat]) {
        return [(lng - this.origin[0]) * this.kmPerDegLng, (lat - this.origin[1]) * KM_PER_DEG_LAT];
    }
    unproject([x, y]) {
        return [round6(this.origin[0] + x / this.kmPerDegLng), round6(this.origin[1] + y / KM_PER_DEG_LAT)];
    }
}
exports.GeoFrame = GeoFrame;
const round6 = (n) => Math.round(n * 1e6) / 1e6;
/** Keeps the part of a convex polygon where nx*x + ny*y <= c (Sutherland–Hodgman, one half-plane). */
function clipHalfPlane(poly, nx, ny, c) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const cur = poly[i];
        const next = poly[(i + 1) % poly.length];
        const fc = nx * cur[0] + ny * cur[1] - c;
        const fn = nx * next[0] + ny * next[1] - c;
        const curInside = fc <= 0;
        const nextInside = fn <= 0;
        if (curInside)
            out.push(cur);
        if (curInside !== nextInside) {
            const t = fc / (fc - fn);
            out.push([cur[0] + (next[0] - cur[0]) * t, cur[1] + (next[1] - cur[1]) * t]);
        }
    }
    return out;
}
/**
 * Illustrative "district" outlines: the Voronoi cell of every site (so neighbouring
 * areas never overlap), clipped to a disc around the centre so outer areas stay bounded.
 * These are NOT administrative boundaries — they only give the map something plausible to colour.
 */
function buildIllustrativeCells(sites, frame, discSegments = 40) {
    const projected = sites.map((s) => frame.project(s.center));
    const cells = new Map();
    sites.forEach((site, i) => {
        const [px, py] = projected[i];
        let poly = [
            [px - 200, py - 200],
            [px + 200, py - 200],
            [px + 200, py + 200],
            [px - 200, py + 200],
        ];
        projected.forEach(([qx, qy], j) => {
            if (i === j)
                return;
            // Points closer to this site than to site j: 2(q-p)·x <= |q|²-|p|²
            poly = clipHalfPlane(poly, 2 * (qx - px), 2 * (qy - py), qx * qx + qy * qy - (px * px + py * py));
        });
        const disc = Array.from({ length: discSegments }, (_, k) => {
            const angle = (2 * Math.PI * k) / discSegments;
            return [px + site.radiusKm * Math.cos(angle), py + site.radiusKm * Math.sin(angle)];
        });
        for (let k = 0; k < disc.length; k++) {
            const a = disc[k];
            const b = disc[(k + 1) % disc.length];
            const nx = b[1] - a[1]; // outward normal of a counter-clockwise edge
            const ny = -(b[0] - a[0]);
            poly = clipHalfPlane(poly, nx, ny, nx * a[0] + ny * a[1]);
        }
        const ring = poly.map((p) => frame.unproject(p));
        ring.push(ring[0]);
        cells.set(site.id, ring);
    });
    return cells;
}
/** Deterministic PRNG so seed data is identical on every run. */
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function hashString(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
