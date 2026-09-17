import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapComponent } from './components/map/map.component';
import { AreaPanelComponent } from './components/area-panel/area-panel.component';
import { LegendComponent } from './components/legend/legend.component';
import { AreaService } from './services/area.service';
import { City } from './models/area.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MapComponent, AreaPanelComponent, LegendComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  cities: City[] = [
    { id: 'hcm', label: 'TP. Hồ Chí Minh' },
    { id: 'hanoi', label: 'Hà Nội' },
  ];
  selectedCity = 'hcm';
  selectedSlug: string | null = null;

  constructor(private areaService: AreaService) {}

  ngOnInit(): void {
    // Fetch from the API rather than trusting the hardcoded fallback above,
    // so the UI stays correct if the backend ever adds/renames a city.
    this.areaService.getCities().subscribe({
      next: (cities) => {
        if (cities.length) this.cities = cities;
      },
      error: () => {
        /* keep the fallback list above if the backend isn't reachable yet */
      },
    });
  }

  onCitySelected(cityId: string): void {
    if (cityId === this.selectedCity) return;
    this.selectedCity = cityId;
    this.selectedSlug = null;
  }

  onAreaSelected(slug: string): void {
    this.selectedSlug = slug;
  }
}
