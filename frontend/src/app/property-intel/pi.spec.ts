import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { formatBillion, formatDistance, formatNum, signed } from './pi-format';
import { PI_TEXT } from './pi-i18n';
import { DEFAULT_STATE, PiStateService, initialState } from './pi.service';

describe('Property Intelligence number formats', () => {
  it('writes Vietnamese decimals with a comma and English ones with a point', () => {
    expect(formatNum(68.4, 'vi')).toBe('68,4');
    expect(formatNum(68.4, 'en')).toBe('68.4');
    expect(formatNum(120028, 'vi', 0)).toBe('120.028');
    expect(signed(3.3, 'vi', '')).toBe('+3,3');
  });

  it('formats totals in billion VND', () => {
    expect(formatBillion(9.8, 'vi')).toBe('9,8 tỷ');
    expect(formatBillion(12.46, 'en')).toBe('12.46 bn VND');
  });

  it('rounds short distances to 10 m and writes longer ones in km', () => {
    expect(formatDistance(392)).toBe('390 m');
    expect(formatDistance(1530, 'vi')).toBe('1,5 km');
    expect(formatDistance(1530, 'en')).toBe('1.5 km');
  });
});

describe('Property Intelligence texts', () => {
  /** Every key path of an object (functions count as leaves). */
  const paths = (o: object, prefix = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? paths(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

  it('has the same keys in Vietnamese and English', () => {
    expect(paths(PI_TEXT.en).sort()).toEqual(paths(PI_TEXT.vi).sort());
  });

  it('describes prices for what they are in both languages', () => {
    expect(PI_TEXT.vi.ward.land.note).toContain('thấp hơn giá thị trường');
    expect(PI_TEXT.en.project.banner).toContain('not transaction prices');
    expect(PI_TEXT.vi.lenses.landPrice).toBe('Giá đất Nhà nước 2026');
    expect(PI_TEXT.vi.ai.questions.analyze('Phường Bồ Đề')).toContain('Phường Bồ Đề');
  });
});

describe('Property Intelligence state', () => {
  it('starts from the defaults (OpenFreeMap basemap, today, Vietnamese)', () => {
    const s = initialState(null, '');
    expect(s).toEqual(DEFAULT_STATE);
    expect(s.basemap).toBe('map');
    expect(s.horizon).toBe(2026);
  });

  it('lets a shared link override the saved ward, horizon and language', () => {
    const saved = JSON.stringify({ ward: 'phuong-ha-dong', horizon: 2030, lang: 'vi', lens: 'landPrice' });
    const s = initialState(saved, '?ward=phuong-cau-giay&horizon=2045&lang=en');
    expect(s.ward).toBe('phuong-cau-giay');
    expect(s.horizon).toBe(2045);
    expect(s.lang).toBe('en');
    expect(s.lens).toBe('landPrice');
  });

  it('ignores invalid link values and values saved by older versions', () => {
    const saved = JSON.stringify({ basemap: 'terrain', lens: 'risk', horizon: 2040, currency: 'USD', layers: { heatmap: true, green: true } });
    const s = initialState(saved, '?ward=Bad Slug&horizon=1999&lang=fr');
    expect(s.basemap).toBe('map');
    expect(s.lens).toBe('potential');
    expect(s.horizon).toBe(2026);
    expect(s.ward).toBe(DEFAULT_STATE.ward);
    expect(s.lang).toBe('vi');
    expect('currency' in s).toBeFalse();
    expect('heatmap' in s.layers).toBeFalse();
    expect(s.layers.green).toBeTrue();
    expect(s.layers.metro).toBeTrue();
  });

  it('survives corrupted storage', () => {
    expect(initialState('{not json', '').ward).toBe(DEFAULT_STATE.ward);
  });

  describe('service', () => {
    beforeEach(() => {
      localStorage.removeItem('pi.state.v2');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    });
    afterEach(() => localStorage.removeItem('pi.state.v2'));

    it('builds a share link with the ward, horizon and language', () => {
      const state = TestBed.inject(PiStateService);
      state.set('ward', 'phuong-tay-ho');
      state.set('horizon', 2030);
      state.set('lang', 'en');
      const url = new URL(state.shareUrl('/property-intelligence/map?x=1'));
      expect(url.pathname).toBe('/property-intelligence/map');
      expect(url.searchParams.get('ward')).toBe('phuong-tay-ho');
      expect(url.searchParams.get('horizon')).toBe('2030');
      expect(url.searchParams.get('lang')).toBe('en');
      expect(url.searchParams.has('x')).toBeFalse();
    });

    it('applies a layer preset and remembers it', () => {
      const state = TestBed.inject(PiStateService);
      state.setLayers(['metro', 'green']);
      expect(Object.entries(state.layers()).filter(([, on]) => on).map(([k]) => k).sort()).toEqual(['green', 'metro']);
      expect(JSON.parse(localStorage.getItem('pi.state.v2')!).layers.green).toBeTrue();
    });

    it('switches the interface text with the language', () => {
      const state = TestBed.inject(PiStateService);
      expect(state.t().tabs.map).toBe('Bản đồ phân tích');
      state.set('lang', 'en');
      expect(state.t().tabs.map).toBe('Map Intelligence');
    });
  });
});
