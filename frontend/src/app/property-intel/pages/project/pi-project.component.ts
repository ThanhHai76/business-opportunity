import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ThemeService } from '../../../services/theme.service';
import { PiProjectMapComponent } from '../../components/pi-project-map.component';
import { PiDistancePipe, formatBillion, formatNum } from '../../pi-format';
import { ProjectDetail } from '../../pi.models';
import { DEFAULT_STATE, PiApiService, PiStateService, describeError } from '../../pi.service';

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; value: T };

/** 02 · Project deep dive — a project with a published price, in its real surroundings. */
@Component({
  selector: 'pi-project',
  standalone: true,
  imports: [PiProjectMapComponent, PiDistancePipe],
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
  protected readonly t = this.state.t;

  private readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')), { initialValue: '' });

  protected readonly load = toSignal(
    toObservable(computed(() => ({ slug: this.slug(), lang: this.state.lang() }))).pipe(
      switchMap(({ slug, lang }) =>
        this.api.project(slug, lang).pipe(
          map((value): Load<ProjectDetail> => ({ status: 'ok', value })),
          catchError((err) => {
            // A link or saved state naming a project that no longer exists: open the default project instead.
            if (err instanceof HttpErrorResponse && err.status === 404 && slug !== DEFAULT_STATE.project) {
              this.state.set('project', DEFAULT_STATE.project);
              void this.router.navigate(['/property-intelligence/projects', DEFAULT_STATE.project], { replaceUrl: true });
              return of<Load<ProjectDetail>>({ status: 'loading' });
            }
            return of<Load<ProjectDetail>>({ status: 'error', message: describeError(err, lang) });
          }),
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

  /** "9,8–12,46 tỷ" for the 70 m² example unit. */
  protected readonly unitPrice = computed(() => {
    const p = this.p();
    if (!p) return '';
    const lang = this.state.lang();
    return p.unit.max === null ? `> ${formatBillion(p.unit.min, lang)}` : p.unit.min === p.unit.max ? formatBillion(p.unit.min, lang) : `${formatNum(p.unit.min, lang, 2)}–${formatBillion(p.unit.max, lang)}`;
  });

  /** The project's price source (the first source of the response). */
  protected readonly priceSource = computed(() => this.p()?.sources[0] ?? null);

  protected readonly watching = computed(() => this.state.watchlist().includes(this.slug()));
  protected readonly formatNum = formatNum;

  constructor() {
    // Remember the project (Projects tab, breadcrumb) and its ward (dashboard selection).
    effect(
      () => {
        const p = this.p();
        if (!p) return;
        this.state.set('project', p.slug);
        if (p.ward) this.state.set('ward', p.ward.slug);
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

  protected openWard(slug: string): void {
    this.state.set('ward', slug);
    void this.router.navigate(['/property-intelligence/map']);
  }

  protected askAbout(p: ProjectDetail): void {
    this.state.ask(this.t().ai.questions.project(p.name), 'project');
    void this.router.navigate(['/property-intelligence/map']);
  }

  protected print(): void {
    window.print();
  }

  protected today(): string {
    return new Date().toLocaleDateString(this.state.lang() === 'en' ? 'en-GB' : 'vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
