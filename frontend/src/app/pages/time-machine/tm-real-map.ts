import type * as maplibregl from 'maplibre-gl';

export interface RealMapItem {
  key: string;
  name: string;
  lngLat: [number, number];
  /** Complete <svg> markup (trusted, from landmark-icons.ts). */
  icon: string;
}

type Theme = 'light' | 'dark';

/**
 * OpenFreeMap vector styles (OpenStreetMap data, no API key; attribution comes with the tiles).
 * tile.openstreetmap.org refused connections from our test network, and CARTO basemaps now require an API key.
 * The warm "old print" tint is a CSS filter on the map canvas (see .tm-real-map in the CSS).
 */
const STYLE_URL: Record<Theme, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
/** Hoàn Kiếm, Ba Đình and the Long Biên bridge — every landmark fits. */
const CENTRE_BOUNDS: maplibregl.LngLatBoundsLike = [
  [105.829, 21.021],
  [105.866, 21.05],
];

/**
 * The geographic version of the Time Machine map: an OpenFreeMap base with one marker per landmark, and
 * optionally a walking tour drawn through some of them. MapLibre is only downloaded the first time the map is shown.
 */
export class TmRealMap {
  private map?: maplibregl.Map;
  private ready?: Promise<void>;
  private readonly markers = new Map<string, HTMLElement>();
  private theme: Theme;
  private selected = '';
  /** Landmark keys of the tour on show, in walking order (empty = none). */
  private tour: string[] = [];
  private destroyed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly items: RealMapItem[],
    private readonly onSelect: (key: string) => void,
    theme: Theme,
  ) {
    this.theme = theme;
  }

  /** Creates the map on first call, then keeps it sized to its (possibly just un-hidden) container. */
  show(): Promise<void> {
    this.ready ??= this.init();
    return this.ready.then(() => {
      this.map?.resize();
    });
  }

  select(key: string): void {
    this.selected = key;
    this.markers.forEach((el, k) => {
      const on = k === key;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', String(on));
      el.style.zIndex = on ? '3' : '';
    });
    const item = this.items.find((i) => i.key === key);
    if (this.map && item && !this.map.getBounds().contains(item.lngLat)) {
      this.map.easeTo({ center: item.lngLat, duration: 600 });
    }
  }

  setTheme(theme: Theme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    // Markers are DOM elements, so swapping the style leaves them in place.
    // diff: false → a full reload that fires 'style.load', where the tour line is added back.
    this.map?.setStyle(STYLE_URL[theme], { diff: false });
  }

  /** New display names (e.g. after a language switch): marker labels and accessible names. */
  setNames(names: Record<string, string>): void {
    for (const item of this.items) if (names[item.key]) item.name = names[item.key];
    this.markers.forEach((el, key) => {
      const name = names[key];
      if (!name) return;
      el.setAttribute('aria-label', name);
      const tag = el.querySelector('.tm-mpin-tag');
      if (tag) tag.textContent = name;
    });
  }

  /** Draws a tour (landmark keys in order) as a dashed line with numbered stops; [] clears it. */
  showTour(keys: string[]): void {
    this.tour = keys;
    this.markers.forEach((el, key) => {
      const order = keys.indexOf(key);
      if (order >= 0) el.dataset['order'] = String(order + 1);
      else delete el.dataset['order'];
      el.classList.toggle('off-tour', keys.length > 0 && order < 0);
    });
    this.applyTour();
    const coords = this.tourCoords();
    if (this.map && coords.length > 1) {
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      this.map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 16, duration: 700 },
      );
    }
  }

  private tourCoords(): [number, number][] {
    return this.tour.map((key) => this.items.find((i) => i.key === key)?.lngLat).filter((c): c is [number, number] => !!c);
  }

  /**
   * (Re)creates the tour line; runs again on every 'style.load', since a style swap drops custom layers.
   * isStyleLoaded() stays false while a vector style's sprites/glyphs load, so rely on addSource throwing instead.
   */
  private applyTour(): void {
    const map = this.map;
    if (!map) return;
    const data: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: this.tourCoords() } };
    try {
      const source = map.getSource('tm-tour') as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else map.addSource('tm-tour', { type: 'geojson', data });
      if (!map.getLayer('tm-tour-line')) {
        map.addLayer({
          id: 'tm-tour-line',
          type: 'line',
          source: 'tm-tour',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': this.theme === 'dark' ? '#e4c98a' : '#8a6420', 'line-width': 3, 'line-dasharray': [1.5, 1.5], 'line-opacity': 0.9 },
        });
      }
    } catch {
      // Style still loading — the 'style.load' listener adds the line once it is ready.
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.map?.remove();
    this.map = undefined;
  }

  private async init(): Promise<void> {
    const ml = await import('maplibre-gl');
    if (this.destroyed) return;
    const map = new ml.Map({
      container: this.host,
      style: STYLE_URL[this.theme],
      bounds: CENTRE_BOUNDS,
      fitBoundsOptions: { padding: 28 },
      minZoom: 11,
      maxZoom: 18,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
    map.on('style.load', () => this.applyTour());

    for (const item of this.items) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tm-mpin';
      el.dataset['landmark'] = item.key;
      el.setAttribute('aria-label', item.name);
      el.innerHTML = item.icon;
      const tag = document.createElement('span');
      tag.className = 'tm-mpin-tag';
      tag.textContent = item.name;
      el.appendChild(tag);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelect(item.key);
      });
      new ml.Marker({ element: el, anchor: 'center' }).setLngLat(item.lngLat).addTo(map);
      this.markers.set(item.key, el);
    }
    this.map = map;
    if (this.selected) this.select(this.selected);
    if (this.tour.length) this.showTour(this.tour);
  }
}
