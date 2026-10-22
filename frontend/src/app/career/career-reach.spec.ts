import { AREAS } from './career.data';
import { WardFigure } from './career.jobmap';
import { LINK_TEXT, ZONES, metroClass, metroLink, reachSummary, sharedLines } from './career.reach';
import { MetroPoint } from '../property-intel/pi.models';

const fig = (slug: string, count: number | null): WardFigure => ({ slug, name: `Phường ${slug}`, count, per10k: null, population: null, landMedian: null });
const point = (now: string[], soon: string[] = now, plan: string[] = soon): MetroPoint => ({ lines: { now, soon, plan }, nearest: { now: null, soon: null, plan: null } });

describe('Career compass: the zone you can reach from home', () => {
  const minutes = { a: 0, b: 12, c: 18, d: 25, e: null, f: 50 };
  const figures = [fig('a', 4), fig('b', 10), fig('c', 0), fig('d', 7), fig('e', 99), fig('f', 30)];

  it('counts the wards within the limit, the places of the sector in them, and the busiest wards', () => {
    const s = reachSummary(minutes, 20, figures);
    expect([...s.inRange].sort()).toEqual(['a', 'b', 'c']);
    expect(s.wards).toBe(3);
    expect(s.total).toBe(6);
    expect(s.places).toBe(14);
    expect(s.top.map((t) => t.slug)).toEqual(['b', 'a']);
  });

  it('leaves out wards with no route and wards without data, and widens with the limit', () => {
    const wide = reachSummary(minutes, 30, figures);
    expect(wide.inRange.has('e')).toBeFalse();
    expect(wide.places).toBe(21);
    expect(reachSummary(minutes, 15, figures).wards).toBe(2);
    expect(reachSummary(minutes, 20, [fig('a', null)]).places).toBe(0);
  });

  it('offers limits that tell wards apart (all of the 79 wards lie within 45 minutes of most homes)', () => {
    expect([...ZONES]).toEqual([15, 20, 30, 45]);
  });
});

describe('Career compass: metro from home', () => {
  const home = point(['2A'], ['2A', '3'], ['2A', '3', '5']);

  it('finds the lines two places share at a horizon', () => {
    expect(sharedLines(home, point(['3'], ['3'], ['3', '5']), 'now')).toEqual([]);
    expect(sharedLines(home, point(['3'], ['3'], ['3', '5']), 'soon')).toEqual(['3']);
    expect(sharedLines(home, point(['3'], ['3'], ['3', '5']), 'plan')).toEqual(['3', '5']);
    expect(sharedLines(null, home, 'now')).toEqual([]);
  });

  it('colours a ward by how it is served, seen from home', () => {
    expect(metroClass(point(['2A']), home, 'now')).toBe('same');
    expect(metroClass(point(['3']), home, 'now')).toBe('any');
    expect(metroClass(point([]), home, 'now')).toBe('none');
    expect(metroClass(undefined, home, 'now')).toBe('none');
    // Without a home any served ward is just "served".
    expect(metroClass(point(['3']), null, 'now')).toBe('any');
  });

  it('says whether home and a place of work are on one line, or why not', () => {
    const work = point([], ['3'], ['3', '5']);
    expect(metroLink(home, work, 'now')).toEqual({ kind: 'noPlace', lines: [] });
    expect(metroLink(home, work, 'soon')).toEqual({ kind: 'direct', lines: ['3'] });
    expect(metroLink(home, point(['1']), 'now')).toEqual({ kind: 'transfer', lines: [] });
    expect(metroLink(point([]), work, 'soon')).toEqual({ kind: 'noHome', lines: [] });
    expect(metroLink(null, work, 'soon').kind).toBe('noHome');
    for (const text of Object.values(LINK_TEXT)) expect(text.length).toBeGreaterThan(0);
  });

  it('uses place ids the server knows', () => {
    // The ids of the work areas are the keys of GET /metro-reach places (backend test: career-data.test.js).
    const known = ['centre', 'offices', 'airport', 'bac', 'dong', 'thuong-tin-phu-xuyen', 'xuan-mai', 'hoa-lac', 'son-tay-ba-vi', 'song-hong'];
    expect(Object.keys(AREAS).sort()).toEqual([...known].sort());
  });
});
