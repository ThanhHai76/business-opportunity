/** Which panels around the map of the dashboard are hidden (so the map has the room). Remembered in this browser. */
export type PanelKey = 'layers' | 'analysis' | 'charts' | 'ai';
export type PanelsHidden = Record<PanelKey, boolean>;

export const PANEL_KEYS: readonly PanelKey[] = ['layers', 'analysis', 'charts', 'ai'];
export const PANELS_KEY = 'hanoi100.pi.panels';

export const NONE_HIDDEN: PanelsHidden = { layers: false, analysis: false, charts: false, ai: false };

/** The saved value, whatever is in the storage: missing, broken, from an older version, or with keys we do not know. */
export function parseHidden(raw: string | null): PanelsHidden {
  const hidden = { ...NONE_HIDDEN };
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<string, unknown>> | null) : null;
    if (parsed && typeof parsed === 'object') for (const key of PANEL_KEYS) hidden[key] = parsed[key] === true;
  } catch {
    // corrupted storage: everything shown
  }
  return hidden;
}

export const toggledPanel = (hidden: PanelsHidden, key: PanelKey): PanelsHidden => ({ ...hidden, [key]: !hidden[key] });

export const setAllPanels = (isHidden: boolean): PanelsHidden => ({ layers: isHidden, analysis: isHidden, charts: isHidden, ai: isHidden });

export const allPanelsHidden = (hidden: PanelsHidden): boolean => PANEL_KEYS.every((key) => hidden[key]);

export function readHidden(): PanelsHidden {
  try {
    return parseHidden(localStorage.getItem(PANELS_KEY));
  } catch {
    return { ...NONE_HIDDEN };
  }
}

export function saveHidden(hidden: PanelsHidden): void {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(hidden));
  } catch {
    // not remembered
  }
}
