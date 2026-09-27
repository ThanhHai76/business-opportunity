import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, ViewChild, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, map, of, startWith, switchMap } from 'rxjs';
import { SearchResult } from '../pi.models';
import { PiApiService, PiStateService } from '../pi.service';

/**
 * Frame shared by the three Property Intelligence pages: the product bar from the design
 * (brand, tabs, ⌘K search with breadcrumb, data date, VND/USD) above the routed page.
 */
@Component({
  selector: 'pi-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['../pi.css', './pi-shell.component.css'],
  template: `
    <div class="pi-root pi-shell">
      <header class="pi-topbar">
        <a class="pi-brand" routerLink="/property-intelligence" aria-label="AI Property Intelligence — overview">
          <span class="pi-brand__mark" aria-hidden="true"><i></i></span>
          <span class="pi-brand__word">AI PROPERTY INTELLIGENCE</span>
        </a>

        <nav class="pi-tabs" aria-label="Property Intelligence sections">
          <a routerLink="/property-intelligence" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Overview</a>
          <a routerLink="/property-intelligence/map" routerLinkActive="is-active" ariaCurrentWhenActive="page">Map Intelligence</a>
          <a [routerLink]="['/property-intelligence/projects', state.project()]" routerLinkActive="is-active" ariaCurrentWhenActive="page">Projects</a>
        </nav>

        <div class="pi-search" [class.is-open]="searchOpen()">
          <span class="pi-search__icon" aria-hidden="true"></span>
          @if (searchOpen()) {
            <input
              #searchInput
              type="search"
              placeholder="Search a district or project…"
              aria-label="Search a district or project"
              autocomplete="off"
              [value]="query()"
              (input)="onQuery($any($event.target).value)"
              (keydown)="onSearchKey($event)"
              (blur)="closeSearchSoon()"
            />
          } @else {
            <button type="button" class="pi-search__crumbs" (click)="openSearch()" aria-label="Search (Ctrl+K)">
              <span>Hà Nội</span>
              @for (crumb of crumbs(); track $index; let last = $last) {
                <span class="pi-search__sep" aria-hidden="true">›</span>
                <span [class.is-current]="last">{{ crumb }}</span>
              }
            </button>
          }
          <kbd class="pi-search__kbd">{{ isMac ? '⌘K' : 'Ctrl K' }}</kbd>
          @if (searchOpen() && results().length) {
            <ul class="pi-search__results" role="listbox">
              @for (r of results(); track r.type + r.slug; let i = $index) {
                <li role="option" [attr.aria-selected]="i === active()">
                  <button type="button" (mousedown)="$event.preventDefault()" (click)="pick(r)" [class.is-active]="i === active()">
                    <span class="pi-search__type">{{ r.type === 'district' ? 'AREA' : 'PROJECT' }}</span>
                    <span class="pi-search__name">{{ r.name }}</span>
                    <span class="pi-search__detail">{{ r.detail }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <div class="pi-topbar__right">
          @if (onProject()) {
            <button type="button" class="pi-btn" [attr.aria-pressed]="watching()" (click)="state.toggleWatch(state.project())">
              {{ watching() ? '✓ Watching' : '+ Watchlist' }}
            </button>
            <button type="button" class="pi-btn pi-btn--primary" (click)="state.reportOpen.set(true)">Generate Investment Report</button>
          } @else {
            <span class="pi-updated"><i aria-hidden="true"></i>Data updated {{ updated() }}</span>
          }
          <div class="pi-currency" role="group" aria-label="Currency">
            @for (c of currencies; track c) {
              <button type="button" [attr.aria-pressed]="state.currency() === c" (click)="state.set('currency', c)">{{ c }}</button>
            }
          </div>
        </div>
      </header>

      <main class="pi-page">
        <router-outlet />
      </main>
    </div>
  `,
})
export class PiShellComponent {
  protected readonly state = inject(PiStateService);
  private readonly api = inject(PiApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  protected readonly currencies = ['VND', 'USD'] as const;
  protected readonly isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly onProject = computed(() => this.url().includes('/property-intelligence/projects/'));
  protected readonly watching = computed(() => this.state.watchlist().includes(this.state.project()));

  private readonly overview = toSignal(this.api.overview().pipe(catchError(() => of(null))), { initialValue: null });
  private readonly districts = toSignal(this.api.districts().pipe(catchError(() => of(null))), { initialValue: null });
  private readonly projects = toSignal(this.api.projects().pipe(catchError(() => of(null))), { initialValue: null });

  protected readonly updated = computed(() => {
    const date = this.overview()?.dataUpdated;
    return date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '…';
  });

  /** Breadcrumb after "Hà Nội": the district, plus the project on the Projects page. */
  protected readonly crumbs = computed(() => {
    if (this.onProject()) {
      const p = this.projects()?.projects.find((x) => x.slug === this.state.project());
      return p ? [p.districtName, `${p.name} · ${p.tower}`] : [];
    }
    const d = this.districts()?.districts.find((x) => x.slug === this.state.district());
    return d ? [d.name] : [];
  });

  protected readonly searchOpen = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  private readonly query$ = new Subject<string>();
  protected readonly results = signal<SearchResult[]>([]);

  constructor() {
    this.query$
      .pipe(
        debounceTime(120),
        distinctUntilChanged(),
        switchMap((q) => (q.trim() ? this.api.search(q).pipe(catchError(() => of({ results: [] }))) : of({ results: [] }))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ results }) => {
        this.results.set(results);
        this.active.set(0);
      });
    // Keep the state's USD rate in sync with the API's sample rate.
    this.api
      .overview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (o) => this.state.vndPerUsd.set(o.vndPerUsd), error: () => undefined });
  }

  @HostListener('document:keydown', ['$event'])
  protected onGlobalKey(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
    }
  }

  protected openSearch(): void {
    this.searchOpen.set(true);
    setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  protected closeSearchSoon(): void {
    setTimeout(() => {
      this.searchOpen.set(false);
      this.query.set('');
      this.results.set([]);
    }, 120);
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.query$.next(value);
  }

  protected onSearchKey(event: KeyboardEvent): void {
    const list = this.results();
    if (event.key === 'Escape') {
      this.searchInput?.nativeElement.blur();
    } else if (event.key === 'ArrowDown' && list.length) {
      event.preventDefault();
      this.active.update((i) => (i + 1) % list.length);
    } else if (event.key === 'ArrowUp' && list.length) {
      event.preventDefault();
      this.active.update((i) => (i - 1 + list.length) % list.length);
    } else if (event.key === 'Enter' && list.length) {
      event.preventDefault();
      this.pick(list[this.active()]);
    }
  }

  protected pick(result: SearchResult): void {
    if (result.type === 'district') {
      this.state.set('district', result.slug);
      void this.router.navigate(['/property-intelligence/map']);
    } else {
      void this.router.navigate(['/property-intelligence/projects', result.slug]);
    }
    this.searchInput?.nativeElement.blur();
  }
}
