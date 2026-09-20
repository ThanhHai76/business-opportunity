import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { AreaService } from '../../services/area.service';
import { AreaFeature } from '../../models/area.model';
import { scoreColor } from '../../utils/color-scale';
import { roundCollection } from '../../utils/rounded-polygon';

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Below this zoom the place-name labels are hidden so the cells do not crowd each other. */
const LABEL_MIN_ZOOM = 10;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
})
export class MapComponent implements AfterViewInit, OnChanges {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @Input() city = 'hcm';
  @Output() areaSelected = new EventEmitter<string>();

  private map!: L.Map;
  private mapReady = false;
  private geoLayer?: L.GeoJSON;
  private markerLayer = L.layerGroup();
  private selectedLayer?: L.Path;

  constructor(private areaService: AreaService) {}

  ngAfterViewInit(): void {
    this.initMap();
    this.mapReady = true;
    this.loadAreas();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['city'] && !changes['city'].firstChange && this.mapReady) {
      this.loadAreas();
    }
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [10.795, 106.72],
      zoom: 11,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.markerLayer.addTo(this.map);

    const container = this.map.getContainer();
    const syncLabels = (): void => {
      container.classList.toggle('labels-off', this.map.getZoom() < LABEL_MIN_ZOOM);
    };
    this.map.on('zoomend', syncLabels);
    syncLabels();
  }

  private loadAreas(): void {
    this.selectedLayer = undefined;
    if (this.geoLayer) {
      this.geoLayer.remove();
    }
    this.markerLayer.clearLayers();

    this.areaService.getAreas(this.city).subscribe((collection) => {
      // Rounded-corner cells; colour, hover and selected states live in map.component.css (.area-cell).
      const rounded = roundCollection(collection as unknown as GeoJSON.FeatureCollection);
      this.geoLayer = L.geoJSON(rounded, {
        style: (feature) => this.styleFor(feature as unknown as AreaFeature),
        onEachFeature: (feature, layer) => this.bindFeature(feature as unknown as AreaFeature, layer),
      }).addTo(this.map);

      // Hand each cell its score colour as a CSS variable so the stroke can adapt to light/dark themes.
      this.geoLayer.eachLayer((layer) => {
        const feature = (layer as L.GeoJSON).feature as unknown as AreaFeature;
        (layer as L.Path).getElement()?.setAttribute('style', `--cell:${scoreColor(feature.properties.top_opportunity.opportunity_score)}`);
      });

      // Badge at each area's centroid: the #1 recommended business type, with the place name underneath.
      collection.features.forEach((f) => {
        const p = f.properties;
        const color = scoreColor(p.top_opportunity.opportunity_score);
        const icon = L.divIcon({
          className: 'area-marker',
          html:
            `<div class="area-chip" style="--cell:${color}"><span>${p.top_opportunity.icon}</span></div>` +
            `<div class="area-name">${escapeHtml(p.name)}</div>`,
          iconSize: [132, 58],
          iconAnchor: [66, 17],
        });
        L.marker([p.lat, p.lng], { icon, interactive: false }).addTo(this.markerLayer);
      });

      if (this.geoLayer.getBounds().isValid()) {
        this.map.fitBounds(this.geoLayer.getBounds(), { padding: [24, 24] });
      }
    });
  }

  private styleFor(feature: AreaFeature): L.PolylineOptions {
    // Fallback values only — the stylesheet overrides them (see .area-cell) to follow the theme.
    return {
      className: 'area-cell',
      color: '#1f2937',
      weight: 2,
      fillColor: scoreColor(feature.properties.top_opportunity.opportunity_score),
      fillOpacity: 0.4,
      lineJoin: 'round',
      smoothFactor: 0, // keep every point of the rounded corners
    };
  }

  private bindFeature(feature: AreaFeature, layer: L.Layer): void {
    const p = feature.properties;
    const top = p.top_opportunity;
    layer.bindTooltip(
      `<strong>${escapeHtml(p.name)}</strong>` +
        `<div class="area-tip"><i style="background:${scoreColor(top.opportunity_score)}"></i>` +
        `<span>${top.icon} ${escapeHtml(top.name)} — <b>${top.opportunity_score}</b>/100</span></div>`,
      { sticky: true, direction: 'top', className: 'area-tooltip', offset: [0, -6] }
    );
    layer.on('click', () => {
      this.highlight(layer as L.Path);
      this.areaSelected.emit(p.slug);
    });
  }

  private highlight(layer: L.Path): void {
    this.selectedLayer?.getElement()?.classList.remove('is-selected');
    layer.getElement()?.classList.add('is-selected');
    layer.bringToFront();
    this.selectedLayer = layer;
  }
}
