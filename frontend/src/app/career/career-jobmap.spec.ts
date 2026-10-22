import { AREAS } from './career.data';
import { RAMP, breaks, classOf, figureOf, legend, markers, topSectors } from './career.jobmap';

describe('Career compass: job map colours', () => {
  it('splits the values above zero into classes of about equal size, so a few big wards do not flatten the rest', () => {
    const values = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 343];
    const limits = breaks(values);
    expect(limits.length).toBe(RAMP.length - 1);
    expect(limits).toEqual([...limits].sort((a, b) => a - b));
    expect(limits[limits.length - 1]).toBeLessThan(343);
    const sizes = new Array(RAMP.length).fill(0);
    for (const v of values) sizes[classOf(v, limits)!]++;
    // The largest class is not more than twice the smallest non-empty one (two wards have no places and share the first class).
    expect(Math.max(...sizes.slice(1))).toBeLessThanOrEqual(2 * Math.min(...sizes.slice(1)));
  });

  it('has no classes to draw when the values barely differ, and never repeats a limit', () => {
    expect(breaks([])).toEqual([]);
    expect(breaks([null, null, 5])).toEqual([]);
    const flat = breaks([3, 3, 3, 3, 3, 3]);
    expect(new Set(flat).size).toBe(flat.length);
  });

  it('gives a ward without data no class, and a ward without places the lowest', () => {
    const limits = [2, 5, 9, 20];
    expect(classOf(null, limits)).toBeNull();
    expect(classOf(0, limits)).toBe(0);
    expect(classOf(2, limits)).toBe(1);
    expect(classOf(100, limits)).toBe(4);
  });

  it('writes a legend with one entry per class, in the colours of the ramp', () => {
    const items = legend([2, 5, 9, 20]);
    expect(items.map((i) => i.color)).toEqual(RAMP);
    expect(items[0].label).toBe('0–2');
    expect(items[4].label).toBe('20 trở lên');
  });
});

describe('Career compass: job map data', () => {
  it('reads the figures of a ward, and none for a ward the map has no data for', () => {
    expect(figureOf({ slug: 'a', name: 'Phường A', scored: true, count: 7, per10k: 1.2, population: 5000 })).toEqual({ slug: 'a', name: 'Phường A', count: 7, per10k: 1.2, population: 5000, landMedian: null });
    const none = figureOf({ slug: 'b', name: 'Xã B', scored: false, count: 3, population: null });
    expect(none.count).toBeNull();
    expect(none.per10k).toBeNull();
  });

  it('puts every planned pole and reference place on the map as a point', () => {
    const points = markers();
    expect(points.length).toBe(Object.keys(AREAS).length);
    for (const p of points) {
      expect(p.lngLat[0]).withContext(p.id).toBeGreaterThan(105);
      expect(p.lngLat[1]).withContext(p.id).toBeGreaterThan(20.5);
    }
    expect(points.filter((p) => p.kind === 'now').map((p) => p.id).sort()).toEqual(['airport', 'centre', 'offices']);
  });

  it('lists the sectors with the most places first, and leaves out those with none', () => {
    const top = topSectors([
      { name: 'a', count: 3 },
      { name: 'b', count: 0 },
      { name: 'c', count: 40 },
      { name: 'd', count: 12 },
    ], 2);
    expect(top.map((t) => t.name)).toEqual(['c', 'd']);
  });
});
