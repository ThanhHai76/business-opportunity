import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type SiteLang = 'vi' | 'en';

/** One language for the whole site. The tools used to keep their own choice under the keys below: they still get it written. */
export const SITE_LANG_KEY = 'hanoi100.lang';
const TOOL_KEYS = ['hanoi100.op.lang', 'hanoi100.fm.lang', 'hanoi100.tm.lang', 'hanoi100.ls.lang'];

/** The language in the address (?lang=en), else the site's saved choice, else one a tool saved before there was a site choice, else Vietnamese. */
export function initialSiteLang(): SiteLang {
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl === 'vi' || fromUrl === 'en') return fromUrl;
    const saved = localStorage.getItem(SITE_LANG_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
    return TOOL_KEYS.some((k) => localStorage.getItem(k) === 'en') ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

let current: SiteLang | null = null;

/** For tests: forgets the choice, so the next test starts from Vietnamese. */
export function resetSiteLangForTests(): void {
  current = null;
  try {
    for (const key of [SITE_LANG_KEY, ...TOOL_KEYS]) localStorage.removeItem(key);
  } catch {
    /* no storage */
  }
}

/** The site's language right now, for plain functions that have no injector (the wording of an error). */
export function siteLangNow(): SiteLang {
  return current ?? initialSiteLang();
}

/**
 * The language of the site (Vietnamese or English), chosen once in the top bar and followed by every page and tool.
 * Each tool still has its own button; it calls set() here, so the choice is the same everywhere and remembered.
 */
@Injectable({ providedIn: 'root' })
export class SiteLangService {
  private readonly document = inject(DOCUMENT);
  readonly lang = signal<SiteLang>(initialSiteLang());

  constructor() {
    current = this.lang();
    // Screen readers and the browser's translation offer read the language of the page.
    effect(() => {
      this.document.documentElement.lang = this.lang();
    });
  }

  set(lang: SiteLang): void {
    if (lang === this.lang()) return;
    this.lang.set(lang);
    current = lang;
    try {
      localStorage.setItem(SITE_LANG_KEY, lang);
      for (const key of TOOL_KEYS) localStorage.setItem(key, lang);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
    // An address that says ?lang= says the new language too (a reload must not undo the choice).
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', lang);
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      }
    } catch {
      /* no history (tests) */
    }
  }

  toggle(): void {
    this.set(this.lang() === 'vi' ? 'en' : 'vi');
  }
}
