import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Hand-drawn 24x24 stroke icons (single path each) so the feature ships without an icon font. */
const ICONS: Record<string, string> = {
  map: 'M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4z M9 4v13 M15 7v13',
  scale: 'M12 3v18 M6 21h12 M4 7h16 M4 7l-3 7a3 3 0 0 0 6 0L4 7z M20 7l-3 7a3 3 0 0 0 6 0l-3-7z',
  sparkles:
    'M11 3l1.9 5.6L18.5 10.5l-5.6 1.9L11 18l-1.9-5.6L3.5 10.5l5.6-1.9L11 3z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  bookmark: 'M6 3h12v18l-6-4-6 4V3z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-7 8-7s8 3 8 7',
  home: 'M3 11l9-8 9 8 M5 10v10h14V10 M10 20v-6h4v6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-4.3-4.3',
  sliders: 'M4 6h9 M17 6h3 M4 12h3 M11 12h9 M4 18h11 M19 18h1 M15 4v4 M7 10v4 M17 16v4',
  x: 'M6 6l12 12 M18 6L6 18',
  plane: 'M21 15.5v-2l-8-5V4a1.5 1.5 0 0 0-3 0v4.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5l8 2.5z',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z M4 7.5l8 4.5 8-4.5 M12 12v9',
  box: 'M3 8l9-5 9 5v8l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v8',
  play: 'M7 4.5v15l12-7.5-12-7.5z',
  pause: 'M8 5v14 M16 5v14',
  expand: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01',
  building: 'M4 21V6l8-3v18 M12 9l8 3v9 M8 9h.01 M8 13h.01 M8 17h.01 M16 15h.01 M16 18h.01',
  message: 'M4 5h16v11H9l-5 4V5z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  coffee: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z M17 10h1.5a2.5 2.5 0 0 1 0 5H17 M8 3.5v2.5 M12 3.5v2.5',
  utensils: 'M6 3v8a2 2 0 0 0 2 2v8 M10 3v8a2 2 0 0 1-2 2 M8 3v5 M17 21V3c-2 1.5-3 4-3 7v4h3',
  dumbbell: 'M6.5 6.5v11 M17.5 6.5v11 M3.5 9v6 M20.5 9v6 M6.5 12h11',
  pill: 'M10.5 20.5a4.95 4.95 0 0 1-7-7l6-6a4.95 4.95 0 0 1 7 7l-6 6z M8.5 8.5l7 7',
  store: 'M3 9l1.5-5h15L21 9 M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M5 11v10h14V11 M10 21v-5h4v5',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z M14 3v5h5 M9 13h6 M9 17h6',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  send: 'M4 12l16-8-6 16-2.5-6.5L4 12z',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M3 20h18',
  filter: 'M4 5h16l-6 8v5l-4 2v-7L4 5z',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6l1-8z',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M6 15l6-6 6 6',
  'arrow-right': 'M5 12h14 M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5 M11 6l-6 6 6 6',
  train:
    'M7 3h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2z M5 11h14 M8 21l2-3 M16 21l-2-3 M8.5 14.5h.01 M15.5 14.5h.01',
  graduation: 'M2 9l10-5 10 5-10 5L2 9z M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5 M22 9v6',
  health: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M12 8v8 M8 12h8',
  tree: 'M12 22v-5 M12 17c-4 0-6-2.5-6-5 0-2 1.3-3.5 3-4 0-2.2 1.3-4 3-4s3 1.8 3 4c1.7.5 3 2 3 4 0 2.5-2 5-6 5z',
  bag: 'M5 8h14l-1 12H6L5 8z M9 8V6a3 3 0 0 1 6 0v2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z M9 12l2 2 4-4',
  leaf: 'M20 4C10 4 4 9 4 15a5 5 0 0 0 5 5c6 0 11-6 11-16z M4 20c3-6 7-9 12-11',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M3 7l2-3h12 M16 14h3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 3l10 18H2L12 3z M12 10v5 M12 18h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01',
  layers: 'M12 3l9 5-9 5-9-5 9-5z M3 13l9 5 9-5',
  pin: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  plus: 'M12 5v14 M5 12h14',
  refresh: 'M4 12a8 8 0 0 1 14-5.3L20 9 M20 4v5h-5 M20 12a8 8 0 0 1-14 5.3L4 15 M4 20v-5h5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18.5 14.5c2 .7 3 2.6 3 5.5',
};

@Component({
  selector: 'ls-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: [':host{display:inline-flex;flex:none;line-height:0}'],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
  protected readonly path = computed(() => ICONS[this.name()] ?? '');
}
