import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HeatmapMarker, RevenuePoint } from '../bc.models';

/** Score -> colour used across the Copilot (green = good). */
export function scoreTone(score: number): string {
  if (score >= 85) return 'var(--bc-good)';
  if (score >= 70) return 'var(--bc-accent)';
  if (score >= 55) return 'var(--bc-warn)';
  return 'var(--bc-bad)';
}

const C = 2 * Math.PI * 42;

@Component({
  selector: 'bc-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 100 100" [attr.width]="size()" [attr.height]="size()" role="img" [attr.aria-label]="'Business Score ' + score() + '/100'">
      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bc-track)" stroke-width="8" />
      <circle cx="50" cy="50" r="42" fill="none" stroke-width="8" stroke-linecap="round" [attr.stroke]="color()" [attr.stroke-dasharray]="c" [attr.stroke-dashoffset]="offset()" transform="rotate(-90 50 50)" style="transition: stroke-dashoffset .6s ease" />
      <text x="50" y="50" text-anchor="middle" dominant-baseline="central" [attr.font-size]="30" font-weight="800" fill="var(--bc-ink)">{{ score() }}</text>
    </svg>
  `,
  styles: [':host{display:inline-flex;line-height:0}text{font-family:inherit;font-variant-numeric:tabular-nums}'],
})
export class BcRingComponent {
  readonly score = input.required<number>();
  readonly size = input(64);
  protected readonly c = C;
  protected readonly color = computed(() => scoreTone(this.score()));
  protected readonly offset = computed(() => C * (1 - Math.max(0, Math.min(100, this.score())) / 100));
}

@Component({
  selector: 'bc-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="t" role="presentation"><i [style.width.%]="value()" [style.background]="color() || tone()"></i></span>`,
  styles: [
    ':host{display:block}.t{display:block;height:4px;border-radius:999px;background:var(--bc-track);overflow:hidden}i{display:block;height:100%;border-radius:999px;transition:width .5s ease}',
  ],
})
export class BcBarComponent {
  readonly value = input.required<number>();
  readonly color = input<string | null>(null);
  protected readonly tone = computed(() => scoreTone(this.value()));
}

/** 18-month revenue bars (green after break-even) with the monthly-cost line. */
@Component({
  selector: 'bc-revenue-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" role="img" [attr.aria-label]="label()">
      @for (b of bars(); track b.month) {
        <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="1.5" [attr.fill]="b.after ? 'var(--bc-good)' : 'var(--bc-accent-soft)'" />
      }
      <polyline [attr.points]="costLine()" fill="none" stroke="var(--bc-warn)" stroke-width="1.6" stroke-dasharray="3 2.5" vector-effect="non-scaling-stroke" />
      @if (breakEvenX() !== null) {
        <line [attr.x1]="breakEvenX()" [attr.x2]="breakEvenX()" y1="0" [attr.y2]="H" stroke="var(--bc-accent)" stroke-width="1" stroke-dasharray="2 2" vector-effect="non-scaling-stroke" />
      }
    </svg>
    <div class="axis"><span>T1</span><span>T6</span><span>T12</span><span>T18</span></div>
  `,
  styles: [
    ':host{display:block}svg{display:block;width:100%;height:170px}.axis{display:flex;justify-content:space-between;font-size:10px;color:var(--bc-faint);font-family:var(--bc-mono);margin-top:4px}',
  ],
})
export class BcRevenueChartComponent {
  readonly series = input.required<RevenuePoint[]>();
  readonly breakEven = input<number | null>(null);
  protected readonly W = 360;
  protected readonly H = 170;
  private readonly max = computed(() => Math.max(1, ...this.series().flatMap((p) => [p.revenue, p.cost])) * 1.08);
  protected readonly bars = computed(() => {
    const n = this.series().length;
    const slot = this.W / n;
    return this.series().map((p, i) => {
      const h = (p.revenue / this.max()) * this.H;
      return { month: p.month, x: i * slot + slot * 0.14, w: slot * 0.72, y: this.H - h, h, after: p.afterBreakEven };
    });
  });
  protected readonly costLine = computed(() => {
    const slot = this.W / this.series().length;
    return this.series()
      .map((p, i) => `${(i + 0.5) * slot},${this.H - (p.cost / this.max()) * this.H}`)
      .join(' ');
  });
  protected readonly breakEvenX = computed(() => {
    const m = this.breakEven();
    return m ? (m - 0.5) * (this.W / this.series().length) : null;
  });
  protected readonly label = computed(() => `Doanh thu 18 tháng${this.breakEven() ? `, hoà vốn tháng ${this.breakEven()}` : ''}`);
}

/** Day x hour foot-traffic heatmap. */
@Component({
  selector: 'bc-traffic-heat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="g" [style.grid-template-columns]="'24px repeat(' + hours().length + ', minmax(0, 1fr))'" role="img" aria-label="Bản đồ nhiệt lưu lượng khách theo giờ">
      @for (row of grid(); track $index; let d = $index) {
        <span class="d">{{ days()[d] }}</span>
        @for (v of row; track $index) {
          <i [style.opacity]="0.12 + (v / 100) * 0.88" [title]="days()[d] + ' ' + hours()[$index] + 'h: ' + v"></i>
        }
      }
    </div>
    <div class="h" [style.grid-template-columns]="'24px repeat(' + hours().length + ', minmax(0, 1fr))'">
      <span></span>
      @for (h of hours(); track h) {
        <span>{{ h % 4 === 3 ? h + 'h' : '' }}</span>
      }
    </div>
  `,
  styles: [
    ':host{display:block}.g,.h{display:grid;gap:2px}.g i{display:block;aspect-ratio:1.25;border-radius:3px;background:var(--bc-accent)}.d,.h span{font:10px/1 var(--bc-mono);color:var(--bc-faint);align-self:center;white-space:nowrap}.h{margin-top:4px}',
  ],
})
export class BcTrafficHeatComponent {
  readonly grid = input.required<number[][]>();
  readonly days = input.required<string[]>();
  readonly hours = input.required<number[]>();
}

