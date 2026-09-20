import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

/** Same key as the inline script in index.html, which applies the theme before the first paint. */
export const THEME_STORAGE_KEY = 'hanoi100.theme';
/** Where the Living Score feature used to keep its own theme choice. */
const LEGACY_STORAGE_KEY = 'hls.theme';

function readChoice(): ThemeChoice {
  const valid = (v: unknown): v is ThemeChoice => v === 'light' || v === 'dark' || v === 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (valid(stored)) return stored;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (valid(parsed)) return parsed;
    }
  } catch {
    // storage blocked or corrupt — fall back to the system setting
  }
  return 'system';
}

/**
 * One light/dark theme for the whole app. The result is written to <html data-theme="light|dark">,
 * and every page styles itself from that attribute (see the tokens in styles.css).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  private readonly systemDark = signal(this.media?.matches === true);

  readonly choice = signal<ThemeChoice>(readChoice());
  readonly effective = computed<EffectiveTheme>(() => {
    const choice = this.choice();
    return choice === 'system' ? (this.systemDark() ? 'dark' : 'light') : choice;
  });

  constructor() {
    this.media?.addEventListener('change', (event) => this.systemDark.set(event.matches));
    effect(() => {
      const theme = this.effective();
      const root = this.document.documentElement;
      root.setAttribute('data-theme', theme);
      root.style.colorScheme = theme;
    });
  }

  setChoice(choice: ThemeChoice): void {
    this.choice.set(choice);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      // storage blocked — the choice still applies for this session
    }
  }

  /** Flips the theme currently on screen (an explicit choice, so it stops following the system). */
  toggle(): void {
    this.setChoice(this.effective() === 'dark' ? 'light' : 'dark');
  }
}
