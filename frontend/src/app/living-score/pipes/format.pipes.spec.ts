import { FactsPipe, NumPipe } from './format.pipes';
import { AreaFacts } from '../models/living-score.models';

const facts: AreaFacts = {
  metroStations: ['Cát Linh', 'La Thành'],
  internationalSchools: 0,
  cafes: 1506,
  parkPct: 3.1,
  waterPct: 29.9,
  lakes: [],
  busStops: 97,
  wards: [],
};

describe('NumPipe', () => {
  const pipe = new NumPipe();

  it('uses a decimal comma in Vietnamese and a decimal point in English', () => {
    expect(pipe.transform(29.9, 'vi', 1)).toBe('29,9');
    expect(pipe.transform(29.9, 'en', 1)).toBe('29.9');
  });

  it('groups thousands the local way and rounds to the requested digits', () => {
    expect(pipe.transform(292000, 'vi')).toBe('292.000');
    expect(pipe.transform(292000, 'en')).toBe('292,000');
    expect(pipe.transform(74.86, 'vi', 0)).toBe('75');
  });

  it('shows a dash for missing values', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined, 'en')).toBe('—');
  });
});

describe('FactsPipe', () => {
  const pipe = new FactsPipe();

  it('summarises metro stations and cafés in the interface language', () => {
    expect(pipe.transform(facts, 'vi')).toBe('2 ga metro · 1.506 quán cà phê');
    expect(pipe.transform(facts, 'en')).toBe('2 metro stations · 1,506 cafés');
  });

  it('says when there is no metro yet', () => {
    expect(pipe.transform({ ...facts, metroStations: [] }, 'vi')).toContain('Chưa có metro');
    expect(pipe.transform({ ...facts, metroStations: [] }, 'en')).toContain('No metro yet');
  });
});
