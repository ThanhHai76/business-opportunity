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
 * The geographic version of the Time Machine map: an OpenStreetMap base with one marker per landmark.
 * MapLibre is only downloaded the first time the real map is shown.
 */
export class TmRealMap {
  private map?: maplibregl.Map;
  private ready?: Promise<void>;
  private readonly markers = new Map<string, HTMLElement>();
  private theme: Theme;
  private selected = '';
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
    this.map?.setStyle(STYLE_URL[theme]);
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
  }
}
