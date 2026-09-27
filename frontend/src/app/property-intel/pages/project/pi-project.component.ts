import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ThemeService } from '../../../services/theme.service';
import { PiProjectMapComponent } from '../../components/pi-project-map.component';
import { PiDistancePipe, PiPerM2Pipe, PiTotalPipe, areaPoints, formatPerM2, linePoints } from '../../pi-format';
import { ProjectDetail } from '../../pi.models';
import { PiApiService, PiStateService, describeError } from '../../pi.service';

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; value: T };
type Range = '1Y' | '3Y' | '5Y';
const RANGE_POINTS: Record<Range, number> = { '1Y': 5, '3Y': 13, '5Y': 21 };

/** 02 · Property deep dive — one project, its location, valuation and AI take. */
@Component({
  selector: 'pi-project',
  standalone: true,
  imports: [PiProjectMapComponent, PiPerM2Pipe, PiTotalPipe, PiDistancePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pi-project.component.html',
  styleUrl: './pi-project.component.css',
})
export class PiProjectComponent {
  protected readonly state = inject(PiStateService);
  protected readonly theme = inject(ThemeService);
  private readonly api = inject(PiApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')), { initialValue: '' });

  protected readonly load = toSignal(
    toObservable(this.slug).pipe(
      switchMap((slug) =>
        this.api.project(slug).pipe(
          map((value): Load<ProjectDetail> => ({ status: 'ok', value })),
          catchError((err) => of<Load<ProjectDetail>>({ status: 'error', message: describeError(err) })),
          startWith<Load<ProjectDetail>>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as Load<ProjectDetail> },
  );
  protected readonly p = computed(() => {
    const l = this.load();
    return l.status === 'ok' ? l.value : null;
  });

  protected readonly show = signal({ tod: true, walk: false, drive: false });
  protected readonly range = signal<Range>('3Y');
  protected readonly ranges: Range[] = ['1Y', '3Y', '5Y'];

  protected readonly priceFormatter = computed(() => {
    const currency = this.state.currency();
    const rate = this.state.vndPerUsd();
    return (tr: number) => `${formatPerM2(tr, currency, rate)}/m²`;
  });

  protected readonly chart = computed(() => {
    const p = this.p();
    if (!p) return null;
    const all = p.history.points;
    const n = RANGE_POINTS[this.range()];
    const pts = all.slice(-n);
    const values = pts.map((x) => x.value);
    const min = Math.min(...values) * 0.95;
    const max = Math.max(...values) * 1.03;
    const startIndex = all.length - n;
    const m = p.history.milestone.quarter - startIndex;
    const milestoneX = m >= 0 && m < n ? (m / (n - 1)) * 320 : null;
    const lastY = Number(linePoints(values, 320, 120, min, max).split(' ').at(-1)!.split(',')[1]);
    return {
      line: linePoints(values, 320, 120, min, max),
      area: areaPoints(values, 320, 120, min, max),
      first: pts[0],
      last: pts.at(-1)!,
      lastY,
      milestoneX,
      milestone: p.history.milestone.label,
    };
  });

  protected readonly base5y = computed(() => {
    const p = this.p();
    return p ? Math.round(p.estimate.value * (1 + p.baseScenario.change / 100) * 100) / 100 : 0;
  });

  protected readonly watching = computed(() => this.state.watchlist().includes(this.slug()));

  constructor() {
    // Remember the project (Projects tab, breadcrumb) and its district (dashboard selection).
    effect(
      () => {
        const p = this.p();
        if (!p) return;
        this.state.set('project', p.slug);
        this.state.set('district', p.district);
      },
      { allowSignalWrites: true },
    );
  }

  @HostListener('document:keydown.escape')
  protected closeReport(): void {
    this.state.reportOpen.set(false);
  }

  protected toggleShow(key: 'tod' | 'walk' | 'drive'): void {
    this.show.update((s) => ({ ...s, [key]: !s[key] }));
  }

  protected openProject(slug: string): void {
    void this.router.navigate(['/property-intelligence/projects', slug]);
  }

  protected openDistrict(slug: string): void {
    this.state.set('district', slug);
    void this.router.navigate(['/property-intelligence/map']);
  }

  protected askAbout(p: ProjectDetail): void {
    this.state.ask(`Tell me about ${p.name}`, 'project');
    void this.router.navigate(['/property-intelligence/map']);
  }

  protected print(): void {
    window.print();
  }

  protected today(): string {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
