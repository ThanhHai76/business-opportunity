import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BillingService } from '../services/billing.service';
import { PremiumPromptService } from '../services/premium-prompt.service';
import { PiCompareComponent, compareCsv } from './components/pi-compare.component';
import { DEFAULT_WEIGHTS, decodeWeights, encodeWeights, isDefaultWeights, rankWards, weightedScore } from './pi-weights';
import { WardSummary } from './pi.models';
import { FREE_COMPARE, PiStateService, initialState } from './pi.service';

const values = (connectivity: number, infrastructure: number, population: number | null = 50) => ({
  connectivity,
  infrastructure,
  planning: 50,
  amenities: 50,
  population,
  development: 50,
});

function ward(slug: string, v: ReturnType<typeof values>, extra: Partial<WardSummary> = {}): WardSummary {
  return {
    slug,
    name: `Phường ${slug}`,
    shortName: slug,
    center: [105.85, 21.03],
    score: 0,
    rank: 0,
    total: 3,
    partial: v.population === null,
    population: 100_000,
    density: 10_000,
    metro: { name: 'Cát Linh', line: '2A', distanceM: 1000 },
    values: v,
    landMedian: 80,
    drive: { centre: 10, metro: 5 },
    ...extra,
  };
}

describe('Potential score weights', () => {
  it('reproduces the server score with the default weights', () => {
    // 0.25·80 + 0.25·60 + 0.15·50 + 0.15·50 + 0.10·50 + 0.10·50 = 60
    expect(weightedScore(values(80, 60), DEFAULT_WEIGHTS)).toBe(60);
  });

  it('scores a commune without a population figure on the other criteria', () => {
    expect(weightedScore(values(80, 60, null), DEFAULT_WEIGHTS)).toBe(Math.round((0.25 * 80 + 0.25 * 60 + 0.15 * 50 * 2 + 0.1 * 50) / 0.9));
  });

  it('re-ranks the wards when the user puts all weight on infrastructure', () => {
    const wards = [ward('metro', values(100, 10)), ward('bridge', values(10, 100))];
    expect(rankWards(wards, DEFAULT_WEIGHTS).get('metro')!.rank).toBe(1);
    const onlyInfra = { connectivity: 0, infrastructure: 100, planning: 0, amenities: 0, population: 0, development: 0 };
    const r = rankWards(wards, onlyInfra);
    expect(r.get('bridge')).toEqual({ score: 100, rank: 1 });
    expect(r.get('metro')).toEqual({ score: 10, rank: 2 });
  });

  it('encodes weights for share links and rejects bad input', () => {
    expect(encodeWeights(DEFAULT_WEIGHTS)).toBe('25,25,15,15,10,10');
    expect(decodeWeights('0,50,10,10,20,10')?.infrastructure).toBe(50);
    expect(decodeWeights('1,2,3')).toBeNull();
    expect(decodeWeights('0,0,0,0,0,0')).toBeNull();
    expect(decodeWeights('200,0,0,0,0,0')).toBeNull();
    expect(isDefaultWeights(DEFAULT_WEIGHTS)).toBeTrue();
  });
});

describe('Shared links with weights and a comparison', () => {
  it('reads ?w= and ?c= (at most five wards)', () => {
    const s = initialState(null, '?w=0,50,10,10,20,10&c=phuong-a,phuong-b,phuong-c,phuong-d,phuong-e,phuong-f');
    expect(s.weights.infrastructure).toBe(50);
    expect(s.compare).toEqual(['phuong-a', 'phuong-b', 'phuong-c', 'phuong-d', 'phuong-e']);
  });

  it('drops invalid saved comparison and watch entries', () => {
    const s = initialState(JSON.stringify({ compare: ['ok-slug', 'Bad Slug', 3], watchWards: ['phuong-x', null] }), '');
    expect(s.compare).toEqual(['ok-slug']);
    expect(s.watchWards).toEqual(['phuong-x']);
  });

  describe('state service', () => {
    beforeEach(() => {
      localStorage.removeItem('pi.state.v2');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    });
    afterEach(() => localStorage.removeItem('pi.state.v2'));

    it('puts custom weights and the comparison in the share link', () => {
      const state = TestBed.inject(PiStateService);
      expect(new URL(state.shareUrl('/x')).searchParams.has('w')).toBeFalse();
      state.setWeight('infrastructure', 50);
      state.toggleCompare('phuong-a');
      state.toggleCompare('phuong-b');
      const url = new URL(state.shareUrl('/x'));
      expect(url.searchParams.get('w')).toBe('25,50,15,15,10,10');
      expect(url.searchParams.get('c')).toBe('phuong-a,phuong-b');
      state.resetWeights();
      expect(state.customWeights()).toBeFalse();
    });

    it('keeps the five most recent wards in the comparison', () => {
      const state = TestBed.inject(PiStateService);
      for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) state.toggleCompare(s);
      expect(state.compare()).toEqual(['b', 'c', 'd', 'e', 'f']);
      state.toggleCompare('c');
      expect(state.compare()).toEqual(['b', 'd', 'e', 'f']);
    });

    it('watches wards apart from projects', () => {
      const state = TestBed.inject(PiStateService);
      state.toggleWatchWard('phuong-bo-de');
      state.toggleWatch('vinhomes-skylake');
      expect(state.watchWards()).toEqual(['phuong-bo-de']);
      expect(state.watchlist()).toEqual(['vinhomes-skylake']);
      expect(JSON.parse(localStorage.getItem('pi.state.v2')!).watchWards).toEqual(['phuong-bo-de']);
    });
  });
});

