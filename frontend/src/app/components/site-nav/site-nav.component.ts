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
import { AccountService } from '../../services/account.service';
import { ThemeService } from '../../services/theme.service';
import { AccountDialogComponent } from '../account/account-dialog.component';

interface SiteTab {
  path: string;
  label: string;
  short: string;
  /** One-line description shown in the mobile menu. */
  hint: string;
  /** Suffix of the `--app-<key>` colour token that identifies the tool. */
  key: 'biz' | 'time' | 'live' | 'future' | 'property';
}

/**
 * Header shared by every page: brand (home link), the five tools, the account button and the light/dark switch.
 * Wide screens: inline pill tabs. Narrow screens (<= 920px): a menu button that opens a drop-down panel.
 */
@Component({
  selector: 'app-site-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AccountDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.css',
})
export class SiteNavComponent {
  protected readonly theme = inject(ThemeService);
  /** Account button (hidden when the server has no database), and the sign-in dialog. */
  protected readonly account = inject(AccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Mobile menu open state. */
  protected readonly menuOpen = signal(false);

  protected readonly tabs: SiteTab[] = [
    { path: '/future-map', label: 'Hanoi Future Map', short: 'Future Map', hint: 'Quy hoạch Thủ đô 2026 → 2065, có nguồn', key: 'future' },
    { path: '/time-machine', label: 'Hanoi Time Machine', short: 'Time Machine', hint: 'Du hành thời gian 1926 → 2100, có AR', key: 'time' },
    { path: '/living-score', label: 'Hanoi Living Score', short: 'Living Score', hint: 'Chấm điểm nơi an cư từ dữ liệu OpenStreetMap', key: 'live' },
    { path: '/property-intelligence', label: 'AI Property Intelligence', short: 'Property AI', hint: 'Tiềm năng 79 phường/xã: metro, hạ tầng, quy hoạch', key: 'property' },
    { path: '/opportunity-map', label: 'Business Opportunity', short: 'Opportunity', hint: 'Phường nào nên mở gì, có lời không — dữ liệu OSM', key: 'biz' },
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

  protected initial(): string {
    const u = this.account.user();
    return (u?.displayName || u?.email || '?').trim().charAt(0).toUpperCase();
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
