import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { OPPORTUNITY_API_URL } from '../../config';
import { DirectoryResponse } from '../../opportunity/op.models';
import { SiteLangService } from '../../services/site-lang.service';
import { WardPageComponent } from './ward-page.component';
import { WardsComponent, plain } from './wards.component';

const DIRECTORY: DirectoryResponse = {
  source: { title: 'Nghị quyết 1656/NQ-UBTVQH15', publisher: 'UBTVQH', url: 'https://example.org/1656' },
  populationDate: '2025-07-01',
  units: [
    { slug: 'phuong-cau-giay', name: 'Phường Cầu Giấy', kind: 'ward', population: 74516, areaKm2: 3.7, density: 19924, covered: true, scored: true, top: { type: 'beauty', name: 'Làm đẹp / spa', icon: '💅', score: 64 }, metroNearest: { name: 'Chùa Hà', line: '3', distanceM: 500 } },
    { slug: 'xa-soc-son', name: 'Xã Sóc Sơn', kind: 'commune', population: 50000, areaKm2: 90, density: 556, covered: false, scored: false, top: null, metroNearest: null },
    { slug: 'phuong-ba-dinh', name: 'Phường Ba Đình', kind: 'ward', population: 60000, areaKm2: 2.5, density: 24000, covered: true, scored: true, top: null, metroNearest: null },
  ],
};

describe('plain', () => {
  it('drops accents and case so a search without accents matches', () => {
    expect(plain('Phường Cầu Giấy')).toBe('phuong cau giay');
    expect(plain('Đống Đa')).toBe('dong da');
  });
});

describe('WardsComponent (directory)', () => {
  let http: HttpTestingController;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<WardsComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [WardsComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WardsComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${OPPORTUNITY_API_URL}/directory`).flush(DIRECTORY);
    fixture.detectChanges();
  });

  it('lists every unit with its figures and the top sector where there is one', () => {
    const cards = el.querySelectorAll('.wd__card');
    expect(cards.length).toBe(3);
    expect(cards[0].textContent).toContain('Phường Cầu Giấy');
    expect(cards[0].textContent).toContain('74.516');
    expect(cards[0].textContent).toContain('Làm đẹp / spa (64)');
    expect(cards[1].textContent).toContain('Chưa có dữ liệu bản đồ');
  });

  it('searches without accents and filters by kind', () => {
    const input = el.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'cau giay';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelectorAll('.wd__card').length).toBe(1);

    input.value = '';
    input.dispatchEvent(new Event('input'));
    const kind = el.querySelectorAll('select')[0] as HTMLSelectElement;
    kind.value = 'commune';
    kind.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelectorAll('.wd__card').length).toBe(1);
    expect(el.querySelector('.wd__card')!.textContent).toContain('Xã Sóc Sơn');
  });

  it('sorts by population, largest first', () => {
    const sort = el.querySelectorAll('select')[1] as HTMLSelectElement;
    sort.value = 'population';
    sort.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelector('.wd__card strong')!.textContent).toBe('Phường Cầu Giấy');
  });

  it('speaks English when the site does', () => {
    TestBed.inject(SiteLangService).set('en');
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${OPPORTUNITY_API_URL}/directory` && r.params.get('lang') === 'en').flush(DIRECTORY);
    fixture.detectChanges();
    expect(el.querySelector('h1')!.textContent).toBe('Hanoi wards and communes');
    expect(el.textContent).toContain('74,516 people');
  });
});

describe('WardPageComponent', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function open(slug: string) {
    params = new BehaviorSubject(convertToParamMap({ slug }));
    TestBed.configureTestingModule({
      imports: [WardPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: params } }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(WardPageComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${OPPORTUNITY_API_URL}/directory`).flush(DIRECTORY);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the official figures and only them for a unit the map does not cover', () => {
    const fixture = open('xa-soc-son');
    http.expectNone((r) => r.url.includes('/wards/'));
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Xã Sóc Sơn');
    expect(text).toContain('50.000 người');
    expect(text).toContain('Bản đồ chưa phủ khu vực này');
    expect(text).toContain('Nghị quyết 1656/NQ-UBTVQH15');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-report-issue')).toBeNull();
  });

  it('adds the nearest metro station and the sectors for a unit the map covers', () => {
    const fixture = open('phuong-cau-giay');
    const req = http.expectOne((r) => r.url === `${OPPORTUNITY_API_URL}/wards/phuong-cau-giay`);
    req.flush({
      slug: 'phuong-cau-giay', name: 'Phường Cầu Giấy', osm: '', centroid: [105.8, 21.03], horizon: 'now', scored: true,
      facts: { population: 74516, populationDate: '2025-07-01', areaKm2: 3.7, counts: {}, metroStations: [], metroNearest: null, metroBuildingKm: null, constructionHa: 0 },
      coverage: null, growth: null, method: '', caveat: '',
      opportunities: [{ type: 'beauty', icon: '💅', name: 'Làm đẹp / spa', opportunity: 64, demand: 70, competition: 40, count: 10, per10k: 1, confidence: 'ok', sparseType: false, growth: null, drivers: [] }],
      sources: [{ id: 'osm', title: 'OpenStreetMap', publisher: 'OSM', url: 'https://www.openstreetmap.org' }],
    });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Chùa Hà');
    expect(text).toContain('Làm đẹp / spa');
    expect(text).toContain('64/100');
    expect(text).toContain('OpenStreetMap');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-report-issue')).not.toBeNull();
  });

  it('says so for an address that is not a unit', () => {
    const fixture = open('phuong-khong-co');
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')!.textContent).toContain('Không tìm thấy');
  });
});
