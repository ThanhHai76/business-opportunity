import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { DirectoryResponse, DirectoryUnit } from '../../opportunity/op.models';
import { OpportunityService } from '../../opportunity/op.service';
import { SiteLangService } from '../../services/site-lang.service';
import { WARDS_TEXT } from './wards.i18n';

type Sort = 'name' | 'population' | 'density';
type Kind = 'all' | 'ward' | 'commune';

export interface DirState {
  state: 'loading' | 'ready' | 'error';
  dir: DirectoryResponse | null;
}

/** Lower case without accents, so "cau giay" finds "Phường Cầu Giấy". */
export const plain = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

/** /phuong-xa: the 126 wards and communes, searchable. Each one links to its own page. */
@Component({
  selector: 'app-wards',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wd">
      <p><a routerLink="/">{{ tx().home }}</a></p>
      <h1>{{ tx().title }}</h1>
      @if (data().dir; as dir) {
        <p class="wd__intro">{{ tx().intro(dir.units.length) }}</p>
        <div class="wd__tools">
          <input type="search" [attr.aria-label]="tx().search" [placeholder]="tx().search" (input)="query.set($any($event.target).value)" />
          <select [attr.aria-label]="tx().kindAll" (change)="kind.set($any($event.target).value)">
            <option value="all">{{ tx().kindAll }}</option>
            <option value="ward">{{ tx().kindWard }}</option>
            <option value="commune">{{ tx().kindCommune }}</option>
          </select>
          <select [attr.aria-label]="tx().sortLabel" (change)="sort.set($any($event.target).value)">
            <option value="name">{{ tx().sortLabel }}: {{ tx().sortName }}</option>
            <option value="population">{{ tx().sortLabel }}: {{ tx().sortPopulation }}</option>
            <option value="density">{{ tx().sortLabel }}: {{ tx().sortDensity }}</option>
          </select>
        </div>
        <p class="wd__count" role="status">{{ tx().shown(units().length, dir.units.length) }}</p>
        @if (!units().length) {
          <p>{{ tx().none }}</p>
        }
        <ul class="wd__list">
          @for (u of units(); track u.slug) {
            <li>
              <a [routerLink]="['/phuong-xa', u.slug]" class="wd__card">
                <strong>{{ u.name }}</strong>
                <span>{{ num(u.population) }} {{ tx().people }} · {{ num(u.density) }} {{ tx().perKm2 }}</span>
                <small>
                  @if (u.top) {
                    {{ u.top.icon }} {{ tx().topSector }}: {{ u.top.name }} ({{ u.top.score }})
                  } @else if (!u.covered) {
                    {{ tx().noMapData }}
                  }
                </small>
              </a>
            </li>
          }
        </ul>
      } @else if (data().state === 'error') {
        <p class="wd__err" role="alert">{{ tx().failed }}</p>
      } @else {
        <p>{{ tx().loading }}</p>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
    .wd { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; display: grid; gap: 12px; }
    h1 { margin: 0; font-size: 28px; }
    p { margin: 0; }
    a { color: var(--app-biz); font-weight: 700; text-decoration: none; }
    .wd__intro { color: var(--app-ink-dim); }
    .wd__tools { display: flex; flex-wrap: wrap; gap: 8px; }
    .wd__tools input { flex: 1 1 220px; }
    input, select { padding: 10px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); color: var(--app-ink); font: inherit; }
    .wd__count { font-size: 13px; color: var(--app-ink-dim); }
    .wd__err { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, #dc2626 12%, transparent); color: #dc2626; }
    .wd__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
    .wd__card { display: grid; gap: 2px; padding: 12px 14px; border: 1px solid var(--app-line); border-radius: 12px; background: var(--app-surface-2); color: var(--app-ink); font-weight: 400; height: 100%; box-sizing: border-box; }
    .wd__card strong { color: var(--app-biz); }
    .wd__card span { font-size: 13px; }
    .wd__card small { font-size: 12.5px; color: var(--app-ink-dim); }
  `,
})
export class WardsComponent {
  private readonly api = inject(OpportunityService);
  private readonly site = inject(SiteLangService);
  protected readonly tx = computed(() => WARDS_TEXT[this.site.lang()]);
  protected readonly query = signal('');
  protected readonly kind = signal<Kind>('all');
  protected readonly sort = signal<Sort>('name');

  protected readonly data = toSignal(
    toObservable(this.site.lang).pipe(
      switchMap((lang) =>
        this.api.directory(lang).pipe(
          map((dir): DirState => ({ state: 'ready', dir })),
          catchError(() => of<DirState>({ state: 'error', dir: null })),
          startWith<DirState>({ state: 'loading', dir: null }),
        ),
      ),
    ),
    { initialValue: { state: 'loading', dir: null } as DirState },
  );

  protected readonly units = computed<DirectoryUnit[]>(() => {
    const dir = this.data().dir;
    if (!dir) return [];
    const q = plain(this.query().trim());
    const kind = this.kind();
    const list = dir.units.filter((u) => (kind === 'all' || u.kind === kind) && (!q || plain(u.name).includes(q)));
    const sort = this.sort();
    if (sort === 'population') return [...list].sort((a, b) => b.population - a.population);
    if (sort === 'density') return [...list].sort((a, b) => b.density - a.density);
    return list;
  });

  protected num(n: number): string {
    return n.toLocaleString(this.site.lang() === 'en' ? 'en-US' : 'vi-VN');
  }
}
