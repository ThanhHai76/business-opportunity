import { CASES, EXAMPLE_INPUT, HORIZON, SWITCH_REFERENCES, SwitchInput, compute, isComplete, loadOptions, remarks, sanitize, saveOptions } from './career.switch';

const base = (over: Partial<SwitchInput> = {}): SwitchInput => ({ ...EXAMPLE_INPUT, raisePct: 0, ...over });

describe('career change calculator', () => {
  it('works the example out by hand: cost, buffer, payback and the gain after a year', () => {
    // Today 10/month. 3 months training + 2 looking: 2/month of side income, so 8/month is given up for 5 months.
    // Fees 6 → cost 6 + 5×8 = 46. Spending 8: 6/month is uncovered → buffer 6 + 5×6 = 36 (4.5 months of spending).
    // From month 6 the new work pays 15: +5 a month over today. -46 + 5k ≥ 0 from k = 10 → month 15.
    const r = compute(base()).base;
    expect(r.totalCost).toBe(46);
    expect(r.buffer).toBe(36);
    expect(r.bufferMonths).toBe(4.5);
    expect(r.paybackMonths).toBe(15);
    expect(r.net[12]).toBe(-11); // 7 months of work: -46 + 35
    expect(r.net[24]).toBe(49); // 19 months of work: -46 + 95
    expect(r.curve.length).toBe(61);
    expect(r.curve[0]).toBe(-6);
    expect(r.curve[5]).toBe(-46);
  });

  it('applies the raise at every 12 months of the new work, not before', () => {
    const flat = compute(base()).base;
    const raised = compute(base({ raisePct: 10 })).base;
    // The first 12 months of work are the same; from the 13th the pay is 16.5.
    expect(raised.curve[17]).toBe(flat.curve[17]);
    expect(raised.curve[18]).toBeCloseTo(flat.curve[18] + 1.5, 2);
    expect(raised.net[36]).toBeGreaterThan(flat.net[36]);
  });

  it('moves the careful and bright cases by the fixed amounts, and never below zero months of search', () => {
    const r = compute(base());
    expect(r.careful.newIncome).toBe(12.75);
    expect(r.careful.searchMonths).toBe(2 + CASES.careful.searchShift);
    expect(r.bright.newIncome).toBe(16.5);
    expect(r.bright.searchMonths).toBe(1);
    expect(r.careful.paybackMonths!).toBeGreaterThan(r.base.paybackMonths!);
    expect(r.bright.paybackMonths!).toBeLessThan(r.base.paybackMonths!);
    expect(compute(base({ searchMonths: 0 })).bright.searchMonths).toBe(0);
  });

  it('says "not within the horizon" when the new work does not pay more than today', () => {
    const r = compute(base({ newIncome: 10 })).base;
    expect(r.paybackMonths).toBeNull();
    expect(remarks(base({ newIncome: 10 }), r)).toContain('noGain');
    expect(remarks(base({ newIncome: 10 }), compute(base({ newIncome: 10 })).base)).not.toContain('slow');
    expect(r.curve[60]).toBeLessThan(0);
    expect(HORIZON).toBe(120);
  });

  it('is immediate when nothing is paid and nothing is given up', () => {
    const r = compute({ ...EXAMPLE_INPUT, fees: 0, studyMonths: 0, searchMonths: 0, bridgeIncome: 0, currentIncome: 5, newIncome: 5 }).base;
    expect(r.paybackMonths).toBe(0);
    expect(r.totalCost).toBe(0);
  });

  it('starts from nothing when not working: the whole bridge is uncovered spending', () => {
    const r = compute(base({ currentIncome: 0, bridgeIncome: 0, fees: 0, studyMonths: 2, searchMonths: 1, expenses: 7, newIncome: 9 })).base;
    expect(r.totalCost).toBe(0); // nothing earned today, so nothing is given up
    expect(r.buffer).toBe(21); // 3 months × 7
    expect(r.paybackMonths).toBe(0); // a gain from the first day of work: it is never below zero
    expect(r.bufferMonths).toBe(3);
  });

  it('gives no months of spending when no spending was typed, and says so', () => {
    const input = base({ expenses: 0 });
    const r = compute(input).base;
    expect(r.bufferMonths).toBeNull();
    expect(remarks(input, r)).toContain('noSpending');
  });

  it('keeps every number sensible, whatever was typed or stored', () => {
    const s = sanitize({ currentIncome: -5, fees: NaN, studyMonths: 2.6, searchMonths: 999, newIncome: 1e9, raisePct: 80, name: 'x'.repeat(200) } as Partial<SwitchInput>);
    expect(s.currentIncome).toBe(0);
    expect(s.fees).toBe(0);
    expect(s.studyMonths).toBe(3);
    expect(s.searchMonths).toBe(36);
    expect(s.newIncome).toBe(10_000);
    expect(s.raisePct).toBe(50);
    expect(s.name.length).toBe(60);
    expect(sanitize(null).newIncome).toBe(0);
    expect(isComplete(sanitize({ newIncome: 3 }))).toBeTrue();
    expect(isComplete(sanitize({}))).toBeFalse();
  });

  it('keeps at most three options in the browser and starts empty when the stored text is not usable', () => {
    localStorage.removeItem('hcv.career.switch.v1');
    expect(loadOptions().length).toBe(1);
    saveOptions([base({ name: 'a' }), base({ name: 'b' }), base({ name: 'c' }), base({ name: 'd' })]);
    expect(loadOptions().map((o) => o.name)).toEqual(['a', 'b', 'c']);
    localStorage.setItem('hcv.career.switch.v1', '{not json');
    expect(loadOptions().length).toBe(1);
    localStorage.removeItem('hcv.career.switch.v1');
  });

  it('only offers reference points that cite a source with a link, and calls the draft a draft', () => {
    for (const ref of SWITCH_REFERENCES) {
      expect(ref.sources.length).toBeGreaterThan(0);
      for (const s of ref.sources) expect(s.url.startsWith('https://')).toBeTrue();
      expect(ref.vi.length).toBeGreaterThan(20);
      expect(ref.en.length).toBeGreaterThan(20);
    }
    expect(SWITCH_REFERENCES.find((r) => r.id === 'draft100')!.vi).toContain('dự thảo');
  });
});
