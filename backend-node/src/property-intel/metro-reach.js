'use strict';
/**
 * Which metro lines serve a place, now, when the stations under construction open (2027) and under the plan (2035).
 * Used by the career compass to show where a commute by metro is possible, and where it becomes possible.
 *
 *   now    stations in service within STATION_KM of the place
 *   soon   plus stations under construction (the underground part of Line 3, due 2027)
 *   plan   plus the corridors of the planned lines within CORRIDOR_KM. These corridors are schematic (the plans give no
 *          station positions), so "plan" only says that a line is planned near the place.
 * Nothing about travel time: the data has no timetable. A station within STATION_KM is "reachable" (about 10 minutes by
 * bike or motorbike), not "next door".
 */
const M = require('./model');

const STATION_KM = 1.5;
const CORRIDOR_KM = 2;
const SOON_YEAR = 2027;

const lineRef = (name) => /Tuyến (\w+)/.exec(name)?.[1] ?? null;
const sortLines = (lines) => [...new Set(lines)].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));

const PLANNED = M.INFRA.filter((i) => i.kind === 'metro' && i.status === 'plan')
  .map((i) => ({ line: lineRef(i.name.vi), name: i.name, year: i.openYear, schematic: Boolean(i.schematic), lines: i.lines }))
  .filter((i) => i.line);

/** The metro of one point: lines at each horizon and the nearest station / corridor. */
function reachOf(point) {
  const stations = M.STATIONS.map((s) => ({ s, d: M.distKm(point, s.coords) })).sort((a, b) => a.d - b.d);
  const within = (list) => list.filter((x) => x.d <= STATION_KM);
  const nowStations = stations.filter((x) => x.s.status === 'operating');
  const nearestNow = nowStations[0];
  const nearestSoon = stations[0];
  const corridors = PLANNED.map((p) => ({ p, d: M.linesKm(point, p.lines) })).sort((a, b) => a.d - b.d);
  const nearCorridors = corridors.filter((x) => x.d <= CORRIDOR_KM);
  const station = (x) => (x ? { name: x.s.name, line: x.s.line, distanceM: Math.round(x.d * 1000), ...(x.s.status === 'construction' ? { openYear: SOON_YEAR } : {}) } : null);

  const now = sortLines(within(nowStations).map((x) => x.s.line));
  const soon = sortLines([...now, ...within(stations).map((x) => x.s.line)]);
  const plan = sortLines([...soon, ...nearCorridors.map((x) => x.p.line)]);
  return {
    lines: { now, soon, plan },
    nearest: {
      now: station(nearestNow),
      soon: station(nearestSoon),
      plan: corridors[0] ? { line: corridors[0].p.line, name: corridors[0].p.name.vi, distanceM: Math.round(corridors[0].d * 1000), year: corridors[0].p.year, schematic: corridors[0].p.schematic } : null,
    },
  };
}

let cache;

/** Every ward and every place of work (reference places and development poles). Built once: the data is static. */
function metroReach() {
  if (!cache) {
    const places = [
      ...M.TRAVEL.destinations.map((d) => ({ id: d.id, name: d.name.vi, point: d.coords })),
      ...M.POLES.map((p) => ({ id: p.slug, name: p.name.vi, point: p.center })),
    ];
    cache = {
      stationKm: STATION_KM,
      corridorKm: CORRIDOR_KM,
      soonYear: SOON_YEAR,
      wards: Object.fromEntries(M.WARDS.map((w) => [w.slug, reachOf(w.centroid)])),
      places: Object.fromEntries(places.map((p) => [p.id, { name: p.name, ...reachOf(p.point) }])),
    };
  }
  return cache;
}

module.exports = { metroReach, reachOf, STATION_KM, CORRIDOR_KM };
