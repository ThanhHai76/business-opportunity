import { landmarkIcon } from './landmark-icons';
import { LANDMARK_INFO, OFFICIAL_SITE } from './landmark-info';
import { TOURS, Tour, tourLegs, tourMapsUrl } from './landmark-tours';
import { TmContext } from './tm-context';
import { EN_TOURS } from './tm-i18n';

/**
 * Walking tours: tour chips, the open tour's stops with leg distances, a Google Maps walking route and links
 * to the official sites. `onShow(stops)` draws the tour on the real map ([] hides it).
 */
export class TmTours {
  private tourId: string | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: TmContext,
    private readonly onShow: (stops: string[]) => void,
  ) {}

  private q<T extends Element = HTMLElement>(selector: string): T | null {
    return this.root.querySelector<T>(selector);
  }

  private text(tour: Tour): { name: string; description: string } {
    return this.ctx.lang() === 'en' ? (EN_TOURS[tour.id] ?? tour) : tour;
  }

  /** Tour chips (and the open tour's detail) in the current language. */
  refresh(): void {
    const chips = this.q('#tm-tourChips');
    if (!chips) return;
    chips.replaceChildren();
    TOURS.forEach((tour) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tm-lm tm-tour-chip';
      b.dataset['tour'] = tour.id;
      b.textContent = `${this.text(tour).name} · ${tour.stops.length} ${this.ctx.tr('điểm', 'stops')}`;
      const on = this.tourId === tour.id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', () => this.select(this.tourId === tour.id ? null : tour));
      chips.appendChild(b);
    });
    const open = TOURS.find((t) => t.id === this.tourId);
    if (open) this.q('#tm-tourDetail')?.replaceChildren(...this.tourDetail(open));
  }

  /** Shows a tour (or hides it with null): detail panel, line on the real map, first stop selected. */
  private select(tour: Tour | null): void {
    this.tourId = tour?.id ?? null;
    Array.from(this.root.querySelectorAll<HTMLElement>('.tm-tour-chip')).forEach((c) => {
      const on = c.dataset['tour'] === this.tourId;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', String(on));
    });
    const detail = this.q('#tm-tourDetail');
    if (detail) {
      detail.hidden = !tour;
      if (tour) detail.replaceChildren(...this.tourDetail(tour));
    }
    this.onShow(tour?.stops ?? []);
    if (tour) this.ctx.select(tour.stops[0]);
  }

  private tourDetail(tour: Tour): Node[] {
    const { legsKm, totalKm, walkMinutes } = tourLegs(tour);
    const desc = document.createElement('p');
    desc.className = 'tm-tour-desc';
    desc.textContent = this.text(tour).description;
    const stats = document.createElement('p');
    stats.className = 'tm-tour-stats';
    stats.textContent = `≈ ${totalKm.toFixed(1)} km · ≈ ${walkMinutes} ${this.ctx.tr('phút đi bộ (ước tính, chưa gồm thời gian tham quan)', 'min walking (estimate, not counting time at each stop)')}`;

    const list = document.createElement('ol');
    list.className = 'tm-tour-stops';
    tour.stops.forEach((key, i) => {
      const li = document.createElement('li');
      const stop = document.createElement('button');
      stop.type = 'button';
      stop.className = 'tm-tour-stop';
      stop.dataset['landmark'] = key;
      stop.innerHTML = landmarkIcon(key);
      stop.append(this.ctx.name(key));
      stop.addEventListener('click', () => this.ctx.select(key));
      li.appendChild(stop);
      if (i < legsKm.length) {
        const leg = document.createElement('span');
        leg.className = 'tm-tour-leg';
        leg.textContent = `↓ ≈ ${legsKm[i] < 1 ? `${Math.round(legsKm[i] * 100) * 10} m` : `${legsKm[i].toFixed(1)} km`}`;
        li.appendChild(leg);
      }
      list.appendChild(li);
    });

    const maps = this.ctx.link(this.ctx.tr('Mở lộ trình đi bộ trên Google Maps ↗', 'Open the walking route in Google Maps ↗'), tourMapsUrl(tour));
    maps.className = 'tm-btn tm-btn-ghost tm-tour-maps';

    const official = tour.stops
      .flatMap((key) => (LANDMARK_INFO[key]?.sources ?? []).filter((s) => s.site === OFFICIAL_SITE).map((s) => ({ key, s })));
    const note = document.createElement('p');
    note.className = 'tm-tour-note';
    note.append(
      this.ctx.tr(
        'Đường nét đứt nối thẳng các điểm; quãng đường là ước tính. Giờ mở cửa và giá vé thay đổi theo thời gian — hãy kiểm tra trước khi đi',
        'The dashed line joins the stops in straight lines; distances are estimates. Opening hours and ticket prices change — check before you go',
      ),
    );
    if (official.length) {
      note.append(' (');
      official.forEach(({ key, s }, i) => {
        if (i) note.append(', ');
        note.append(this.ctx.link(this.ctx.name(key), s.url));
      });
      note.append(')');
    }
    note.append('.');
    return [desc, stats, list, maps, note];
  }
}
