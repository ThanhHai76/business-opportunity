import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { ReportIssueComponent } from '../../components/report-issue/report-issue.component';
import { DirectoryResponse, DirectoryUnit, WardDetail } from '../../opportunity/op.models';
import { OpportunityService } from '../../opportunity/op.service';
import { SiteLangService } from '../../services/site-lang.service';
import { WARDS_TEXT } from './wards.i18n';

interface PageState {
  state: 'loading' | 'ready' | 'missing' | 'error';
  dir: DirectoryResponse | null;
  unit: DirectoryUnit | null;
  detail: WardDetail | null;
}

const LOADING: PageState = { state: 'loading', dir: null, unit: null, detail: null };

/** /phuong-xa/:slug: one ward or commune. Official figures for every unit, and the map's findings where it covers the unit. */
@Component({
  selector: 'app-ward-page',
  standalone: true,
  imports: [RouterLink, ReportIssueComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wp">
      <p><a routerLink="/phuong-xa">{{ tx().back }}</a></p>
      @switch (page().state) {
        @case ('ready') {
          @let u = page().unit!;
          <h1>{{ u.name }}</h1>
          <p class="wp__kind">{{ tx().kind[u.kind] }} · Hà Nội</p>

          <section aria-labelledby="wp-facts">
            <h2 id="wp-facts">{{ tx().facts }}</h2>
            <dl class="wp__facts">
              <div><dt>{{ tx().population(date()) }}</dt><dd>{{ num(u.population) }} {{ tx().people }}</dd></div>
              <div><dt>{{ tx().area }}</dt><dd>{{ num(u.areaKm2) }} km²</dd></div>
              <div><dt>{{ tx().density }}</dt><dd>{{ num(u.density) }} {{ tx().perKm2 }}</dd></div>
              @if (u.covered) {
                <div>
                  <dt>{{ tx().metro }}</dt>
                  <dd>
                    @if (u.metroNearest; as m) {
                      {{ m.name }} ({{ tx().metroLine(m.line, km(m.distanceM)) }})
                    } @else {
                      {{ tx().metroNone }}
                    }
                  </dd>
                </div>
              }
            </dl>
          </section>

          @if (page().detail; as d) {
            @if (d.scored && d.opportunities.length) {
              <section aria-labelledby="wp-opps">
                <h2 id="wp-opps">{{ tx().opportunities }}</h2>
                <ol class="wp__opps">
                  @for (o of d.opportunities.slice(0, 5); track o.type) {
                    <li>
                      <span aria-hidden="true">{{ o.icon }}</span>
                      <strong>{{ o.name }}</strong>
                      <span>{{ o.opportunity }}/100 {{ o.confidence === 'low' ? '· ' + tx().lowData : '' }}</span>
                    </li>
                  }
                </ol>
                <p class="wp__note">{{ tx().opportunitiesNote }}</p>
              </section>
            }
          } @else if (!u.covered) {
            <p class="wp__note">{{ tx().uncovered }}</p>
          }

          <nav class="wp__links">
            @if (u.covered) {
              <a class="wp__btn" routerLink="/opportunity-map" [queryParams]="{ ward: u.slug }">{{ tx().openMap }}</a>
            }
            <a class="wp__btn wp__btn--ghost" routerLink="/property-intelligence">{{ tx().openProperty }}</a>
          </nav>

          <section aria-labelledby="wp-src">
            <h2 id="wp-src">{{ tx().sources }}</h2>
            <ul class="wp__src">
              @for (s of page().detail?.sources ?? [officialSource()]; track s.id) {
                <li><a [href]="s.url" target="_blank" rel="noopener noreferrer">{{ s.title }}</a> <small>— {{ s.publisher }}</small></li>
              }
            </ul>
          </section>
          @if (u.covered) {
            <app-report-issue kind="ward" [target]="u.slug" [targetName]="u.name" page="ward-page" [lang]="site.lang()" />
          }
        }
        @case ('missing') {
          <h1>{{ tx().notFound }}</h1>
        }
        @case ('error') {
          <p class="wp__err" role="alert">{{ tx().failed }}</p>
        }
        @default {
          <p>{{ tx().loading }}</p>
        }
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
    .wp { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; display: grid; gap: 14px; }
    h1 { margin: 0; font-size: 28px; }
    h2 { margin: 0 0 8px; font-size: 17px; }
    p, ol, ul, dl { margin: 0; }
    a { color: var(--app-biz); font-weight: 700; text-decoration: none; }
    .wp__kind, .wp__note { color: var(--app-ink-dim); font-size: 14px; }
    .wp__facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    .wp__facts div { padding: 10px 12px; border: 1px solid var(--app-line); border-radius: 12px; background: var(--app-surface-2); }
    dt { font-size: 12.5px; font-weight: 700; color: var(--app-ink-dim); }
    dd { margin: 2px 0 0; font-weight: 700; }
    .wp__opps { list-style: none; padding: 0; display: grid; gap: 6px; }
    .wp__opps li { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; padding: 8px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); }
    .wp__links { display: flex; flex-wrap: wrap; gap: 8px; }
    .wp__btn { padding: 10px 16px; border-radius: 10px; background: var(--app-biz); color: #fff; }
    .wp__btn--ghost { background: transparent; border: 1px solid var(--app-biz); color: var(--app-biz); }
    .wp__src { padding-left: 18px; display: grid; gap: 4px; }
    .wp__err { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, #dc2626 12%, transparent); color: #dc2626; }
  `,
})
export class WardPageComponent {
  private readonly api = inject(OpportunityService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  protected readonly site = inject(SiteLangService);
  protected readonly tx = computed(() => WARDS_TEXT[this.site.lang()]);

  protected readonly page = toSignal(
    combineLatest([this.route.paramMap, toObservable(this.site.lang)]).pipe(
      switchMap(([params, lang]) => {
        const slug = params.get('slug') ?? '';
        return this.api.directory(lang).pipe(
          switchMap((dir): import('rxjs').Observable<PageState> => {
            const unit = dir.units.find((x) => x.slug === slug) ?? null;
            if (!unit) return of({ state: 'missing', dir, unit: null, detail: null });
            if (!unit.covered) return of({ state: 'ready', dir, unit, detail: null });
            return this.api.ward(slug, 'now', lang).pipe(
              map((detail): PageState => ({ state: 'ready', dir, unit, detail })),
              // The ward's own figures are enough to show the page.
              catchError(() => of<PageState>({ state: 'ready', dir, unit, detail: null })),
            );
          }),
          catchError(() => of<PageState>({ state: 'error', dir: null, unit: null, detail: null })),
          startWith(LOADING),
        );
      }),
    ),
    { initialValue: LOADING },
  );

  protected readonly date = computed(() => {
    const iso = this.page().dir?.populationDate ?? '2025-07-01';
    const [y, m, d] = iso.split('-').map(Number);
    return this.site.lang() === 'en' ? iso : `${d}/${m}/${y}`;
  });

  constructor() {
    effect(() => {
      const u = this.page().unit;
      if (u) this.title.setTitle(`${u.name}, Hà Nội · Hanoi Century Vista`);
    });
  }

  protected officialSource() {
    const s = this.page().dir!.source;
    return { id: 'wardList', ...s };
  }

  protected num(n: number): string {
    return n.toLocaleString(this.site.lang() === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: 1 });
  }

  protected km(meters: number): string {
    return (meters / 1000).toLocaleString(this.site.lang() === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: 1 });
  }
}
