import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

interface SiteTab {
  path: string;
  label: string;
  short: string;
  /** Suffix of the `--app-<key>` colour token that identifies the tool. */
  key: 'biz' | 'time' | 'live';
}

/** Header shared by every page: brand (home link), the three tools and the light/dark switch. */
@Component({
  selector: 'app-site-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.css',
})
export class SiteNavComponent {
  protected readonly theme = inject(ThemeService);

  protected readonly tabs: SiteTab[] = [
    { path: '/opportunity-map', label: 'Cơ hội kinh doanh', short: 'Kinh doanh', key: 'biz' },
    { path: '/time-machine', label: 'Hanoi Time Machine', short: 'Time Machine', key: 'time' },
    { path: '/living-score', label: 'Hanoi Living Score', short: 'Living Score', key: 'live' },
  ];
}
