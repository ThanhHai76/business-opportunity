import { marketCsv, marketRows, sortMarket } from './op-market';
import { WardProps } from './op.models';

const ward = (slug: string, name: string, score: number | null, extra: Partial<WardProps> = {}): WardProps => ({
  slug,
  name,
  population: 10_000,
  scored: score !== null,
  score,
  rank: null,
  topType: null,
  confidence: 'ok',
  landMedian: 50,
  lng: 105.8,
  lat: 21,
  ...extra,
});

describe('Market table', () => {
  const wards = [
    ward('a', 'Phường Ánh', 70, { demand: 80, competition: 10, count: 3, per10k: 1 }),
    ward('b', 'Phường Bình', 40, { demand: 50, competition: 60, count: 9, per10k: 4, landMedian: null }),
    ward('c', 'Xã Cầu', 20, { demand: 30, competition: 20, count: 1, per10k: 0.5 }),
    ward('x', 'Xã Chưa', null),
  ];

  it('keeps the scored wards and marks the gaps (demand ≥ median, competition < median)', () => {
    const rows = marketRows(wards);
    expect(rows.map((r) => r.slug)).toEqual(['a', 'b', 'c']);
    expect(rows.filter((r) => r.gap).map((r) => r.slug)).toEqual(['a']);
  });

  it('marks no gap without the type figures', () => {
    expect(marketRows([ward('a', 'A', 50), ward('b', 'B', 40)]).some((r) => r.gap)).toBeFalse();
  });

  it('sorts both ways, missing values last, and filters by name and gaps', () => {
    const rows = marketRows(wards);
    const all = { query: '', gapsOnly: false };
    expect(sortMarket(rows, { key: 'score', desc: true }, all).map((r) => r.slug)).toEqual(['a', 'b', 'c']);
    expect(sortMarket(rows, { key: 'competition', desc: false }, all).map((r) => r.slug)).toEqual(['a', 'c', 'b']);
    expect(sortMarket(rows, { key: 'landMedian', desc: false }, all).at(-1)!.slug).toBe('b');
    expect(sortMarket(rows, { key: 'landMedian', desc: true }, all).at(-1)!.slug).toBe('b');
    expect(sortMarket(rows, { key: 'name', desc: false }, { query: 'binh', gapsOnly: false }).map((r) => r.slug)).toEqual(['b']);
    expect(sortMarket(rows, { key: 'score', desc: true }, { query: '', gapsOnly: true }).map((r) => r.slug)).toEqual(['a']);
  });

  it('exports CSV with a BOM and quoted cells', () => {
    const csv = marketCsv(marketRows([ward('a', 'Phường "A", mới', 50)]), {
      name: 'Tên', score: 'Điểm', demand: 'D', competition: 'C', count: 'N', per10k: 'P', population: 'Pop', landMedian: 'L', gap: 'G',
    });
    expect(csv.startsWith('﻿Tên,Điểm')).toBeTrue();
    expect(csv.split('\n')[1]).toBe('"Phường ""A"", mới",50,,,,,10000,50,0');
  });
});
