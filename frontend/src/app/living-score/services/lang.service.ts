import { Injectable, computed, signal } from '@angular/core';
import { DICT, Dict, Lang } from '../i18n/ls-i18n';

const STORAGE_KEY = 'hanoi100.ls.lang';

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

/** Interface language of Hanoi Living Score (Vietnamese by default), remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class LangService {
  readonly lang = signal<Lang>(readLang());
  /** The dictionary of the current language: `t().detail.back`. */
  readonly t = computed<Dict>(() => DICT[this.lang()]);
  /** Locale for numbers: 29,9 in Vietnamese, 29.9 in English. */
  readonly locale = computed(() => (this.lang() === 'en' ? 'en-US' : 'vi-VN'));

  set(lang: Lang): void {
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  }

  toggle(): void {
    this.set(this.lang() === 'vi' ? 'en' : 'vi');
  }
}
