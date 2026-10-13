import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, ViewChild, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, map, of, startWith, switchMap } from 'rxjs';
import { Horizon, SearchResult } from '../pi.models';
import { DEFAULT_STATE, MAX_COMPARE, PiApiService, PiStateService } from '../pi.service';
import { decodeWeights } from '../pi-weights';

/**
 * Frame shared by the three Property Intelligence pages: the product bar (brand, tabs, ⌘K search with breadcrumb,
 * data date, language) above the routed page. A shared link's ?ward=&horizon=&lang= is applied here.
 */
@Component({
  selector: 'pi-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['../pi.css', './pi-shell.component.css'],
  template: `
    @let tx = state.t();
    <div class="pi-root pi-shell" [attr.lang]="state.lang()">
      <header class="pi-topbar">
        <a class="pi-brand" routerLink="/property-intelligence" [attr.aria-label]="tx.brandAria">
          <span class="pi-brand__mark" aria-hidden="true"><i></i></span>
          <span class="pi-brand__word">{{ tx.brand }}</span>
        </a>

        <nav class="pi-tabs" [attr.aria-label]="tx.tabsAria">
          <a routerLink="/property-intelligence" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">{{ tx.tabs.overview }}</a>
          <a routerLink="/property-intelligence/map" routerLinkActive="is-active" ariaCurrentWhenActive="page">{{ tx.tabs.map }}</a>
          <a [routerLink]="['/property-intelligence/projects', projectLink()]" routerLinkActive="is-active" ariaCurrentWhenActive="page">{{ tx.tabs.projects }}</a>
        </nav>

        <div class="pi-search" [class.is-open]="searchOpen()">
          <span class="pi-search__icon" aria-hidden="true"></span>
          @if (searchOpen()) {
            <input
              #searchInput
              type="search"
              [placeholder]="tx.searchPlaceholder"
              [attr.aria-label]="tx.searchAria"
              autocomplete="off"
              [value]="query()"
              (input)="onQuery($any($event.target).value)"
              (keydown)="onSearchKey($event)"
              (blur)="closeSearchSoon()"
            />
          } @else {
            <button type="button" class="pi-search__crumbs" (click)="openSearch()" [attr.aria-label]="tx.searchOpen">
              <span>{{ tx.city }}</span>
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
                    <span class="pi-search__type">{{ tx.resultType[r.type] }}</span>
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
              {{ watching() ? tx.watching : tx.watch }}
            </button>
            <button type="button" class="pi-btn pi-btn--primary" (click)="state.reportOpen.set(true)">{{ tx.report }}</button>
          } @else {
            <span class="pi-updated"><i aria-hidden="true"></i>{{ tx.updated(updated()) }}</span>
          }
          <div class="pi-watch">
            <button type="button" class="pi-btn pi-watch__btn" [attr.aria-expanded]="watchOpen()" [attr.aria-label]="tx.watchList.aria" (click)="watchOpen.set(!watchOpen())">
              {{ tx.watchList.open(watchCount()) }}
            </button>
            @if (watchOpen()) {
              <div class="pi-watch__menu" role="dialog" [attr.aria-label]="tx.watchList.title">
                <strong>{{ tx.watchList.title }}</strong>
                @if (!watchCount()) {
                  <p>{{ tx.watchList.empty }}</p>
                }
                @if (watchedWards().length) {
                  <span class="pi-kicker">{{ tx.watchList.wards }}</span>
                  @for (w of watchedWards(); track w.slug) {
                    <div class="pi-watch__row">
                      <button type="button" class="pi-watch__open" (click)="openWard(w.slug)">{{ w.name }} <small>· {{ w.score }}</small></button>
                      <button type="button" class="pi-watch__x" (click)="state.toggleWatchWard(w.slug)" [attr.aria-label]="tx.watchList.remove">×</button>
                    </div>
                  }
                }
                @if (watchedProjects().length) {
                  <span class="pi-kicker">{{ tx.watchList.projects }}</span>
                  @for (p of watchedProjects(); track p.slug) {
                    <div class="pi-watch__row">
                      <button type="button" class="pi-watch__open" (click)="openProject(p.slug)">{{ p.name }} <small>· {{ p.price.label }}</small></button>
                      <button type="button" class="pi-watch__x" (click)="state.toggleWatch(p.slug)" [attr.aria-label]="tx.watchList.remove">×</button>
                    </div>
                  }
                }
              </div>
            }
          </div>
          <button type="button" class="pi-btn pi-lang" (click)="toggleLang()" [attr.aria-label]="tx.langAria">{{ tx.langSwitch }}</button>
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
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

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

  private readonly overview = toSignal(toObservable(this.state.lang).pipe(switchMap((lang) => this.api.overview(lang).pipe(catchError(() => of(null))))), { initialValue: null });
  private readonly wards = toSignal(this.api.wards().pipe(catchError(() => of(null))), { initialValue: null });
  private readonly projects = toSignal(toObservable(this.state.lang).pipe(switchMap((lang) => this.api.projects(lang).pipe(catchError(() => of(null))))), { initialValue: null });
  /** The remembered project, unless it no longer exists (e.g. saved by an earlier version): then the default one. */
  protected readonly projectLink = computed(() => {
    const list = this.projects()?.projects;
    const saved = this.state.project();
    return !list?.length || list.some((p) => p.slug === saved) ? saved : DEFAULT_STATE.project;
  });

  protected readonly updated = computed(() => {
    const date = this.overview()?.dataUpdated;
    const locale = this.state.lang() === 'en' ? 'en-GB' : 'vi-VN';
    return date ? new Date(date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '…';
  });

  /** Breadcrumb after "Hà Nội": the ward, plus the project on the Projects page. */
  protected readonly crumbs = computed(() => {
    if (this.onProject()) {
      const p = this.projects()?.projects.find((x) => x.slug === this.state.project());
      return p ? [p.ward?.name ?? p.street, p.name] : [];
    }
    const w = this.wards()?.wards.find((x) => x.slug === this.state.ward());
    return w ? [w.name] : [];
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
        switchMap((q) => (q.trim() ? this.api.search(q, this.state.lang()).pipe(catchError(() => of({ results: [] }))) : of({ results: [] }))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ results }) => {
        this.results.set(results);
        this.active.set(0);
      });
    // A shared link (?ward=&horizon=&lang=) wins over the saved state; the address is then cleaned up.
    const q = this.route.snapshot.queryParamMap;
    const ward = q.get('ward');
    const horizon = Number(q.get('horizon')) as Horizon;
    const lang = q.get('lang');
    if (ward && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ward)) this.state.set('ward', ward);
    if ([2026, 2030, 2045].includes(horizon)) this.state.set('horizon', horizon);
    if (lang === 'vi' || lang === 'en') this.state.set('lang', lang);
    const weights = decodeWeights(q.get('w'));
    if (weights) this.state.setWeights(weights);
    const compare = (q.get('c') ?? '').split(',').filter((x) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)).slice(0, MAX_COMPARE);
    if (compare.length) this.state.setCompare(compare);
    if (ward || q.get('horizon') || lang || q.get('w') || q.get('c')) {
      void this.router.navigate([], { queryParams: { ward: null, horizon: null, lang: null, w: null, c: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  protected readonly watchOpen = signal(false);
  protected readonly watchedWards = computed(() => {
    const list = this.wards()?.wards ?? [];
    return this.state.watchWards().map((slug) => list.find((w) => w.slug === slug)).filter((w) => !!w);
  });
  protected readonly watchedProjects = computed(() => {
    const list = this.projects()?.projects ?? [];
    return this.state.watchlist().map((slug) => list.find((p) => p.slug === slug)).filter((p) => !!p);
  });
  /** Only entries that still exist (a project removed since it was watched does not count). */
  protected readonly watchCount = computed(() => this.watchedWards().length + this.watchedProjects().length);

  protected openWard(slug: string): void {
    this.state.set('ward', slug);
    this.watchOpen.set(false);
    void this.router.navigate(['/property-intelligence/map']);
  }

  protected openProject(slug: string): void {
    this.watchOpen.set(false);
    void this.router.navigate(['/property-intelligence/projects', slug]);
  }

  protected toggleLang(): void {
    this.state.set('lang', this.state.lang() === 'vi' ? 'en' : 'vi');
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
    if (result.type === 'ward') {
      this.state.set('ward', result.slug);
      void this.router.navigate(['/property-intelligence/map']);
    } else {
      void this.router.navigate(['/property-intelligence/projects', result.slug]);
    }
    this.searchInput?.nativeElement.blur();
  }
}
