import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface RadarSeries {
  name: string;
  /** One value per axis, 0-100. */
  values: number[];
}

/** Colours of the 2–3 compared wards (kept apart from the score scale of the map). */
export const RADAR_COLORS = ['#2563eb', '#db2777', '#d97706'];

const SIZE = 280;
const R = 92;
const C = SIZE / 2;

/** Radar chart of 2–3 wards over the same 0-100 axes (relative between all wards of the map). */
@Component({
  selector: 'op-radar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="radar">
      <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" role="img" [attr.aria-label]="label()">
        @for (ring of rings; track ring) {
          <polygon [attr.points]="ringPoints(ring)" class="radar__ring" />
        }
        @for (a of geometry().axes; track a.label) {
          <line [attr.x1]="c" [attr.y1]="c" [attr.x2]="a.x" [attr.y2]="a.y" class="radar__axis" />
          <text [attr.x]="a.lx" [attr.y]="a.ly" [attr.text-anchor]="a.anchor" dominant-baseline="middle" class="radar__label">{{ a.label }}</text>
        }
        @for (s of geometry().shapes; track s.name; let i = $index) {
          <polygon [attr.points]="s.points" class="radar__shape" [style.fill]="color(i)" [style.stroke]="color(i)" />
        }
      </svg>
      <figcaption class="radar__legend">
        @for (s of series(); track s.name; let i = $index) {
          <span><i [style.background]="color(i)"></i>{{ s.name }}</span>
        }
      </figcaption>
    </figure>
  `,
  styles: [
    `
      .radar {
        margin: 0;
        display: grid;
        justify-items: center;
        gap: 6px;
      }
      svg {
        width: min(100%, 340px);
        height: auto;
        overflow: visible;
      }
      .radar__ring {
        fill: none;
        stroke: var(--op-line);
      }
      .radar__axis {
        stroke: var(--op-line);
      }
      .radar__label {
        font-size: 10.5px;
        fill: var(--op-ink-dim);
      }
      .radar__shape {
        fill-opacity: 0.14;
        stroke-width: 2;
        stroke-linejoin: round;
      }
      .radar__legend {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
        font-size: 12px;
        font-weight: 700;
      }
      .radar__legend i {
        display: inline-block;
        width: 10px;
        height: 10px;
        margin-right: 5px;
        border-radius: 3px;
      }
    `,
  ],
})
export class OpRadarComponent {
  readonly axes = input.required<string[]>();
  readonly series = input.required<RadarSeries[]>();
  readonly label = input('');

  protected readonly size = SIZE;
  protected readonly c = C;
  protected readonly rings = [25, 50, 75, 100];

  private point(i: number, n: number, v: number): [number, number] {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const r = (Math.max(0, Math.min(100, v)) / 100) * R;
    return [Math.round((C + r * Math.cos(angle)) * 10) / 10, Math.round((C + r * Math.sin(angle)) * 10) / 10];
  }

  protected ringPoints(v: number): string {
    const n = this.axes().length;
    return Array.from({ length: n }, (_, i) => this.point(i, n, v).join(',')).join(' ');
  }

  protected readonly geometry = computed(() => {
    const labels = this.axes();
    const n = labels.length;
    const axes = labels.map((label, i) => {
      const [x, y] = this.point(i, n, 100);
      const [lx, ly] = this.point(i, n, 122);
      const anchor = Math.abs(lx - C) < 8 ? 'middle' : lx > C ? 'start' : 'end';
      return { label, x, y, lx, ly, anchor };
    });
    const shapes = this.series().map((s) => ({ name: s.name, points: s.values.map((v, i) => this.point(i, n, v).join(',')).join(' ') }));
    return { axes, shapes };
  });

  protected color(i: number): string {
    return RADAR_COLORS[i % RADAR_COLORS.length];
  }
}
