import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeService } from '../../services/theme.service';

interface SiteTab {
  path: string;
  label: string;
  short: string;
  /** One-line description shown in the mobile menu. */
  hint: string;
  /** Suffix of the `--app-<key>` colour token that identifies the tool. */
  key: 'biz' | 'time' | 'live' | 'future' | 'copilot' | 'property';
}

/**
 * Header shared by every page: brand (home link), the six tools and the light/dark switch.
 * Wide screens: inline pill tabs. Narrow screens (<= 920px): a menu button that opens a drop-down panel.
 */
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Mobile menu open state. */
  protected readonly menuOpen = signal(false);

  protected readonly tabs: SiteTab[] = [
    { path: '/future-map', label: 'Hanoi Future Map', short: 'Future Map', hint: 'Quy hoạch & tương lai 2026 → 2100', key: 'future' },
    { path: '/time-machine', label: 'Hanoi Time Machine', short: 'Time Machine', hint: 'Du hành thời gian 1926 → 2100, có AR', key: 'time' },
    { path: '/living-score', label: 'Hanoi Living Score', short: 'Living Score', hint: 'Chấm điểm nơi an cư theo 8 tiêu chí', key: 'live' },
    { path: '/property-intelligence', label: 'AI Property Intelligence', short: 'Property AI', hint: 'Growth Score, quy hoạch, giá & dự án', key: 'property' },
    { path: '/opportunity-map', label: 'Business Opportunity', short: 'Opportunity', hint: 'Điểm cơ hội kinh doanh theo khu vực', key: 'biz' },
    { path: '/business-copilot', label: 'Business Copilot', short: 'Copilot', hint: 'Top 10 vị trí mở kinh doanh tại Hà Nội', key: 'copilot' },
  ];

  constructor() {
    // Close the menu whenever a navigation finishes (tab tapped, back button, brand link…).
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.closeMenu());
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeMenu();
  }

  /** Tap outside the header/menu closes it. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  /** The menu is only rendered on narrow screens; make sure it can't stay open after a resize to desktop. */
  @HostListener('window:resize')
  protected onResize(): void {
    if (this.menuOpen() && window.innerWidth > 920) {
      this.closeMenu();
    }
  }
}
