import { Injectable, inject, signal } from '@angular/core';
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

  /** Personalised weights (percent-like values 0-100), or null when the user keeps the defaults. */
  readonly weights = signal<PartialWeights | null>(read<PartialWeights | null>('weights', null));
  readonly saved = signal<string[]>(read<string[]>('saved', []));
  readonly compareSelection = signal<string[]>(read<string[]>('compare', []));

  setTheme(choice: ThemeChoice): void {
    this.themeService.setChoice(choice);
  }

  setWeights(weights: PartialWeights | null): void {
    this.weights.set(weights);
    write('weights', weights);
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

export function fullWeights(partial: PartialWeights | null, defaults: CriterionMap): CriterionMap {
  return Object.fromEntries(CRITERION_KEYS.map((key) => [key, partial?.[key] ?? defaults[key]])) as CriterionMap;
}
