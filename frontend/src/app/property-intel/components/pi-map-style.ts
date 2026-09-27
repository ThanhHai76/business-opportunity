import type { RasterLayerSpecification } from 'maplibre-gl';
import { Basemap } from '../pi.models';

type Theme = 'light' | 'dark';

export interface BasemapSpec {
  tiles: string[];
  maxzoom: number;
  attribution: string;
  paint: RasterLayerSpecification['paint'];
}

const OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Raster basemaps for the Basemap switch. The dark theme dims imagery so the overlays stay readable. */
export const BASEMAPS: Record<Basemap, (theme: Theme) => BasemapSpec> = {
  satellite: (theme) => ({
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 18,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    paint:
      theme === 'dark'
        ? { 'raster-brightness-max': 0.62, 'raster-saturation': -0.35, 'raster-contrast': 0.05 }
        : { 'raster-brightness-max': 0.95, 'raster-saturation': -0.15 },
  }),
  dark: (theme) => ({
    tiles: ['a', 'b', 'c'].map((s) => `https://${s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}.png`),
    maxzoom: 19,
    attribution: `${OSM} © <a href="https://carto.com/attributions">CARTO</a>`,
    paint: {},
  }),
  terrain: (theme) => ({
    tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
    maxzoom: 17,
    attribution: `${OSM}, SRTM · © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
    paint: theme === 'dark' ? { 'raster-brightness-max': 0.55, 'raster-saturation': -0.5 } : { 'raster-saturation': -0.2 },
  }),
};

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
  ink2: string;
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
        ink2: '#c9d3e3',
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
        ink2: '#2c3b55',
        outline: 'rgba(10,20,38,0.35)',
        projectDot: '#152238',
      };
}
