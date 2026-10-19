import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AccountService } from '../../services/account.service';
import { BillingService } from '../../services/billing.service';
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

/** The five tools in three groups, so a newcomer sees who each is for before reading names. */
interface SiteGroup {
  id: string;
  label: string;
  hint: string;
  tabs: SiteTab[];
}

/**
 * Header shared by every page: brand (home link), the five tools in three groups, the account button and the light/dark switch.
 * Wide screens: inline pill tabs. Narrow screens (<= 1100px): a menu button that opens a drop-down panel.
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
  /** "Nâng cấp" / "Premium" link (hidden when nothing is for sale on this server). */
  protected readonly billing = inject(BillingService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Mobile menu open state. */
  protected readonly menuOpen = signal(false);

  /** Which group's drop-down is open on wide screens (null: none). */
  protected readonly openGroup = signal<string | null>(null);
  private readonly router = inject(Router);
  private readonly url = signal(this.router.url);

  protected readonly tabs: SiteTab[] = [
    { path: '/future-map', label: 'Hanoi Future Map', short: 'Future Map', hint: 'Quy hoạch Thủ đô 2026 → 2065, có nguồn', key: 'future' },
    { path: '/time-machine', label: 'Hanoi Time Machine', short: 'Time Machine', hint: 'Du hành thời gian 1926 → 2100, có AR', key: 'time' },
    { path: '/living-score', label: 'Hanoi Living Score', short: 'Living Score', hint: 'Chấm điểm nơi an cư từ dữ liệu OpenStreetMap', key: 'live' },
    { path: '/property-intelligence', label: 'AI Property Intelligence', short: 'Property AI', hint: 'Tiềm năng 79 phường/xã: metro, hạ tầng, quy hoạch', key: 'property' },
    { path: '/opportunity-map', label: 'Business Opportunity', short: 'Opportunity', hint: 'Phường nào nên mở gì, có lời không — dữ liệu OSM', key: 'biz' },
  ];

  /** Business · Real estate · Explore Hanoi. A group with one tool is a plain link. */
  protected readonly groups: SiteGroup[] = [
    { id: 'explore', label: 'Khám phá Hà Nội', hint: 'Lịch sử, quy hoạch, tương lai', tabs: [this.tabs[0], this.tabs[1]] },
    { id: 'biz', label: 'Kinh doanh', hint: 'Mở quán, chọn địa điểm', tabs: [this.tabs[4]] },
    { id: 'property', label: 'Bất động sản', hint: 'Mua nhà, đầu tư, chọn nơi ở', tabs: [this.tabs[3], this.tabs[2]] },
  ];

  /** Whether the visitor closed the invitation bar this session. */
  private readonly nudgeClosed = signal(this.readClosed());

  /**
   * The invitation under the header on a tool page: a visitor is invited to try the in-depth AI answers for free,
   * a free account is told what is left and invited to upgrade. Nothing for Premium accounts or where nothing is sold.
   */
  protected readonly nudge = computed(() => {
    const onTool = this.tabs.some((t) => this.url().split(/[?#]/)[0].startsWith(t.path));
    if (!onTool || this.nudgeClosed() || !this.billing.enabled()) return null;
    const metered = this.billing.aiMetering();
    const limits = this.billing.aiLimits();
    if (!this.account.user()) {
      if (!this.account.ready() || !this.account.enabled()) return null;
      return {
        text: metered
          ? `Dùng thử miễn phí: đăng nhập để nhận ${limits.freePerDay} lượt AI chuyên sâu mỗi ngày (Time Machine ${limits.storyFreePerDay}).`
          : 'Đăng nhập để lưu báo cáo và mở trên mọi thiết bị.',
        cta: 'Đăng nhập miễn phí',
        action: 'login' as const,
      };
    }
    const ai = this.billing.ai();
    if (!ai || ai.premium) return null;
    return {
      text: metered
        ? ai.freeLeft + ai.aiCredits > 0
          ? `Hôm nay bạn còn ${ai.freeLeft} lượt AI miễn phí${ai.aiCredits ? ` và ${ai.aiCredits} lượt đã mua` : ''}. Premium: ${limits.premiumPerDay} lượt mỗi ngày.`
          : `Bạn đã dùng hết lượt AI miễn phí hôm nay. Premium: ${limits.premiumPerDay} lượt mỗi ngày.`
        : 'Premium: thêm lượt hỏi AI chuyên sâu và credit báo cáo.',
      cta: 'Nâng cấp Premium',
      action: 'premium' as const,
    };
  });

  /** The group that contains the page on screen (highlighted in the bar). */
  protected readonly activeGroup = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    return this.groups.find((g) => g.tabs.some((t) => path === t.path || path.startsWith(`${t.path}/`)))?.id ?? null;
  });

  constructor() {
    // Tool pages are as tall as the viewport minus --site-nav-h: keep it equal to the real height of the header
    // (the invitation bar makes it taller while it shows).
    afterNextRender(() => {
      const el = this.host.nativeElement;
      const root = document.documentElement;
      const sync = () => root.style.setProperty('--site-nav-h', `${Math.round(el.getBoundingClientRect().height)}px`);
      sync();
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(sync);
      ro.observe(el);
      inject(DestroyRef).onDestroy(() => {
        ro.disconnect();
        root.style.removeProperty('--site-nav-h');
      });
    });
    // Close the menu whenever a navigation finishes (tab tapped, back button, brand link…).
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((e) => {
        this.url.set((e as NavigationEnd).urlAfterRedirects);
        this.closeMenu();
        this.openGroup.set(null);
      });
  }

  private readClosed(): boolean {
    try {
      return sessionStorage.getItem('hcv.nudge.closed') === '1';
    } catch {
      return false;
    }
  }

  protected closeNudge(): void {
    this.nudgeClosed.set(true);
    try {
      sessionStorage.setItem('hcv.nudge.closed', '1');
    } catch {
      /* private mode: the bar simply comes back on the next visit */
    }
  }

  protected nudgeAction(action: 'login' | 'premium'): void {
    if (action === 'login') this.account.dialogOpen.set(true);
    else void this.router.navigateByUrl('/premium');
  }

  protected toggleGroup(id: string): void {
    this.openGroup.update((open) => (open === id ? null : id));
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
    this.openGroup.set(null);
  }

  protected initial(): string {
    const u = this.account.user();
    return (u?.displayName || u?.email || '?').trim().charAt(0).toUpperCase();
  }

  /** Tap outside the header/menu closes it. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.openGroup.set(null);
      if (this.menuOpen()) this.closeMenu();
    }
  }

  /** The menu is only rendered on narrow screens; make sure it can't stay open after a resize to desktop. */
  @HostListener('window:resize')
  protected onResize(): void {
    if (this.menuOpen() && window.innerWidth > 1100) {
      this.closeMenu();
    }
  }
}
