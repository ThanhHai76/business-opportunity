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
  }

  private loadAreas(): void {
    this.selectedLayer = undefined;
    if (this.geoLayer) {
      this.geoLayer.remove();
    }
    this.markerLayer.clearLayers();

    this.areaService.getAreas(this.city).subscribe((collection) => {
      this.geoLayer = L.geoJSON(collection as unknown as GeoJSON.GeoJsonObject, {
        style: (feature) => this.styleFor(feature as unknown as AreaFeature),
        onEachFeature: (feature, layer) => this.bindFeature(feature as unknown as AreaFeature, layer),
      }).addTo(this.map);

      // Emoji marker at each area's centroid showing its #1 recommended business type
      collection.features.forEach((f) => {
        const icon = L.divIcon({
          className: 'area-emoji-icon',
          html: `<span>${f.properties.top_opportunity.icon}</span>`,
          iconSize: [30, 30],
        });
        L.marker([f.properties.lat, f.properties.lng], { icon, interactive: false }).addTo(this.markerLayer);
      });

      if (this.geoLayer.getBounds().isValid()) {
        this.map.fitBounds(this.geoLayer.getBounds(), { padding: [24, 24] });
      }
    });
  }

  private styleFor(feature: AreaFeature): L.PathOptions {
    return {
      color: '#1f2937',
      weight: 1,
      fillColor: scoreColor(feature.properties.top_opportunity.opportunity_score),
      fillOpacity: 0.55,
    };
  }

  private bindFeature(feature: AreaFeature, layer: L.Layer): void {
    const p = feature.properties;
    layer.bindTooltip(
      `<strong>${p.name}</strong><br/>${p.top_opportunity.icon} ${p.top_opportunity.name} — ${p.top_opportunity.opportunity_score}/100`,
      { sticky: true, direction: 'top' }
    );
    layer.on('click', () => {
      this.highlight(layer as L.Path);
      this.areaSelected.emit(p.slug);
    });
    layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 2, fillOpacity: 0.75 }));
    layer.on('mouseout', () => {
      if (layer !== this.selectedLayer) {
        this.geoLayer?.resetStyle(layer as L.Path);
      }
    });
  }

  private highlight(layer: L.Path): void {
    if (this.selectedLayer) {
      this.geoLayer?.resetStyle(this.selectedLayer);
    }
    layer.setStyle({ weight: 3, color: '#111827', fillOpacity: 0.8 });
    layer.bringToFront();
    this.selectedLayer = layer;
  }
}
