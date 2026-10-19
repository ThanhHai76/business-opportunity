import { estimateCount, formatAsOf, isEstimate, qualityText } from './pi-quality.view';

describe('Property Intelligence data labels', () => {
  it('formats the date of the data in each language', () => {
    expect(formatAsOf('2026-01-01', 'vi')).toBe('01/01/2026');
    expect(formatAsOf('2026-09', 'vi')).toBe('09/2026');
    expect(formatAsOf('2026-01-01', 'en')).toBe('2026-01-01');
  });

  it('writes kind, confidence and date', () => {
    expect(qualityText({ kind: 'official', confidence: 'high', asOf: '2026-01-01' }, 'vi')).toBe('Số liệu chính thức · độ tin cậy cao · dữ liệu đến 01/01/2026');
    expect(qualityText({ kind: 'asking', confidence: 'low', asOf: null }, 'en')).toBe('Asking/expected price, estimate · low confidence');
  });

  it('never shows a missing label as firm', () => {
    expect(qualityText(undefined, 'vi')).toBe('Chưa đánh giá');
    expect(isEstimate(undefined)).toBe(true);
  });

  it('counts asking, computed and low-confidence sources as estimates', () => {
    expect(isEstimate({ kind: 'asking', confidence: 'medium', asOf: null })).toBe(true);
    expect(isEstimate({ kind: 'computed', confidence: 'medium', asOf: null })).toBe(true);
    expect(isEstimate({ kind: 'published', confidence: 'low', asOf: null })).toBe(true);
    expect(isEstimate({ kind: 'official', confidence: 'high', asOf: '2026-01-01' })).toBe(false);
    const q = { kind: 'official' as const, confidence: 'high' as const, asOf: null };
    expect(estimateCount([{ id: 'a', title: '', publisher: '', url: null, quality: q }, { id: 'b', title: '', publisher: '', url: null }])).toBe(1);
  });
});
