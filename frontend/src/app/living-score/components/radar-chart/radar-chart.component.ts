import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface RadarAxis {
  key: string;
  label: string;
}

export interface RadarSeries {
  name: string;
  color: string;
  values: number[];
}

interface Point {
  x: number;
  y: number;
}

/** Dependency-free SVG radar chart (0-100 scale) used by the Compare page. */
@Component({
  selector: 'ls-radar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="viewBox" role="img" [attr.aria-label]="ariaLabel()">
      @for (ring of rings(); track $index) {
        <polygon class="ring" [attr.points]="ring" />
      }
      @for (spoke of spokes(); track $index) {
        <line class="spoke" [attr.x1]="centre" [attr.y1]="centre" [attr.x2]="spoke.x" [attr.y2]="spoke.y" />
      }
      @for (poly of polygons(); track poly.name) {
        <polygon [attr.points]="poly.points" [attr.fill]="poly.color" fill-opacity="0.16" [attr.stroke]="poly.color" stroke-width="2" stroke-linejoin="round" />
        @for (dot of poly.dots; track $index) {
          <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="3" [attr.fill]="poly.color" />
        }
      }
      @for (label of labels(); track label.text) {
        <text class="axis" [attr.x]="label.x" [attr.y]="label.y" [attr.text-anchor]="label.anchor" dominant-baseline="middle">{{ label.text }}</text>
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      svg {
        width: 100%;
        height: auto;
        max-width: 520px;
        display: block;
        margin-inline: auto;
      }
      .ring {
        fill: none;
        stroke: var(--ls-line);
        stroke-width: 1;
      }
      .spoke {
        stroke: var(--ls-line);
        stroke-width: 1;
      }
      .axis {
        fill: var(--ls-ink-dim);
        font-size: 13px;
        font-weight: 600;
        font-family: inherit;
      }
    `,
  ],
})
export class RadarChartComponent {
  protected readonly size = 340;
  protected readonly centre = this.size / 2;
  /** Extra horizontal room so long axis labels ("Không gian xanh") are never clipped. */
  protected readonly viewBox = `-70 0 ${this.size + 140} ${this.size}`;
  private readonly radius = this.size * 0.355;

  readonly axes = input.required<RadarAxis[]>();
  readonly series = input.required<RadarSeries[]>();

  protected readonly spokes = computed(() => this.axes().map((_, i) => this.point(i, 100)));

  protected readonly rings = computed(() =>
    [25, 50, 75, 100].map((level) => this.axes().map((_, i) => this.point(i, level)).map((p) => `${p.x},${p.y}`).join(' ')),
  );

  protected readonly polygons = computed(() =>
    this.series().map((s) => {
      const dots = s.values.map((v, i) => this.point(i, v));
      return { name: s.name, color: s.color, dots, points: dots.map((p) => `${p.x},${p.y}`).join(' ') };
    }),
  );

  protected readonly labels = computed(() =>
    this.axes().map((axis, i) => {
      const p = this.point(i, 100, 1.2);
      const anchor = Math.abs(p.x - this.centre) < 8 ? 'middle' : p.x > this.centre ? 'start' : 'end';
      return { text: axis.label, x: p.x, y: p.y, anchor };
    }),
  );

  protected readonly ariaLabel = computed(
    () => 'Biểu đồ radar so sánh: ' + this.series().map((s) => s.name).join(', '),
  );

  private point(index: number, value: number, scale = 1): Point {
    const count = Math.max(1, this.axes().length);
    const angle = (2 * Math.PI * index) / count - Math.PI / 2;
    const r = (this.radius * scale * value) / 100;
    return { x: this.centre + r * Math.cos(angle), y: this.centre + r * Math.sin(angle) };
  }
}
