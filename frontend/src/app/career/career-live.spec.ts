import { MetroPoint } from '../property-intel/pi.models';
import { Candidate, LIVE_LIMITS, Workplace, liveClasses, metroFrom, rankHomes } from './career.live';

const point = (now: string[], soon: string[] = now, plan: string[] = soon): MetroPoint => ({ lines: { now, soon, plan }, nearest: { now: null, soon: null, plan: null } });
const ward = (slug: string, landMedian: number | null): Candidate => ({ slug, name: `Phường ${slug}`, landMedian });
const work = (id: string, minutes: Record<string, number | null>, metro: MetroPoint | null = null): Workplace => ({ id, name: id, minutes, metro });

const WARDS = [ward('a', 120), ward('b', 60), ward('c', 40), ward('d', null), ward('e', 90)];

describe('Career compass: where to live for the work', () => {
  it('lists the wards within the limit of the workplace, nearest first, and the ward of the workplace itself', () => {
    const A = work('A', { a: 0, b: 12, c: 18, d: 25, e: null });
    const rows = rankHomes(WARDS, [A], 20, 'time');
    expect(rows.map((r) => r.slug)).toEqual(['a', 'b', 'c']);
    expect(rows[0].minutes).toEqual([0]);
    // A ward with no route is never offered, and a wider limit adds wards.
    expect(rankHomes(WARDS, [A], 30, 'time').map((r) => r.slug)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('with two workplaces, needs both within the limit and ranks by the longer trip', () => {
    const A = work('A', { a: 5, b: 12, c: 18, d: 25, e: 10 });
    const B = work('B', { a: 30, b: 15, c: 10, d: 12, e: 40 });
    const rows = rankHomes(WARDS, [A, B], 30, 'time');
    expect(rows.map((r) => r.slug)).toEqual(['b', 'c', 'd', 'a']); // worst trips 15, 18, 25, 30; e (40) is out
    expect(rows[0].worst).toBe(15);
    expect(rows[0].sum).toBe(27);
    expect(rankHomes(WARDS, [A, B], 15, 'time').map((r) => r.slug)).toEqual(['b']);
  });

  it('can rank by the cheapest official land instead, with wards without a price last, and ties by time', () => {
    const A = work('A', { a: 10, b: 20, c: 25, d: 5, e: 15 });
    expect(rankHomes(WARDS, [A], 30, 'price').map((r) => r.slug)).toEqual(['c', 'b', 'e', 'a', 'd']);
    const same = [ward('x', 50), ward('y', 50)];
    expect(rankHomes(same, [work('A', { x: 20, y: 10 })], 30, 'price').map((r) => r.slug)).toEqual(['y', 'x']);
  });

  it('offers nothing without a workplace', () => {
    expect(rankHomes(WARDS, [], 30, 'time')).toEqual([]);
  });

  it('says from when a ward shares a metro line with every workplace', () => {
    const home = point([], ['3'], ['3', '5']);
    expect(metroFrom(home, [point(['3'])])).toBe('soon');
    expect(metroFrom(home, [point([], [], ['5'])])).toBe('plan');
    expect(metroFrom(point(['3']), [point(['3']), point(['3'])])).toBe('now');
    expect(metroFrom(home, [point(['3']), point(['1'], ['1'], ['1'])])).toBeNull(); // not on a line of the second
    expect(metroFrom(home, [null])).toBeNull();
    expect(metroFrom(undefined, [point(['3'])])).toBeNull();
    expect(metroFrom(home, [])).toBeNull();
  });

  it('puts the metro answer on each row', () => {
    const A = work('A', { a: 5, b: 12 }, point(['2A']));
    const rows = rankHomes([ward('a', 1), ward('b', 2)], [A], 30, 'time', (slug) => (slug === 'a' ? point(['2A']) : point(['3'])));
    expect(rows.map((r) => r.metroFrom)).toEqual(['now', null]);
  });

  it('gives the nearest wards the darkest class, in five bands', () => {
    const rows = rankHomes(Array.from({ length: 10 }, (_, i) => ward(`w${i}`, null)), [work('A', Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`w${i}`, i + 1])))], 45, 'time');
    const classes = liveClasses(rows);
    expect(classes.get('w0')).toBe(4);
    expect(classes.get('w9')).toBe(0);
    expect([...new Set(classes.values())].sort()).toEqual([0, 1, 2, 3, 4]);
    expect([...LIVE_LIMITS]).toEqual([15, 20, 30, 45]);
  });
});
