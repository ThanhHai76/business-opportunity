import { TestBed } from '@angular/core/testing';
import { Assumptions, DEFAULT_ASSUMPTIONS, FeasibilityStore, HORIZON_MONTHS, computeFeasibility, defaultsFor, planWards, riskOf } from './op-feasibility';

const base: Assumptions = {
  basis: 'day',
  customers: 100,
  ticket: 50_000,
  daysOpen: 30,
  sizeM2: 50,
  rentPerM2: 400_000,
  cogsPct: 30,
  staff: 3,
  salary: 8_000_000,
  utilitiesPerM2: 100_000,
  otherPct: 5,
  setupPerM2: 5_000_000,
  depositMonths: 3,
  budget: 500_000_000,
  rampMonths: 0,
  rampStartPct: 100,
};

describe('Feasibility calculator', () => {
  it('computes the monthly profit and loss', () => {
    const r = computeFeasibility(base);
    expect(r.revenue).toBe(150_000_000); // 100 × 50k × 30
    expect(r.costs.rent).toBe(20_000_000);
    expect(r.costs.staff).toBe(24_000_000);
    expect(r.costs.utilities).toBe(5_000_000);
    expect(r.costs.cogs).toBe(45_000_000);
    expect(r.costs.other).toBe(7_500_000);
    expect(r.profit).toBe(150_000_000 - 101_500_000);
    expect(Math.round(r.marginPct)).toBe(32);
  });

  it('counts the investment, payback, break-even and budget', () => {
    const r = computeFeasibility(base);
    expect(r.investment).toBe(250_000_000 + 60_000_000); // fit-out + 3 months of rent
    expect(r.paybackMonths).toBe(Math.ceil(310_000_000 / 48_500_000));
    // fixed 49m / (50k × 65%) = 1,508 customers a month → 51 a day
    expect(r.breakEvenCustomers).toBe(Math.ceil(49_000_000 / 32_500 / 30));
    expect(r.budgetGap).toBe(190_000_000);
  });

  it('reports no payback for a loss-making business and a budget shortfall', () => {
    const r = computeFeasibility({ ...base, customers: 20, budget: 100_000_000 });
    expect(r.profit).toBeLessThan(0);
    expect(r.paybackMonths).toBeNull();
    expect(r.budgetGap).toBeLessThan(0);
  });

  it('uses customers per month for monthly businesses', () => {
    const r = computeFeasibility({ ...base, basis: 'month', customers: 60, ticket: 2_500_000 });
    expect(r.revenue).toBe(150_000_000);
  });

  it('has defaults for the twelve business types of the map', () => {
    expect(Object.keys(DEFAULT_ASSUMPTIONS).sort()).toEqual(
      ['beauty', 'bookstore', 'cafe', 'carwash', 'convenience', 'education', 'fnb', 'gym', 'laundry', 'petshop', 'pharmacy', 'realestate'],
    );
    expect(defaultsFor('unknown').ticket).toBe(DEFAULT_ASSUMPTIONS['cafe'].ticket);
  });

  it('keeps the user figures per type until reset', () => {
    const store = TestBed.inject(FeasibilityStore);
    expect(store.isDefault('cafe')).toBeTrue();
    store.set('cafe', { rentPerM2: 600_000 });
    expect(store.get('cafe').rentPerM2).toBe(600_000);
    expect(store.get('cafe').ticket).toBe(DEFAULT_ASSUMPTIONS['cafe'].ticket);
    expect(store.isDefault('fnb')).toBeTrue();
    store.reset('cafe');
    expect(store.get('cafe').rentPerM2).toBe(DEFAULT_ASSUMPTIONS['cafe'].rentPerM2);
  });

  it('draws the cumulative cash over 36 months and delays payback with a ramp-up', () => {
    const flat = computeFeasibility(base);
    expect(flat.cumulative.length).toBe(HORIZON_MONTHS);
    expect(flat.cumulative[0]).toBe(-flat.investment + flat.profit);
    const ramp = computeFeasibility({ ...base, rampMonths: 6, rampStartPct: 50 });
    expect(ramp.cumulative[0]).toBeLessThan(flat.cumulative[0]);
    expect(ramp.paybackMonths!).toBeGreaterThan(flat.paybackMonths!);
    expect(ramp.cumulative.at(-1)! - ramp.cumulative.at(-2)!).toBeCloseTo(flat.profit, 0);
  });
});

describe('Business plan across wards', () => {
  const wards = [
    { slug: 'centre', name: 'Phường A', score: 80, landMedian: 300 },
    { slug: 'middle', name: 'Phường B', score: 50, landMedian: 60 },
    { slug: 'edge', name: 'Xã C', score: 20, landMedian: 15 },
  ];

  it('adjusts customers by the opportunity score and rent by the land price, within bounds', () => {
    const rows = planWards(wards, base, 60, true);
    const by = (slug: string) => rows.find((r) => r.slug === slug)!;
    expect(by('middle').factors).toEqual({ customers: 1, rent: 1 });
    expect(by('centre').factors).toEqual({ customers: 1.4, rent: 2.5 });
    expect(by('edge').factors).toEqual({ customers: 0.6, rent: 0.5 });
  });

  it('puts the wards within budget first, then by monthly profit', () => {
    const rows = planWards(wards, { ...base, budget: 320_000_000 }, 60, true);
    expect(rows.map((r) => r.fits)).toEqual([...rows.map((r) => r.fits)].sort((a, b) => Number(b) - Number(a)));
    const fitting = rows.filter((r) => r.fits);
    expect(fitting.map((r) => r.result.profit)).toEqual([...fitting.map((r) => r.result.profit)].sort((a, b) => b - a));
    expect(rows.find((r) => r.slug === 'centre')!.fits).toBeFalse(); // 2.5 × rent makes the deposit too big
  });

  it('uses the user figures unchanged when adjustment is off', () => {
    const rows = planWards(wards, base, 60, false);
    expect(rows.every((r) => r.factors.customers === 1 && r.factors.rent === 1)).toBeTrue();
    expect(new Set(rows.map((r) => r.result.profit)).size).toBe(1);
  });
});

describe('Risk of a plan', () => {
  it('is low for a profitable plan within budget', () => {
    expect(riskOf(computeFeasibility(base), true, 30)).toEqual({ level: 'low', reasons: [] });
  });

  it('adds points for budget, payback, margin and competition', () => {
    const loss = computeFeasibility({ ...base, customers: 20 });
    expect(riskOf(loss, false, 80)).toEqual({ level: 'high', reasons: ['budget', 'noPayback', 'thinMargin', 'crowded'] });
    const thin = computeFeasibility({ ...base, customers: 65 }); // margin ~15 %, payback in ~22 months
    expect(riskOf(thin, true, 10)).toEqual({ level: 'medium', reasons: ['slowPayback', 'lowMargin'] });
  });

  it('is part of every plan row', () => {
    const rows = planWards([{ slug: 'a', name: 'A', score: 50, landMedian: 60, competition: 90 }], base, 60, true);
    expect(rows[0].risk.reasons).toContain('crowded');
  });
});
