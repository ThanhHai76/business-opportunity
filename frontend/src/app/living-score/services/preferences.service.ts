import { Injectable, computed, inject, signal } from '@angular/core';
import { ThemeChoice, ThemeService } from '../../services/theme.service';
import { CRITERION_KEYS, CriterionMap, PartialWeights } from '../models/living-score.models';

export type { ThemeChoice };

const STORAGE_PREFIX = 'hls.';
const MAX_COMPARE = 3;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage blocked/full — keep working in memory
  }
}

/** Per-browser preferences (personalised weights, saved & compared areas) in localStorage; the theme lives in ThemeService. */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly themeService = inject(ThemeService);

  /** The app-wide light/dark theme (shared with every other page, switched from the site header). */
  readonly theme = this.themeService.choice;
  readonly effectiveTheme = this.themeService.effective;

  /** The user's own personalised weights (percent-like values 0-100), or null for the defaults. */
  private readonly ownWeights = signal<PartialWeights | null>(knownWeights(read<Record<string, number> | null>('weights', null)));
  /** Weights from a shared link (`?w=`): used for viewing until adopted or dismissed; never saved on their own. */
  readonly sharedWeights = signal<PartialWeights | null>(null);
  /** The weights every page scores with. */
  readonly weights = computed<PartialWeights | null>(() => this.sharedWeights() ?? this.ownWeights());
  /** The user's own weights, for building a share link. */
  readonly myWeights = this.ownWeights.asReadonly();
  readonly saved = signal<string[]>(read<string[]>('saved', []));
  readonly compareSelection = signal<string[]>(read<string[]>('compare', []));

  setTheme(choice: ThemeChoice): void {
    this.themeService.setChoice(choice);
  }

  setWeights(weights: PartialWeights | null): void {
    this.sharedWeights.set(null);
    this.ownWeights.set(weights);
    write('weights', weights);
  }

  /** Shows the weights of a shared link (from `?w=transportation:30,…`); ignores anything malformed. */
  viewShared(param: string | null): void {
    if (!param) return;
    const parsed: Record<string, number> = {};
    for (const part of param.split(',')) {
      const [key, value] = part.split(':');
      const n = Number(value);
      if (key && Number.isFinite(n) && n >= 0 && n <= 100) parsed[key] = n;
    }
    const weights = knownWeights(parsed);
    if (weights && Object.values(weights).some((v) => v > 0)) this.sharedWeights.set(weights);
  }

  adoptShared(): void {
    const shared = this.sharedWeights();
    if (shared) this.setWeights(shared);
  }

  dismissShared(): void {
    this.sharedWeights.set(null);
  }

  resetWeights(): void {
    this.setWeights(null);
  }

  isSaved(slug: string): boolean {
    return this.saved().includes(slug);
  }

  toggleSaved(slug: string): void {
    const next = this.isSaved(slug) ? this.saved().filter((s) => s !== slug) : [...this.saved(), slug];
    this.saved.set(next);
    write('saved', next);
  }

  setCompare(slugs: string[]): void {
    const next = [...new Set(slugs)].slice(0, MAX_COMPARE);
    this.compareSelection.set(next);
    write('compare', next);
  }

  toggleCompare(slug: string): boolean {
    const current = this.compareSelection();
    if (current.includes(slug)) {
      this.setCompare(current.filter((s) => s !== slug));
      return true;
    }
    if (current.length >= MAX_COMPARE) return false;
    this.setCompare([...current, slug]);
    return true;
  }

  clearAll(): void {
    this.setTheme('system');
    this.setWeights(null);
    this.saved.set([]);
    write('saved', []);
    this.setCompare([]);
  }
}

/**
 * Keeps only the current criteria: weights saved by an older version may still hold criteria that were
 * removed (safety, environment, cost — no open data). Returns null when nothing is left.
 */
function knownWeights(saved: Record<string, number> | null): PartialWeights | null {
  if (!saved) return null;
  const kept = Object.fromEntries(CRITERION_KEYS.filter((key) => Number.isFinite(saved[key])).map((key) => [key, saved[key]]));
  return Object.keys(kept).length ? (kept as PartialWeights) : null;
}

export function fullWeights(partial: PartialWeights | null, defaults: CriterionMap): CriterionMap {
  return Object.fromEntries(CRITERION_KEYS.map((key) => [key, partial?.[key] ?? defaults[key]])) as CriterionMap;
}
