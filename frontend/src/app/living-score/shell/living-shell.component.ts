import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../components/icon/icon.component';
import { weightsParam } from '../services/living-score-api.service';
import { LangService } from '../services/lang.service';
import { BAND_COLORS, LivingMetaService } from '../services/living-meta.service';
import { PreferencesService } from '../services/preferences.service';

interface NavItem {
  path: string;
  key: 'explore' | 'compare' | 'ai' | 'saved' | 'profile';
  icon: string;
}

/**
 * Frame of the Hanoi Living Score feature: top bar on desktop, bottom navigation on mobile, light/dark theme,
 * Vietnamese/English, share links (`?w=` weights, `?lang=`), and the CSS variables shared by every page.
 */
@Component({
  selector: 'app-living-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './living-shell.component.html',
  styleUrl: '../styles/living-score.css',
  // The shared design-system rules are namespaced under `.ls-root`; see living-score.css.
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display:block' },
})
export class LivingShellComponent {
  protected readonly prefs = inject(PreferencesService);
  protected readonly lang = inject(LangService);
  private readonly meta = inject(LivingMetaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly t = this.lang.t;
  protected readonly theme = this.prefs.effectiveTheme;
  protected readonly bandVars = Object.fromEntries(Object.entries(BAND_COLORS).map(([band, color]) => [`--ls-band-${band}`, color]));
  protected readonly nav: NavItem[] = [
    { path: '/living-score/explore', key: 'explore', icon: 'map' },
    { path: '/living-score/compare', key: 'compare', icon: 'scale' },
    { path: '/living-score/ai', key: 'ai', icon: 'sparkles' },
    { path: '/living-score/saved', key: 'saved', icon: 'bookmark' },
    { path: '/living-score/profile', key: 'profile', icon: 'user' },
  ];
  /** Pages are rebuilt (and reload their data) when this changes. */
  protected readonly viewKey = computed(() => `${this.lang.lang()}|${this.prefs.sharedWeights() ? 'shared' : 'own'}`);
  protected readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const lang = params.get('lang');
    if (lang === 'en' || lang === 'vi') this.lang.set(lang);
    this.prefs.viewShared(params.get('w'));
    this.meta.load();
  }

  protected dismissShared(): void {
    this.prefs.dismissShared();
    void this.router.navigate([], { queryParams: { w: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Link to the current page with the weights in use and the language, copied or handed to the share sheet. */
  protected async share(): Promise<void> {
    const url = new URL(window.location.href);
    const weights = weightsParam(this.prefs.weights());
    if (weights) url.searchParams.set('w', weights);
    else url.searchParams.delete('w');
    if (this.lang.lang() === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    const link = url.toString();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Hanoi Living Score', url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      this.showToast(this.t().shell.copied);
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return; // share sheet closed
      this.showToast(this.t().shell.copyFailed);
    }
  }

  private showToast(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2600);
  }
}
