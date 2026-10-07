import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, of, switchMap, tap } from 'rxjs';
import { IconComponent } from '../living-score/components/icon/icon.component';
import { ThemeService } from '../services/theme.service';
import { normalizeText } from '../utils/text';
import { OP_LANG_KEY, OP_TEXT } from './op-i18n';
import { OpMapComponent, SCORE_STOPS } from './op-map.component';
import { AskAnswer, BusinessType, CompareResponse, Horizon, Lang, Opportunity, WardDetail, WardProps, WardsResponse } from './op.models';
import { OpportunityService, describeError } from './op.service';

const SLUG = /^[a-z0-9-]{1,60}$/;
const MAX_COMPARE = 3;

function initialLang(params: URLSearchParams): Lang {
  const fromUrl = params.get('lang');
  if (fromUrl === 'vi' || fromUrl === 'en') return fromUrl;
  try {
    return localStorage.getItem(OP_LANG_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

/**
 * Business Opportunity Map — Hanoi wards (2025) coloured by how promising a business type is there, today or in
 * 3–5 years, from OpenStreetMap data. Pick a type first (where should I open X?) or a ward (what should I open
 * here?); every score opens up into the figures behind it.
 */
@Component({
  selector: 'app-opportunity',
  standalone: true,
  imports: [OpMapComponent, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './opportunity.component.html',
  styleUrl: './opportunity.component.css',
})
export class OpportunityComponent {
  private readonly api = inject(OpportunityService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly theme = inject(ThemeService).effective;
  @ViewChild(OpMapComponent) protected map?: OpMapComponent;

  private readonly params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  protected readonly lang = signal<Lang>(initialLang(this.params));
  protected readonly t = computed(() => OP_TEXT[this.lang()]);
  protected readonly scoreStops = SCORE_STOPS;

  protected readonly types = signal<BusinessType[]>([]);
  protected readonly type = signal<string | null>(this.validSlug(this.params.get('type')));
  protected readonly horizon = signal<Horizon>(this.params.get('horizon') === '2030' ? '2030' : 'now');
  protected readonly wards = signal<WardsResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly reload = signal(0);

  protected readonly selected = signal<string | null>(this.validSlug(this.params.get('ward')));
  protected readonly detail = signal<WardDetail | null>(null);
  protected readonly flyToken = signal(0);
  protected readonly showPlaces = signal(false);
  protected readonly places = signal<GeoJSON.FeatureCollection | null>(null);

  protected readonly query = signal('');
  protected readonly compare = signal<string[]>((this.params.get('compare') ?? '').split(',').filter((s) => SLUG.test(s)).slice(0, MAX_COMPARE));
  protected readonly compareOpen = signal(false);
  protected readonly compareResult = signal<CompareResponse | null>(null);
  protected readonly askOpen = signal(false);
  protected readonly askText = signal('');
  protected readonly asking = signal(false);
  protected readonly answer = signal<AskAnswer | null>(null);
  protected readonly askError = signal<string | null>(null);
  protected readonly methodOpen = signal(false);
  protected readonly copied = signal(false);
  /** Left panel; on small screens it folds away while a ward is open, so the map stays visible. */
  protected readonly panelOpen = signal(!(this.selected() && this.isSmall()));

  protected readonly selectedType = computed(() => this.types().find((x) => x.key === this.type()) ?? null);
  private readonly wardList = computed(() => (this.wards()?.features ?? []).map((f) => f.properties as unknown as WardProps));
  /** Best wards for the selected type (or by their top type), for the list in the left panel. */
  protected readonly ranking = computed(() =>
    this.wardList()
      .filter((w) => w.scored && w.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 12),
  );
  protected readonly suggestions = computed(() => {
    const q = normalizeText(this.query());
    if (!q) return [];
    return this.wardList()
      .filter((w) => normalizeText(w.name).includes(q))
      .slice(0, 6);
  });
  /** The selected type in the ward panel (or the ward's best type when no type is selected). */
  protected readonly focus = computed<Opportunity | null>(() => {
    const d = this.detail();
    if (!d?.scored) return null;
    return (this.type() ? d.opportunities.find((o) => o.type === this.type()) : d.opportunities[0]) ?? null;
  });
  protected readonly others = computed(() => {
    const d = this.detail();
    const f = this.focus();
    return (d?.opportunities ?? []).filter((o) => o.type !== f?.type).slice(0, 6);
  });
  protected readonly compareNames = computed(() => this.compare().map((slug) => this.wardList().find((w) => w.slug === slug)?.name ?? slug));

  constructor() {
    toObservable(computed(() => this.lang()))
      .pipe(
        switchMap((lang) => this.api.types(lang).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        if (!r) return;
        this.types.set(r.types);
        if (this.type() && !r.types.some((x) => x.key === this.type())) this.type.set(null);
      });

    toObservable(computed(() => ({ type: this.type(), horizon: this.horizon(), lang: this.lang(), reload: this.reload() })))
      .pipe(
        switchMap(({ type, horizon, lang }) =>
          this.api.wards(type, horizon, lang).pipe(
            catchError((e: unknown) => {
              this.error.set(describeError(e, lang));
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((w) => {
        this.error.set(null);
        this.wards.set(w);
      });

    toObservable(computed(() => ({ slug: this.selected(), horizon: this.horizon(), lang: this.lang() })))
      .pipe(
        tap(({ slug }) => {
          if (!slug) this.detail.set(null);
        }),
        switchMap(({ slug, horizon, lang }) => (slug ? this.api.ward(slug, horizon, lang).pipe(catchError(() => (this.selected.set(null), EMPTY))) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe((d) => this.detail.set(d));

    // Competitors of the focused type in the selected ward.
    toObservable(computed(() => ({ slug: this.selected(), type: this.focus()?.type ?? null, show: this.showPlaces() })))
      .pipe(
        switchMap(({ slug, type, show }) => (slug && type && show ? this.api.places(slug, type).pipe(catchError(() => of(null))) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe((p) => this.places.set(p));

    // Keep the address bar on the current view so it can be shared.
    effect(() => {
      const url = this.shareUrl();
      if (typeof history !== 'undefined') history.replaceState(history.state, '', url.slice(location.origin.length));
    });
    if (this.selected()) setTimeout(() => this.flyToken.update((n) => n + 1), 1500);
  }

  private isSmall(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 1100;
  }

  private validSlug(value: string | null): string | null {
    return value && SLUG.test(value) ? value : null;
  }

  private shareUrl(): string {
    const p = new URLSearchParams();
    if (this.type()) p.set('type', this.type()!);
    if (this.horizon() === '2030') p.set('horizon', '2030');
    if (this.selected()) p.set('ward', this.selected()!);
    if (this.compare().length) p.set('compare', this.compare().join(','));
    if (this.lang() === 'en') p.set('lang', 'en');
    const qs = p.toString();
    return `${location.origin}${location.pathname}${qs ? `?${qs}` : ''}`;
  }

  // ------------------------------------------------------------- choices
  protected setType(key: string | null): void {
    this.type.set(key);
    this.answer.set(null);
  }

  protected setHorizon(h: Horizon): void {
    this.horizon.set(h);
  }

  protected selectWard(slug: string, fly = false): void {
    this.selected.set(slug);
    this.query.set('');
    if (this.isSmall()) this.panelOpen.set(false);
    if (fly) this.flyToken.update((n) => n + 1);
  }

  protected closeWard(): void {
    this.selected.set(null);
    this.showPlaces.set(false);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected toggleLang(): void {
    const next: Lang = this.lang() === 'vi' ? 'en' : 'vi';
    this.lang.set(next);
    this.answer.set(null);
    this.compareResult.set(null);
    try {
      localStorage.setItem(OP_LANG_KEY, next);
    } catch {
      /* not remembered */
    }
    if (this.compareOpen()) this.loadCompare();
  }

  // ------------------------------------------------------------- compare
  protected inCompare(slug: string): boolean {
    return this.compare().includes(slug);
  }

  protected toggleCompare(slug: string): void {
    const list = this.compare();
    if (list.includes(slug)) this.compare.set(list.filter((s) => s !== slug));
    else if (list.length < MAX_COMPARE) this.compare.set([...list, slug]);
    if (this.compareOpen()) this.loadCompare();
  }

  protected openCompare(): void {
    this.compareOpen.set(true);
    this.loadCompare();
  }

  private loadCompare(): void {
    this.compareResult.set(null);
    if (this.compare().length < 2) return;
    this.api
      .compare(this.compare(), this.type(), this.horizon(), this.lang())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.compareResult.set(r), error: () => this.compareResult.set(null) });
  }

  // ------------------------------------------------------------- ask
  protected onAskInput(event: Event): void {
    this.askText.set((event.target as HTMLInputElement).value);
  }

  protected ask(event: Event): void {
    event.preventDefault();
    const q = this.askText().trim();
    if (q.length < 2 || this.asking()) return;
    this.asking.set(true);
    this.askError.set(null);
    this.api
      .ask(q, { type: this.type(), ward: this.selected(), horizon: this.horizon(), lang: this.lang() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (a) => {
          this.answer.set(a);
          this.asking.set(false);
        },
        error: (e: unknown) => {
          this.askError.set(describeError(e, this.lang()));
          this.asking.set(false);
        },
      });
  }

  protected answeredBy(a: AskAnswer): string {
    const by = this.t().askBy;
    return a.outOfScope ? by['out'] : (by[a.provider] ?? by['mock']);
  }

  // ------------------------------------------------------------- share & misc
  protected async share(): Promise<void> {
    const url = this.shareUrl();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: this.t().title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      /* share sheet closed or clipboard refused — the link is in the address bar */
    }
  }

  protected retry(): void {
    this.error.set(null);
    this.reload.update((n) => n + 1);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.compareOpen()) this.compareOpen.set(false);
    else if (this.askOpen()) this.askOpen.set(false);
    else if (this.methodOpen()) this.methodOpen.set(false);
    else if (this.selected()) this.closeWard();
  }

  /** 29.9 → "29,9" in Vietnamese. */
  protected num(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString(this.lang() === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: digits });
  }

  protected bandColor(score: number | null): string {
    if (score === null) return 'var(--op-ink-faint)';
    let color = SCORE_STOPS[0][1];
    for (const [v, c] of SCORE_STOPS) if (score >= v) color = c;
    return color;
  }

  protected shortName(name: string): string {
    return name.replace(/^(Phường|Xã)\s+/, '');
  }

  protected typeOf(key: string): BusinessType | undefined {
    return this.types().find((x) => x.key === key);
  }
}
