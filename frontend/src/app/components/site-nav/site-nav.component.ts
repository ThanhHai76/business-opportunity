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
import { SiteLangService } from '../../services/site-lang.service';
import { ThemeService } from '../../services/theme.service';
import { NAV_TEXT } from './site-nav.i18n';
import { AccountDialogComponent } from '../account/account-dialog.component';

interface SiteTab {
  path: string;
  label: string;
  short: string;
  /** One-line description shown in the mobile menu. */
  hint: string;
  /** Suffix of the `--app-<key>` colour token that identifies the tool. */
  key: 'biz' | 'time' | 'live' | 'future' | 'property' | 'career';
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

  protected readonly site = inject(SiteLangService);
  /** The words of the bar, in the site's language. */
  protected readonly nx = computed(() => NAV_TEXT[this.site.lang()]);
  protected readonly tabs = computed<SiteTab[]>(() => {
    const t = this.nx().tools;
    return [
      { path: '/future-map', ...t.future, key: 'future' },
      { path: '/time-machine', ...t.time, key: 'time' },
      { path: '/living-score', ...t.live, key: 'live' },
      { path: '/property-intelligence', ...t.property, key: 'property' },
      { path: '/opportunity-map', ...t.biz, key: 'biz' },
      { path: '/career', ...t.career, key: 'career' },
    ];
  });
  /** Business · Real estate · Explore Hanoi. A group with one tool is a plain link. */
  protected readonly groups = computed<SiteGroup[]>(() => {
    const tabs = this.tabs();
    const g = this.nx().groups;
    return [
      { id: 'explore', ...g.explore, tabs: [tabs[0], tabs[1]] },
      { id: 'biz', ...g.biz, tabs: [tabs[4], tabs[5]] },
      { id: 'property', ...g.property, tabs: [tabs[3], tabs[2]] },
    ];
  });

  /** Whether the visitor closed the invitation bar this session. */
  private readonly nudgeClosed = signal(this.readClosed());

  /**
   * The invitation under the header on a tool page: a visitor is invited to try the in-depth AI answers for free,
   * a free account is told what is left and invited to upgrade. Nothing for Premium accounts or where nothing is sold.
   */
  protected readonly nudge = computed(() => {
    // The career compass has no AI answers (yet): no invitation to try them there.
    const onTool = this.tabs().some((t) => t.key !== 'career' && this.url().split(/[?#]/)[0].startsWith(t.path));
    if (!onTool || this.nudgeClosed() || !this.billing.enabled()) return null;
    const metered = this.billing.aiMetering();
    const limits = this.billing.aiLimits();
    if (!this.account.user()) {
      if (!this.account.ready() || !this.account.enabled()) return null;
      const nx = this.nx();
      return {
        text: metered ? nx.nudgeFree(limits.freePerDay, limits.storyFreePerDay) : nx.nudgeSave,
        cta: nx.nudgeSignIn,
        action: 'login' as const,
      };
    }
    const ai = this.billing.ai();
    if (!ai || ai.premium) return null;
    const nx = this.nx();
    return {
      text: metered ? (ai.freeLeft + ai.aiCredits > 0 ? nx.nudgeLeft(ai.freeLeft, ai.aiCredits, limits.premiumPerDay) : nx.nudgeUsed(limits.premiumPerDay)) : nx.nudgePremium,
      cta: nx.nudgeUpgrade,
      action: 'premium' as const,
    };
  });

  /** The group that contains the page on screen (highlighted in the bar). */
  protected readonly activeGroup = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    return this.groups().find((g) => g.tabs.some((t) => path === t.path || path.startsWith(`${t.path}/`)))?.id ?? null;
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