describe('PiCompareComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [PiCompareComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('shows one column per ward and marks the best value of each row', () => {
    const fixture = TestBed.createComponent(PiCompareComponent);
    const wards = [ward('a', values(90, 20), { score: 55, rank: 4, drive: { centre: 25, metro: 3 } }), ward('b', values(30, 95), { score: 61, rank: 2, drive: { centre: 8, metro: 12 } })];
    fixture.componentRef.setInput('wards', wards);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const rows = Array.from(el.querySelectorAll('.cmp__row:not(.cmp__row--head)'));
    const row = (label: string) => rows.find((r) => r.firstElementChild?.textContent?.trim() === label)!;
    const cells = (label: string) => Array.from(row(label).querySelectorAll('[role="cell"]'));
    expect(el.querySelectorAll('.cmp__ward').length).toBe(2);
    // Higher score wins; for driving times the shorter one wins.
    expect(cells('Điểm tiềm năng')[1].classList).toContain('is-best');
    expect(cells('Kết nối metro & xe buýt')[0].classList).toContain('is-best');
    expect(cells('Lái xe tới Hồ Gươm')[1].classList).toContain('is-best');
    expect(cells('Lái xe tới ga metro')[0].classList).toContain('is-best');
    expect(el.querySelector('.cmp__hint')).toBeNull();
  });

  it('uses the user ranking when one is given and asks for more wards when only one is picked', () => {
    const fixture = TestBed.createComponent(PiCompareComponent);
    fixture.componentRef.setInput('wards', [ward('a', values(90, 20), { score: 55, rank: 4 })]);
    fixture.componentRef.setInput('ranking', new Map([['a', { score: 70, rank: 1 }]]));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('70');
    expect(el.textContent).toContain('#1');
    expect(el.querySelector('.cmp__hint')).not.toBeNull();
  });
});

describe('Property Intelligence comparison and Premium', () => {
  beforeEach(() => {
    localStorage.removeItem('pi.state.v2');
    TestBed.resetTestingModule();
  });
  afterEach(() => localStorage.removeItem('pi.state.v2'));

  it('compares two wards without Premium, asks for it on a third, and lets existing ones be removed', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: BillingService, useValue: { premiumLocked: signal(true) } }] });
    const state = TestBed.inject(PiStateService);
    const prompt = TestBed.inject(PremiumPromptService);
    expect(state.compareLimit()).toBe(FREE_COMPARE);
    state.toggleCompare('a');
    state.toggleCompare('b');
    expect(prompt.ask()).toBeNull();
    state.toggleCompare('c');
    expect(state.compare()).toEqual(['a', 'b']);
    expect(prompt.ask()?.feature).toBe(state.t().premium.compare);
    state.toggleCompare('a');
    expect(state.compare()).toEqual(['b']);
  });

  it('writes the comparison as CSV with one column per ward, quoting what needs it', () => {
    const csv = compareCsv(['Phường A', 'Phường "B"'], [{ label: 'Điểm, tiềm năng', cells: ['70', '65'] }]);
    expect(csv).toBe('﻿,Phường A,"Phường ""B"""\n"Điểm, tiềm năng",70,65');
  });
});