/** Schematic opportunity heatmap with ranked markers. */
@Component({
  selector: 'bc-opportunity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="g" [style.grid-template-columns]="'repeat(' + width() + ', minmax(0, 1fr))'">
        @for (row of grid(); track $index) {
          @for (v of row; track $index) {
            <i [style.background]="'color-mix(in srgb, #22c55e ' + v + '%, #0f2a1d)'" [style.opacity]="0.35 + v / 160"></i>
          }
        }
      </div>
      @for (m of markers(); track m.slug) {
        <button type="button" class="m" [style.left.%]="m.x * 100" [style.top.%]="m.y * 100" (click)="pick.emit(m.slug)" [attr.aria-label]="'#' + m.rank + ' ' + m.name">
          <b>{{ m.rank }}</b><span>{{ m.name }}</span>
        </button>
      }
    </div>
  `,
  styles: [
    `:host{display:block}.wrap{position:relative}.g{display:grid;gap:3px}.g i{display:block;aspect-ratio:1;border-radius:3px}
     .m{position:absolute;transform:translate(-12px,-50%);display:flex;align-items:center;gap:5px;padding:0;border:0;background:none;color:#fff;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;line-height:1}
     .m b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#0b1426;border:2px solid #fff;font-size:11px}
     .m span{padding:2px 7px;border-radius:999px;background:rgba(11,20,38,.78);white-space:nowrap}`,
  ],
})
export class BcOpportunityComponent {
  readonly grid = input.required<number[][]>();
  readonly width = input.required<number>();
  readonly markers = input.required<HeatmapMarker[]>();
  readonly pick = output<string>();
}

export interface RadarSeries {
  name: string;
  color: string;
  values: number[];
}

/** Radar chart for 2-3 locations over the same axes (0-100). */
@Component({
  selector: 'bc-radar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="-60 -20 400 320" role="img" aria-label="Biểu đồ radar so sánh">
      @for (r of [0.25, 0.5, 0.75, 1]; track r) {
        <polygon [attr.points]="ring(r)" fill="none" stroke="var(--bc-line)" />
      }
      @for (a of axisPoints(); track a.label) {
        <line x1="140" y1="140" [attr.x2]="a.x" [attr.y2]="a.y" stroke="var(--bc-line)" />
        <text [attr.x]="a.lx" [attr.y]="a.ly" [attr.text-anchor]="a.anchor" dominant-baseline="middle" font-size="11" fill="var(--bc-dim)">{{ a.label }}</text>
      }
      @for (s of shapes(); track s.name) {
        <polygon [attr.points]="s.points" [attr.fill]="s.color" fill-opacity="0.14" [attr.stroke]="s.color" stroke-width="2" />
      }
    </svg>
  `,
  styles: [':host{display:block}svg{width:100%;height:auto;max-height:320px}text{font-family:inherit}'],
})
export class BcRadarComponent {
  readonly axes = input.required<string[]>();
  readonly series = input.required<RadarSeries[]>();
  private readonly R = 110;
  private point(i: number, r: number): [number, number] {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / this.axes().length;
    return [140 + Math.cos(a) * r, 140 + Math.sin(a) * r];
  }
  protected ring(r: number): string {
    return this.axes()
      .map((_, i) => this.point(i, this.R * r).join(','))
      .join(' ');
  }
  protected readonly axisPoints = computed(() =>
    this.axes().map((label, i) => {
      const [x, y] = this.point(i, this.R);
      const [lx, ly] = this.point(i, this.R + 18);
      const anchor = Math.abs(lx - 140) < 8 ? 'middle' : lx > 140 ? 'start' : 'end';
      return { label, x, y, lx, ly, anchor };
    }),
  );
  protected readonly shapes = computed(() =>
    this.series().map((s) => ({ name: s.name, color: s.color, points: s.values.map((v, i) => this.point(i, (this.R * v) / 100).join(',')).join(' ') })),
  );
}

export const SERIES_COLORS = ['#2563eb', '#16a34a', '#f59e0b'];

export const BC_CHARTS = [BcRingComponent, BcBarComponent, BcRevenueChartComponent, BcTrafficHeatComponent, BcOpportunityComponent, BcRadarComponent];
