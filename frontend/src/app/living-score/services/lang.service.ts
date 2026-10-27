import { Injectable, computed, inject } from '@angular/core';
import { SiteLangService } from '../../services/site-lang.service';
import { DICT, Dict, Lang } from '../i18n/ls-i18n';

/** Interface language of Hanoi Living Score: the language of the whole site (see SiteLangService), chosen in the top bar or on this page. */
@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly site = inject(SiteLangService);
  readonly lang = this.site.lang;
  /** The dictionary of the current language: `t().detail.back`. */
  readonly t = computed<Dict>(() => DICT[this.lang()]);
  /** Locale for numbers: 29,9 in Vietnamese, 29.9 in English. */
  readonly locale = computed(() => (this.lang() === 'en' ? 'en-US' : 'vi-VN'));

  set(lang: Lang): void {
    this.site.set(lang);
  }

  toggle(): void {
    this.site.toggle();
  }
}
