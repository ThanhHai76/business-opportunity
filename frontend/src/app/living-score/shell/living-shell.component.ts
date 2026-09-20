import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../components/icon/icon.component';
import { BAND_COLORS, LivingMetaService } from '../services/living-meta.service';
import { PreferencesService } from '../services/preferences.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/**
 * Frame of the Hanoi Living Score feature: top bar on desktop, bottom navigation on mobile,
 * light/dark theme, and the CSS variables shared by every page in the feature.
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
  private readonly prefs = inject(PreferencesService);
  private readonly meta = inject(LivingMetaService);

  protected readonly theme = this.prefs.effectiveTheme;
  protected readonly bandVars = Object.fromEntries(Object.entries(BAND_COLORS).map(([band, color]) => [`--ls-band-${band}`, color]));
  protected readonly nav: NavItem[] = [
    { path: '/living-score/explore', label: 'Khám phá', icon: 'map' },
    { path: '/living-score/compare', label: 'So sánh', icon: 'scale' },
    { path: '/living-score/ai', label: 'AI', icon: 'sparkles' },
    { path: '/living-score/saved', label: 'Đã lưu', icon: 'bookmark' },
    { path: '/living-score/profile', label: 'Cá nhân', icon: 'user' },
  ];

  constructor() {
    this.meta.load();
  }
}
