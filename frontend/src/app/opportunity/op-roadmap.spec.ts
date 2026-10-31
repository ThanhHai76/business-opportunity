import { DEFAULT_ASSUMPTIONS, computeFeasibility } from './op-feasibility';
import { RUNWAY_MONTHS, buildRoadmap, checklistText, permitText } from './op-roadmap';

describe('opening roadmap', () => {
  const a = DEFAULT_ASSUMPTIONS['cafe'];

  it('has seven steps, and the launch waits for the tax, permit, fire and fit-out steps', () => {
    const r = buildRoadmap('cafe', a, 'vi');
    expect(r.steps.map((s) => s.id)).toEqual(['lease', 'register', 'tax', 'permit', 'fire', 'fitout', 'launch']);
    const launch = r.steps[6];
    for (const s of r.steps.slice(0, 6)) expect(launch.start[1]).toBeGreaterThanOrEqual(s.end[1]);
    expect(r.total[0]).toBeLessThan(r.total[1]);
  });

  it('takes deposit and fit-out from the assumptions, so the cash before opening matches the calculator', () => {
    const r = buildRoadmap('cafe', a, 'vi');
    const inv = computeFeasibility(a).investment;
    const fixedSteps = r.steps.filter((s) => s.id === 'lease' || s.id === 'fitout').reduce((n, s) => n + s.cost[0], 0);
    expect(fixedSteps).toBe(inv);
    expect(r.cash[1]).toBeGreaterThan(r.cash[0]);
    const f = computeFeasibility(a);
    expect(r.runway).toBe((f.costs.rent + f.costs.staff + f.costs.utilities) * RUNWAY_MONTHS);
  });

  it('reports a shortfall when the budget is below the cash needed', () => {
    const r = buildRoadmap('cafe', { ...a, budget: 10_000_000 }, 'vi');
    expect(r.gap[0]).toBeLessThan(0);
    expect(r.gap[1]).toBeLessThan(0);
  });

  it('knows the licence of every business type and falls back for an unknown one', () => {
    for (const type of Object.keys(DEFAULT_ASSUMPTIONS)) expect(permitText(type, 'vi').length).toBeGreaterThan(40);
    expect(permitText('unknown', 'en')).toContain('one-stop');
  });

  it('writes a checklist with the done marks and the dates', () => {
    const r = buildRoadmap('cafe', a, 'en');
    const text = checklistText(r, { title: 'Cafe', start: new Date(2026, 10, 1), lang: 'en', money: (v) => `${v}`, done: new Set(['lease']) });
    expect(text).toContain('[x] 1.');
    expect(text).toContain('[ ] 2.');
    expect(text).toContain('Launch:');
  });
});
