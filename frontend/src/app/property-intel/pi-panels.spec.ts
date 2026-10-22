import { NONE_HIDDEN, PANELS_KEY, allPanelsHidden, parseHidden, readHidden, saveHidden, setAllPanels, toggledPanel } from './pi-panels';

describe('Dashboard panels (hidden around the map)', () => {
  afterEach(() => localStorage.removeItem(PANELS_KEY));

  it('shows every panel when nothing is saved, or what is saved is broken', () => {
    expect(parseHidden(null)).toEqual(NONE_HIDDEN);
    expect(parseHidden('')).toEqual(NONE_HIDDEN);
    expect(parseHidden('{not json')).toEqual(NONE_HIDDEN);
    expect(parseHidden('42')).toEqual(NONE_HIDDEN);
    expect(parseHidden('null')).toEqual(NONE_HIDDEN);
  });

  it('reads only true values of the four known panels', () => {
    expect(parseHidden('{"layers":true,"ai":true,"charts":"yes","analysis":1,"extra":true}')).toEqual({ layers: true, analysis: false, charts: false, ai: true });
  });

  it('toggles one panel without touching the others, and never changes its input', () => {
    const before = { ...NONE_HIDDEN };
    const next = toggledPanel(before, 'charts');
    expect(next).toEqual({ layers: false, analysis: false, charts: true, ai: false });
    expect(before).toEqual(NONE_HIDDEN);
    expect(toggledPanel(next, 'charts')).toEqual(NONE_HIDDEN);
  });

  it('"map only" hides everything, and shows everything again when pressed a second time', () => {
    expect(allPanelsHidden(NONE_HIDDEN)).toBeFalse();
    expect(allPanelsHidden(toggledPanel(setAllPanels(true), 'ai'))).toBeFalse();
    const focused = setAllPanels(!allPanelsHidden(NONE_HIDDEN));
    expect(allPanelsHidden(focused)).toBeTrue();
    expect(setAllPanels(!allPanelsHidden(focused))).toEqual(NONE_HIDDEN);
  });

  it('is remembered in this browser', () => {
    saveHidden({ layers: true, analysis: false, charts: true, ai: false });
    expect(readHidden()).toEqual({ layers: true, analysis: false, charts: true, ai: false });
  });
});
