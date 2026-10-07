import type { StyleSpecification } from 'maplibre-gl';
import { Basemap } from '../pi.models';

type Theme = 'light' | 'dark';

const OPENFREEMAP: Record<Theme, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
/** Fonts for our own labels (ward names); the same server as the vector basemap. */
export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const LABEL_FONT = ['Noto Sans Regular'];

const plain = (theme: Theme): StyleSpecification => ({
  version: 8,
  glyphs: GLYPHS,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': theme === 'dark' ? '#0e1826' : '#e7edf3' } }],
});

const vectorStyles = new Map<Theme, Promise<StyleSpecification>>();
function vector(theme: Theme): Promise<StyleSpecification> {
  let style = vectorStyles.get(theme);
  if (!style) {
    // A hung download must not keep the map from appearing: give up after 8 s and use a plain background.
    style = fetch(OPENFREEMAP[theme], { signal: AbortSignal.timeout(8000) })
      .then((res) => (res.ok ? (res.json() as Promise<StyleSpecification>) : Promise.reject(new Error(`HTTP ${res.status}`))))
      .catch(() => {
        vectorStyles.delete(theme);
        return plain(theme);
      });
    vectorStyles.set(theme, style);
  }
  return style;
}

function satellite(theme: Theme): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      satellite: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 18,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': theme === 'dark' ? '#0e1826' : '#dfe6ee' } },
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        paint:
          theme === 'dark'
            ? { 'raster-brightness-max': 0.62, 'raster-saturation': -0.35, 'raster-contrast': 0.05 }
            : { 'raster-brightness-max': 0.95, 'raster-saturation': -0.15 },
      },
    ],
  };
}

/**
 * The basemap as a full MapLibre style: OpenFreeMap vector tiles (default, no key) or Esri imagery. Overlays are
 * added after `style.load`, so a slow or failing tile server never keeps the data layers from showing.
 */
export async function baseStyle(basemap: Basemap, theme: Theme): Promise<StyleSpecification> {
  const style = basemap === 'satellite' ? satellite(theme) : await vector(theme);
  // A fresh copy: MapLibre may keep references to the object it is given.
  return { ...style, glyphs: style.glyphs ?? GLYPHS, layers: [...style.layers] };
}

/** Id of the base map's first label layer: data fills go below it so street and place names stay readable. */
export function firstSymbolLayer(style: StyleSpecification): string | undefined {
  return style.layers.find((l) => l.type === 'symbol')?.id;
}

export interface PiPalette {
  bg: string;
  cyan: string;
  violet: string;
  green: string;
  amber: string;
  yellow: string;
  red: string;
  redSoft: string;
  park: string;
  dim: string;
  ink: string;
  ink2: string;
  halo: string;
  outline: string;
  projectDot: string;
}

/** Overlay colours; kept in sync with the --pi-* tokens in pi.css (MapLibre needs literal colours). */
export function overlayPalette(theme: Theme): PiPalette {
  return theme === 'dark'
    ? {
        bg: '#0a101c',
        cyan: '#3cc8e8',
        violet: '#9b7bff',
        green: '#3dd68c',
        amber: '#f5a044',
        yellow: '#e8d25a',
        red: '#f0605a',
        redSoft: '#f0a8a4',
        park: '#2e8b5e',
        dim: '#56637a',
        ink: '#e8eef7',
        ink2: '#c9d3e3',
        halo: 'rgba(8,13,24,0.9)',
        outline: 'rgba(255,255,255,0.28)',
        projectDot: '#ffffff',
      }
    : {
        bg: '#ffffff',
        cyan: '#0e93b3',
        violet: '#7556f0',
        green: '#17a364',
        amber: '#d4801f',
        yellow: '#b99a12',
        red: '#d9433d',
        redSoft: '#d9433d',
        park: '#2e8b5e',
        dim: '#8a97ab',
        ink: '#152238',
        ink2: '#2c3b55',
        halo: 'rgba(255,255,255,0.92)',
        outline: 'rgba(10,20,38,0.35)',
        projectDot: '#152238',
      };
}
