import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SiteLangService } from '../../services/site-lang.service';
import { GUIDE_TEXT } from './score-guide.i18n';

/** /giai-thich-diem: what the scores of the three tools mean, in plain words (Vietnamese and English). */
@Component({
  selector: 'app-score-guide',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="sg">
      <p><a routerLink="/">{{ tx().home }}</a></p>
      <h1>{{ tx().title }}</h1>
      <p class="sg__intro">{{ tx().intro }}</p>

      <nav class="sg__toc" [attr.aria-label]="tx().tocLabel">
        @for (s of tx().sections; track s.id) {
          <a [href]="'#' + s.id" (click)="jump($event, s.id)">{{ s.title }}</a>
        }
      </nav>

      <section class="sg__box" aria-labelledby="sg-reading">
        <h2 id="sg-reading">{{ tx().readingTitle }}</h2>
        <ul>
          @for (line of tx().reading; track line) {
            <li>{{ line }}</li>
          }
        </ul>
      </section>

      @for (s of tx().sections; track s.id) {
        <section class="sg__sec" [id]="s.id" [attr.aria-labelledby]="s.id + '-title'">
          <h2 [id]="s.id + '-title'">{{ s.title }}</h2>
          <p class="sg__lead">{{ s.lead }}</p>
          <dl class="sg__terms">
            @for (t of s.terms; track t.name) {
              <div>
                <dt>{{ t.name }}</dt>
                <dd>
                  {{ t.means }}
                  @if (t.detail) {
                    <small>{{ t.detail }}</small>
                  }
                </dd>
              </div>
            }
          </dl>
          @if (s.example) {
            <p class="sg__example">{{ s.example }}</p>
          }
          @if (s.link; as l) {
            <p><a class="sg__go" [routerLink]="l.path">{{ l.label }} →</a></p>
          }
        </section>
      }

      <section class="sg__box" aria-labelledby="sg-limits">
        <h2 id="sg-limits">{{ tx().limitsTitle }}</h2>
        <ul>
          @for (line of tx().limits; track line) {
            <li>{{ line }}</li>
          }
        </ul>
      </section>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.6; }
    .sg { max-width: 820px; margin: 0 auto; padding: 24px 16px 56px; display: grid; gap: 16px; }
    h1 { margin: 0; font-size: 30px; }
    h2 { margin: 0; font-size: 20px; }
    p, ul, dl { margin: 0; }
    a { color: var(--app-biz); font-weight: 700; text-decoration: none; }
    .sg__intro, .sg__lead { color: var(--app-ink-dim); }
    .sg__toc { display: flex; flex-wrap: wrap; gap: 8px; }
    .sg__toc a { padding: 6px 12px; border: 1px solid var(--app-line); border-radius: 999px; font-size: 13px; background: var(--app-surface-2); }
    .sg__box, .sg__sec { padding: 16px 18px; border: 1px solid var(--app-line); border-radius: 14px; background: var(--app-surface-2); display: grid; gap: 10px; scroll-margin-top: 80px; }
    .sg__box ul { padding-left: 20px; display: grid; gap: 6px; }
    .sg__terms { display: grid; gap: 10px; }
    .sg__terms div { padding-left: 12px; border-left: 3px solid var(--app-line); }
    dt { font-weight: 800; }
    dd { margin: 2px 0 0; }
    dd small { display: block; margin-top: 2px; font-size: 13.5px; color: var(--app-ink-dim); }
    .sg__example { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--app-biz) 10%, transparent); }
    .sg__go { display: inline-block; }
  `,
})
export class ScoreGuideComponent {
  private readonly site = inject(SiteLangService);
  protected readonly tx = computed(() => GUIDE_TEXT[this.site.lang()]);

  constructor() {
    // /giai-thich-diem#living (from the "?" next to a score) opens at that section, once it is drawn.
    inject(ActivatedRoute)
      .fragment.pipe(takeUntilDestroyed())
      .subscribe((id) => {
        if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
      });
  }

  /** The links of the contents go to the section without changing the address (the router owns it). */
  protected jump(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
